// Membaca QR dari foto/gambar dan menggambar QR. Pustaka dimuat malas agar bundle awal kecil.
// Pembaca dicoba bertahap: BarcodeDetector bawaan browser (cepat, bagus untuk foto) -> jsQR di beberapa ukuran.

async function toBitmap(file) {
  return createImageBitmap(file) // sudah memutar sesuai EXIF
}

function imageDataAt(bmp, maxSide) {
  const scale = maxSide / Math.max(bmp.width, bmp.height)
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

/** Isi teks QR dari berkas gambar; null kalau tidak ada QR yang terbaca. */
export async function decodeQrFromFile(file) {
  const bmp = await toBitmap(file)
  try {
    // 1) BarcodeDetector (Chrome/Android, Safari baru)
    if ('BarcodeDetector' in window) {
      try {
        const det = new window.BarcodeDetector({ formats: ['qr_code'] })
        const hits = await det.detect(bmp)
        const raw = hits.find((h) => h.rawValue)?.rawValue
        if (raw) return raw
      } catch { /* lanjut ke jsQR */ }
    }

    // 2) jsQR — coba beberapa ukuran; foto besar kadang gagal di satu ukuran saja
    const { default: jsQR } = await import('jsqr')
    const longest = Math.max(bmp.width, bmp.height)
    const sizes = [...new Set([Math.min(longest, 1600), 1000, 700, Math.min(longest, 2400)])]
    for (const size of sizes) {
      const img = imageDataAt(bmp, size)
      const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
      if (hit?.data) return hit.data
    }
    return null
  } finally {
    bmp.close?.()
  }
}

/** Gambar QR hitam di atas putih ke <canvas> (tampilan di layar). */
export async function drawQr(canvas, text, width = 288) {
  const QR = await import('qrcode')
  await (QR.default || QR).toCanvas(canvas, text, {
    width,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  })
}

/** PNG besar (hitam di atas putih, ada ruang kosong di tepi) untuk diunduh / discan dari galeri. */
export async function qrToDataUrl(text, width = 1024) {
  const QR = await import('qrcode')
  return (QR.default || QR).toDataURL(text, {
    width,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  })
}
