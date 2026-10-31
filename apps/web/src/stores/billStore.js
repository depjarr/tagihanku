import { defineStore } from 'pinia'
import { billsApi } from '../api/bills'
import { myBills } from '../composables/useMyBills'

export const useBillStore = defineStore('bill', {
  state: () => ({ bill: null, isMine: false, loading: false, error: '' }),

  actions: {
    /** Jalankan panggilan API yang mengembalikan tagihan terbaru, lalu simpan ke state. */
    async mutate(fn) {
      this.error = ''
      try {
        this.bill = await fn()
        return this.bill
      } catch (e) {
        this.error = e.message
        throw e
      }
    },

    async load(id) {
      this.loading = true
      this.bill = null
      try { await this.mutate(() => billsApi.get(id)); this.isMine = !!this.bill?.isMine } catch { /* error sudah di state */ } finally { this.loading = false }
    },
    async loadShared(code) {
      this.loading = true
      this.bill = null
      try { await this.mutate(() => billsApi.getShared(code)); this.isMine = !!this.bill?.isMine } catch { /* error sudah di state */ } finally { this.loading = false }
    },

    async create(payload) {
      const res = await billsApi.create(payload)
      myBills.add({ id: res.id, token: res.ownerToken, shareCode: res.shareCode })
      const { ownerToken, ...view } = res
      this.bill = view
      this.isMine = !!view.isMine
      return view
    },
    async remove(id) {
      await billsApi.remove(id)
      myBills.remove(id)
      this.bill = null
    },

    update(patch) { return this.mutate(() => billsApi.update(this.bill.id, patch)) },
    addParticipant(name) { return this.mutate(() => billsApi.addParticipant(this.bill.id, name)) },
    removeParticipant(pid) { return this.mutate(() => billsApi.removeParticipant(this.bill.id, pid)) },
    setPaid(pid, paid) { return this.mutate(() => billsApi.setPaid(this.bill.id, pid, paid)) },

    addItem(item) { return this.mutate(() => billsApi.addItem(this.bill.id, item)) },
    bulkItems(items) { return this.mutate(() => billsApi.bulkItems(this.bill.id, items)) },
    updateItem(itemId, patch) { return this.mutate(() => billsApi.updateItem(this.bill.id, itemId, patch)) },
    removeItem(itemId) { return this.mutate(() => billsApi.removeItem(this.bill.id, itemId)) },
    setAssignments(itemId, ids) { return this.mutate(() => billsApi.setAssignments(this.bill.id, itemId, ids)) },

    /** Mengembalikan hasil baca struk (bukan tagihan). */
    uploadReceipt(file) { return billsApi.uploadReceipt(this.bill.id, file) },
  },
})
