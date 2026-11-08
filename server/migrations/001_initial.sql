CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE branches (
  id text PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
  address text NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE users (
  id text PRIMARY KEY, name text NOT NULL, phone text UNIQUE,
  role text NOT NULL CHECK(role IN ('customer','professional','admin')),
  CHECK(phone IS NULL OR phone ~ '^\+569[0-9]{8}$')
);
CREATE TABLE professionals (
  id text PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES users(id),
  branch_id text NOT NULL REFERENCES branches(id), name text NOT NULL,
  title text NOT NULL DEFAULT '', bio text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
  UNIQUE(id,branch_id)
);
CREATE TABLE services (
  id text PRIMARY KEY, branch_id text NOT NULL REFERENCES branches(id),
  name text NOT NULL, description text NOT NULL DEFAULT '',
  duration integer NOT NULL CHECK(duration BETWEEN 5 AND 480),
  price integer NOT NULL CHECK(price BETWEEN 0 AND 100000000), active boolean NOT NULL DEFAULT true,
  UNIQUE(id,branch_id)
);
CREATE TABLE modules (
  id text PRIMARY KEY, branch_id text NOT NULL REFERENCES branches(id),
  professional_id text NOT NULL, name text NOT NULL, active boolean NOT NULL DEFAULT true,
  FOREIGN KEY(professional_id,branch_id) REFERENCES professionals(id,branch_id),
  UNIQUE(id,professional_id,branch_id)
);
CREATE TABLE availability (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  professional_id text NOT NULL REFERENCES professionals(id), weekday integer NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_minute integer NOT NULL CHECK(start_minute >= 0), end_minute integer NOT NULL CHECK(end_minute <= 1440),
  CHECK(start_minute < end_minute),
  EXCLUDE USING gist (professional_id WITH =, weekday WITH =, int4range(start_minute,end_minute,'[)') WITH &&)
);
CREATE TABLE availability_blocks (
  id text PRIMARY KEY, professional_id text NOT NULL REFERENCES professionals(id),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK(ends_at > starts_at)
);
CREATE TABLE bookings (
  id text PRIMARY KEY, customer_id text NOT NULL REFERENCES users(id),
  branch_id text NOT NULL REFERENCES branches(id), professional_id text NOT NULL,
  service_id text NOT NULL, duration integer NOT NULL CHECK(duration BETWEEN 5 AND 480),
  price integer NOT NULL CHECK(price >= 0), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','no_show')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at = starts_at + duration * interval '1 minute'),
  FOREIGN KEY(professional_id,branch_id) REFERENCES professionals(id,branch_id),
  FOREIGN KEY(service_id,branch_id) REFERENCES services(id,branch_id),
  EXCLUDE USING gist (professional_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
    WHERE (status IN ('pending','confirmed','completed','no_show'))
);
CREATE TABLE tickets (
  id text PRIMARY KEY, number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  customer_id text NOT NULL REFERENCES users(id), branch_id text NOT NULL REFERENCES branches(id),
  service_id text NOT NULL, professional_id text, module_id text,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','called','completed','cancelled')),
  duration integer NOT NULL CHECK(duration BETWEEN 5 AND 480),
  created_at timestamptz NOT NULL DEFAULT now(), called_at timestamptz, completed_at timestamptz,
  FOREIGN KEY(service_id,branch_id) REFERENCES services(id,branch_id),
  FOREIGN KEY(module_id,professional_id,branch_id) REFERENCES modules(id,professional_id,branch_id),
  CHECK((status = 'pending' AND called_at IS NULL AND completed_at IS NULL AND module_id IS NULL AND professional_id IS NULL)
    OR (status = 'cancelled' AND called_at IS NULL AND completed_at IS NULL)
    OR (status = 'called' AND called_at IS NOT NULL AND completed_at IS NULL AND module_id IS NOT NULL AND professional_id IS NOT NULL)
    OR (status = 'completed' AND called_at IS NOT NULL AND completed_at >= called_at AND module_id IS NOT NULL AND professional_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_called_per_module ON tickets(module_id) WHERE status='called';
CREATE UNIQUE INDEX one_called_per_professional ON tickets(professional_id) WHERE status='called';
CREATE INDEX pending_ticket_fifo ON tickets(branch_id,created_at,number) WHERE status='pending';
CREATE TABLE event_outbox (
  id uuid PRIMARY KEY, entity_id text NOT NULL, entity_type text NOT NULL,
  action text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}', delivered_at timestamptz
);
