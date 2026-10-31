import { request } from './client'

export const authApi = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  google: (credential) => request('/auth/google', { method: 'POST', body: { credential } }),
  config: () => request('/auth/config'),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  forgot: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  reset: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } }),
  me: () => request('/auth/me'),
  updateProfile: (name) => request('/auth/me', { method: 'PATCH', body: { name } }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),

  getSettings: () => request('/me/settings'),
  updateSettings: (patch) => request('/me/settings', { method: 'PATCH', body: patch }),

  myBills: () => request('/bills/mine'),
  claimBills: (bills) => request('/bills/claim', { method: 'POST', body: { bills } }),

  notifications: () => request('/notifications'),
  unreadCount: () => request('/notifications/unread-count'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'POST' }),
  clearNotifications: () => request('/notifications', { method: 'DELETE' }),
}
