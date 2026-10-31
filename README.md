# Tagihanku

Aplikasi patungan tagihan: buat tagihan → scan struk (OCR) atau isi manual → bagi item per orang →
bagikan link ke WhatsApp → pembuat menandai siapa yang sudah lunas. Tanpa login: pembuat dikenali lewat
token yang disimpan di browsernya, teman cukup membuka link `/s/:code`.
Teman yang membayar lewat QRIS mendapat **QRIS dengan nominal bagiannya sudah terisi**.

```
tagihanku/
├── db/schema.sql          # DDL PostgreSQL (dipakai docker-compose)
├── docker-compose.yml     # db + api + web
├── DEPLOY.md              # panduan Netlify (web) + API + database
└── apps/
    ├── api/               # NestJS + Prisma  (Swagger di /docs)
    └── web/               # Vue 3 + Vite + Pinia + Tailwind
```

## Jalankan dengan Docker (paling cepat)
```bash
docker compose up --build
# web  → http://localhost:8080
# api  → http://localhost:3000/api   (docs: http://localhost:3000/docs)
```
Schema dibuat otomatis dari `db/schema.sql` saat volume DB pertama kali dibuat.
Reset DB: `docker compose down -v`.

> Nama folder proyek ini `tagihanku`, jadi Docker membuat volume baru (database kosong). Nama database/user di
> Postgres tetap `splitbill`; itu hanya identitas teknis dan tidak terlihat pengguna.

## Jalankan manual (development)
```bash
# 1. database saja
docker compose up -d db

# 2. backend
cd apps/api
cp .env.example .env
npm install
npx prisma generate          # schema DB sudah dibuat oleh db/schema.sql
npm run start:dev            # http://localhost:3000/api , docs di /docs
npm test                     # unit test logika split & parser struk

# 3. frontend (terminal lain)
cd apps/web
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
npm test
```
> Tidak pakai docker untuk DB? Buat database kosong, jalankan `psql -d splitbill -f db/schema.sql`,
> lalu isi `DATABASE_URL` di `apps/api/.env`.

## OCR (baca struk)
Default-nya **OCR sungguhan** (`OCR_PROVIDER=tesseract`, tesseract.js, bahasa `ind`+`eng`). Data bahasa diunduh sekali
saat scan pertama (server butuh internet) lalu disimpan di `OCR_CACHE_DIR`.
`OCR_PROVIDER=mock` hanya untuk mencoba UI: selalu mengembalikan struk contoh yang sama.

Alur: foto diperbaiki di browser (`useReceiptImage.js`: dikecilkan/dibesarkan, abu-abu, kontras) → API OCR →
`receipt-parser.ts` mengurai teks menjadi **item, qty, subtotal, total, pajak, service, tanggal, nama toko**.
Persen pajak/service dihitung dari **nominal di struk** sehingga total tagihan sama dengan total di struk. Layar
"Periksa hasil scan" menampilkan hasilnya (bisa diedit, termasuk pajak + service dan tanggal) dan teks mentah OCR.
Kualitas OCR bergantung foto: struk lurus, terang, tanpa bayangan/lipatan. Provider lain (Google Vision, AWS Textract,
dll.) cukup implementasi interface `OcrProvider` di `apps/api/src/receipts/ocr/` lalu daftarkan di `receipts.module.ts`.

## Cara kerja hitung porsi (`apps/api/src/split/split.calculator.ts`)
- Harga item dibagi rata ke peserta yang dipilih; sisa rupiah dibagikan 1-per-1 (tidak ada rupiah hilang).
- Pajak + service dihitung dari subtotal, lalu dibagi sebanding porsi item masing-masing orang.
- Jumlah semua porsi selalu sama dengan total tagihan. Contoh mockup: 62.100 + 34.500 + 29.900 = 126.500.

## Endpoint ringkas
| Method | Path | Akses |
|---|---|---|
| POST | `/api/bills` | publik (mengembalikan `ownerToken`) |
| GET | `/api/bills?ids=` , `/api/bills/:id` , `/api/bills/share/:code` | publik |
| PATCH / DELETE | `/api/bills/:id` | pembuat (`x-owner-token`) |
| POST / DELETE / PATCH `paid` | `/api/bills/:id/participants[/:pid[/paid]]` | pembuat |
| POST, POST `bulk`, PATCH, DELETE, PUT `assignments` | `/api/bills/:id/items[/:itemId]` | pembuat |
| POST | `/api/bills/:id/receipts` (multipart `file`) | pembuat |

## Akun, pengaturan & notifikasi (tahap 2)
- **Tetap bisa tanpa akun**: mode tamu (`x-owner-token`) masih jalan. Login bersifat opsional.
- **Daftar / masuk** → JWT (`Authorization: Bearer`), kata sandi di-hash bcrypt. Saat login/daftar, tagihan tamu di
  perangkat itu otomatis ditautkan ke akun (`POST /api/bills/claim`).
- **Lupa kata sandi** → `POST /api/auth/forgot-password` membuat token sekali pakai (berlaku 30 menit, disimpan
  sebagai hash) dan mengirim tautan `WEB_URL/reset-password?token=…`. Dengan `MAIL_PROVIDER=console`
  (default) tautannya muncul di **log server**; isi `SMTP_*` dan `MAIL_PROVIDER=smtp` untuk email sungguhan.
