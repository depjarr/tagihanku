import { defineStore } from 'pinia'
import { authApi } from '../api/auth'
import { AUTH_KEY } from '../api/client'
import { myBills } from '../composables/useMyBills'

import { ACCENT_KEY, applyAppearance, DEFAULT_ACCENT, THEME_KEY } from '../composables/useAccent'

const DEFAULT_SETTINGS = {
  theme: 'light', accent: DEFAULT_ACCENT,
  notifyPaid: true, notifyDone: true, notifyOpened: false, notifyReminder: true, reminderDays: 3, notifyEmail: false,
  defaultPaymentMethods: [],
}

const store = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* mode privat */ } }
const USER_KEY = 'tagihanku.user'
const loadUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null } }
const load = (k) => { try { return localStorage.getItem(k) || '' } catch { return '' } }

let poll = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: load(AUTH_KEY),
    user: load(AUTH_KEY) ? loadUser() : null,
    settings: { ...DEFAULT_SETTINGS, theme: load(THEME_KEY) || 'light', accent: load(ACCENT_KEY) || DEFAULT_ACCENT },
    unread: 0,
    ready: false,
  }),
  getters: { loggedIn: (s) => !!s.token },

  actions: {
    /** Dipanggil sekali saat aplikasi dibuka: pulihkan sesi dari token tersimpan. */
    init() {
      this.applyLook()
      matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (this.settings.theme === 'system') this.applyLook()
      })
      window.addEventListener('splitbill:unauthorized', () => this.clear())
      if (this.token) this.hydrate()
      this.ready = true
    },

    async hydrate() {
      try {
        const [user, settings] = await Promise.all([authApi.me(), authApi.getSettings()])
        this.user = user
        store(USER_KEY, JSON.stringify(user))
        this.setSettings(settings)
        this.refreshUnread()
        this.startPolling()
      } catch (e) {
        if (e.status === 401) this.clear()
      }
    },

    async finish(res) {
      this.token = res.token
      this.user = res.user
      store(AUTH_KEY, res.token)
      store(USER_KEY, JSON.stringify(res.user))
      // tagihan yang dibuat sebagai tamu di perangkat ini ikut ditautkan ke akun
      const local = myBills.all().map((b) => ({ id: b.id, token: b.token }))
      if (local.length) { try { await authApi.claimBills(local) } catch { /* tidak fatal */ } }
      await this.hydrate()
    },

    async register(payload) { await this.finish(await authApi.register(payload)) },
    async login(payload) { await this.finish(await authApi.login(payload)) },
    async loginWithGoogle(credential) { await this.finish(await authApi.google(credential)) },

    logout() { this.clear() },
    clear() {
      this.token = ''
      this.user = null
      this.unread = 0
      store(AUTH_KEY, null)
      store(USER_KEY, null)
      this.stopPolling()
    },

    /** Terapkan mode + aksen yang sedang tersimpan (dipakai juga untuk membatalkan pratinjau). */
    applyLook() { applyAppearance(this.settings) },

    setSettings(s) {
      this.settings = { ...this.settings, ...s }
      store(THEME_KEY, this.settings.theme)
      store(ACCENT_KEY, this.settings.accent)
      this.applyLook()
    },
    /** Simpan pengaturan. Tamu (belum login) hanya menyimpan tampilan di perangkat ini. */
    async saveSettings(patch) {
      const prev = { ...this.settings }
      this.setSettings(patch) // optimistis: tampilan langsung berubah
      if (!this.token) return
      try { this.setSettings(await authApi.updateSettings(patch)) } catch (e) { this.setSettings(prev); throw e }
    },

    async refreshUnread() {
      if (!this.token) return
      try { this.unread = (await authApi.unreadCount()).unread } catch { /* abaikan */ }
    },
    startPolling() {
      this.stopPolling()
      poll = setInterval(() => this.refreshUnread(), 60_000)
    },
    stopPolling() { if (poll) clearInterval(poll); poll = null },
  },
})
