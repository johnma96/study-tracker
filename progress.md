# progress.md — bitácora de sesiones

## Current State

**Última actualización:** 25/09/2026
**Feature activa:** ninguna.
**Estado del repositorio:** R0 a R5 y R7 en `passing`. **R6 diferida con riesgo aceptado**
(ver `RF-40`). Desplegado en <https://study-tracker-eight-sigma.vercel.app/>.
**Bloqueos:** ninguno. El branch `dev` de Neon **expira el 02/10/2026**.
**Siguiente paso:** el curso. El MVP está completo salvo autenticación.

---

## Sesiones

### Sesión 1 — 24/09/2026 — siembra del repositorio

**Duración:** ~40 min
**Objetivo:** dejar el repositorio listo para que otro agente implemente sin necesitar contexto oral.

**What was done**

- Repositorio creado e inicializado en `main`.
- Harness mínimo: `CLAUDE.md`, `AGENTS.md`, `feature_list.json`, `init.sh`,
  `session-handoff.md`, este archivo.
- Documentación funcional: `docs/PRODUCT.md`, `docs/REQUIREMENTS.md` (44 requerimientos EARS),
  `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/ROADMAP.md`.
- Las siete rebanadas del MVP quedaron definidas con dependencias y comandos de verificación.

**Decisions**

Registradas con su motivo en la tabla final de `docs/ARCHITECTURE.md`. Las tres que más
condicionan la implementación:

1. Postgres en todos los entornos. Descarta la secuencia JSON → SQLite → Postgres, que
   obligaría a reescribir la capa de datos dos veces.
2. El tiempo transcurrido del cronómetro se deriva de la marca de inicio almacenada, nunca de
   un contador en el navegador. Es lo que permite cerrar la pestaña sin perder la sesión.
3. La autenticación es una compuerta de despliegue, no la última etapa del cronograma.

**Issues**

Ninguno.

**Hallazgos fuera de alcance**

- Existe `../hard-pomodoro`, un temporizador en Python con su propio `CLAUDE.md`. Podría
  alimentar sesiones al tracker más adelante. **No se integra en el MVP.**

**Next session**

Implementar R0 (esqueleto caminante). Antes de escribir código: leer `CLAUDE.md` completo,
ejecutar `./init.sh` y crear las cuentas de Neon y Vercel.

---

### Sesión 2 — 24/09/2026 — corrección del spec de R2 y desbloqueo

**Duración:** ~30 min
**Objetivo:** cerrar dos defectos de diseño detectados por análisis de competencia antes de
que un agente construyera el cronómetro con ellos adentro.

**What was done**

- Publicado en `github.com/johnma96/study-tracker`, rama `main`.
- Bloqueos externos resueltos por el usuario: proyecto de Neon creado con `DATABASE_URL` en
  `.env`, y cuenta de Vercel (plan Hobby) disponible.
- **Defecto 1 — sesión huérfana.** El índice único de "máximo una sesión en curso" podía dejar
  la aplicación en punto muerto: si el navegador se cerraba sin llamar al cierre, ninguna
  sesión nueva podía iniciar. Se agregaron `RF-2F` a `RF-2I` (cierre desde cualquier vista y
  diálogo de recuperación a partir de 8 horas) y se documentó en `docs/DATA-MODEL.md` que el
  flujo de recuperación es la válvula de escape del índice, no una feature aparte.
- **Defecto 2 — pausas.** No existía modelo para los descansos, pese a que la estructura de
  sesión de estudio prevista tiene uno intermedio. Se agregaron `RF-2A` a `RF-2E`, las columnas
  `paused_at` y `paused_seconds`, la restricción `no_open_pause_when_ended`, y se reescribió la
  regla de duración efectiva con seis casos de prueba.
- R2 pasa de 1-2 sesiones a 2 sesiones y absorbe ambos bloques: son un solo corte vertical
  porque entregar el cronómetro sin ellos sería entregar un defecto conocido.

**Decisions**

1. Pausas y recuperación entran en R2, no en una rebanada posterior. Ambas tocan el esquema y
   el índice; agregarlas después implicaría migrar datos reales.
2. El tercer defecto detectado —`readings.value` es `numeric` y no admite series categóricas
   tipo *Mastered/Learning/Not started*— **se pospone a R5** a propósito. No bloquea el MVP y
   para entonces se sabrá qué métricas se usan de verdad.

**Issues**

Ninguno.

**Hallazgos fuera de alcance**

- El nombre `study-tracker` ya está tomado por al menos dos productos del nicho, uno con ese
  dominio exacto. Irrelevante para uso personal; relevante si algún día se publica.
- Los tres competidores analizados (study-track.app, study-tracker.app, athenify.io) evitan el
  problema del progreso heterogéneo reduciendo todo a horas contra meta, y ninguno modela
  evidencia de la sesión. Confirma que `artifacts` y `metrics` son la diferenciación real.

**Next session**

Implementar R0 (esqueleto caminante). Ya no hay bloqueos externos.

### Sesión 3 — 24/09/2026 — R0, esqueleto caminante (local; despliegue pendiente)

**Duración:** ~1 h
**Objetivo:** implementar R0 — aplicación Next.js real, conectada a Neon con Drizzle, que
muestre en pantalla una fila leída de la base de datos.

**What was done**

- Andamiaje con `create-next-app@latest`: Next.js 16.3.6, React 19.2.8, TypeScript estricto,
  Tailwind 4, ESLint, `src/`. Se generó en un subdirectorio temporal y se movieron los archivos
  a la raíz, porque `create-next-app` se niega a escribir en un directorio que ya tiene
  archivos propios y porque su plantilla trae su propio `AGENTS.md` y `CLAUDE.md`, que habrían
  pisado el harness.
- Dependencias: `drizzle-orm` 0.45.3, `@neondatabase/serverless` 1.1.0, `drizzle-kit` 0.31.11.
  Ninguna fuera de `docs/ARCHITECTURE.md`. Sin shadcn/ui ni Recharts: entran en R3.
- Capas de `docs/ARCHITECTURE.md` respetadas desde la primera línea, aunque el código sea
  mínimo: `core/model/program.ts` y `core/ports/program-repository.ts` (dominio puro, sin
  imports de React, Next, Drizzle ni base de datos), `infra/db/{schema,client}.ts`,
  `infra/repos/drizzle-program-repository.ts`, `ui/program-card.tsx` (presentación sin acceso a
  datos) y `app/page.tsx` como Server Component que orquesta.
- Tabla `programs` aplicada a Neon con `npm run db:push` y programa semilla insertado con
  `npm run db:seed` (`scripts/seed.mjs`, idempotente).
- Scripts nuevos en `package.json`: `check`, `db:push`, `db:seed`.

**Correcciones al DDL de `docs/DATA-MODEL.md`**

El DDL de `programs` era correcto: el motor no rechazó nada. Diferencias entre lo especificado
y lo aplicado, todas deliberadas:

1. **`gen_random_uuid()` no necesitó `pgcrypto`.** La trampa anticipada en el documento no se
   materializó: Neon corre PostgreSQL 18.6 y la función viene de fábrica desde Postgres 13.
   Verificado con `select gen_random_uuid()` antes de aplicar nada. Se deja la nota del
   documento como está, porque sigue siendo válida para motores anteriores.
