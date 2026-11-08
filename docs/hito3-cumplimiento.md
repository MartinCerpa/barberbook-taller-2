# Matriz de cumplimiento del Hito 3

Fuentes leídas: `Enunciado_Hito_3_Desarrollo_Web_Movil.docx` y `Rubrica taller 3.pdf`, disponibles en Downloads. El enunciado define continuidad, caso 3.3, PostgreSQL, MongoDB, REST, React, Swagger y Compose. El PDF de Canvas especifica las ponderaciones, total **100 puntos**; sus páginas 2–5 contienen los criterios. Las instrucciones operativas del usuario prevalecen sobre acciones sugeridas por los documentos: no se hizo push ni merge.

«Completado» significa implementado con evidencia técnica en esta sesión; no es una nota ni garantiza el puntaje. «Parcial» identifica una verificación o revisión pendiente. La evaluación final pertenece al docente.

| Etapa y criterio | Puntos de rúbrica | Estado | Evidencia concreta / pendiente |
| --- | ---: | --- | --- |
| 1. Continuidad con Taller 2 | 5 | Completado | Historial desde `e84fc03`; perfil y panel originales recuperados y conectados a API; 74 pruebas intactas. El propietario informa aprobación del producto en Taller 2; adaptación del Hito 3 por revisar con docente |
| 1. Ampliación del dominio | 5 | Completado | Sucursales, servicios, funcionarios/barberos, módulos, emisión, llamado, estados, espera e historial; E2E de turnos y administración |
| 1. Modelado y arquitectura | 5 | Completado | `hito3-arquitectura.md`, diagrama ER, migraciones 001–006, relaciones profesionales, autenticación, colección de eventos y outbox |
| 1. Diseño de API | 5 | Completado | `server/routes/endpoints.js`, `server/openapi.js`, contrato `/api/openapi.json` y Swagger |
| 2. Estructura del backend | 6 | Completado | Rutas, controladores, validaciones, servicios, repositorios, configuración y migraciones en `server/` |
| 2. API REST y reglas | 6 | Completado | Validaciones, duración/jornada, exclusión de solapamientos, estados y concurrencia probados en integración |
| 2. Persistencia SQL | 6 | Completado | PostgreSQL real, PK/FK/CHECK/GiST, CRUD, transacciones y lectura desde conexión nueva |
| 2. Persistencia NoSQL | 6 | Completado | MongoDB real autenticado, `events`, escritura/consulta y reintento idempotente del outbox; consulta desde React |
| 2. Swagger y errores | 6 | Completado | Modelos de entrada/salida, códigos, errores centralizados y `GET /services` ejecutado desde Swagger UI |
| 3. Integración React–API | 5 | Completado | Perfil/catálogo, reservas, agenda, fila, administración, clientes, métricas y eventos desde API; sin fallback operacional local |
| 3. Funcionalidad y flujos | 5 | Completado | 7 escenarios E2E reales: reservas, login/logout, agenda/resultados, clientes, finanzas, tarjetas, ajustes, móvil, Swagger y extensión FIFO separada |
| 3. Experiencia y estados | 5 | Completado | Estilos originales, carga/error/vacío/éxito, reintentos y revisión móvil sin desbordamiento |
| 3. Separación frontend | 5 | Completado | Cliente HTTP, estado remoto en memoria y adaptadores; App monta el panel original protegido; extensión académica en ruta separada |
| 4. Flujo end-to-end | 6 | Completado | React → Express → PostgreSQL → outbox/MongoDB → historial; captura y pruebas `e2e/fullstack.spec.js` |
| 4. Pruebas y validaciones | 5 | Completado | 78 pruebas unitarias/históricas, integración 14/14 según Node (13 escenarios y suite), E2E 7/7, lint/build; alcance exacto en validación |
| 4. Docker y reproducibilidad | 5 | Completado | `docker compose config --quiet`, construcción, cuatro servicios operativos, flujos desde React y Swagger; persistencia SQL/Mongo tras detener y reiniciar sin borrar volúmenes. Evidencia en `hito3-validacion.md` |
| 4. Git y colaboración | 4 | Parcial | Misma carpeta/rama, historia y commits descriptivos. Sin push/PR nuevo/merge por restricción; no se inventan contribuciones |
| 4. README y documentación | 3 | Completado | README, arquitectura, modelo, API, entorno, datos, pruebas, límites y guion; archivo histórico preservado |
| 4. Uso de IA | 3 | Parcial | Herramienta, prompt, resultados y verificación automática documentados. Revisión, correcciones y aprendizaje humanos pendientes |
| 4. Demostración y defensa | 4 | Pendiente | Guion preparado y automatización ejecutada; **defensa individual del estudiante aún no realizada/verificada** |

## Requisitos específicos del caso Sistema de turnos

Esta tabla describe la extensión del enunciado oficial, conservada en `#/academic/...` con permiso administrativo. El recorrido principal corresponde al producto BarberBook de reservas por hora: Tu jornada, Solicitudes, Agenda, Clientes, Finanzas, Servicios y Ajustes. Son alcances diferenciados; la aprobación previa informada por el propietario no sustituye la revisión docente de la adaptación del Hito 3.

| Requisito | Evidencia |
| --- | --- |
| Sucursales y servicios | CRUD REST + formularios; desactivación conserva referencias |
| Funcionarios y módulos | `users`, `professionals`, `modules`; asociación por sucursal validada |
| Emisión y asignación | `POST /tickets`, `POST /tickets/next`; módulo/profesional asignados transaccionalmente |
| Siguiente turno y estados | FIFO, pending → called → completed; cancelación de pendiente y protección ante concurrencia |
| Pendientes, llamados, finalizados | Panel Turnos, GET `/tickets`, métricas SQL |
| Historial y espera | Fechas de emisión/llamado/finalización, promedios SQL y `/history` |
| Persistencia SQL del caso | Sucursales, servicios, funcionarios, usuarios, turnos y relaciones; reservas agregadas para continuidad |
| NoSQL del caso | Eventos de estado y trazabilidad en MongoDB consultados desde API y frontend |
| API pública complementaria | Nager.Holidays conservada, con carga, error y reintento; consulta real HTTP 200 |

No se estima una nota ni se declaran los 100 puntos obtenidos. La revisión humana, defensa y eventual publicación autorizada deben resolverse antes de presentar la entrega como completamente validada.
