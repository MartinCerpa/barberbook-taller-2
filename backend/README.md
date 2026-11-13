# Backend profesional de BarberBook Taller 3

Express y PostgreSQL atienden catálogo, disponibilidad, reservas y el panel React profesional, con Agenda y cuatro apartados de Ajustes. Se conserva la arquitectura sencilla, sin JWT, frameworks o bases adicionales.

## Ejecución y credenciales iniciales

Desde la raíz del proyecto, con PostgreSQL académico iniciado y `.env` configurado:

```powershell
npm run db:setup --prefix backend
npm run auth:setup --prefix backend
npm run dev --prefix backend
```

`auth:setup` prepara las columnas necesarias y configura el primer profesional llamado Matías. Usa `matiasbarber@gmail.com` por defecto; puede cambiarse mediante `MATIAS_EMAIL`. La contraseña aleatoria se entrega únicamente en `.runtime/auth/matias-login.txt`, ignorado por Git. En Windows el archivo queda limitado al usuario actual y SYSTEM; en sistemas POSIX se crea con permisos 0600. No se imprime la contraseña, no se escribe en la semilla y una segunda ejecución conserva las credenciales existentes. Puede suministrarse `MATIAS_INITIAL_PASSWORD` mediante un entorno privado (12 a 128 caracteres).

No reutilizar credenciales comerciales. El script no proporciona restablecimiento ni sobrescribe el archivo privado. Si una configuración falla y deja un archivo incompleto, revisarlo localmente antes de volver a intentar; no publicarlo para diagnosticarlo.

## Endpoints

Las rutas indicadas tienen prefijo `/api`. Respuestas correctas: `{ "data": ... }`; errores: `{ "error": "mensaje" }`.

| Método y ruta | Entrada / comportamiento |
| --- | --- |
| `POST /auth/login` | JSON `{email,password}`. Establece cookie y devuelve identidad y `csrfToken` |
| `GET /auth/session` | Requiere cookie. Recupera identidad, modalidad actual y `csrfToken` |
| `POST /auth/logout` | Cookie y `X-CSRF-Token`. Revoca sesión SQL y borra cookie |
| `GET /professional/bookings` | Cookie. Solo reservas propias, por `created_at,id` ascendente |
| `GET /professional/bookings?status=pending` | Filtro opcional: pending, confirmed, rejected, cancelled o completed |
| `PATCH /professional/bookings/:id/status` | Cookie, CSRF y JSON `{ "status": "confirmed" }` o `rejected` |
| `PATCH /professional/settings` | Cookie, CSRF y JSON `{ "automatic_approval": true }` o `false` |

Los endpoints públicos existentes continúan disponibles: `GET /professionals`, `GET /services`, `GET /availability`, `POST /bookings` y `GET /health`. Los catálogos no exponen correo, contraseña ni hash.

Guardar la cookie del login y enviar el token devuelto en la cabecera `X-CSRF-Token` para cada escritura privada, incluido logout. El frontend usa el proxy `/api` de Vite. Mantener el mismo host: `localhost` y `127.0.0.1` tienen cookies distintas. No colocar el token en la URL ni registrar contraseñas o cookies en logs.

HTTP: 400 datos/filtros inválidos, 401 sin sesión o credenciales incorrectas, 403 CSRF/origen inválido, 404 reserva inexistente o ajena, 409 conflicto/FIFO/transición inválida, 422 jornada/fecha/duración incompatible y 429 límite de login. Los errores internos se ocultan.

## Cómo pasa una solicitud de pending a confirmed

1. La identidad se obtiene de la sesión, no de un `professionalId` enviado por el cliente.
2. La transacción bloquea la fila del profesional. Creación pública, confirmación y cambio de modalidad se coordinan mediante ese mismo bloqueo de fila.
3. Se localiza y bloquea la reserva propia. Solo `pending` puede pasar a `confirmed` o `rejected`; repetir exactamente el estado es idempotente.
4. Al confirmar, se revalidan futuro, jornada, cadencia y conflictos con atenciones confirmadas/completadas, en `America/Santiago`. Se conserva la duración solicitada almacenada en inicio/término, aunque cambie el catálogo. La hora se compara con el reloj actual de PostgreSQL después de esperar el bloqueo.
5. FIFO comprueba si existe una pendiente anterior que se solape y siga siendo elegible. Si existe, responde 409 y no cambia estados. Si no existe, actualiza la reserva y confirma la transacción.

