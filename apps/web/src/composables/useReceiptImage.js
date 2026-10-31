// Menyiapkan foto struk sebelum diunggah agar OCR lebih akurat:
// - dikecilkan ke sisi terpanjang <= 2400px (foto HP 12MP tidak perlu dikirim utuh), tapi struk kecil dibesarkan
// - diubah ke abu-abu lalu kontrasnya diregangkan (kertas thermal yang pudar jadi lebih terbaca)
// Kalau gagal (mis. format tidak didukung browser), berkas asli dikirim apa adanya.

export async function prepareReceiptImage(file, maxSide = 2400, minSide = 1600) {
  try {
    const bmp = await createImageBitmap(file) // sudah memutar sesuai EXIF
    const longest = Math.max(bmp.width, bmp.height)
    let scale = longest > maxSide ? maxSide / longest : 1
    if (longest < minSide) scale = Math.min(2, minSide / longest)
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()

    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const hist = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) {
      const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0
      d[i] = d[i + 1] = d[i + 2] = g
      hist[g]++
    }
    // regangkan antara persentil 1% dan 99%
    const total = w * h
    let acc = 0, lo = 0, hi = 255
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.01) { lo = v; break } }
    acc = 0
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.01) { hi = v; break } }
    if (hi - lo >= 40) {
      const k = 255 / (hi - lo)
      for (let i = 0; i < d.length; i += 4) {
        let v = (d[i] - lo) * k
        v = v < 0 ? 0 : v > 255 ? 255 : v
        d[i] = d[i + 1] = d[i + 2] = v
      }
    }
    ctx.putImageData(img, 0, 0)

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
    if (!blob) return file
    return new File([blob], 'struk.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
