import { request } from './client'

/** Sinkron data alur split bill ke akun (hanya dipanggil saat login). */
export const syncApi = {
  pull: () => request('/me/sync'),
  pushBills: (bills) => request('/me/sync/bills', { method: 'POST', body: { bills } }),
  pushProfile: (profile) => request('/me/sync/profile', { method: 'PUT', body: profile }),
}