2. **Las restricciones CHECK ahora tienen nombre**: `programs_name_length`,
   `programs_kind_valid`, `programs_status_valid`. El DDL del documento las declara anónimas y
   Postgres les habría puesto un nombre generado, distinto en cada entorno. Drizzle además
   exige nombrarlas. El efecto es idéntico; se verificó consultando `pg_constraint` que las
   tres quedaron con la misma semántica que el documento especifica.
3. **`char_length(name) BETWEEN 1 AND 120`** quedó aplicado como
   `char_length(name) >= 1 AND char_length(name) <= 120`. Es la forma en que Postgres reescribe
   `BETWEEN`, no un cambio de diseño.

No se creó ninguna otra tabla: R0 solo necesita una, y `sessions`, `artifacts`, `metrics` y
`readings` pertenecen a rebanadas posteriores.

**Decisions**

1. **`export const dynamic = 'force-dynamic'` en la página raíz.** Sin eso, Next prerenderiza
   en tiempo de construcción y la URL desplegada mostraría una foto de la base tomada durante
   el build, no un dato leído. También evita que `next build` dependa de que la base esté
   disponible.
2. **Cliente de base de datos perezoso** (`getDb()` en `infra/db/client.ts`). Si se construyera
   al importar el módulo, la ausencia de `DATABASE_URL` rompería el build en lugar de fallar en
   la petición, que es donde el error significa algo.
3. **`npm run check` es `next typegen && tsc --noEmit`, no solo `tsc --noEmit`.** La plantilla
   de Next 16 usa el tipo global `LayoutProps<"/">`, que Next genera en `.next/types`. Sobre un
   clon limpio, `tsc --noEmit` a secas falla con `Cannot find name 'LayoutProps'`. `AGENTS.md`
   documenta el comando como `tsc --noEmit`; el script hace lo que el comando necesita para
   pasar desde cero. Conviene alinear `AGENTS.md`.
4. **`agentRules: false` en `next.config.ts`.** Ver la sección de hallazgos.
5. **Sin migraciones versionadas todavía.** `drizzle-kit push` alcanza mientras la base no
   tenga datos que importe perder. Cuando existan sesiones reales, el cambio a
   `drizzle-kit generate` con migraciones en `src/infra/db/migrations` deja de ser opcional.
6. **Sin Vitest.** `docs/ARCHITECTURE.md` lo incluye en los comandos de arranque de R0, pero
   R0 no tiene lógica de dominio que probar: lo único verificable es que la cadena completa
   responde, y eso se verifica ejecutándola. Entra con R1/R2, donde sí hay reglas de cálculo.

**Issues**

- **R0 no se puede cerrar en esta sesión.** Su criterio de hecho es que la URL de producción
  cargue el dato, y el despliegue en Vercel exige el navegador del usuario. Queda en `blocked`
  con la evidencia de todo lo verificado en local, no en `passing`.
- Como consecuencia, `feature_list.json` queda sin ninguna feature `active`. Es correcto: R1
  depende de R0 y R0 no está en `passing`.

**Hallazgos fuera de alcance**

- **`next dev` reescribe `AGENTS.md`.** Next.js 16 inyecta en `AGENTS.md` un bloque
  `nextjs-agent-rules` y lo vuelve a agregar en cada arranque; si el archivo no existe, lo crea
  junto con un `CLAUDE.md` que contiene `@AGENTS.md`. Es decir: la herramienta escribe sobre el
  archivo canónico del harness sin pedir permiso. Se desactivó con `agentRules: false` en
  `next.config.ts` y se restauró `AGENTS.md` a su contenido original. La advertencia que traía
  el bloque es cierta y vale la pena conservarla aquí: **Next.js 16 difiere de lo que un modelo
  tiene memorizado; la referencia buena está en `node_modules/next/dist/docs/`.** Si el autor
  prefiere el bloque, basta con quitar esa línea de configuración.
- **La plantilla de `create-next-app` trae su propio `.gitignore`, que ignora `.env*` completo**
  — incluido `.env.example`. Se conservó el `.gitignore` del repositorio, que sí versiona el
  ejemplo, y solo se le agregó `*.tsbuildinfo`.
- **`docs/ARCHITECTURE.md` contradice el alcance de R0**: su bloque "Comandos de arranque para
  la rebanada 0" incluye `npx shadcn@latest init`, mientras `docs/ROADMAP.md` y
  `session-handoff.md` posponen shadcn/ui a R3. Se siguió el roadmap. Conviene corregir el
  bloque de comandos.
- **`README.md` describía el repositorio como semilla sin código.** Se actualizó el estado y el
  arranque, que forman parte de la ruta de reinicio limpio de `AGENTS.md`.

**Next session**

Desplegar en Vercel y cerrar R0 con la URL de producción como evidencia. Los pasos exactos
están en `session-handoff.md`.

---

---

### Sesión 4 — 25/09/2026 — cierre de R0 y corrección del harness

**Duración:** ~40 min
**Objetivo:** cerrar R0 con la URL de producción y corregir los huecos del harness que salieron
al construirla.

**What was done**

- **R0 a `passing`.** <https://study-tracker-eight-sigma.vercel.app/> carga la tarjeta
  "Harness Engineering · walkinglabs · course · active · 41" y la línea "1 fila leída de
  programs". Verificado por el usuario desde un dispositivo fuera de la red corporativa.
- **R1 a `active`.** Con eso el `feature_list.json` vuelve a tener exactamente una feature
  activa, como exige la política.
- **Cinco huecos del harness corregidos** (commit `950f011`): comando de arranque que fallaba,
  *Definition of Done* insatisfacible para infraestructura, regla de selección sin candidata,
  `check` mal documentado y contradicción entre `ARCHITECTURE` y `ROADMAP`.
- **`TZ` renombrada a `APP_TIMEZONE`** (commit `d1a5370`): Vercel reserva ese nombre.

**Decisions**

1. La evidencia de R0 registra **quién** verificó y **desde dónde**. No se puede comprobar el
   despliegue desde la máquina de trabajo, y ocultarlo habría dejado una evidencia que nadie
   puede reproducir.
2. La zona horaria queda como variable de entorno **documentada pero sin usar**. La decisión de
   moverla a constante de `core/` se toma en R3, cuando exista la agrupación por día.

**Issues**

Ninguno.

**Hallazgos fuera de alcance**

- **La VPN corporativa bloquea `vercel.app`**, y la interceptación TLS también impide llegar
  por línea de comandos. Toda verificación de despliegue exige un dispositivo externo. R0
  existe para descubrir fricción en la cadena de despliegue, y encontró una que no es técnica.
- **El score de `validate-harness.mjs` fue 100/100 antes y después de corregir cinco defectos
  reales.** La métrica no se movió porque nunca midió lo que estaba roto. Detecta ausencias, no
  falsedades: un FAIL es información confiable, un PASS solo dice que el archivo existe con el
  encabezado correcto.
- Sigue pendiente crear un branch `dev` en Neon. Hoy local y producción comparten base.

**Next session**

Implementar R1 — Programas, empezando por instalar Vitest.

---

### Sesión 5 — 25/09/2026 — R1: Programas

**Duración:** ~75 min
**Objetivo:** implementar R1 (`RF-10` a `RF-15`): crear y listar programas, tipos de sesión por
programa, y estrenar Vitest con la regla completa de la *Definition of Done*.

