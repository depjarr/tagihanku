-- Tagihanku · PostgreSQL 14+ schema (identik dengan apps/api/prisma/schema.prisma)
-- Dijalankan otomatis oleh docker-compose saat volume DB masih kosong.

CREATE TYPE bill_status    AS ENUM ('ACTIVE', 'DONE');
CREATE TYPE payment_type   AS ENUM ('QRIS', 'BANK', 'EWALLET');
CREATE TYPE receipt_status AS ENUM ('PROCESSED', 'FAILED');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(80)  NOT NULL,
  email         varchar(160) NOT NULL UNIQUE,      -- disimpan huruf kecil
  password_hash varchar(100),                      -- bcrypt; NULL = akun yang hanya masuk lewat Google
  google_id     varchar(40) UNIQUE,                -- 'sub' dari Google
  created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE user_settings (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme           varchar(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','system')),
  notify_paid     boolean     NOT NULL DEFAULT true,
  notify_reminder boolean     NOT NULL DEFAULT true,
  reminder_days   integer     NOT NULL DEFAULT 3 CHECK (reminder_days BETWEEN 1 AND 30),
  notify_email    boolean     NOT NULL DEFAULT false,
  notify_opened   boolean     NOT NULL DEFAULT false,   -- saat teman membuka link
  notify_done     boolean     NOT NULL DEFAULT true,    -- saat semua sudah bayar
  accent          varchar(12) NOT NULL DEFAULT 'biru' CHECK (accent IN ('biru','merah','kuning','hijau','ungu','peach')),
  default_payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb   -- metode bayar bawaan untuk tagihan baru
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

CREATE TABLE bills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           varchar(120) NOT NULL,
  bill_date       date         NOT NULL,
  tax_percent     numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_percent BETWEEN 0 AND 100),
  service_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (service_percent BETWEEN 0 AND 100),
  status          bill_status  NOT NULL DEFAULT 'ACTIVE',
  share_code      varchar(12)  NOT NULL UNIQUE,   -- untuk link publik /s/:share_code
  owner_token     varchar(64)  NOT NULL,          -- "kunci" pembuat, disimpan di browser pembuat
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,  -- NULL = tagihan tamu (tanpa akun)
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE participants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    uuid        NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  name       varchar(60) NOT NULL,
  is_owner   boolean     NOT NULL DEFAULT false,
  paid_at    timestamptz,                         -- NULL = belum bayar
  opened_at  timestamptz,                         -- pertama kali membuka link (untuk notifikasi)
  sort_order integer     NOT NULL DEFAULT 0,
  UNIQUE (bill_id, name)
);
CREATE INDEX participants_bill_id_idx ON participants(bill_id);

CREATE TABLE items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    uuid         NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  name       varchar(120) NOT NULL,
  price      integer      NOT NULL CHECK (price >= 0),  -- total baris, dalam rupiah
  qty        integer      NOT NULL DEFAULT 1 CHECK (qty >= 1),
  sort_order integer      NOT NULL DEFAULT 0
);
CREATE INDEX items_bill_id_idx ON items(bill_id);

-- siapa saja yang ikut menanggung sebuah item (dibagi rata)
CREATE TABLE item_assignments (
  item_id        uuid NOT NULL REFERENCES items(id)        ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, participant_id)
);
CREATE INDEX item_assignments_participant_idx ON item_assignments(participant_id);

CREATE TABLE payment_methods (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id        uuid        NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  type           payment_type NOT NULL,
  label          varchar(60) NOT NULL,            -- mis. BCA, DANA, nama merchant QRIS
  account_number varchar(40),
  account_name   varchar(80),
  qris_payload   varchar(600)                     -- isi QRIS statis hasil baca foto; dipakai membuat QRIS ber-nominal
);
CREATE INDEX payment_methods_bill_id_idx ON payment_methods(bill_id);

CREATE TABLE receipts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    uuid         NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  file_path  varchar(255) NOT NULL,
  mime_type  varchar(60)  NOT NULL,
  raw_text   text,
  status     receipt_status NOT NULL DEFAULT 'PROCESSED',
  created_at timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX receipts_bill_id_idx ON receipts(bill_id);

CREATE INDEX bills_user_id_idx ON bills(user_id);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id    uuid         REFERENCES bills(id) ON DELETE CASCADE,
  type       varchar(20)  NOT NULL,              -- BILL_CREATED | PAID | BILL_DONE | REMINDER | LINK_OPENED
  title      varchar(120) NOT NULL,
  body       varchar(255) NOT NULL,
  read_at    timestamptz,
  created_at timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_created_idx ON notifications(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER bills_set_updated_at BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
