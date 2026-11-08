# Guion de demostración

Este guion prepara una defensa verificable; no acredita una defensa realizada ni la aprobación docente de la adaptación.

1. Explicar el problema del Taller 2 y mostrar el historial Git desde `e84fc03`. Distinguir reserva futura de turno presencial y justificar sucursales, barberos y sillones.
2. Iniciar las bases, API y React según README. Abrir `/api/health` y mostrar ambas bases conectadas y su aislamiento.
3. En el perfil, seleccionar profesional, servicio y horario futuro. Introducir «Cliente Demo» y `+56900000001`; revisar y enviar. Explicar el estado pendiente.
4. Recargar, confirmar desde Solicitudes y comprobar Agenda con la fecha seleccionada o «Todas las fechas». Mostrar la consulta a `/api/bookings`.
5. En Swagger, crear otro id con un inicio dentro de la duración ya reservada: esperar 409. Una fecha inválida da 400 y una hora fuera de jornada da 422. No modificar directamente la base para aparentar resultados.
6. Crear otra solicitud en un intervalo libre y rechazarla. Mostrar liberación del horario y eventos. Reprogramar o cancelar. No completar artificialmente una reserva futura: la API lo rechaza.
7. En Turnos, emitir con un cliente ficticio, elegir módulo, llamar siguiente y finalizar. Requiere jornada activa y duración suficiente sin compromisos incompatibles. Si hoy está cerrado, configurar honestamente una jornada de demostración en Administración.
8. Mostrar métricas: espera = llamado − emisión; atención = finalización − llamado. Los turnos aún pendientes no entran al promedio de espera de llamados. Los ingresos incluyen solo reservas completadas.
9. En Historial, diferenciar operaciones SQL de eventos MongoDB: reserva creada/confirmada, turno emitido/llamado/completado. Explicar outbox y consistencia eventual.
10. En Swagger, expandir `GET /services`, pulsar «Try it out» y «Execute», mostrar 200 y el catálogo real. Consultar una reserva y sus eventos por id.
11. Mostrar pruebas, lint, build, Compose y matriz. Declarar si Docker todavía está pendiente. Explicar un esquema Zod, la exclusión GiST y una FK compuesta.

Preparar respuestas individuales: ¿por qué un feriado no cierra automáticamente?, ¿qué ocurre ante dos reservas simultáneas?, ¿qué protege SKIP LOCKED?, ¿por qué MongoDB no guarda clientes?, ¿cómo se recupera un fallo de MongoDB después de confirmar SQL?, ¿qué sobrevive a una recarga?, ¿qué diferencias hay entre el prototipo local y el servidor actual?

Después de revisar personalmente, registrar correcciones, decisiones comprendidas y aprendizajes. Actualmente esa validación humana sigue pendiente y no debe reemplazarse por afirmaciones generadas automáticamente.
