-- Sinkron data alur "split bill" (tagihan, metode pembayaran, daftar teman) ke akun.
-- Untuk DB yang SUDAH berjalan. Jalankan SEKALI di Neon (SQL Editor) atau: psql -d <db> -f db/migrations_004_split_sync.sql
-- Tidak mengubah tabel lama; hanya menambah 2 tabel baru. Aman diulang (IF NOT EXISTS).
BEGIN;

CREATE TABLE IF NOT EXISTS split_records (
  user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_id         varchar(64) NOT NULL,
  data              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  deleted           boolean     NOT NULL DEFAULT false,
  client_updated_at timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, record_id)
);

CREATE TABLE IF NOT EXISTS split_profiles (
  user_id           uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payment_methods   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  friends           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  client_updated_at timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMIT;