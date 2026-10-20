# BarberBook — Taller Evaluado 2

Versión académica e independiente de BarberBook. Es una aplicación frontend de demostración: no corresponde al producto comercial ni debe usarse con datos personales reales.

**Integrantes:** completar con los nombres reales antes de entregar.

## Problema y usuarios

BarberBook organiza solicitudes de horas que normalmente se coordinan mediante mensajes. El cliente puede elegir un servicio, fecha y horario. El profesional puede revisar la solicitud y verla en su agenda después de confirmarla.

## Funcionalidades principales

- Perfil público ficticio de un profesional.
- Reserva por servicio, fecha y horario.
- Formulario controlado con validación de nombre y teléfono chileno.
- Consulta de feriados de Chile mediante Nager.Holidays.
- Envío, confirmación y rechazo de solicitudes.
- Agenda y panel profesional de demostración.
- Persistencia local al recargar la página.
- Diseño responsive y temas claro/oscuro.

Los feriados solo entregan información. No bloquean automáticamente una fecha porque el profesional podría trabajar ese día.

## Tecnologías

- React 19 y JavaScript/JSX.
- Vite 8.
- CSS responsive y algunas utilidades de Bootstrap 5.3.
- Fetch para consultar Nager.Holidays.
- localStorage para conservar datos de demostración.
- `node:test` para pruebas y Oxlint para revisión del código.

Este taller no utiliza backend propio, base de datos ni autenticación real.

## Instalación

Requisito recomendado: Node.js 24 LTS y npm.

```powershell
cd C:\Users\Martin\barberbook-taller-2
npm ci
npm run dev
```

La aplicación queda disponible en `http://localhost:5174`.

Otros comandos:

```powershell
npm test
npm run lint
npm run build
npm run preview
```

## Estructura principal

```text
src/
  components/booking/  pasos de la reserva
  components/admin/    componentes del panel
  hooks/                carga de feriados
  pages/                perfil y páginas del panel
  data/                 datos ficticios
  services/             reservas, almacenamiento y API
  styles/               estilos responsive
tests/                  pruebas de lógica
docs/                   diseño, defensa y validación
```

La navegación usa hash, por ejemplo `#inicio`, `#/panel/requests` y `#/panel/schedule`.

## API pública

Se utiliza [Nager.Holidays](https://nagerholidays.com/api) mediante:

```text
GET https://nagerholidays.com/api/v4/Holidays/CL/{year}
```

La aplicación consulta el año necesario, valida el JSON y conserva solamente feriados nacionales de Chile de tipo público. Los nombres se presentan en español mediante una tabla explícita de equivalencias; si un nombre no tiene traducción confirmada, se conserva el original.

Mientras se consulta se muestra un estado de carga. Si ocurre un error, aparece una opción de reintento y la reserva sigue funcionando. No se envían a la API nombres, teléfonos ni reservas.

## Datos y persistencia

Los datos del profesional, servicios y clientes son ficticios. Se guardan localmente con claves propias de este proyecto, por lo que existen solo en el navegador y origen utilizados. Cambiar de navegador o limpiar localStorage elimina esa información.

## Procedencia del proyecto

Esta versión reutiliza el frontend histórico del repositorio BarberBook, commit `b1aa52c`. Se conservaron componentes, estilos y reglas locales. No se copiaron backend, base de datos, variables de entorno ni historial Git del producto comercial.

## Uso de Inteligencia Artificial

Se utilizó OpenAI Codex como apoyo para:

- adaptar el frontend histórico a un proyecto académico independiente;
- crear datos ficticios de un barbero, servicios, clientes y solicitudes, evitando datos personales reales;
- integrar y probar la consulta de feriados;
- revisar código y redactar documentación.

Prompt real resumido: «Construir una preversión académica independiente desde `b1aa52c`, sin tocar el producto comercial; integrar Nager.Holidays con Fetch, carga, error y reintento, manteniendo las reservas locales».

La documentación y el código deben ser revisados personalmente por el estudiante antes de la entrega. No se atribuyen revisiones manuales, aprendizajes ni decisiones que todavía no hayan sido confirmados por él.

## Limitaciones

- No existe backend, cuenta de usuario ni seguridad real.
- El panel está abierto y solo sirve para demostración.
- La información no se sincroniza entre dispositivos.
- Los feriados requieren Internet; las reservas locales no.
- No se envían mensajes, se procesan pagos ni se crean reservas comerciales.

## Documentos de apoyo

- [Diseño](docs/diseno.md)
- [Guía de defensa](docs/defensa.md)
- [Validación](docs/validacion.md)

Antes de entregar falta completar integrantes, revisar personalmente el contenido y crear evidencia Git Flow auténtica en un repositorio académico separado. No se deben fabricar commits ni revisiones.
