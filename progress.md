# progress.md — bitácora de sesiones

## Current State

**Última actualización:** 24/09/2026
**Feature activa:** ninguna. R0 quedó en `blocked` a la espera del despliegue en Vercel.
**Estado del repositorio:** aplicación Next.js 16 funcionando en local contra Neon. La página
raíz lee la tabla `programs` y muestra el programa semilla "Harness Engineering".
**Bloqueos externos:** importar el repositorio en Vercel y definir `DATABASE_URL` allí. Requiere
el navegador del usuario.
**Siguiente paso:** desplegar en Vercel, verificar la URL de producción y cerrar R0 con esa
evidencia. Solo entonces R1 queda habilitada.

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