FIFO significa **orden de registro SQL** por `(created_at,id)`, no orden de la fecha agendada ni orden de llegada a la red. Los registros nuevos toman `clock_timestamp()` dentro del bloqueo; el ID desempata timestamps iguales. PostgreSQL compara los timestamps con su precisión completa, sin redondearlos a milisegundos de JavaScript.

Una anterior es elegible cuando aún es futura, pertenece a la jornada y no se solapa con una atención confirmada/completada. Una anterior incompatible no bloquea otra que sí pueda atenderse. FIFO solo afecta solicitudes que compiten por un intervalo del mismo profesional, incluso si son de servicios diferentes; no bloquea horas independientes. Se puede rechazar una pendiente sin esperar a otras.

## Aprobación automática y pendientes existentes

- Manual: la creación válida queda `pending`.
- Automática: se confirma una nueva reserva disponible solo si no adelanta una pendiente anterior elegible que se solape. En caso de prioridad FIFO, la nueva queda `pending`.
- Cambiar la modalidad solo modifica `automatic_approval`; no procesa en lote solicitudes antiguas ni modifica las ya confirmadas.
- Tras una confirmación, otras solicitudes competidoras permanecen `pending`, pero no pueden confirmarse mientras exista ese conflicto. El profesional puede rechazarlas. No se introduce un estado nuevo ni rechazo masivo automático.

## Seguridad y persistencia

`professionals` incorpora únicamente `email` y `password_hash` opcionales, con índice único de correo sin distinguir mayúsculas. `professional_sessions` guarda profesional, hash SHA-256 del token, CSRF y vencimiento. Inicializar aplica SQL idempotente: no elimina reservas, tablas ni volúmenes.

Contraseñas: scrypt nativo de Node, sal aleatoria de 16 bytes, `N=131072,r=8,p=1`, clave derivada de 64 bytes y comparación de tiempo constante. Sesiones: token aleatorio de 32 bytes, ocho horas, cookie HttpOnly/SameSite Strict y revocación en PostgreSQL. El login rota el token anterior y limita a diez fallos por IP durante quince minutos. Se verifica el origen del login; CSRF protege escrituras autenticadas.

En HTTP local la cookie no es Secure. En producción `NODE_ENV=production` la marca Secure; también puede activarse con `COOKIE_SECURE=true`. Esto requiere HTTPS. No se añadió ni validó un despliegue público, recuperación de contraseña o segundo factor. El contador de fallos vive en memoria y se reinicia con el proceso; las sesiones sí persisten en PostgreSQL. Cambios directos por un administrador SQL no pasan por las reglas de la API.

