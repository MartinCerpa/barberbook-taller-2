# Validación de la preversión académica

Fecha de ejecución: 20 de octubre de 2026.

## Comandos ejecutados

- Instalación con npm: correcta.
- `npm test`: 71 aprobadas, cero fallos; incluye siete pruebas nuevas de feriados.
- `npm run lint`: sin incidencias.
- `npm run build`: compilación de producción correcta, 82 módulos.
- `npm run dev -- --host 127.0.0.1`: servidor funcionando en puerto 5174.
- `npm audit --omit=dev`: cero vulnerabilidades. Se actualizó la dependencia transitiva source-map-js tras el aviso inicial de instalación.

Los tests de API usan respuestas controladas para probar errores y datos inválidos; no son evidencia de disponibilidad del proveedor. La consulta real se comprobó por separado.

## Verificación real en navegador

- Perfil público y flujo de selección de servicio/fecha/hora.
- Feriados reales de 2026: 16 nacionales públicos tras filtrar la respuesta.
- Selección del 31 de octubre, Reformation Day, sin impedir la reserva.
- Teléfono de tres dígitos mantiene «Revisar solicitud» deshabilitado.
- Teléfono ficticio completo permite revisar y enviar.
- «Cliente Prueba Taller» aparece en Solicitudes; confirmación elimina su tarjeta pendiente.
- Recarga del navegador y selección del mismo día en Agenda mantienen la atención confirmada.
- Rechazo de una solicitud de muestra aparece en la pestaña Rechazadas.
- Se bloqueó temporalmente la conexión a Nager.Holidays en la pestaña de prueba: mensaje claro y botón de reintento, sin impedir usar Agenda.
- Se retiró el bloqueo y se reintentó: respuesta HTTP 200 y recuperación de feriados. La respuesta del navegador pudo usar su caché HTTP; además se realizó una petición HTTP independiente al proveedor.
- Revisión visual en 375 px (tema oscuro, calendario) y 1280 px (tema claro, Agenda). Sin desbordamiento horizontal de página en las vistas comprobadas; carruseles internos conservan desplazamiento.
- Consulta de consola tras el recorrido: sin errores ni advertencias de aplicación capturados.

No se afirma una auditoría exhaustiva de todos los navegadores, tamaños ni combinaciones de vistas. Los estados de JSON inválido y respuesta vacía se cubrieron mediante tests, no alterando la API real.

## Separación del producto

Código extraído por lectura de `b1aa52c`. No se copió historial Git, variables de entorno, base de datos ni datos de un navegador comercial. La reserva de prueba queda únicamente en el origen académico local. No se ejecutaron operaciones Git de escritura.

## Pendientes para el estudiante

Completar integrantes reales, revisar personalmente el código y practicar la defensa. Crear el repositorio académico independiente y realizar Git Flow auténtico. Confirmar con el docente la aceptación del código reutilizado y declarado. No se pueden inventar estas evidencias ni garantizar una nota.
