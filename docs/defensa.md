# Guion de presentación — 6 a 8 minutos

## Preparación

1. Abrir esta carpeta independiente e iniciar `npm run dev`.
2. Usar el mismo host y navegador durante toda la demostración.
3. Verificar Internet; no ingresar nombres ni teléfonos reales.
4. Tener abierto este guion, `DateSelector.jsx`, `useHolidays.js`, `holidayService.js`, `CustomerForm.jsx` y `bookingService.js`.
5. No mostrar el producto comercial ni afirmar que este panel tiene autenticación.

## Recorrido

**0:00 — Problema.** «Organizamos solicitudes que normalmente se dispersan por mensajes. Hay un cliente que solicita y un profesional que decide».

**0:45 — Perfil.** Mostrar identidad Oficio cercano, modo claro/oscuro y botón reservar. Aclarar que es una preversión con datos ficticios.

**1:15 — Reserva.** Elegir servicio; observar avance automático. En fecha, explicar la consulta anual a Nager.Holidays y desplegar la lista de feriados. Si hay uno disponible, seleccionarlo: el feriado no implica cierre.

**2:15 — Validación.** Elegir hora. Escribir un nombre ficticio y solo tres dígitos: revisar sigue deshabilitado. Completar los ocho dígitos, revisar precio/fecha y enviar explícitamente.

**3:00 — Panel.** Abrir Solicitudes, localizar el cliente y confirmar. Abrir Agenda y elegir el mismo día. Recargar y volver a ese día: la reserva permanece. Rechazar otra solicitud ficticia y mostrar la pestaña Rechazadas.

**4:15 — React.** Explicar los componentes, props/callbacks y estado central del flujo. Mostrar el hook de feriados, el Fetch y la transformación.

**5:15 — Errores.** Mostrar el mensaje/reintento si falla Internet. Explicar que no se reemplazan los feriados por datos inventados y que el formulario local sigue funcionando.

**6:00 — Cierre.** Mostrar pruebas/build, procedencia del commit y uso de IA. Explicar límites y Git Flow real realizado por el estudiante, sin inventar evidencias.

## Preguntas técnicas

**¿Qué se reutilizó y qué se construyó para este taller?**  
El frontend histórico b1aa52c conserva el diseño y las reglas locales. Esta adaptación aísla almacenamiento, integra feriados v4 con hook/componente/servicio y añade documentación y pruebas.

**¿Dónde se usan componentes y props?**  
BookingFlow coordina ServiceSelector, DateSelector, TimeSelector, CustomerForm y BookingSummary mediante valores y callbacks. HolidayNotice recibe estado, feriados, fecha y callback de reintento; se reutiliza en fechas y Agenda.

**¿Por qué useState y useEffect?**  
useState guarda selecciones y estado de consulta. useEffect ejecuta un efecto externo al cambiar los años o el intento; su limpieza cancela una consulta antigua para que no sobrescriba la vigente.

**¿Qué hace Fetch?**  
Solicita JSON real por HTTPS, verifica `response.ok`, valida estructura/fechas y transforma el resultado. La UI no recibe el JSON sin validar.

**¿Qué feriados se muestran?**  
País CL, nacionales y tipo Public. No confundir un feriado regional con uno aplicable a todo Chile. Se muestran nombres originales, no inventados.

**¿Por qué no se bloquea el feriado?**  
La API informa; los horarios y bloqueos locales deciden disponibilidad. El profesional puede trabajar un feriado.

**¿Cómo se evita una consulta excesiva?**  
Caché en memoria por año durante cinco minutos; no se consulta por cada render. StrictMode puede iniciar y cancelar un efecto adicional en desarrollo. Reintentar invalida la caché.

**¿Qué ocurre con respuesta vacía, lenta o inválida?**  
Vacía tiene mensaje propio; el límite es diez segundos; HTTP fallido/JSON inválido muestran error y reintento. No bloquean reservas.

**¿Qué es un formulario controlado?**  
El valor vive en estado React y `onChange` lo actualiza. El teléfono requiere los ocho dígitos restantes del prefijo chileno; el usuario revisa antes de enviar.

**¿Dónde persiste una reserva?**  
En el repositorio local mediante los servicios históricos y claves `barberbook-taller-2:*`. Recargar no la elimina, pero cambiar de navegador/origen no comparte esos datos.

**¿Hay backend o seguridad real?**  
No. El panel es demostrativo y abierto. No es apto para almacenar información real ni operar comercialmente.

**¿Por qué keys en listas?**  
React necesita identidad estable de cada elemento. Servicios usan id y feriados normalizados usan fecha, después de agrupar duplicados.

**¿Bootstrap reemplaza el diseño?**  
No: solo utilidades en el aviso académico. Los componentes conservan CSS y tokens Oficio cercano.

**¿Qué se prueba?**  
Reglas locales históricas y siete casos nuevos de API: endpoint, filtro/normalización, vacío, datos inválidos, fallos, reintento y cancelación/rango.

**¿Qué hizo la IA y qué hiciste tú?**  
Declarar honestamente la asistencia documentada. Añadir únicamente revisiones, cambios y aprendizajes que realmente hayas realizado; practicar explicando el código, no memorizando una autoría ficticia.

## Checklist antes de entregar

- Completar integrantes reales en README.
- Revisar el diseño y explicar al menos un componente y el hook sin ayuda.
- Crear repositorio académico separado y evidencia Git Flow auténtica.
- Confirmar con el docente la reutilización declarada de código previo.
- Llevar copia del proyecto; las reservas funcionan sin API, pero los feriados reales requieren Internet.
