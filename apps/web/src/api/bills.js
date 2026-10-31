import { request } from './client'
import { getToken } from '../composables/useMyBills'

const t = (id) => getToken(id)

export const billsApi = {
  create: (body) => request('/bills', { method: 'POST', body }),
  list: (ids) => request(`/bills?ids=${ids.join(',')}`),
  get: (id) => request(`/bills/${id}`),
  getShared: (code) => request(`/bills/share/${code}`),
  markOpened: (code, participantId) => request(`/bills/share/${code}/open`, { method: 'POST', body: { participantId } }),
  update: (id, body) => request(`/bills/${id}`, { method: 'PATCH', body, token: t(id) }),
  remove: (id) => request(`/bills/${id}`, { method: 'DELETE', token: t(id) }),

  addParticipant: (id, name) => request(`/bills/${id}/participants`, { method: 'POST', body: { name }, token: t(id) }),
  removeParticipant: (id, pid) => request(`/bills/${id}/participants/${pid}`, { method: 'DELETE', token: t(id) }),
  setPaid: (id, pid, paid) => request(`/bills/${id}/participants/${pid}/paid`, { method: 'PATCH', body: { paid }, token: t(id) }),

  addItem: (id, body) => request(`/bills/${id}/items`, { method: 'POST', body, token: t(id) }),
  bulkItems: (id, items) => request(`/bills/${id}/items/bulk`, { method: 'POST', body: { items }, token: t(id) }),
  updateItem: (id, itemId, body) => request(`/bills/${id}/items/${itemId}`, { method: 'PATCH', body, token: t(id) }),
  removeItem: (id, itemId) => request(`/bills/${id}/items/${itemId}`, { method: 'DELETE', token: t(id) }),
  setAssignments: (id, itemId, participantIds) =>
    request(`/bills/${id}/items/${itemId}/assignments`, { method: 'PUT', body: { participantIds }, token: t(id) }),

  uploadReceipt(id, file) {
    const form = new FormData()
    form.append('file', file)
    return request(`/bills/${id}/receipts`, { method: 'POST', form, token: t(id) })
  },
}
