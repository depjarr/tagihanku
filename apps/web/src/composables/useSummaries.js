// Ringkasan satu baris untuk menu Pengaturan ("2 dari 4 aktif", "QRIS, BCA, DANA").
export const NOTIFY_KEYS = ['notifyPaid', 'notifyDone', 'notifyOpened', 'notifyReminder']

export const notifSummary = (s) => `${NOTIFY_KEYS.filter((k) => s?.[k]).length} dari ${NOTIFY_KEYS.length} aktif`

export const methodName = (m) => (m.type === 'QRIS' ? 'QRIS' : m.label)
export const paymentSummary = (list) => (list?.length ? list.map(methodName).join(', ') : 'Belum diatur')