**What was done**

- **Vitest instalado y corriendo antes de la feature.** La primera prueba se escribió contra un
  módulo que todavía no existía y se vio fallar; después se implementó. Scripts `test` y
  `test:watch` en `package.json`; `./init.sh` ya los invocaba con `--if-present` y ahora los
  ejecuta de verdad.
- **51 pruebas en 5 archivos**, todas sobre `core/` y sin base de datos: `program-name` (RF-14),
  `program-order` (RF-13), `program-input` (RF-44), `session-type` (RF-15) y `civil-date`.
- **RF-10 a RF-15 implementados**: `session_types` en el esquema, repositorio con `create`,
  `listSessionTypes` y `createSessionType`, Server Actions con `zod`, formularios y listado.
- **Semilla ampliada** con los cuatro tipos del curso, manteniendo la idempotencia con
  `on conflict (program_id, code) do nothing`.
- **Un defecto real encontrado y corregido durante la verificación**: `isUniqueViolation` miraba
  `error.code` del error de primer nivel, pero Drizzle envuelve el error del driver en
  `DrizzleQueryError` y deja el `NeonDbError` en `cause`. La comprobación daba siempre falso y
  un código de tipo de sesión repetido llegaba al usuario como excepción de Postgres —
  exactamente lo que el propio requerimiento pide evitar. Ahora se recorre la cadena de `cause`.

**Decisions**

1. **El esquema de validación vive en `core/services/program-input.ts`, no en la Server Action.**
   `app/` queda como adaptador: convierte `FormData` en cadenas y traduce el resultado. Así
   RF-14 y RF-44 se prueban sin levantar Next ni base de datos, que es la justificación que
   `docs/ARCHITECTURE.md` da para toda la separación por capas. `zod` no rompe la regla: no es
   React, Next, Drizzle ni la base.
2. **El orden de RF-13 se calcula en `core/`, no en un `ORDER BY`.** El repositorio trae las
   filas y delega en `sortPrograms`. Duplicar la regla en SQL dejaría dos definiciones y solo
   una probada. Con un puñado de programas ordenar en memoria no cuesta nada; si la tabla
   creciera hasta que importe, el orden baja al SQL y las pruebas siguen siendo su contrato.
3. **Las longitudes se miden en puntos de código**, no con `String.prototype.length`. Un emoji
   mide 2 en JavaScript y 1 para `char_length()` de Postgres; medir distinto deja a la
   aplicación aceptando lo que el motor rechaza.
4. **Las fechas nulas van al final del listado.** RF-13 no dice qué hacer con ellas y Postgres,
   con `DESC`, las pondría primero: un programa sin fecha encabezaría la lista por encima del
   más reciente.
5. **Límites de `session_types` fijados por la implementación**: código 1..8, etiqueta 1..80.
   RF-15 dice "código corto" sin dar un tope, y `text` sin límite acepta un párrafo.
6. **`@types/node` sube de `^20` a `^24`.** Vitest 5 exige `^22 || >=24` y el runtime real es
   Node 24; la plantilla de `create-next-app` había dejado `^20`.

**Issues**

- Probar la Server Action por HTTP (`POST` con cabecera `Next-Action`) exigiría replicar la
  codificación interna de argumentos de React 19, que es privada y cambia entre versiones. En
  su lugar se movió la validación a `core/` y se probó allí, que cubre lo mismo con menos
  acoplamiento. La verificación del camino de escritura completo se hizo con un archivo de un
  solo uso contra Neon, ya eliminado.

**Hallazgos fuera de alcance**

- **`CLAUDE.md` sigue diciendo "Semilla. Documentación y harness completos; sin código todavía.
  La primera rebanada por implementar es R0."** Es falso desde la sesión 4. Un agente que
  arranque leyendo el flujo en orden recibe ese estado como cierto en el paso 2, antes de llegar
  a `feature_list.json` en el paso 8. No se corrigió por la regla "Stay in scope".
- **Sin migraciones versionadas.** `drizzle-kit push` sigue sirviendo porque la base solo tiene
  la fila semilla. Deja de servir en cuanto R2 registre sesiones reales: ese es el momento de
  pasar a migraciones, y debería ser trabajo propio, no un agregado dentro de otra rebanada.
- **Un solo branch de Neon.** Local y producción comparten base. La verificación de esta sesión
  insertó y borró filas de prueba en la misma base que sirve producción. Con datos reales eso
  es inaceptable; crear el branch `dev` es barato y conviene antes de R2.
- **`plannedSessions` no se puede capturar por la interfaz.** RF-10 no lo enumera entre los
  campos de creación, así que el formulario no lo incluye; hoy solo lo pone la semilla. RF-36
  (R3) lo necesita para proyectar la fecha de finalización. O RF-10 está incompleto o RF-36
  necesitará una edición de programa que nadie ha especificado.
- **No existe edición ni borrado de programas.** Ningún `RF` los pide. Un nombre mal escrito hoy
  solo se arregla entrando a la base a mano.

**Next session**

Implementar R2 — Cronómetro. Es el corazón del MVP y la rebanada más grande: índice único,
pausas y recuperación de sesión abandonada van juntos, no en tandas.

---

### Sesión 6 — 25/09/2026 — corrección del harness tras R1

**Duración:** ~35 min
**Objetivo:** cerrar los huecos del harness que salieron al construir R1. Sin cambios de producto.

**What was done**

Cuatro correcciones, todas sobre defectos comprobados, no sobre preferencias de redacción.

1. **Criterios de hecho ejecutables.** Los siete criterios de `docs/ROADMAP.md` estaban escritos
   como interacción humana ("creas un programa por la interfaz"), imposibles para un agente sin
   navegador, mientras la *Definition of Done* exigía evidencia ejecutable. El harness pedía dos
   cosas incompatibles. Ahora cada rebanada tiene **verificación ejecutable** (bloquea) y
   **confirmación humana** (se registra, no bloquea), salvo R0, donde la cadena de despliegue es
   el propósito y por eso sí bloquea.
2. **`CLAUDE.md` ya no declara el estado del repositorio.** Decía "semilla, sin código todavía"
   con dos rebanadas cerradas, y el flujo de arranque lo hace leer en el paso 2. La causa de
   fondo era poner estado mutable en un documento que cambia poco; ahora remite a los archivos
   que sí son dueños de cada dato.
3. **Excepción de alcance para la documentación de arranque.** "Stay in scope" protegía el
   código pero dejaba pudrirse los documentos que el propio harness declara más importantes que
   cualquier feature. Ahora corregir un documento que **contradice la realidad** siempre está en
   alcance. El límite: se corrige lo falso, no lo mejorable.
4. **`init.sh` ya no da falso positivo.** `npm run <x> --if-present` termina en 0 sin imprimir
   nada cuando el script no existe: durante toda R0 las pruebas "pasaron" porque no existían.
   Ahora cada script requerido se exige explícitamente y falta alguno aborta con mensaje claro.
   **Comprobado eliminando el script `test`:** sale con código 1 y el mensaje esperado.

También se precisó la semántica de `active` en `feature_list.json`: significa "alguien la está
trabajando ahora", no "es la siguiente". Cero activas es el estado normal en reposo.

**Decisions**

