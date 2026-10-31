// QRIS = format EMVCo MPM: deretan TLV  [ID 2 digit][panjang 2 digit][isi].
// Versi lama memakai regex pada string mentah dan merusak tag lain (mis. MCC "5499" ikut terhapus),
// akibatnya QR dinamis tidak bisa dibayar di GoPay/OVO/ShopeePay/m-banking. Sekarang semuanya
// di-parse sebagai TLV, diubah per tag, lalu CRC dihitung ulang.

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) sesuai standar EMVCo / Bank Indonesia. */
export function crc16(data) {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Bangun satu elemen TLV. */
export function tlv(id, val) {
  return id + String(val.length).padStart(2, '0') + val
}

/** Pecah payload menjadi [{ id, val }]. Melempar error kalau panjang tidak cocok. */
export function parseTlv(payload) {
  const out = []
  let i = 0
  while (i < payload.length) {
    if (i + 4 > payload.length) throw new Error('TLV terpotong')
    const id = payload.slice(i, i + 2)
    const len = Number(payload.slice(i + 2, i + 4))
    if (!Number.isInteger(len) || !/^\d{2}$/.test(payload.slice(i + 2, i + 4))) throw new Error('Panjang TLV tidak valid')
    const val = payload.slice(i + 4, i + 4 + len)
    if (val.length !== len) throw new Error('Isi TLV kurang dari panjangnya')
    out.push({ id, val })
    i += 4 + len
  }
  return out
}

const build = (tags) => tags.map((t) => tlv(t.id, t.val)).join('')

/** Payload valid = diawali 000201, TLV utuh, tag 63 di paling akhir, dan CRC cocok. */
export function isValidQris(payload) {
  if (typeof payload !== 'string' || !payload.startsWith('000201')) return false
  try {
    const tags = parseTlv(payload)
    const last = tags[tags.length - 1]
    if (!last || last.id !== '63' || last.val.length !== 4) return false
    const body = payload.slice(0, payload.length - 4)
    return crc16(body) === last.val.toUpperCase()
  } catch {
    return false
  }
}

/** Nama merchant (tag 59). */
export function merchantName(payload) {
  try {
    return parseTlv(payload).find((t) => t.id === '59')?.val.trim() || ''
  } catch {
    return ''
  }
}

/** NMID (ID.CO.QRIS.WWW di tag 51, atau 26) kalau ada; untuk ditampilkan saja. */
export function merchantNmid(payload) {
  try {
    for (const t of parseTlv(payload)) {
      if (Number(t.id) < 26 || Number(t.id) > 51) continue
      const sub = parseTlv(t.val)
      if (sub.find((s) => s.id === '00')?.val.toUpperCase().includes('QRIS')) {
        const nm = sub.find((s) => s.id === '02')?.val
        if (nm) return nm
      }
    }
  } catch { /* abaikan */ }
  return ''
}

/** Apakah QR sudah memuat nominal (tag 54)? */
export function hasAmount(payload) {
  try {
    return parseTlv(payload).some((t) => t.id === '54')
  } catch {
    return false
  }
}

/**
 * QRIS statis -> QRIS dinamis dengan nominal terkunci:
 * - tag 01: 11 (statis) -> 12 (dinamis)
 * - tag 54: nominal rupiah (nominal lama diganti), diletakkan sesudah tag 53, sebelum 55+
 * - tag 63: CRC dihitung ulang
 * Tag lain (26–51 data merchant, 52 MCC, 53 mata uang, 58, 59, 60, 61, 62) tidak disentuh.
 */
export function toDynamicQris(rawQrisPayload, amount) {
  if (!isValidQris(rawQrisPayload)) throw new Error('Payload QRIS tidak valid')
  const rupiah = Math.round(Number(amount))
  if (!Number.isFinite(rupiah) || rupiah <= 0) throw new Error('Nominal harus lebih dari 0')

  const tags = parseTlv(rawQrisPayload).filter((t) => t.id !== '63' && t.id !== '54')
  const init = tags.find((t) => t.id === '01')
  if (init) init.val = '12'

  const amountTag = { id: '54', val: String(rupiah) }
  const at = tags.findIndex((t) => Number(t.id) > 54)
  if (at === -1) tags.push(amountTag)
  else tags.splice(at, 0, amountTag)

  const body = build(tags) + '6304'
  return body + crc16(body)
}