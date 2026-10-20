# BarberBook — Taller Evaluado 2

Preversión académica independiente, exclusivamente frontend. No es el producto comercial ni un sistema de reservas en producción.

**Integrantes:** completar con los integrantes reales antes de entregar. No se ha inventado participación, revisión humana ni historial Git.

## Problema y usuarios

Las solicitudes por mensajes dispersos dificultan organizar una barbería. El cliente necesita elegir un servicio y solicitar una hora; el profesional necesita revisar solicitudes y consultar su jornada. Esta demostración integra ambos recorridos en un mismo navegador.

## Funcionalidades

- Perfil público de demostración y diseño «Oficio cercano», claro/oscuro.
- Selección de servicio, fecha y horario; avance automático y posibilidad de volver.
- Formulario controlado: nombre y ocho dígitos después del prefijo +56 9.
- Resumen y envío explícito; confirmación/rechazo desde el panel demostrativo.
- Agenda, servicios y configuración local heredados de la base histórica.
- Persistencia en localStorage con claves exclusivas `barberbook-taller-2:*` y `barberbook-taller-2-theme`.
- Feriados nacionales de Chile consultados realmente desde Nager.Holidays, tanto en fechas como en Agenda.
- Un feriado es informativo: **no cierra automáticamente la barbería**.

## Tecnologías

React 19, JavaScript/JSX, Vite 8, CSS responsive, utilidades de Bootstrap 5.3, Fetch, localStorage, pruebas `node:test` y Oxlint. Bootstrap se usa en el aviso académico, importando solo sus utilidades; no reemplaza el diseño ni incorpora su JavaScript.

No incluye Express, PostgreSQL, autenticación real, variables secretas ni backend propio.

## Instalación y ejecución

Requisito recomendado: Node.js 24 LTS y npm.

```powershell
cd C:\Users\Martin\barberbook-taller-2
npm ci
npm run dev
```

Abrir http://localhost:5174. El puerto es fijo para no interferir con el producto comercial. Usar siempre el mismo host: `localhost` y `127.0.0.1` tienen almacenamientos diferentes.

```text
npm test
npm run lint
npm run build
npm run preview
```

Preview: http://localhost:4174. `dist/` es el resultado estático; no abrir `index.html` directamente mediante `file://`.

## Estructura

```text
src/
  components/booking/  pasos del formulario público
  components/admin/    tarjetas y controles del panel
  components/HolidayNotice.jsx  información reutilizable de feriados
  hooks/useHolidays.js          carga, caché, cancelación y reintento
  pages/                perfil público y páginas del panel
  data/                 datos ficticios iniciales
  models/               documentación de formas de datos
  services/             reglas y acceso a datos
  services/bookingRepository.js almacenamiento local de reservas
  services/holidayService.js    Fetch y validación de la API
  styles/               sistema visual y adaptación académica
tests/                  pruebas de lógica
docs/                   diseño, defensa y validación
```

La navegación utiliza hash, no rutas de servidor: `#inicio`, `#/panel/requests`, `#/panel/schedule`. El panel es abierto deliberadamente para la evaluación.

## API pública: Nager.Holidays

Documentación: https://nagerholidays.com/api

Endpoint verificado:

```text
GET https://nagerholidays.com/api/v4/Holidays/CL/{year}
```

Ejemplo real: https://nagerholidays.com/api/v4/Holidays/CL/2026

Se consulta el año de la fecha seleccionada en Agenda y los años visibles en el selector público, incluyendo el cruce diciembre/enero. No se envían nombres, teléfonos, cookies ni reservas. No requiere clave.

Se valida que la respuesta sea un arreglo y que cada elemento tenga fecha válida del año pedido, país CL, nombre, `nationalHoliday` booleano y `holidayTypes` como arreglo de cadenas. Solo se presentan feriados nacionales (`nationalHoliday === true`) de tipo `Public`. Se agrupan fechas repetidas, se ordenan y se transforman a `{ date, name }`. Los feriados regionales no se presentan como nacionales.

Los nombres se muestran tal como los entrega la API, actualmente en inglés. No se inventan traducciones ni feriados. La lista desplegable permite demostrar la integración aunque no exista un feriado dentro del horizonte de reservas.

### Carga y errores

