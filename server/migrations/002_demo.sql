INSERT INTO branches(id,name,address) VALUES ('branch-demo','BarberBook Académico','Dirección ficticia, Santiago');
INSERT INTO users(id,name,role) VALUES ('user-matias','Matías Demo','professional');
INSERT INTO professionals(id,user_id,branch_id,name,title,bio)
VALUES ('professional-matias','user-matias','branch-demo','Matías','Especialista en cortes y barba','Cortes precisos y atención cercana. Perfil ficticio académico.');
INSERT INTO modules(id,branch_id,professional_id,name) VALUES ('module-demo','branch-demo','professional-matias','Sillón 1');
INSERT INTO services(id,branch_id,name,description,duration,price) VALUES
('haircut','branch-demo','Corte de cabello','Corte personalizado y terminaciones cuidadas.',45,12000),
('haircut-beard','branch-demo','Corte + barba','Servicio completo para renovar tu estilo.',60,16000),
('beard','branch-demo','Barba','Perfilado, rebaje y acabado profesional.',30,8000);
INSERT INTO availability(professional_id,weekday,start_minute,end_minute)
SELECT 'professional-matias',d,s,e FROM generate_series(1,5) d CROSS JOIN (VALUES(600,780),(900,1140)) hours(s,e);
INSERT INTO availability(professional_id,weekday,start_minute,end_minute) VALUES ('professional-matias',6,600,960);