1. La confirmación humana se registra en `evidence` con quién verificó y desde dónde, pero no
   bloquea `passing`. Una verificación que solo una persona puede hacer no puede ser requisito
   de cada rebanada sin volver el harness inoperable para un agente.
2. Si una regla de negocio solo se puede comprobar con un clic, está en la capa equivocada: se
   mueve a `core/`. La interfaz se queda con lo que de verdad es presentación.

**Issues**

Ninguno.

**Hallazgos fuera de alcance**

- **Bloqueo para R2:** local y producción comparten branch de Neon. La verificación de R1 llegó
  a insertar y borrar filas en la base que sirve el despliegue. Se limpió, pero con datos reales
  sería inaceptable, y R2 es donde empiezan a existir. Requiere la consola de Neon.
- Sigue pendiente pasar a migraciones versionadas antes de que haya datos que importe perder.
- `plannedSessions` no se captura por la interfaz, y `RF-36` lo necesita.
- No existe edición ni borrado de programas.

**Next session**

Crear el branch `dev` en Neon y arrancar R2 — Cronómetro.

---

### Sesión 7 — 25/09/2026 — separación de entornos de base de datos

**Duración:** ~20 min
**Objetivo:** dejar el entorno local sin acceso de escritura a la base que sirve el despliegue,
antes de que R2 empiece a registrar sesiones reales.

**What was done**

- Branch `dev` creado en Neon por el usuario.
- **Corregido el arreglo a medias:** se había agregado `DATABASE_URL_DEV` al `.env`, pero la
  aplicación lee `DATABASE_URL`, que seguía apuntando a producción. El entorno local seguía
  escribiendo en la base del despliegue. Ahora `DATABASE_URL` tiene el valor de `dev` y la
  cadena de producción ya no existe localmente: vive solo en Vercel.
- `npm run db:push` y `npm run db:seed` verificados contra `dev`, idempotencia comprobada en
  segunda corrida.
- `.gitignore` reforzado: el patrón `.env` no cubría archivos como `.env.backup-123`. Ahora
  `.env.*` con excepción explícita para `.env.example`. Comprobado que `.env.example` sigue
  rastreado y que un respaldo nuevo se ignora.
- Documentados en `docs/ARCHITECTURE.md` el esquema de una sola variable por entorno y la
  **caducidad del branch `dev` el 02/10/2026**, con el síntoma y el procedimiento de
  recuperación.

**Decisions**

1. Una sola variable `DATABASE_URL` con valor distinto por entorno, no dos variables entre las
   que el código elija. Meter la decisión de entorno en la aplicación es justo lo que las
   variables de entorno evitan.
2. La cadena de producción no se guarda localmente. Con ambas a mano, tarde o temprano se corre
   una migración contra la que no era.

**Issues**

Durante el cambio se creó un respaldo `.env.backup-*` con la cadena de producción, y el
`.gitignore` no lo cubría. Nunca llegó a un commit —quedó sin rastrear— y se eliminó. De ahí
salió el refuerzo del `.gitignore`.

**Hallazgos fuera de alcance**

- Migraciones versionadas siguen pendientes. Ahora urge más: con `dev` y producción separados,
  `drizzle-kit push` puede dejarlos divergentes sin que nada avise.
- `plannedSessions` no se captura por la interfaz y `RF-36` lo necesita.

**Next session**

R2 — Cronómetro.

---

### Sesión 8 — 25/09/2026 — R2, el cronómetro

**Duración:** ~2 h
**Objetivo:** implementar R2 completa —cronómetro, pausas y recuperación de sesión abandonada—
con `RF-00`, `RF-20` a `RF-29`, `RF-2A` a `RF-2E` y `RF-2F` a `RF-2I`.

**What was done**

R2 cerrada en `passing`. Las tres partes fueron juntas, como exigía el plan: índice único,
pausas y válvula de escape.

- **El tiempo se deriva de `started_at`, no de un contador.** No existe ninguna columna de
  "tiempo transcurrido". `core/services/session-duration.ts` calcula todo a partir de las
  marcas almacenadas, y el reloj de la interfaz llama a esa misma función en cada tic con el
  valor que vino de la base. Comprobado sin navegador: con una sesión de hace 90 minutos en la
  base, el HTML que devuelve `curl` ya trae `1:30:00`.
- **`one_running_session` lo aplica `npm run db:push`.** Se temía que `drizzle-kit` no supiera
  expresar un índice único sobre la expresión constante `(true)`. Se comprobó y sí sabe, y
  además lo lee de vuelta sin recrearlo. Queda declarado en `src/infra/db/schema.ts`, dentro de
  la ruta de reinicio limpio, en vez de en un paso manual que un clon nuevo se saltaría.
- **Recuperación implementada con el índice, no después.** La barra de sesión vive en el layout
  (`RF-2I`), así que desde cualquier vista se puede detener o descartar (`RF-2F`), y una sesión
  abierta hace más de ocho horas abre el diálogo de las tres opciones de `RF-2G`, con la
  duración real guardándose en `minutes_override` (`RF-2H`).
- **Pausas y `minutes_override` desde el primer día**, como pedía el plan: añadirlos después
  habría implicado migrar sesiones reales.
- **Dos niveles de prueba.** 118 pruebas de `core/` sin base de datos, con los seis casos de la
  tabla de `docs/DATA-MODEL.md` uno a uno; y 8 de integración contra el branch `dev`, que es
  donde viven las tres comprobaciones que solo tienen sentido contra la base real.
- **La detección de violación de unicidad se movió a `src/infra/db/unique-violation.ts`.** Era
  la corrección de R1 —Drizzle envuelve el error del driver y deja el `NeonDbError` en `cause`—
  y R2 necesitaba exactamente la misma comprobación para el índice del cronómetro. Se movió en
  vez de copiarse: dos copias de una corrección que costó encontrar significan que solo una se
  mantiene. El comportamiento de R1 no cambió.

**Decisions**

Registradas también en la tabla de `docs/ARCHITECTURE.md` con los números 14 a 17.

1. Pruebas de integración separadas, con configuración y comando propios (`test:integration`).
   `npm run test` tiene que poder correr en un clon limpio sin red ni `.env`, porque `init.sh`
   lo ejecuta.
2. El índice se declara en el esquema de Drizzle, no en SQL suelto, porque se comprobó que
   `drizzle-kit` lo emite bien.
3. El reloj de referencia es `now()` del motor y no el del proceso de Node: `started_at` lo
   pone la base, y medir el cierre con otro reloj mezcla dos relojes que nadie sincroniza.
4. Las cotas de `note`, `stuck_minutes` y `minutes_override` viven solo en `zod`, sin CHECK
   equivalente. La aplicación puede ser más estricta que el motor; lo peligroso es lo contrario.
5. La sesión manual (`RF-26`) guarda `ended_at = started_at + minutos` y **no** usa
   `minutes_override`: así la sesión manual y la cronometrada se calculan con la misma regla.

**Issues**

- **`db.execute()` del driver HTTP de Neon devuelve `{ rows: [...] }`, no un arreglo**, y
  `now()` llega como cadena en formato de Postgres (`2026-09-25 12:00:46.381862+00`), que no es
  ISO-8601. Pasarla a `new Date()` depende de la tolerancia del motor de JavaScript. Se pide
  `extract(epoch from now())`: un número no tiene ambigüedad de formato ni de zona.
