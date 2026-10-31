// Aturan password (dipakai saat daftar, reset, dan ganti password).
// Login TIDAK memakai aturan ini supaya akun lama tetap bisa masuk.
export const passwordChecks = (pw = '') => [
  { key: 'len', label: 'Minimal 8 karakter', ok: pw.length >= 8 },
  { key: 'upper', label: 'Ada 1 huruf besar (A-Z)', ok: /[A-Z]/.test(pw) },
  { key: 'symbol', label: 'Ada 1 simbol, mis. * & ! @ #', ok: /[^A-Za-z0-9]/.test(pw) },
]

export const passwordError = (pw = '') => {
  const bad = passwordChecks(pw).find((c) => !c.ok)
  return bad ? `Kata sandi belum memenuhi syarat: ${bad.label.toLowerCase()}` : ''
}