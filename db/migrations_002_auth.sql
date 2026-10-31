-- Untuk DB yang SUDAH berjalan dengan schema tahap 1 (tanpa reset volume).
-- Jalankan: psql -d splitbill -f db/migrations_002_auth.sql
BEGIN;
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(80)  NOT NULL,
  email         varchar(160) NOT NULL UNIQUE,      -- disimpan huruf kecil
  password_hash varchar(100) NOT NULL,             -- bcrypt
  created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE user_settings (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme           varchar(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','system')),
  notify_paid     boolean     NOT NULL DEFAULT true,
  notify_reminder boolean     NOT NULL DEFAULT true,
  reminder_days   integer     NOT NULL DEFAULT 3 CHECK (reminder_days BETWEEN 1 AND 30),
  notify_email    boolean     NOT NULL DEFAULT false
);

CREATE TABLE password_resets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,          -- sha256 dari token yang dikirim ke email
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets(user_id);

ALTER TABLE bills ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX bills_user_id_idx ON bills(user_id);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id    uuid         REFERENCES bills(id) ON DELETE CASCADE,
  type       varchar(20)  NOT NULL,              -- BILL_CREATED | PAID | BILL_DONE | REMINDER
  title      varchar(120) NOT NULL,
  body       varchar(255) NOT NULL,
  read_at    timestamptz,
  created_at timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_created_idx ON notifications(user_id, created_at DESC);
COMMIT;