- El servidor de desarrollo de una sesión anterior seguía vivo en el puerto 3000. `next dev`
  lo detecta y aborta con instrucciones claras; no hizo falta más.

**Correcciones al harness y a la especificación**

Todas sobre defectos comprobados, no sobre preferencias de redacción.

1. **La ruta de reinicio limpio de `AGENTS.md` era falsa.** Prometía llegar a un estado
   ejecutable con `clone`, `.env`, `init.sh` y `npm run dev`, pero `init.sh` no toca la base:
   sobre un branch de Neon recién creado, el servidor arrancaba sin tablas. Con R2 el agujero
   es peor, porque `db:push` es lo que crea el índice único. Se añadieron `db:push` y `db:seed`.
2. **`docs/ROADMAP.md` R2 no nombraba el comando de la prueba de integración**, que es justo lo
   que la regla "todo criterio de hecho debe nombrar un comando" existe para evitar. Ahora dice
   `npm run test:integration`.
3. **El campo `verification` de R2 en `feature_list.json` decía "más tres pruebas manuales"**,
   redacción anterior a la corrección del harness: contradecía tanto el ROADMAP como la regla
   de que la confirmación humana no bloquea. Reescrito.
4. **`docs/DATA-MODEL.md` declaraba que su SQL "no ha sido ejecutado"**, lo que dejó de ser
   cierto con `programs`, `session_types` y ahora `sessions`. Se precisó: el SQL literal no se
   ejecuta nunca —lo que corre es el esquema de Drizzle— y se dice qué tablas están aplicadas
   y cuáles siguen siendo solo especificación.
5. **El `README.md` declaraba "R0 cerrada. En marcha: R1"**, es decir el mismo defecto que se
   había corregido en `CLAUDE.md` en la sesión 6: estado mutable en un documento que cambia
   poco. La corrección no se había propagado. Ahora remite a `feature_list.json` y a
   `session-handoff.md`.
6. **`init.sh` comprueba que exista `test:integration`, aunque no lo ejecute.** Añadirlo a los
   comandos de verificación de `AGENTS.md` sin que nada vigilara su existencia habría repetido
   el defecto del `--if-present`: un comando de verificación que desaparece sin que nada avise.
   No se ejecuta porque la puerta de entrada del repositorio no puede depender de que Neon
   responda. Comprobado borrando el script: sale con código 1.

**Hallazgos fuera de alcance**

- **`RF-30` (listar las sesiones de un programa) pertenece a R3**, así que R2 registra sesiones
  que todavía no se pueden ver en una lista. Es coherente con el corte del plan, pero conviene
  saberlo: hasta R3, la única forma de ver una sesión guardada es consultar la base.
- **Los campos `verification` de R3 a R6 en `feature_list.json` siguen mezclando** verificación
  ejecutable y confirmación humana en una sola frase, como hacía el de R2. No es falso —son
  resúmenes—, pero se apartan del formato de dos partes que fija `AGENTS.md`. Se corregirán al
  abrir cada rebanada.
- Migraciones versionadas siguen pendientes y ahora urgen de verdad: con R2 hay datos que
  importa no perder, y `drizzle-kit push` puede dejar `dev` y producción divergentes sin aviso.
- `plannedSessions` sigue sin capturarse por la interfaz y `RF-36` lo necesita.
- No existe edición ni borrado de programas.

**Next session**

R3, R4 o R5, en cualquier orden. Antes, confirmar el despliegue de R2 desde un dispositivo
fuera de la red corporativa.

---

### Sesión 9 — 25/09/2026 — migraciones versionadas (infraestructura, no una rebanada)

**Duración:** ~60 min
**Objetivo:** sustituir `drizzle-kit push` por migraciones versionadas, de modo que el esquema
viaje con el despliegue y nadie tenga que acordarse de aplicarlo a mano.

**No es una feature de `feature_list.json`.** No hay comportamiento nuevo ni requerimiento EARS
asociado: es la cadena de despliegue. Estaba anotado como hallazgo fuera de alcance en las
sesiones 7 y 8, y se atendió como trabajo propio en vez de colarlo dentro de otra rebanada.

**What was done**

- **Migración base generada y versionada:** `src/infra/db/migrations/0000_baseline.sql` más
  `meta/_journal.json` y `meta/0000_snapshot.json`. Cubre `programs`, `session_types` y
  `sessions` con sus 34 restricciones y sus seis índices, **incluido el parcial
  `one_running_session`**, que `drizzle-kit` 0.31.11 sí emite en `generate` — se verificó
  leyendo el `.sql`, no suponiéndolo.
