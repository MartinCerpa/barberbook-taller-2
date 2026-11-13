-- Semilla solo para instalaciones nuevas. db:setup no repone configuraciones editadas.
WITH new_professional AS (
 INSERT INTO professionals(name,automatic_approval)
 SELECT 'Matías',FALSE WHERE NOT EXISTS(SELECT 1 FROM professionals) RETURNING id
), initial_services(name,duration_minutes,price) AS (
 VALUES ('Corte de cabello',45,12000),('Corte + barba',60,16000),('Barba',30,8000)
), inserted_services AS (
 INSERT INTO services(professional_id,name,duration_minutes,price)
 SELECT p.id,s.name,s.duration_minutes,s.price FROM new_professional p CROSS JOIN initial_services s RETURNING id
), schedule AS (
 SELECT day AS weekday,start_minute,end_minute FROM generate_series(1,5) day
 CROSS JOIN (VALUES(600,780),(900,1140)) intervals(start_minute,end_minute)
 UNION ALL SELECT 6,600,960
)
INSERT INTO working_hours(professional_id,weekday,start_minute,end_minute)
SELECT p.id,s.weekday,s.start_minute,s.end_minute FROM new_professional p CROSS JOIN schedule s;