- **Pengaturan** (`/settings`) berupa menu: *Tampilan*, *Notifikasi*, *Metode pembayaran* (bawaan akun),
  *Ubah password*, *Pindahkan tagihan dari perangkat ini*, *Keluar*. Profil/nama ada di kartu paling atas.
- **Notifikasi** (`/notifications`): dibuat saat tagihan dibuat, teman membuka link (sekali per teman), teman ditandai
  bayar, tagihan lunas, dan pengingat harian 09:00 WIB (`@Cron`) untuk tagihan yang belum lunas setelah N hari.
  Tiap jenis bisa dimatikan; pengaturannya juga tampil di bawah daftar notifikasi. Badge di beranda
  di-refresh tiap 60 detik.

| Method | Path | Akses |
|---|---|---|
| POST | `/api/auth/register`, `/login`, `/forgot-password`, `/reset-password` | publik (rate-limit 5/menit) |
| GET / PATCH | `/api/auth/me` | login |
| POST | `/api/auth/change-password` | login |
| GET / PATCH | `/api/me/settings` | login |
| GET | `/api/bills/mine` · POST `/api/bills/claim` | login |
| GET | `/api/notifications` , `/unread-count` | login |
| PATCH / POST / DELETE | `/api/notifications/:id/read` , `/read-all` , `/` | login |

### Migrasi DB
DB baru: otomatis dari `db/schema.sql`. DB lama (tanpa `docker compose down -v`):
`psql -d splitbill -f db/migrations_002_auth.sql`, lalu `npx prisma generate` di `apps/api`.
Jangan lupa ganti `JWT_SECRET` di production.

**Fitur tahap 3** (login Google, QRIS ber-nominal, tampilan/aksen, notifikasi "link dibuka", metode bayar bawaan)
butuh kolom baru. DB lama: `psql -d splitbill -f db/migrations_003_features.sql`, lalu `npx prisma generate`
dan `npm install` di `apps/web` (dependensi baru: `qrcode`, `jsqr`).

## Tampilan: mode x warna aksen
`Pengaturan > Tampilan` memilih **mode** (Terang/Gelap/Sistem) dan **warna utama pastel** (Biru, Merah, Kuning,
Hijau, Ungu, Peach). Semua layar (buat tagihan, editor, ringkasan, halaman teman, notifikasi, pengaturan) memakai
variabel CSS di `apps/web/src/style.css`, jadi satu pilihan mengubah semuanya, dipratinjau langsung, dan baru
tersimpan setelah *Simpan tampilan*. Tamu (tanpa akun) menyimpannya di perangkat; akun menyimpannya di DB
(`user_settings.accent`). Status Lunas (hijau) dan Belum bayar (kuning) sengaja tidak ikut berubah.
- Tambah/ubah warna: edit `ACCENTS` di `apps/web/src/composables/useAccent.js`, blok `data-accent` di `style.css`,
  dan `ACCENTS` di `apps/api/src/settings/dto/settings.dto.ts` (+ CHECK di `db/schema.sql`).
- Warna awal: `DEFAULT_ACCENT` di `useAccent.js` (juga `index.html` dan default kolom DB).

## QRIS ber-nominal
1. Pembuat memotret QRIS tokonya (`+ Foto QRIS`); `jsqr` membaca QR, isinya divalidasi (format EMV + CRC16) dan
   disimpan di `payment_methods.qris_payload`. Foto tidak diunggah ke server.
2. Di halaman teman, `useQris.js#toDynamicQris` mengubah QRIS statis jadi dinamis (tag 01=12, tag 54=nominal bagian
   teman, hitung ulang CRC16), digambar dengan `qrcode`, dan bisa diunduh sebagai PNG hitam di atas putih.
Logika murni ini punya tes di `useQris.test.js`. **Coba dulu dengan QRIS asli dan nominal kecil** sebelum dipakai
luas: sebagian penerbit QRIS menolak QRIS hasil modifikasi atau memakai tag tambahan.

## Login Google (opsional)
Buat *OAuth Client ID* tipe Web di Google Cloud Console, isi *Authorized JavaScript origins* dengan URL web, lalu set
`GOOGLE_CLIENT_ID` di `apps/api/.env` (atau lingkungan docker-compose). Kosong = tombol Google tidak muncul.
Server memverifikasi ID token (`aud`, `iss`, `email_verified`) ke Google; akun email yang sama otomatis ditautkan.
Akun yang hanya masuk lewat Google belum punya kata sandi (buat lewat *Lupa password*).

## Endpoint tambahan
| Method | Path | Akses |
|---|---|---|
| POST | `/api/auth/google` , GET `/api/auth/config` | publik |
| POST | `/api/bills/share/:code/open` (teman memilih namanya) | publik |
| GET / PATCH | `/api/me/settings` (kini juga `accent`, `notifyOpened`, `notifyDone`, `defaultPaymentMethods`) | login |

## Belum ada
Verifikasi email, halaman syarat & kebijakan privasi (checkbox daftar hanya teks), rate-limit per-IP di belakang
proxy (`trust proxy`), penyimpanan upload struk ke S3/R2, dan tes otomatis untuk komponen Vue.