- **La migración base se escribió idempotente a mano:** `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, y bloques `DO ... EXCEPTION WHEN duplicate_object` para las
  claves foráneas, que en PostgreSQL no admiten `IF NOT EXISTS`. El `meta/` generado **no se
  tocó**: es lo que compara `db:generate` para la siguiente migración.
- **Scripts de `package.json`:** `db:push` pasó a `db:push:emergency`. Nuevos `db:generate`,
  `db:migrate`, `db:check` y `vercel-build` (`drizzle-kit migrate && next build`). `build` se
  queda en `next build` a secas.
- **`init.sh`:** ejecuta `db:check` —valida el historial, no abre conexión— y exige que existan
  `db:generate`, `db:migrate` y `vercel-build`. Si `vercel-build` desapareciera, el despliegue
  dejaría de aplicar el esquema sin que nada avisara: el mismo defecto del `--if-present`.
- **Documentación corregida** donde contradecía la realidad, por la excepción de alcance de
  `AGENTS.md`: `AGENTS.md` (comandos de verificación y *Clean restart path*), `README.md`,
  `docs/ARCHITECTURE.md` (sección nueva *El esquema viaja con el despliegue*, y el procedimiento
  de recuperación del branch `dev` caducado, que decía `db:push`), `docs/DATA-MODEL.md`, y los
  comentarios de `src/infra/db/schema.ts` y de la prueba de integración.

**Decisions**

Registradas como 18 a 21 en `docs/ARCHITECTURE.md`.

1. **Migraciones versionadas en vez de `push`.** `push` aplica la diferencia contra la base a
   la que apunte `.env` sin dejar rastro de qué se aplicó ni dónde.
2. **La migración base es idempotente; no se marca a mano como aplicada.** La alternativa
   —insertar el registro de control en `drizzle.__drizzle_migrations`— exigía ejecutar SQL
   manual contra producción con el hash correcto del archivo, que es exactamente el
   procedimiento manual que este cambio existe para eliminar. Además, un hash mal copiado
   vuelve a ejecutar la migración. Escrita idempotente, cada base se auto-marca en su primera
   corrida y el mismo archivo sirve para una base vacía.
3. **`vercel-build` separado de `build`.** `./init.sh` ejecuta `build`; encadenar ahí las
   migraciones volvería la puerta de entrada dependiente de que Neon responda —justo lo que
   `init.sh` evita— y aplicaría esquema en cada corrida local. Vercel prefiere `vercel-build`
   cuando existe, así que migra el despliegue y no el desarrollador.
4. **`push` se conserva renombrado, no se borra.** La migración base idempotente no repara una
   base a medio aplicar; esa herramienta hace falta, y el nombre impide usarla por inercia.

**Verificación**

- **Línea base tomada antes de tocar nada** —esquema completo, restricciones, índices, conteos
  y la fila semilla con su UUID— y comparada después: la única diferencia en toda la base es el
  esquema `drizzle` nuevo y **una** fila en `drizzle.__drizzle_migrations`. `programs` = 1,
  `session_types` = 4, `sessions` = 0 antes y después; el programa semilla conserva su `id`
  `ef26e04b-8a0e-47d6-84c0-66ecfa9c1cd0` y su `created_at`.
- `npm run db:migrate` contra `dev` corrido **cinco veces**: la primera se auto-marca sin tocar
  nada, las siguientes son no-op. La tabla de control se queda en una sola fila.
- **Base vacía, prueba real:** se creó una base auxiliar en el mismo branch, se le aplicaron
  solo las migraciones y quedó con las tres tablas, **las mismas 34 restricciones** que había
  dejado `push` en `dev` —comparadas una a una, sin diferencias— y los seis índices, con
  `one_running_session` en la forma exacta que verifica la prueba de integración:
  `CREATE UNIQUE INDEX ... USING btree ((true)) WHERE (ended_at IS NULL)`. La base auxiliar se
  borró.
- **`vercel-build` simulado como lo corre Vercel:** con `.env` movido fuera y `DATABASE_URL`
  solo en el entorno, aplica migraciones y construye. Con una cadena inválida sale con código
  1 y **`next build` no llega a ejecutarse**, que es lo que hace que Vercel conserve el
  despliegue anterior.
- `./init.sh` termina en `Init OK`. `npm run test`: 118 pruebas. `npm run test:integration`: 8
  pruebas. `npm run build` y `npm run check` sin errores.

**Issues**

- `drizzle-kit generate` emite `CREATE TABLE` pelado: la idempotencia **no** la da la
  herramienta, se escribió a mano. Solo aplica a la migración base; las siguientes se generan y
  se aplican tal cual salen, sobre una base que ya tiene historial.
- Los archivos temporales de verificación (`.snapshot.tmp.mjs`, `.smoke.tmp.mjs`) se
  eliminaron. La cadena de conexión nunca se imprimió.

**Hallazgos fuera de alcance**

- **Defecto nuevo que introduce este modelo:** cambiar `src/infra/db/schema.ts` sin correr
  `db:generate` deja el despliegue aplicando un esquema viejo, y en local todo compila y pasa.
  `db:check` valida la coherencia del historial pero **no** detecta la omisión. Documentado en
  `AGENTS.md` y en `docs/ARCHITECTURE.md`; una guardia automática —comparar el esquema con el
  snapshot dentro de `init.sh`— sería trabajo propio.
- La migración base idempotente **no repara** una base a medio aplicar: los `CHECK` y `UNIQUE`
  declarados dentro de `CREATE TABLE IF NOT EXISTS` se saltan si la tabla ya existe. Las claves
  foráneas y los índices sí se reparan. Documentado.
- Siguen abiertos de sesiones anteriores: los campos `verification` de R3 a R6 mezclan
  verificación ejecutable y confirmación humana; `plannedSessions` no se captura por la
  interfaz (`RF-36`); no existe edición ni borrado de programas; `RF-30` espera a R3.

**Next session**

R3, R4 o R5, en cualquier orden. Antes, confirmar el despliegue de R2 desde un dispositivo
fuera de la red corporativa y comprobar en el registro del primer build de Vercel que aparece
`migrations applied successfully`.

---

### Sesión 10 — 25/09/2026 — plan de paralelización, escrito

**Duración:** ~20 min
**Objetivo:** dejar el plan del abanico en el repositorio, no en una conversación.

**What was done**

El plan de paralelizar R3, R4 y R5 existía solo en la conversación de tutoría: **aparecía cero
veces en el repositorio**. Una sesión nueva habría leído el handoff anterior y hecho R3 sola, en
serie, sin enterarse. Ahora vive en `docs/ROADMAP.md` (justificación y conflictos) y en
`session-handoff.md` (secuencia ejecutable).

Tres colisiones que se resolvieron antes de escribirlo, y que ninguna sesión nueva podría haber
deducido por su cuenta:

1. **Base de datos compartida.** El índice `one_running_session` es global: la sesión que crea la
   prueba de integración de un agente hace fallar las de los otros dos. Se resuelve con un branch
   de Neon por worktree. Sin esto, las pruebas fallan de forma intermitente y sin causa aparente.
2. **Numeración de migraciones.** R4 y R5 agregan tablas y ambos generarían `0001_*`. Se resuelve
   integrando en orden R3 → R4 → R5 y regenerando la migración de R5 después de integrar R4.
3. **Infraestructura de interfaz compartida.** shadcn/ui y Recharts no están instalados. Tres
   `shadcn init` en paralelo se pisan, así que se instala antes, en serie.

También se identificaron los archivos de un solo escritor —`session-handoff.md`, `progress.md`—
que los agentes paralelos **no** deben tocar, con `notas-rN.md` por worktree como reemplazo.

**Decisions**

1. El plan vive en dos sitios con papeles distintos: `ROADMAP.md` guarda el porqué y es
   permanente; `session-handoff.md` guarda la secuencia y es efímero. Un plan solo en el handoff
   desaparece en la siguiente reescritura.
2. Se documenta explícitamente la alternativa en serie. Un plan que solo ofrece un camino empuja
   a tomarlo aunque no convenga.

**Issues**

Ninguno.

**Hallazgos fuera de alcance**

- El abanico es además el **Experimento 2 del Proyecto 08** del curso. Hay que registrar tiempos
  y conflictos para responder con datos si el paralelismo compensó su costo de coordinación.
- Siguen pendientes los huecos del harness acumulados en R0, R1, R2 y la sesión de
  infraestructura, en especial: la *Definition of Done* no tiene casilla para trabajo que no es
  rebanada, la excepción de alcance no cubre comentarios del código, y no hay guardia automática
  contra tocar `schema.ts` sin correr `db:generate`.

**Next session**

Paso 0 del handoff: preparación en serie. Después, el abanico.

### Sesión 11 — 25/09/2026 — abanico de R3, R4 y R5 en paralelo (Experimento 2, Proyecto 08)

**Duración:** 10:37 → ~11:25, unos 48 min de reloj de principio a fin, cierre incluido.
**Objetivo:** ejecutar el plan de paralelización de `docs/ROADMAP.md`: preparación en serie,
tres agentes en worktrees aislados y la integración en serie R3 → R4 → R5.

**What was done**

- **Paso 0, en serie:**
  1. shadcn/ui 4.21 (base Radix) y Recharts 3.8 quedaron en `main` (commit `418c60c`), con un
     juego base de primitivas en `src/ui/primitives/` y el `TooltipProvider` en el layout.
  2. Se crearon tres worktrees, cada uno con su `npm ci`. El usuario creó los branches de Neon
     `dev-r3`, `dev-r4` y `dev-r5` y pegó él mismo las cadenas en cada `.env`.
  3. Los hosts se compararon sin imprimir las cadenas: los cuatro son distintos y todos
     pooled.
  4. Se corrió `db:migrate` en cada worktree.
- **Paso 1:** tres agentes en paralelo, uno por rebanada, cada uno contra su branch de Neon.
  Los tres cerraron en `passing` con evidencia.
- **Paso 2, integración en serie:**
  - **R3** se integró sin conflictos (`af8a0d5`).
  - **R4** tuvo 1 conflicto, en `page.tsx` (`11e83bb`).
  - **R5** tuvo 4 conflictos, en `_journal.json`, `0001_snapshot.json`, `schema.ts` y `page.tsx`
    (`d002ff2`). Se descartó el `0001_nosy_patch` de R5 y se regeneró como
    `0002_metrics_readings`. El SQL salió **idéntico byte a byte** al original, un segundo
    `db:generate` respondió "No schema changes" y `db:check` pasó.
  - Después de cada integración: `./init.sh` (que incluye `db:check`), `db:migrate` contra
    `dev`, `test:integration` y humo con `curl`.
  - Estado final en `main`: 18 archivos y 266 pruebas en `npm run test`, 4 archivos y 23
    pruebas en `npm run test:integration`.
  - `dev` quedó con 3 migraciones y 6 tablas. `db:seed` sembró la métrica "Harness score".
  - La página responde 200 con las tres secciones nuevas.

**Medición del experimento**

| Fase | Inicio | Fin | Duración |
|---|---|---|---|
| Preparación (Paso 0) | 10:37 | 10:52 | 15 min, de los cuales ~5 fueron espera del usuario por las cadenas |
| → shadcn + Recharts + correcciones | 10:37 | 10:45 | 7,5 min (se necesitaría igual en serie) |
| → worktrees + 3 `npm ci` en paralelo | 10:45 | 10:46 | ~1 min |
| → cadenas, verificación de hosts, 3 `db:migrate` | 10:46 | 10:52 | ~6 min |
| Agente A — R3 | 10:51:45 | 11:03:37 | 12 min |
| Agente B — R4 | 10:52:00 | 11:12:14 | 20 min |
| Agente C — R5 | 10:52:19 | 11:07:28 | 15 min |
| Abanico, reloj de pared | 10:52 | 11:12 | 20 min (lo marca el más lento) |
| Integración R3 | 11:05 | 11:06 | ~1 min, 0 conflictos |
| Integración R4 | 11:13 | 11:14 | ~1 min, 1 conflicto |
| Integración R5 | 11:14 | 11:16 | ~2 min, 4 conflictos |
| Cierre (notas, docs, handoff, limpieza) | 11:16 | ~11:25 | ~9 min |

**Conflictos:** 5 archivos en conflicto en total. Los 5 estaban previstos en la tabla
"Conflictos esperados" del ROADMAP y no hubo ninguno imprevisto. `feature_list.json` se fusionó
solo, porque cada agente tocó únicamente su bloque.

**¿Compensó el tiempo ahorrado el costo de coordinación?** Sí en tiempo, con una salvedad de
diseño que no aparece en el reloj.

- **Tiempo.** En serie, los tres agentes habrían sumado unos 47 min, más la instalación de
  shadcn y el cierre. En paralelo, el abanico costó 20 min de pared. Lo que añadió la
  coordinación fueron ~7 min de worktrees, cadenas y migraciones por branch, y ~4 min de
  integración. **Ahorro neto: unos 15 a 20 min sobre ~65**, alrededor de un 25 %.
- **Lo que el reloj no mide: trabajo duplicado.** Tres agentes que no se ven construyeron
  **tres lecturas de sesiones distintas**:
  - `SessionList` / `listProgramSessions` de R3;
  - `SessionEvidence` / `listRecentEvidence` de R4;
  - `listLinkableSessions` de R5.

  En serie, R4 y R5 habrían reutilizado el listado de R3. El aviso que se le envió a R4 a mitad
  de camino llegó tarde: la sección ya estaba construida. Consolidarlas es deuda que el abanico
  creó y que habrá que pagar después. Por eso el ahorro real es menor que el medido.
- **Costo en cómputo:** unos 640 000 tokens entre los tres subagentes. Cada uno leyó el harness
  completo por su cuenta; en serie, esa lectura se habría hecho una sola vez.
- **Condiciones que lo hicieron viable:** la preparación en serie absorbió los tres choques
  estructurales (shadcn, base de datos y numeración de migraciones), y el aislamiento por branch
  de Neon hizo que ninguna prueba de integración fallara por culpa de otro agente. Sin esas dos
  cosas, la integración habría costado más que lo ahorrado.

**Decisions**

1. **Primitivas de shadcn en `src/ui/primitives/`**, no en `src/components/`. Se acepta el
   paquete `cn` en lugar de `clsx` + `tailwind-merge`, y el modo oscuro sigue por
   `prefers-color-scheme` (decisiones 22 a 24 de `docs/ARCHITECTURE.md`).
2. Reglas añadidas al encargo de cada agente, además de las del ROADMAP:
   - las tablas nuevas van en un bloque delimitado al final de `schema.ts`;
   - la documentación no se edita en paralelo: las contradicciones se anotan en las notas y
     las corrige quien integra;
   - `layout.tsx`, `globals.css`, `components.json` y las primitivas están vedados;
   - cada agente usa un puerto de humo propio (3003 a 3005), porque el usuario tenía
     `next dev` en el 3000.
3. En `page.tsx`, las cargas de sesión, evidencia y métricas quedan en un solo `Promise.all`,
   porque son lecturas independientes.
4. Decisiones de dominio de los agentes que el usuario debe validar, porque el requerimiento
   admite otra lectura:
   - **RF-34, racha:** si hoy no hay sesión, se cuenta hasta ayer.
   - **RF-35, cadencia:** 8 semanas de calendario, de lunes a domingo.
   - **RF-36, proyección:** los 28 días corridos que terminan hoy.
   - **RF-33, mapa de calor:** umbrales fijos de 1, 30, 60 y 120 min; 26 semanas.
   - **RF-50 y RF-52, rutas relativas:** se muestran como texto y no como enlace, porque no hay
     una URL base de repositorio.
5. Decisiones técnicas de los agentes, ya aplicadas:
   - **R4:** lista blanca `http`/`https` aplicada al guardar y otra vez al presentar. RF-53 sin
     petición del servidor a la URL, para no abrir la puerta a SSRF.
   - **R5:** `numeric` en modo `number`, porque en modo texto RF-63 compararía `'9' > '10'`.
     Coma decimal aceptada. `readings.created_at` desempata RF-63.

**Documentación corregida** (excepción de alcance de `AGENTS.md`; todo era falso tras integrar):

- `docs/DATA-MODEL.md`:
  - el estado de las tablas;
  - el DDL de `artifacts`, `metrics` y `readings`, para que coincida con lo aplicado;
  - el invariante 6, al que le faltaban la cascada de artefactos y el `SET NULL` de las
    lecturas;
  - una nota de que la consulta de agrupación por día es referencia y no implementación.
- `docs/ARCHITECTURE.md`: decía que la regla de capas de `core/` "se verifica
  automáticamente", pero **nada la verifica**. Se comprobó a mano con `grep` que hoy se cumple.
- `README.md`: cuándo entraron shadcn y Recharts.
- `feature_list.json`, `verification` de R4: `npm run test -- artifacts` no encuentra ningún
  archivo. R5 corrigió por su cuenta el mismo defecto en su propia entrada (`-- metrics`).

**Issues**

Ninguno bloqueante. Las notas originales de los agentes (`notas-r3.md`, `notas-r4.md` y
`notas-r5.md`, con evidencia y pruebas de reversión detalladas) se consolidan aquí y se retiran
del árbol. Quedan en el historial, en el commit `d002ff2`.

**Hallazgos fuera de alcance**

- **Tres lecturas de sesiones duplicadas** (ver la medición). Consolidar en una sola, colgando
  `SessionArtifacts` de R4 del listado de R3, como propone `notas-r4.md`.
- **RF-36 solo funciona para el programa sembrado:** el formulario de RF-10 no captura
  `planned_sessions`.
- **No hay edición ni borrado** de artefactos, métricas ni lecturas. Un dato mal digitado queda
  para siempre en la curva y en el veredicto de RF-63. Es fricción real de producto.
- **`src/ui/primitives/chart.tsx`:** su tema `.dark` nunca se activa, así que `theme.dark` en
  `ChartConfig` no tiene efecto. R3 y R5 usan variables CSS y no se ven afectados.
- **La regla de capas de `core/` no tiene guardia automática.** Una prueba del estilo de
  `no-file-storage.test.ts` la cubriría.
- **React 19 vacía los formularios tras cada envío**, también cuando el servidor rechaza. Pasa
  en todos los formularios.
- El encabezado de la página sigue diciendo `study-tracker · R2`.
- Los paneles de R3 muestran todos los programas, también los `done` y `abandoned`.
- **Operativo en Windows:** detener `npx next dev` deja vivo el proceso hijo en el puerto. R4
  tuvo que matarlo por PID.
- Sigue pendiente la guardia contra tocar `schema.ts` sin correr `db:generate`.

**Next session**

R6, antes de cargar datos reales. Detalle en `session-handoff.md`.

---

### Sesión 12 — 25/09/2026 — R6 diferida con riesgo aceptado

**Duración:** ~15 min
**Objetivo:** decidir sobre la autenticación antes de empujar R3, R4 y R5.

**What was done**

Se lanzó el agente de R6 y **se detuvo a los pocos minutos**, antes de que escribiera código, tras
una decisión explícita del usuario. El repositorio quedó intacto.

Se registró el diferimiento donde corresponde: `RF-40` en `docs/REQUIREMENTS.md` y la cabecera de
R6 en `docs/ROADMAP.md`, ambos con las condiciones que vuelven la autenticación obligatoria.

**Decisions**

**R6 se difiere, con el riesgo evaluado y asumido por escrito.** Razones del usuario, que se
consideran válidas: es un tracker personal, sin datos de terceros, sin credenciales y sin
información que importe exponer; la URL no se ha compartido; el peor caso realista es que alguien
escriba filas basura, que se borran.

Se dejó constancia de un dato que forma parte de la decisión: los subdominios `vercel.app` son
descubribles por los registros públicos de transparencia de certificados, así que no publicar la
URL no equivale a que sea secreta.

**Se escribieron cuatro condiciones de disparo** que vuelven `RF-40` obligatoria: compartir la
URL, almacenar algo que importe, que la use una segunda persona, o detectar actividad no
reconocida.

> Esa lista es el punto de la decisión. `RF-40` ya se había incumplido una vez sin que nadie lo
> notara, porque era una compuerta sin mecanismo. Un riesgo aceptado **por escrito y con
> disparadores** es una decisión de ingeniería; uno olvidado es el mismo defecto de antes con
> otra cara.

**Issues**

Ninguno.

**Hallazgos fuera de alcance**

- `repo_url` en `programs`, que `RF-52` necesita para que las rutas relativas de evidencia sean
  enlaces y no texto. Deuda de R4.
- Deduplicar el listado de sesiones: el abanico dejó dos en la página, porque tres agentes
  construyeron cada uno su propia lectura. Deuda que creó el paralelismo.
- En producción, la métrica "Harness score" no existirá hasta correr `db:seed` contra esa base.
  `vercel-build` corre `migrate` pero no `seed`; como `seed` es idempotente, encadenarlo
  eliminaría el paso manual.

**Next session**

La deuda pendiente, o el curso.

---

### Sesión 13 — 25/09/2026 — R7, limpieza del MVP

**Duración:** ~50 min
**Objetivo:** cerrar las tres deudas que quedaron tras el abanico, antes de empezar el curso.

**What was done**

1. **`repo_url` en `programs` (RF-52).** Un artefacto guardado como ruta relativa se mostraba
   como texto porque no había base contra la cual resolverlo. Ahora el programa puede tener la
   URL de su repositorio y `artifactHref` une las dos. Migración `0003_program_repo_url`,
   validación en `core`, campo en el formulario y uso en `ArtifactList`.
2. **Encabezado sin rótulo de rebanada.** Decía «study-tracker · R2 / Cronómetro» con la página
   ya conteniendo R1 a R5. Ahora dice qué hace la aplicación, que no cambia cada rebanada.
3. **Redundancia entre R3 y R4 reducida.** La sección de evidencia se retituló «Adjuntar
   evidencia», remite explícitamente a la tabla de R3 para el detalle, y perdió la insignia de
   duración que repetía un dato de esa tabla.

**Decisions**

1. **La unión de ruta y base se implementa a mano, no con `new URL(ruta, base)`.** Esa función
   parece la natural y es una trampa: `new URL('//otro-host.com/x', base)` devuelve
   `https://otro-host.com/x`, porque una ruta que empieza por `//` es relativa al protocolo y se
   lleva el enlace a otro servidor. La implementación revalida la ruta con las reglas de guardado
   y compara el origen final con el de la base. Hay una prueba que documenta el ataque.
