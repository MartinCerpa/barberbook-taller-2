# Diseño del Taller Evaluado 2

Esta adaptación académica reutiliza la interfaz histórica «Oficio cercano» de BarberBook, commit `b1aa52c`. Este documento registra el diseño de la integración de feriados antes de implementarla; no pretende ser evidencia anterior a la creación del producto original.

## Problema y usuarios

Clientes necesitan solicitar una hora sin intercambiar mensajes repetidos. El profesional necesita revisar solicitudes y organizar su jornada. Los feriados ayudan a planificar la fecha, pero no determinan si la barbería abre.

## Navegación

Perfil público → Servicio → Fecha con feriados → Hora → Datos → Resumen → Solicitud enviada.

Panel demostrativo → Inicio / Solicitudes / Agenda / Clientes / Configuración.
Desde Solicitudes se confirma o rechaza. Una confirmación se refleja en Agenda. El panel no tiene autenticación y se utiliza exclusivamente con datos ficticios.

## Wireframes de la adaptación

```text
Móvil · selección de fecha
┌─────────────────────────────┐
│ BarberBook       Tema/Panel │
│ Demo académica · datos local│
│ Paso 2 · Elige una fecha    │
│ Feriados de Chile · año     │
│ Cargando / error + Reintentar│
│ [día] [día • feriado] [día] │
│ Nombre de feriado          │
│ No modifica disponibilidad │
│ [Ver feriados del año ▾]    │
│ [Volver]                   │
└─────────────────────────────┘

Agenda
┌─────────────────────────────┐
│ Agenda · fecha seleccionada│
│ Resumen de jornada         │
│ Selector horizontal de días│
│ Feriados · aviso del día    │
│ 10:00 Cliente · servicio    │
│ 11:00 Disponible           │
└─────────────────────────────┘
```

En escritorio se conservan el ancho máximo y la navegación lateral. En móvil, las fechas siguen siendo compactas y los nombres extensos pueden envolver líneas. El listado anual es desplegable para no saturar el flujo y permitir demostrar la API aunque hoy no sea feriado.

## Jerarquía y componentes

- La selección de fecha es la acción principal; los feriados son contexto secundario.
- `DateSelector` conserva selección y navegación mediante props.
- `HolidayNotice` presenta carga, error, reintento, vacío y fechas recibidas.
- `useHolidays` sincroniza React con la API; `holidayService` valida y transforma JSON.
- `SchedulePage` reutiliza el mismo hook y presentación.
- `BookingFlow`, formularios, estados locales y repositorio se conservan.

## Identidad visual

Se mantienen tokens históricos: fondo claro `#F3F4F2`, texto `#20292B`, acento `#245A63`; el tema oscuro utiliza fondo `#181D1E` y acento `#9BCBD0`. Tipografía de sistema para controles y Georgia para identidad. Bordes discretos, foco visible, contrastes de tema y controles táctiles.

Bootstrap aporta utilidades de disposición únicamente al aviso académico. El diseño principal utiliza CSS propio; no se carga su reinicio global para no alterar componentes existentes.

## Reglas

Solo feriados `nationalHoliday: true`, país `CL` y tipo `Public`. No traducir inventando datos: se muestra el nombre proporcionado por la API, que puede estar en inglés. Fallo o respuesta vacía nunca bloquea una reserva. No se crea ni modifica disponibilidad a partir de feriados.
