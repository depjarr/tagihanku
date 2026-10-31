-- Untuk DB yang SUDAH berjalan (setelah migrations_002_auth.sql).
-- Jalankan: psql -d splitbill -f db/migrations_003_features.sql ; lalu `npx prisma generate` di apps/api
BEGIN;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id varchar(40) UNIQUE;

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_opened boolean NOT NULL DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_done   boolean NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS accent varchar(12) NOT NULL DEFAULT 'biru'
  CHECK (accent IN ('biru','merah','kuning','hijau','ungu','peach'));
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE participants    ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS qris_payload varchar(600);
COMMIT;
