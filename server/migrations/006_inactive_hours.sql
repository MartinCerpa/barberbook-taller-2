-- Conservar los intervalos al cerrar temporalmente un día de la semana.
ALTER TABLE professionals ADD COLUMN inactive_hours jsonb NOT NULL DEFAULT '{}';
-- Restaurar el perfil también debe usar la descripción pública del producto.
UPDATE professionals SET profile_baseline=jsonb_set(profile_baseline,'{bio}',to_jsonb('Cortes precisos, atención cercana y un espacio pensado para que cada visita se sienta personal.'::text))
WHERE id='professional-matias' AND profile_baseline->>'bio' LIKE '%Perfil ficticio académico.%';
