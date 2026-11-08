ALTER TABLE professionals ADD COLUMN public_visible boolean NOT NULL DEFAULT false;
ALTER TABLE professionals ADD COLUMN profile jsonb NOT NULL DEFAULT '{}';
ALTER TABLE professionals ADD COLUMN profile_baseline jsonb NOT NULL DEFAULT '{}';
UPDATE professionals SET profile_baseline=jsonb_build_object('name',name,'title',title,'bio',bio);
ALTER TABLE professionals ADD COLUMN preferences jsonb NOT NULL DEFAULT '{"version":1,"confirmationMode":"manual","requestExpirationMinutes":null,"cancellationNoticeMinutes":20,"minimumAdvanceMinutes":0,"bookingHorizonDays":14}';
UPDATE professionals SET public_visible=true WHERE id='professional-matias';
UPDATE professionals SET bio='Cortes precisos, atención cercana y un espacio pensado para que cada visita se sienta personal.' WHERE id='professional-matias' AND bio LIKE '%Perfil ficticio académico.%';
UPDATE branches SET name='BarberBook' WHERE id=(SELECT branch_id FROM professionals WHERE id='professional-matias') AND name='BarberBook Académico';
ALTER TABLE services ADD COLUMN professional_id text REFERENCES professionals(id);
UPDATE services s SET professional_id=(SELECT p.id FROM professionals p WHERE p.branch_id=s.branch_id ORDER BY (p.id='professional-matias') DESC,p.id LIMIT 1);
ALTER TABLE services ADD COLUMN public_visible boolean NOT NULL DEFAULT true;
ALTER TABLE services ADD COLUMN public_price_visible boolean NOT NULL DEFAULT true;
ALTER TABLE users DROP CONSTRAINT users_phone_key;
CREATE TABLE professional_customers (
  professional_id text NOT NULL REFERENCES professionals(id), customer_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), trust_status text NOT NULL DEFAULT 'normal' CHECK(trust_status IN ('normal','requires_manual_approval')),
  notes text NOT NULL DEFAULT '',favorite_service text NOT NULL DEFAULT '', archived boolean NOT NULL DEFAULT false,
  PRIMARY KEY(professional_id,customer_id)
);
INSERT INTO professional_customers(professional_id,customer_id) SELECT DISTINCT professional_id,customer_id FROM bookings;
ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','no_show','expired'));
ALTER TABLE bookings DROP CONSTRAINT bookings_professional_id_tstzrange_excl;
ALTER TABLE bookings ADD CONSTRAINT bookings_professional_id_tstzrange_excl EXCLUDE USING gist (professional_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(status IN ('confirmed','completed','no_show'));
ALTER TABLE bookings ADD COLUMN expires_at timestamptz;
ALTER TABLE bookings ADD COLUMN expiration_reason text;
ALTER TABLE bookings ADD COLUMN confirmation_origin text NOT NULL DEFAULT 'manual' CHECK(confirmation_origin IN ('manual','automatic'));
ALTER TABLE bookings ADD COLUMN outcome_recorded_at timestamptz;
ALTER TABLE bookings ADD COLUMN is_late_cancellation boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TABLE professional_credentials (
  user_id text PRIMARY KEY REFERENCES users(id),email text NOT NULL UNIQUE,
  password_hash text NOT NULL,is_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE professional_sessions (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES professional_credentials(user_id),
  csrf_token text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX professional_sessions_expiry ON professional_sessions(expires_at);
CREATE TABLE booking_undo (
  token uuid PRIMARY KEY,professional_id text NOT NULL REFERENCES professionals(id),
  records jsonb NOT NULL,expires_at timestamptz NOT NULL DEFAULT now()+interval '2 minutes',used_at timestamptz
);
CREATE TABLE availability_exceptions (
  id text PRIMARY KEY,professional_id text NOT NULL REFERENCES professionals(id),date_id date NOT NULL,
  time text NOT NULL CHECK(time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),UNIQUE(professional_id,date_id,time)
);
