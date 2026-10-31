// Tagihan milik perangkat ini (id + token pembuat) disimpan di localStorage — tanpa login.
const KEY = 'splitbill.mine'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}
function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* mode privat / penuh */ }
}

export const myBills = {
  ids: () => read().map((b) => b.id),
  all: () => read(),
  add: (b) => write([b, ...read().filter((x) => x.id !== b.id)]),
  remove: (id) => write(read().filter((b) => b.id !== id)),
}
export const getToken = (id) => read().find((b) => b.id === id)?.token
export const isOwner = (id) => !!getToken(id)
