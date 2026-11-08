# Validación ejecutada el 8 de noviembre de 2026

La validación se realizó en Windows, dentro de `C:\Users\Martin\barberbook-taller-2`, rama `feature/hito3-fullstack`, sin clones, worktrees, push ni merges. Se utilizaron datos ficticios. Los resultados son verificaciones ejecutadas por Codex, no una revisión humana ni una calificación docente.

## Resultados

| Verificación | Resultado observado |
| --- | --- |
| `npm test` | 78 aprobadas: 74 históricas intactas y 4 unitarias nuevas; una suite de integración omitida explícitamente |
| `npm run test:integration` | 9/9 aprobadas según Node: contenedor de suite y 8 escenarios con PostgreSQL/MongoDB reales |
| `npm run test:e2e` | 5/5 aprobadas en Chromium, sin mocks del backend ni de las bases para los flujos operacionales |
| `npm run lint` | Sin errores ni advertencias |
| `npm run build` | Compilación de producción correcta con Vite 8.3.6 |
| `npm audit` después de actualizar Vite | Cero vulnerabilidades informadas |
| `npm audit --omit=dev` en la verificación final | Cero vulnerabilidades informadas |
| `git diff --check` | Sin errores de espacios |
| `/api/health` local | HTTP 200, PostgreSQL/MongoDB `connected`, cero eventos pendientes |
| Nager.Holidays, consulta externa real de CL/2026 | HTTP 200, 17 registros |
| Compose | YAML leído y cuatro servicios declarados; **no se ejecutó Docker** |

Se corrigieron durante el desarrollo un conflicto de tipado de parámetros SQL y selectores de pruebas de navegador. Las pruebas finales aprobaron después de esas correcciones; no se modificaron las 74 pruebas históricas para ocultar fallos.

## Alcance de las pruebas

Unitarias nuevas: fechas reales, teléfonos chilenos, límites de duración, campos desconocidos, aislamiento de nombres de bases, códigos HTTP, ocultamiento de errores internos y correspondencia del registro REST con Swagger. La prueba de indisponibilidad simula un error de conexión; no apaga bases ajenas.

Integración real: migraciones idempotentes, CRUD y FK de sucursal, creación/lectura SQL, reintentos idempotentes, nombres conservados por operación, intervalos solapados y adyacentes, dos escrituras concurrentes, exclusión directamente en PostgreSQL, oferta de disponibilidad, bloqueo/desbloqueo, estados inválidos, reprogramación, rechazo/cancelación, FIFO, llamado concurrente, finalización, métricas, historial y consulta desde conexiones nuevas.

La entrega de eventos se prueba con una falla simulada del escritor MongoDB para comprobar que SQL conserve el outbox; luego se entrega y consulta en MongoDB real. Se comprueba que repetir la entrega no duplique documentos. Esto no equivale a una prueba exhaustiva de recuperación ante cortes eléctricos o reinicios del sistema operativo.

Escenarios E2E:

1. Reserva mediante React, recarga, consulta SQL, confirmación desde Solicitudes, agenda actualizada y eventos MongoDB visibles.
2. Emisión de turno desde React, llamado con módulo, finalización y cambio de métricas.
3. Swagger UI ejecuta `GET /services` y muestra HTTP 200 con el catálogo real.
4. Viewport móvil 390 × 844, navegación sin desbordamiento horizontal y mensaje/reintento ante error simulado de red en `/services`.
5. Formularios React crean sucursal, profesional, módulo, jornada y servicio; se recupera el servicio después de recargar.

## Aislamiento y evidencia

Las bases de uso local son `barberbook_hito3`: PostgreSQL en 55433 y MongoDB en 27028, ambos autenticados y escuchando localhost. PostgreSQL usa un clúster propio en `.runtime/postgres`; MongoDB usa WiredTiger en `.runtime/mongo`. No se accedió al dominio comercial ni a otras bases operacionales.

Cada ejecución de integración o navegador crea bases académicas nuevas con nombres únicos. Se conservan; no se borran bases existentes. La última integración aprobada de esta sesión dejó `barberbook_hito3_test_ec7d4c41da40` como evidencia en ambas bases. Las pruebas E2E usan API 3004 y Vite 5175 temporalmente, con jornadas amplias exclusivamente en su base nueva. Esa jornada no reemplaza la semilla de la aplicación normal.

Capturas de ejecución real de las pruebas, copiadas a `docs/evidencias/` y revisadas visualmente:

- [Historial y eventos](evidencias/hito3-history-desktop.png).
- [Perfil móvil](evidencias/hito3-profile-mobile.png).
- [Turnos en móvil](evidencias/hito3-queue-mobile.png).
- [Swagger con una operación ejecutada](evidencias/hito3-swagger-executed.png).

Las capturas proceden de bases E2E, no de la base de demostración normal. Las trazas y capturas de fallos se generan en `test-results/`, excluido de Git. Los datos operacionales de demostración no se usan como evidencia inventada.

## Pendientes y límites

Docker no se encontró en PATH ni en la ruta habitual de Docker Desktop. Se entregan Dockerfiles, red/volúmenes aislados, healthchecks y Compose, pero no se afirma que sus imágenes hayan sido construidas o que los contenedores hayan iniciado. Instalar/iniciar Docker Desktop con Compose y ejecutar `docker compose up --build -d`; comprobar `docker compose ps`, salud y los flujos desde React. Detener antes la modalidad nativa para liberar los mismos puertos.

Pendientes humanos: revisar personalmente el código y documentos, validar la pertinencia de la adaptación con el docente y realizar la defensa. La bitácora de IA debe completarse con correcciones y aprendizajes reales del estudiante. No se probó autenticación porque no está implementada; la aplicación se limita a un entorno académico local.

Las preferencias locales avanzadas del prototipo no se consideran migradas por pasar sus pruebas históricas. La lógica activa usa datos SQL, confirmación manual y transiciones documentadas; las pruebas antiguas acreditan conservación del código anterior, no integración de todas sus opciones en el servidor.