`useEffect` inicia la consulta; `useState` mantiene carga/error/resultado/reintento. Hay cancelación al desmontar, tiempo máximo de 10 segundos y caché exitosa en memoria de 5 minutos por año. El reintento invalida esa caché.

Un fallo HTTP, de red o JSON inválido muestra un mensaje y «Reintentar consulta». Una respuesta vacía muestra un estado específico. No se usan datos ficticios como respaldo. La disponibilidad local sigue operativa incluso si la API falla. Las respuestas artificiales de los tests son exclusivamente fixtures de prueba.

Uso exclusivamente académico; revisar las condiciones vigentes del proveedor antes de cualquier reutilización comercial.

## Procedencia y cambios académicos

Base reutilizada: https://github.com/MartinCerpa/BarberBook, commit `b1aa52c`.

Se extrajeron únicamente frontend, assets disponibles, pruebas y configuración de ejecución. Se conservaron componentes y reglas locales históricas. No se copió `.git`, `.env`, backend, migraciones ni almacenamiento del navegador comercial. Los registros iniciales son demostrativos.

Adaptaciones: namespace local independiente, identificación académica, integración Nager.Holidays, pruebas de la API, puerto independiente, utilidades Bootstrap y documentación. Se quitaron enlaces sociales ficticios y referencias a imágenes inexistentes; se conservan fallbacks visuales.

## Uso de Inteligencia Artificial

Herramienta: OpenAI Codex. Uso: recuperación de frontend histórico, aislamiento de almacenamiento, implementación de consulta de feriados, pruebas y redacción de documentación.

Prompt principal resumido: «Construir una preversión académica independiente desde b1aa52c, sin tocar el producto comercial; integrar Nager.Holidays con Fetch, carga/error/reintento y mantener reservas locales».

Resultado: código y documentación de esta carpeta, más las validaciones descritas en `docs/validacion.md`. Las decisiones de aislamiento, filtro nacional y ausencia de bloqueo por feriados corresponden al alcance solicitado.

**Pendiente del estudiante:** revisar el código, registrar sus modificaciones reales y explicar lo aprendido. No se afirma que esa revisión o aprendizaje ya ocurrió. El guion ayuda a prepararse, no sustituye la defensa individual.

## Limitaciones y pendientes académicos

- Datos y panel demostrativos sin control de acceso. No ingresar información real.
- Persistencia solo en este navegador/origen; no hay sincronización ni garantías multiusuario.
- El reloj del dispositivo determina fechas y expiración. Los horarios base son de demostración.
- El identificador telefónico local heredado no representa un diseño de identidad apto para producción.
- API externa dependiente de Internet/CORS; no existe copia offline de feriados.
- No se envían mensajes, se cobran pagos ni se generan reservas comerciales.
- No se amplió Finanzas; las vistas heredadas no son evidencia de pagos reales.
- Faltan integrantes definitivos, revisión humana y evidencias Git Flow reales.

## Entrega y defensa

Consultar [diseño](docs/diseno.md), [guion y preguntas técnicas](docs/defensa.md) y [validaciones](docs/validacion.md).

### Publicar en un repositorio separado (lo hace el estudiante)

No se ejecutaron operaciones de escritura Git. Primero verificar que se está dentro de **barberbook-taller-2**, nunca dentro del producto comercial. Crear manualmente un repositorio vacío diferente en GitHub.

Secuencia orientativa para ejecutar después de revisar:

```text
git init -b main
git add .
git commit -m "Entrega base académica Taller 2"
git remote add origin URL_DEL_NUEVO_REPOSITORIO
git push -u origin main
git switch -c develop
git push -u origin develop
git switch -c feature/revision-academica
```

Realizar cambios auténticos en esa feature, comprobarlos, hacer commits descriptivos y abrir PR hacia develop; luego preparar la entrega a main. No fabricar commits, fechas ni revisiones anteriores. El historial comercial no se importó. El nombre de rama por sí solo no prueba Git Flow.

Para hosting estático, publicar `dist/` generado por build (por ejemplo mediante un workflow de GitHub Pages creado posteriormente). La configuración `base: './'` y navegación hash permiten alojar bajo una subcarpeta. No subir `node_modules`, `.env` ni datos personales.
