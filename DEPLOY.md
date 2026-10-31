# Menayangkan Tagihanku ke internet

Netlify hanya menayangkan **tampilan web** (folder `apps/web`). Backend (`apps/api`, NestJS) dan database
PostgreSQL harus jalan di tempat lain, lalu web diarahkan ke alamatnya. Jadi ada 3 bagian:

| Bagian | Tempat | Catatan |
|---|---|---|
| Web (Vue) | **Netlify** | statis, gratis |
| API (NestJS + OCR) | Render / Railway / Fly.io / VPS | pakai `apps/api/Dockerfile` |
| Database | Neon / Supabase / Render Postgres / Railway | PostgreSQL 14+ |

> Alamat API **harus HTTPS**. Situs Netlify berjalan di HTTPS, jadi browser memblokir API yang masih `http://`.

## 1. Database
1. Buat database PostgreSQL di penyedia pilihanmu, salin *connection string*-nya
   (`postgresql://user:pass@host:5432/dbname`).
2. Sambungkan pgAdmin4 (atau `psql`) ke database itu, buka Query Tool, lalu jalankan seluruh isi `db/schema.sql`
   **sekali saja** pada database yang masih kosong.
3. Untuk `DATABASE_URL` tambahkan `?schema=public` di ujung (Neon/Supabase kadang butuh `&sslmode=require`).

## 2. API
Buat *Web Service* dari folder `apps/api` (pilih "Docker"; Dockerfile sudah ada) dan isi environment variable:

| Variable | Isi |
|---|---|
| `DATABASE_URL` | connection string dari langkah 1 |
| `JWT_SECRET` | string acak panjang (jangan pakai contoh) |
| `CORS_ORIGIN` | alamat webmu, mis. `https://tagihanku.netlify.app` (pisahkan dengan koma bila lebih dari satu) |
| `WEB_URL` | sama dengan `CORS_ORIGIN` (dipakai di link reset password) |
| `OCR_PROVIDER` | `tesseract` |
| `OCR_CACHE_DIR` | `/tmp/ocr` (atau folder disk persisten) |
| `UPLOAD_DIR` | `/tmp/uploads` (atau folder disk persisten) |
| `MAIL_PROVIDER` | `console` (tes) atau `smtp` + `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` |
| `GOOGLE_CLIENT_ID` | opsional, untuk login Google |

`PORT` biasanya diisi otomatis oleh penyedia. Setelah jalan, cek `https://<api-kamu>/docs` terbuka.

Catatan penting:
- **OCR (tesseract) butuh RAM**. Kalau API sering mati saat scan struk, naikkan ke instance dengan RAM ≥ 1 GB.
- Scan **pertama** lebih lambat karena data bahasa OCR diunduh dulu. Di instance gratis yang "tidur", ini terulang
  setiap bangun kecuali `OCR_CACHE_DIR` memakai disk persisten.
- Foto struk hanya diarsipkan (belum ditampilkan di aplikasi). Disk gratis biasanya terhapus saat deploy ulang;
  itu tidak mengganggu fitur lain.

## 3. Web di Netlify
**Lewat Git (disarankan)**
1. Push proyek ke GitHub, di Netlify pilih *Add new site → Import from Git*.
2. *Base directory*: `apps/web` (build command dan publish directory sudah diatur di `apps/web/netlify.toml`).
3. *Site configuration → Environment variables*: tambahkan `VITE_API_URL` = `https://<api-kamu>/api`
   (**harus berakhiran `/api`**). Nilai ini ditanam saat build, jadi ubah lalu *Trigger deploy* ulang bila berganti.
4. Ganti nama situs (Site configuration → Change site name) menjadi `tagihanku` bila masih tersedia,
   lalu isi `CORS_ORIGIN` / `WEB_URL` di API dengan alamat finalnya.

**Tanpa Git (drag & drop)**
```bash
cd apps/web
npm install
VITE_API_URL=https://<api-kamu>/api npm run build     # Windows PowerShell: $env:VITE_API_URL="..."; npm run build
```
Lalu seret folder `dist` ke Netlify (*Add new site → Deploy manually*). File `public/_redirects` ikut terbawa
sehingga alamat seperti `/s/abc123` tetap jalan saat di-refresh.

## Daftar cek sebelum dibagikan
- [ ] `JWT_SECRET` sudah diganti, password database kuat.
- [ ] `CORS_ORIGIN` = alamat Netlify persis (tanpa `/` di akhir).
- [ ] `VITE_API_URL` berakhiran `/api` dan memakai `https://`.
- [ ] Coba alur lengkap dengan struk asli: scan → periksa → bagi → buka link teman → QRIS ber-nominal (nominal kecil dulu).
- [ ] Login Google (bila dipakai): daftarkan alamat Netlify di *Authorized JavaScript origins*.
