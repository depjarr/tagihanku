// Notifikasi di dalam aplikasi (pengganti alert()/confirm() bawaan browser yang menampilkan
// judul "localhost:5173 says"). Dirender oleh components/ToastHost.vue.
import { reactive } from 'vue'

export const toastState = reactive({ items: [], dialog: null })
let seq = 0

function push(type, message, ms = 3200) {
  const id = ++seq
  toastState.items.push({ id, type, message })
  if (toastState.items.length > 3) toastState.items.shift()
  if (ms > 0) setTimeout(() => dismiss(id), ms)
  return id
}

export function dismiss(id) {
  const i = toastState.items.findIndex((t) => t.id === id)
  if (i > -1) toastState.items.splice(i, 1)
}

export const toast = {
  success: (m, ms) => push('success', m, ms),
  error: (m, ms = 4500) => push('error', m, ms),
  info: (m, ms) => push('info', m, ms),
  warn: (m, ms = 4000) => push('warn', m, ms),
}

/**
 * Dialog konfirmasi bergaya aplikasi. Mengembalikan Promise<boolean>.
 *   if (!(await askConfirm({ title: 'Hapus?', message: '...', okText: 'Hapus', danger: true }))) return
 */
export function askConfirm({ title = 'Yakin?', message = '', okText = 'Ya', cancelText = 'Batal', danger = false } = {}) {
  return new Promise((resolve) => {
    toastState.dialog = {
      title, message, okText, cancelText, danger,
      done: (v) => { toastState.dialog = null; resolve(v) },
    }
  })
}

export const useToast = () => ({ toast, askConfirm })