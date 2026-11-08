-- El teléfono identifica al usuario; el nombre ingresado se conserva en cada operación.
ALTER TABLE bookings ADD COLUMN customer_name_snapshot text;
UPDATE bookings b SET customer_name_snapshot=u.name FROM users u WHERE u.id=b.customer_id;
ALTER TABLE bookings ALTER COLUMN customer_name_snapshot SET NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT booking_customer_name_length CHECK(length(customer_name_snapshot) BETWEEN 2 AND 100);
ALTER TABLE tickets ADD COLUMN customer_name_snapshot text;
UPDATE tickets t SET customer_name_snapshot=u.name FROM users u WHERE u.id=t.customer_id;
ALTER TABLE tickets ALTER COLUMN customer_name_snapshot SET NOT NULL;
ALTER TABLE tickets ADD CONSTRAINT ticket_customer_name_length CHECK(length(customer_name_snapshot) BETWEEN 2 AND 100);