Referencias: [scrypt en Node.js](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [almacenamiento de contraseñas OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) y [protección CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Archivos nuevos y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `src/app.js` | Ensambla Express y permite probar la misma API con una base aislada; `server.js` conserva arranque y conexiones |
| `src/services/authService.js` | Hash, verificación, sesiones SQL y límite de intentos |
| `src/controllers/authController.js` | Entradas de login, cookie, sesión y comprobación CSRF |
| `src/routes/authRoutes.js` | Endpoints de autenticación |
| `src/services/professionalService.js` | Cambio de modalidad del profesional |
| `src/controllers/professionalController.js` | Validación HTTP e identidad tomada de la sesión |
| `src/routes/professionalRoutes.js` | Rutas privadas con sesión y CSRF |
| `src/database/setupCredentials.js` | Creación privada y reproducible de credenciales iniciales |
| `test/professional.test.js` | Casos HTTP contra PostgreSQL real aislado, incluidos FIFO y concurrencia |

`bookingService.js` mantiene y amplía las reglas existentes; `availabilityService.js` sigue siendo la comprobación común. Los controladores públicos reciben la conexión de la aplicación para probar sus rutas reales sin duplicarlas ni simular las bases.

## Verificación

```powershell
npm test --prefix backend
```

Requiere PostgreSQL funcionando y permiso para crear bases. Las suites crean bases nuevas con prefijo `barberbook_t3_test_` y `barberbook_t3_auth_`; las conservan y no reinicializan la base de demostración. Las credenciales de prueba se generan en memoria y nunca son las credenciales privadas de Matías.

Se comprueban catálogo/disponibilidad originales, login correcto/incorrecto, cookie, sesión SQL, CSRF, propiedad profesional, orden cronológico y desempates, confirmación/rechazo, jornada/duración, superposición, solicitudes concurrentes, FIFO automático, cambios de modalidad, rotación, expiración y logout. El panel React consume las rutas privadas mediante el proxy `/api`, cookie HttpOnly y CSRF en memoria.

## Agenda y recuperación de Ajustes

### Diagnóstico

La Agenda anterior construía las fechas con `new Set([today, ...confirmed.map(...)])`: solo hoy y los días con reservas confirmadas. Por eso aparecían el 13 y el 14 de noviembre; no era un fallo CSS ni significaba que los demás días estuvieran cerrados. Ahora PostgreSQL entrega catorce fechas consecutivas desde el día actual en `America/Santiago`, incluidos días cerrados y sin reservas.

Configuración contenía una sola tarjeta y un formulario de aprobación: no se habían migrado perfil, servicios ni jornada porque faltaban sus operaciones privadas. Se recuperan las cuatro tarjetas, sus iconos, organización y formularios originales, conectados a PostgreSQL.

### Nuevos endpoints

Todos llevan prefijo `/api`, requieren sesión y devuelven `{data: ...}`. Las escrituras requieren `X-CSRF-Token`. La identidad se toma de la sesión, nunca del cuerpo o una URL suministrada por el cliente.

| Método y ruta | Contrato |
| --- | --- |
| `GET /professional/agenda` | Sin parámetros. `{timeZone,days}` con 14 fechas, intervalos laborales, oferta por servicio y reservas propias pending/confirmed |
| `GET /professional/profile` | Datos públicos editables del profesional autenticado |
| `PATCH /professional/profile` | Uno o más de `name,bio,title,specialties,location,instagram,whatsapp`; no cambia credenciales |
| `GET /professional/services` | Servicios propios, incluidos inactivos |
| `POST /professional/services` | `{name,duration_minutes,price,active?}` |
| `PATCH /professional/services/:id` | Uno o más de esos campos, solo para servicios propios |
| `GET /professional/working-hours` | `{days:[{day,enabled,intervals:[{start,end}]}]}`; lunes=1, domingo=0 |
| `PUT /professional/working-hours` | La semana completa, exactamente siete días; días cerrados con `intervals:[]` |

Ejemplo de día: `{"day":1,"enabled":true,"intervals":[{"start":"10:00","end":"13:00"},{"start":"15:00","end":"19:00"}]}`. Se admiten hasta cuatro intervalos diarios; se rechazan intervalos vacíos, invertidos y superpuestos. El editor guarda la semana mediante un botón explícito para validar el conjunto de forma atómica.

Servicios: nombre de 1–100 caracteres, duración de 5–480 minutos en múltiplos de 5 y precio entero de 0–100000000. No se duplican nombres propios al ignorar mayúsculas y espacios exteriores. Desactivar retira el servicio del catálogo público y de nuevas reservas; conserva el historial y permite resolver pendientes existentes con las validaciones habituales.

Errores: 400 datos inválidos, 401 sesión ausente/vencida, 403 CSRF, 404 servicio ajeno/inexistente, 409 nombre duplicado o jornada incompatible con una reserva confirmada.

### Persistencia y decisiones

- `professionals`: añade título, especialidades, ubicación, Instagram y WhatsApp, inicialmente vacíos. Nombre y biografía ya existían. Las consultas públicas excluyen correo de login y hash de contraseña.
- `services`: añade `active`, verdadero para servicios existentes. No se eliminan registros.
- `bookings`: añade copias del nombre y precio del servicio; inicio y término ya conservan la duración solicitada. Editar el catálogo no reescribe esas copias. Las reservas anteriores reciben los valores conocidos al migrar: no se pueden reconstruir cambios históricos que nunca se registraron.
- `working_hours`: conserva su esquema. La escritura reemplaza solo la semana propia en una transacción. Reutiliza `assertBookingAvailable` para proteger cada reserva confirmada futura o en curso, excluyéndola de su propia comprobación de ocupación. Si una jornada cambia de forma incompatible su intervalo o cadencia, se revierte la semana completa con 409. No se cancelan ni reprograman reservas automáticamente; las pendientes se conservan y se revalidan al confirmar.
- Creación, confirmación, edición de servicios y jornada se coordinan mediante el bloqueo de la misma fila profesional. El catálogo se lee después de adquirir el bloqueo. Se mantienen las reglas FIFO y la autenticación existentes.
- La inicialización SQL es idempotente. La semilla actúa solo sobre instalaciones vacías: repetir `db:setup` no repone servicios renombrados ni días cerrados y no duplica a un profesional cuyo nombre cambió. `auth:setup` reconoce credenciales por el correo configurado aunque cambie el nombre público.

Agenda reutiliza `consultarDisponibilidad`, la misma función de las reservas públicas y confirmaciones, por cada servicio activo. React combina esa oferta SQL con reservas reales, conservando las tarjetas y el desplazamiento horizontal original. Una fecha sin reservas puede seguir teniendo horas disponibles. Las solicitudes se resuelven desde su sección, con validación backend y FIFO.

### Archivos de esta recuperación

Nuevos en backend:

- `src/controllers/configurationController.js`: contratos HTTP de Agenda y Ajustes.
- `src/services/agendaService.js`: horizonte SQL y combinación de oferta real por servicio.
- `src/services/profileService.js`: edición de datos públicos propios.
- `src/services/serviceManagementService.js`: catálogo privado, creación, edición y desactivación.
- `src/services/workingHoursService.js`: validación y transacción de jornada semanal.
- `test/configuration.test.js`: HTTP con PostgreSQL real aislado, incluidos cambios concurrentes.

Modificados en backend: `README.md`, `src/database/schema.sql`, `src/database/seed.sql`, `src/database/setupCredentials.js`, `src/routes/professionalRoutes.js`, `src/services/availabilityService.js`, `src/services/bookingService.js` y `src/services/catalogService.js`.

Nuevos en frontend:

- `src/components/admin/ProfileSettings.jsx`, `WorkingHoursSettings.jsx`, `ReservationSettings.jsx` y `ServiceCard.jsx`: formularios adaptados del original con operaciones persistentes.
- `src/components/admin/SettingsBackButton.jsx` y `ResourceState.jsx`: navegación y estados comunes.
- `src/pages/ServicesPage.jsx`: administración de servicios con sus tarjetas originales.
- `src/hooks/useProfessionalResource.js`: lecturas privadas abortables y tratamiento de sesión vencida.
- `src/utils/agendaItems.js`: presentación de oferta y reservas, sin generar ocupación.
- `test/agenda.test.js`: verificaciones de esa combinación.

Modificados en frontend: `src/pages/SchedulePage.jsx`, `src/pages/SettingsPage.jsx`, `src/pages/ProfessionalPanel.jsx`, `src/pages/PublicBarberPage.jsx`, `src/components/admin/ScheduleItem.jsx`, `src/components/public/ProfileHero.jsx`, `src/services/professionalApi.js`, `src/styles/admin.css` y `src/styles/panel.css`. Los estilos se extraen selectivamente del original; no se incorpora su arquitectura ni el stylesheet completo.

### Verificación adicional y límites

```powershell
npm test --prefix backend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

`backend/test/configuration.test.js` crea y conserva una base aislada `barberbook_t3_config_*` para comprobar configuración, historial, autorización, propiedad, calendario, rollback e inicialización. No usa credenciales privadas ni reinicializa la base de demostración. `frontend/test/agenda.test.js` comprueba que las tarjetas no fabriquen ocupación ni dupliquen intervalos confirmados.

Pendientes: imágenes con almacenamiento real, excepciones/bloqueos por fecha, reprogramación, resultados/finanzas y preferencias adicionales de anticipación o cancelación. No se presentan controles simulados para ellas.
