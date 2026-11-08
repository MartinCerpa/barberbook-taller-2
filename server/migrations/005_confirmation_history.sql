ALTER TABLE bookings ADD COLUMN confirmed_at timestamptz;
UPDATE bookings SET confirmed_at=created_at WHERE status IN ('confirmed','completed','no_show','cancelled');
