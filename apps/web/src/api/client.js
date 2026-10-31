export const AUTH_KEY = 'splitbill.auth'
export const getAuthToken = () => {
  try { return localStorage.getItem(AUTH_KEY) || '' } catch { return '' }
}

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function request(path, { method = 'GET', body, token, form } = {}) {
  const headers = {}
  if (token) headers['x-owner-token'] = token
  const auth = getAuthToken()
  if (auth) headers['Authorization'] = `Bearer ${auth}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(BASE + path, { method, headers, body: payload })
  } catch {
    throw new ApiError('Tidak bisa terhubung ke server', 0)
  }
  if (!res.ok) {
    let message = 'Terjadi kesalahan'
    try {
      const j = await res.json()
      message = Array.isArray(j.message) ? j.message.join(', ') : j.message || message
    } catch { /* abaikan */ }
    if (res.status === 401 && auth) window.dispatchEvent(new Event('splitbill:unauthorized'))
    throw new ApiError(message, res.status)
  }
  return res.status === 204 ? null : res.json()
}
