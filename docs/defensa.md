# Guía breve para la defensa

## ¿Qué es BarberBook?

BarberBook es una aplicación React que permite demostrar dos recorridos: un cliente solicita una hora y un profesional revisa esa solicitud en su panel. Busca ordenar reservas que normalmente se coordinan mediante mensajes.

Esta versión es académica. Usa datos ficticios, no tiene backend y no debe almacenar información personal real.

## Tecnologías utilizadas

- React y JSX para construir la interfaz con componentes.
- Vite para ejecutar y compilar el proyecto.
- CSS para el diseño responsive y los temas claro/oscuro.
- Fetch para consultar la API Nager.Holidays.
- localStorage para mantener reservas y configuraciones al recargar.
- `node:test` y Oxlint para comprobar lógica y revisar el código.

## Cómo funciona una reserva

1. El cliente selecciona servicio, fecha y hora.
2. Completa un formulario controlado con nombre y teléfono.
3. Revisa los datos antes de enviar.
4. La solicitud se guarda en el navegador.
5. En el panel, el profesional puede confirmarla o rechazarla.
6. Si se confirma, aparece en la Agenda.

## Cómo funciona el panel

El panel permite revisar solicitudes, agenda, clientes y configuraciones de demostración. No tiene autenticación real. La información se obtiene de servicios locales y localStorage, por lo que solo existe en el navegador utilizado.

## Conceptos de React que debo explicar

**Componentes:** son partes reutilizables de la interfaz. Por ejemplo, `BookingFlow` coordina `ServiceSelector`, `DateSelector`, `TimeSelector` y `CustomerForm`.

**Props:** son valores o funciones que un componente padre entrega a un componente hijo. Se usan para mostrar la selección actual y avisar cuando el usuario elige una opción.

**useState:** mantiene información que cambia en pantalla, como el paso actual, el servicio elegido o el estado de carga de la API.

**useEffect:** ejecuta tareas externas después del render. En este proyecto inicia la consulta de feriados cuando cambian los años requeridos y cancela consultas antiguas al desmontar el componente.

## Fetch y Nager.Holidays

La aplicación consulta:

```text
https://nagerholidays.com/api/v4/Holidays/CL/{year}
```

El servicio verifica la respuesta, filtra feriados nacionales públicos y transforma los datos para el calendario. Una función centralizada muestra nombres en español de Chile. Si la consulta falla, se ofrece reintentar, pero la reserva local sigue disponible.

## ¿Para qué se usa localStorage?

Se usa para conservar solicitudes, agenda y configuraciones al recargar la página. Es apropiado para esta demostración porque el taller no requiere backend, pero no reemplaza una base de datos: no sincroniza equipos y el usuario puede borrar su contenido.

## Limitaciones que debo reconocer

- No hay autenticación ni control de acceso.
- Los datos quedan en un solo navegador.
- No existe base de datos ni trabajo multiusuario.
- La API de feriados depende de Internet.
- No hay pagos, mensajería ni reservas comerciales reales.

## Recorrido sugerido para presentar

1. Mostrar el perfil público y seleccionar un servicio.
2. Elegir fecha y explicar el feriado obtenido por Fetch.
3. Mostrar la validación del formulario.
4. Enviar una solicitud ficticia.
5. Abrir Solicitudes, confirmarla y verla en Agenda.
6. Recargar para demostrar la persistencia local.
7. Mostrar brevemente el servicio de feriados y una prueba.

## Preguntas probables

**¿Por qué usaron React?**  
Porque permite separar la interfaz en componentes y actualizar solo lo que cambia mediante estado.

**¿Qué es un formulario controlado?**  
Es un formulario cuyos valores viven en el estado de React. Cada `onChange` actualiza ese estado y permite validar antes de enviar.

**¿Qué diferencia hay entre props y estado?**  
Las props llegan desde otro componente. El estado pertenece al componente que lo administra y cambia mediante sus funciones de actualización.

**¿Qué hace useEffect en este proyecto?**  
Coordina la consulta externa de feriados cuando cambia el año requerido y limpia consultas que ya no son necesarias.

**¿Cómo manejan errores de la API?**  
Se comprueba la respuesta y el JSON. La interfaz muestra un mensaje y un botón para reintentar. La reserva no se bloquea.

**¿Por qué un feriado no bloquea la fecha?**  
Porque la API solo informa el feriado. La decisión de atender corresponde al horario configurado por el profesional.

**¿Cómo se guardan las reservas?**  
En localStorage mediante servicios del proyecto. Al recargar se leen nuevamente, pero no se comparten con otros dispositivos.

**¿Por qué no hay backend?**  
Porque el alcance del Taller 2 es demostrar frontend con React, formularios, datos locales y consumo de una API pública.

**¿Qué ocurre si el nombre de un feriado no tiene traducción confirmada?**  
Se mantiene el nombre original. No se generan traducciones automáticas ni se modifica el JSON recibido.

**¿Qué hizo la IA?**  
Apoyó la adaptación del frontend, la creación de datos ficticios, la integración de la API, las pruebas y la documentación. El estudiante debe revisar el resultado y ser capaz de explicar el código.

## Antes de entregar

- Completar integrantes reales en README.
- Revisar personalmente documentos y código.
- Practicar el recorrido con datos ficticios.
- Crear evidencia Git Flow real en el repositorio académico.
- No afirmar tareas o aprendizajes que no se hayan realizado.
