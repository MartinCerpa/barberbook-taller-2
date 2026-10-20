# Diseño de BarberBook — Taller 2

## Problema identificado

Coordinar horas mediante mensajes puede producir respuestas tardías y desorden. BarberBook reúne la solicitud del cliente y la revisión del profesional en una misma aplicación de demostración.

## Usuarios

- **Cliente:** necesita elegir un servicio y solicitar una hora de forma clara.
- **Profesional:** necesita revisar solicitudes y consultar su jornada.

## Objetivo

Demostrar un flujo completo de reserva utilizando React, datos locales y una API pública, sin implementar backend propio.

## Funcionalidades principales

- Perfil público del profesional ficticio.
- Selección de servicio, fecha y horario.
- Información de feriados chilenos.
- Formulario con validación y resumen.
- Confirmación o rechazo desde el panel.
- Agenda y persistencia local.

## Navegación

```text
Perfil → Servicio → Fecha → Hora → Datos → Resumen → Solicitud enviada

Panel → Inicio / Solicitudes / Agenda / Clientes / Configuración
```

Una solicitud confirmada pasa a la Agenda. El panel no tiene autenticación porque esta entrega es solo frontend.

## Wireframes simplificados

```text
Móvil · reserva
┌──────────────────────────┐
│ BarberBook         Tema  │
│ Paso actual              │
│ [opciones seleccionables]│
│ Estado del feriado       │
│ [Volver]                 │
└──────────────────────────┘

Agenda
┌──────────────────────────┐
│ Agenda · fecha elegida   │
│ Resumen del día          │
│ [días desplazables]      │
│ Hora · cliente · servicio│
└──────────────────────────┘
```

## Diseño responsive

El diseño parte desde móvil. Las opciones táctiles tienen espacio suficiente y algunos selectores usan desplazamiento horizontal para evitar desbordar la página. En escritorio, el panel utiliza navegación lateral y más ancho disponible.

## Colores y estructura visual

Se mantiene la identidad «Oficio cercano» heredada del proyecto original:

- Fondo claro: `#F3F4F2`.
- Texto principal: `#20292B`.
- Acento: `#245A63`.
- Tema oscuro: fondo `#181D1E` y acento `#9BCBD0`.
- Georgia se utiliza en elementos de identidad y tipografía de sistema en controles.

Las tarjetas, bordes discretos y estados de foco también provienen del diseño histórico. Para el taller se integró la información de feriados sin cambiar la jerarquía principal de la reserva.

## Feriados en la interfaz

`DateSelector` y `SchedulePage` consumen el mismo hook. La fecha sigue siendo la acción principal y el feriado aparece como información secundaria. Los nombres se normalizan en un solo servicio y se muestran en español cuando existe una equivalencia confirmada.

Un feriado no cambia automáticamente la disponibilidad. Si la API falla, aparece un mensaje con reintento y el flujo local continúa funcionando.