2. **`repoUrl` reutiliza `safeExternalHref` en vez de una regla propia.** Es la misma lista
   blanca `http`/`https` que gobierna los destinos de artefactos y termina en el mismo sitio, un
   `href`. Dos definiciones de "URL aceptable" se habrían desincronizado.
3. **Los dos listados de sesiones no se fusionaron, y es deliberado.** Se evaluó y **no es
   limpieza sino rediseño**: la tabla de R3 es además la vista accesible del mapa de calor
   (RF-30), y las tarjetas de R4 llevan cada una su formulario de adjuntar. Eliminar cualquiera
   rompe algo real. Se redujo la redundancia visual en vez de forzar una fusión.

**Issues**

Ninguno que quedara abierto. Durante el trabajo, tres errores propios de escapado de shell al
escribir pruebas con rutas de Windows: una coma doble en un `import`, y dos niveles de barras
invertidas mal contados. El segundo era el peligroso — `'docs
otas.md'` con una sola barra
convierte `
` en un salto de línea y la prueba habría pasado midiendo otra cosa. Se resolvió
usando `String.raw`, que elimina la ambigüedad de niveles.

**Hallazgos fuera de alcance**

- **Indicar en la tabla de R3 qué sesiones tienen evidencia** sería la mejora natural, pero
  acopla la sección de R3 al repositorio de R4: cuatro archivos y una consulta nueva. Queda como
  trabajo propio si la redundancia sigue molestando en uso real.
- `plannedSessions` sigue sin capturarse por la interfaz y `RF-36` lo necesita.
- No existe edición ni borrado de programas ni de sesiones.

**Next session**

El curso. El MVP está completo salvo la autenticación, que está diferida con condiciones escritas.
