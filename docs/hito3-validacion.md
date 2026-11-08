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
| Compose | `config --quiet` aprobado, imágenes construidas y cuatro servicios iniciados; pruebas funcionales y persistencia tras reinicio aprobadas, detalladas más abajo |

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

## Validación adicional con Docker Compose

Después de habilitar SVM, reiniciar Windows e instalar Docker Desktop/WSL, el motor respondió como Linux. Docker Engine 29.9.2 y Compose 5.6.1 ejecutaron la configuración existente, sin cambios funcionales ni de infraestructura. Las imágenes ejecutaron Node 24.22.2, PostgreSQL 18.6 y MongoDB 8.0.34. No hubo puertos ocupados por la ejecución nativa tras el reinicio.

Se ejecutaron `docker compose config --quiet`, `docker compose up -d --build`, `docker compose ps`, revisión de logs y healthchecks. PostgreSQL, MongoDB y Express quedaron saludables; React/Nginx respondió HTTP 200. `/api/health` devolvió ambas bases conectadas y cero eventos pendientes. Las tres migraciones quedaron aplicadas en la base académica del contenedor.

La prueba de navegador utilizó el frontend compilado servido por Nginx en 5174, no el servidor Vite de pruebas. Se ejecutaron estos pasos contra los contenedores reales:

1. Consultar servicios y profesionales desde React.
2. Crear la reserva `2ce66941-65d1-4b98-9926-9d633dbfa6a5` desde el formulario público y verificar su estado pendiente con una consulta PostgreSQL.
3. Confirmarla desde Solicitudes, comprobar el estado SQL y verla en Agenda para el 10 de noviembre de 2026 a las 10:00.
4. Consultar sus eventos `booking.created` y `booking.confirmed` desde React/API y directamente en MongoDB.
5. Intentar otra reserva en el mismo intervalo y obtener HTTP 409 por solapamiento.
6. Crear datos ficticios adicionales para una sucursal, profesional, servicio de cinco minutos y módulo de demostración. Configurar una jornada para ese profesional mediante la API, sin modificar la jornada original de Matías.
7. Emitir, llamar, asignar y finalizar el turno `32bda4da-04e2-4ecf-9e04-ea8ba9c0f3b6` desde React; comprobar estado finalizado en PostgreSQL y eventos `ticket.issued`, `ticket.called` y `ticket.completed` en MongoDB.
8. Ejecutar `GET /services` desde Swagger UI, servido a través de Nginx, y obtener HTTP 200 con datos reales. No se observaron excepciones JavaScript en estos recorridos.

Se ejecutaron nuevamente `npm test` (78 aprobadas y la integración omitida explícitamente), `npm run test:integration` (9/9), `npm run lint` (sin advertencias) y `npm run build` (correcto). La suite de integración utilizó las bases Docker reales con una base nueva aislada `barberbook_hito3_test_be3894b87810`; no borró ni reinicializó las bases existentes. En los logs PostgreSQL quedaron dos rechazos esperados de estas pruebas negativas: una FK de módulos y la exclusión de reservas solapadas. Los cinco E2E previos corresponden a la validación inicial; los pasos anteriores documentan la prueba adicional sobre el despliegue Docker.

Para verificar persistencia y repetibilidad, se detuvieron los cuatro servicios con `docker compose stop --timeout 15` y se iniciaron otra vez con `docker compose up -d --wait --wait-timeout 120`. Se verificaron la misma reserva confirmada, el mismo turno finalizado y los cinco eventos MongoDB, una sola vez cada uno. Las URLs volvieron a responder y el outbox quedó sin pendientes. No se utilizó `down -v`, no se eliminaron volúmenes y no se detuvieron aplicaciones de otros proyectos.

Volúmenes comprobados: `barberbook-hito3-academico_academic-postgres` y `barberbook-hito3-academico_academic-mongo`. Los datos ficticios de la demostración se conservan para revisión personal. Capturas de esta ejecución Docker:

- [Reserva confirmada en Agenda](evidencias/hito3-docker-agenda.png).
- [Turno finalizado desde React](evidencias/hito3-docker-turno.png).
- [Operación ejecutada desde Swagger](evidencias/hito3-docker-swagger.png).

No se encontraron errores de la configuración Compose. Una selección de sucursal en la automatización inicial esperó datos recién creados antes de la actualización periódica del panel; se continuó con el panel recién cargado y el recorrido aprobó. No fue necesario cambiar código de la aplicación ni sus pruebas existentes.

## Pendientes y límites

No quedan bloqueos de Docker en este equipo. El frontend queda disponible en `http://127.0.0.1:5174/`, la API en `http://127.0.0.1:3003/api` y Swagger en `http://127.0.0.1:3003/api/docs/`, con los contenedores en ejecución. La aplicación continúa limitada a localhost y datos académicos ficticios.

Pendientes humanos: revisar personalmente el código y documentos, validar la pertinencia de la adaptación con el docente y realizar la defensa. La bitácora de IA debe completarse con correcciones y aprendizajes reales del estudiante. No se probó autenticación porque no está implementada; la aplicación se limita a un entorno académico local.

Las preferencias locales avanzadas del prototipo no se consideran migradas por pasar sus pruebas históricas. La lógica activa usa datos SQL, confirmación manual y transiciones documentadas; las pruebas antiguas acreditan conservación del código anterior, no integración de todas sus opciones en el servidor.
