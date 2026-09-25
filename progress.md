# progress.md — bitácora de sesiones

## Current State

**Última actualización:** 25/09/2026
**Feature activa:** ninguna.
**Estado del repositorio:** R0, R1 y R2 en `passing`. El MVP ya cronometra y guarda sesiones,
que era el criterio de corte de `docs/ROADMAP.md`: a partir de aquí todo es visualización sobre
datos que ya se capturan. Desplegado en <https://study-tracker-eight-sigma.vercel.app/>.
**Bloqueos:** ninguno. Branch `dev` de Neon en uso; **expira el 02/10/2026**.
**Siguiente paso:** R3, R4 o R5, en cualquier orden — son independientes entre sí. Antes,
confirmar el despliegue de R2 desde un dispositivo fuera de la red corporativa.

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
