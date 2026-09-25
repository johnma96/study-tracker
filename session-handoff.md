# session-handoff.md

**Last Updated:** 25/09/2026

> Encabezados de sección en inglés a propósito: son los marcadores estructurales que buscan las
> herramientas de auditoría del harness. El contenido va en español.

## Current Objective

**Ninguno en marcha.** La sesión 11 ejecutó el abanico de R3, R4 y R5 en paralelo y los integró
en `main`. No hay ninguna feature en `active`. Según el paso 8 del *Startup Workflow*, la
siguiente es **R6 — Autenticación**: es la única `not_started` y su dependencia (R0) está en
`passing`.

## What was done

- **R3 — Totales y mapa de calor, en `passing`.** Implementa RF-30 a RF-37 con funciones puras
  en `src/core/services/study-stats.ts`. Una sesión iniciada a las 23:40 hora de Colombia cuenta
  en su propio día.
- **R4 — Evidencia enlazada, en `passing`.** Implementa RF-50 a RF-54: tabla `artifacts` y
  lista blanca `http`/`https` aplicada al guardar y al presentar. RF-54 se prueba con
  `src/core/no-file-storage.test.ts`, que recorre el código.
- **R5 — Métricas de progreso, en `passing`.** Implementa RF-60 a RF-63: tablas `metrics` y
  `readings`, veredicto de RF-63 en `core/` y gráfica con línea de objetivo. La semilla agrega
  "Harness score".
- **Infraestructura de interfaz.** shadcn/ui y Recharts quedan en `src/ui/primitives/`
  (decisiones 22 a 24 de `docs/ARCHITECTURE.md`).
- **Migraciones:** `0000_baseline`, `0001_artifacts` y `0002_metrics_readings`, todas
  aplicadas en `dev`.
- **Verificación sobre `main` integrado:**
  - `./init.sh` termina en `Init OK`: 18 archivos y 266 pruebas.
  - `npm run test:integration`: 4 archivos y 23 pruebas, contra `dev`.
  - Humo con `curl`: HTTP 200 con las tres secciones nuevas.
- **Documentación corregida** donde contradecía la realidad: `docs/DATA-MODEL.md`,
  `docs/ARCHITECTURE.md` (la regla de capas **no** se verifica automáticamente), `README.md` y
  el campo `verification` de R4.
- **Medición del Experimento 2**, en la sesión 11 de `progress.md`. Ahorro neto de ~25 % en
  tiempo de reloj y 5 conflictos, todos previstos. El costo que no mide el reloj: **tres
  lecturas de sesiones duplicadas**.

## What is broken or unverified

- **Nada de esta sesión se ha empujado.** `main` va 11 commits por delante de `origin/main`,
  que está en `dd75aee`. Ese commit ya incluye las migraciones versionadas de la sesión 9, así
  que puede que Vercel ya haya corrido `vercel-build` con `0000_baseline`. **No se pudo
  comprobar desde esta máquina**, porque la VPN bloquea `vercel.app`. El próximo despliegue
  aplicará las migraciones que falten:
  - `0000_baseline`, si todavía no se aplicó. Es idempotente y no toca nada.
  - `0001_artifacts` y `0002_metrics_readings`, que crean tablas nuevas.

  Hay que confirmar en el registro del build que aparece `migrations applied successfully`.
- **La métrica "Harness score" no existirá en producción** hasta que se corra `db:seed` contra
  ella. Vercel no siembra. Para hacerlo desde local sin guardar la cadena en `.env`, sigue la
  válvula de escape de `docs/ARCHITECTURE.md`.
- **Confirmaciones humanas pendientes (no bloquean):**
  - **R2:** iniciar una sesión, cerrar el navegador y ver el cronómetro seguir corriendo.
  - **R3:** ver el tablero en un navegador. El gráfico de cadencia se pinta en el cliente, así
    que `curl` no lo muestra.
  - **R4:** un artefacto `doc` con URL de GitHub abre el archivo real en una pestaña nueva.
  - **R5:** cargar los scores reales de `validate-harness.mjs` y ver la curva con el objetivo
    en 80.

  La VPN corporativa bloquea `vercel.app`, así que se hacen en local o desde fuera de la red.
- **Deuda del abanico: tres lecturas de sesiones.** R3 tiene `SessionList` /
  `listProgramSessions`, R4 tiene `SessionEvidence` / `listRecentEvidence` y R5 tiene
  `listLinkableSessions`. La página muestra dos listados de sesiones, el de totales y el de
  evidencia. Consolidarlas es trabajo propio: la guía está en el commit `d002ff2`, en
  `notas-r4.md`, sección "Guía para integrar".
- **La regla de capas de `core/` no tiene guardia automática.** Hoy se cumple, comprobado con
  `grep`.

## Files

**Nuevos en `main` esta sesión:**
- `components.json`, `src/ui/primitives/*` y `src/ui/utils.ts`.
- Código de R3: `study-stats`, `session-listing`, `civil-calendar`, el puerto y el repositorio
  de historial, `stats-section`, `stats-panel`, `heatmap`, `cadence-chart` y `session-list`.
- Código de R4: `artifact-*`, `no-file-storage.test.ts`, `evidence.ts`, `artifact-actions.ts`,
  `session-artifacts` y `session-evidence`.
- Código de R5: `metric-*`, `reading-*`, `metrics-snapshot.ts` y `metric-actions.ts`.
- Las migraciones `0001_artifacts.sql` y `0002_metrics_readings.sql`, con sus snapshots.
- Tres pruebas en `tests/integration/`.

**Modificados:**
- `package.json`, `package-lock.json`, `src/app/globals.css`, `src/app/layout.tsx` y
  `src/app/page.tsx`.
- `src/infra/db/schema.ts`, `src/infra/repos/drizzle-session-repository.ts` (se exporta
  `toDomain`) y `scripts/seed.mjs`.
- `feature_list.json` (R3, R4 y R5 en `passing`).
- `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `README.md`, `progress.md` y este archivo.

**Retirados:** `notas-r3.md`, `notas-r4.md` y `notas-r5.md`. Están consolidados en
`progress.md` y quedan en el historial, en `d002ff2`.

## Blockers

**Ninguno técnico.** Hay decisiones que son del usuario:

1. **Validar las lecturas de requerimientos que eligieron los agentes** y fijarlas en
   `docs/REQUIREMENTS.md`:
   - RF-34: la racha cuenta hasta ayer si hoy todavía no hay sesión.
   - RF-35: 8 semanas de calendario, de lunes a domingo.
   - RF-36: los últimos 28 días corridos.
   - RF-50 y RF-52: una ruta relativa no tiene URL base y hoy se muestra como texto. ¿Se agrega
     `repo_url` a `programs`?
2. **Si R6 va antes de empujar.** La aplicación desplegada ya acepta escrituras sin
   autenticación desde R1. Empujar ahora suma dos formularios públicos más, el de evidencia y el
   de métricas. Recomendación: hacer R6 y empujar después.
3. **Borrar en la consola de Neon los branches `dev-r3`, `dev-r4` y `dev-r5`.** Ya no se usan y
   solo tienen datos de prueba. Los worktrees se eliminaron.

**Aviso con fecha: el branch `dev` de Neon expira el 02/10/2026.** El procedimiento de
recuperación está en `docs/ARCHITECTURE.md`. Ahora hay tres migraciones; `db:migrate` las
aplica todas.

## Next Session

**El MVP está completo salvo la autenticación.** R0 a R5 y R7 en `passing`; R6 diferida con
riesgo aceptado y condiciones escritas en `RF-40`.

Recommended Next Step: **el curso de harness engineering**. El tracker ya puede registrar su
propia primera sesión: cronometra, guarda, muestra totales y evidencia, y grafica métricas.

Antes de la próxima sesión de trabajo, dos cosas de mantenimiento:

1. **Confirmar el despliegue.** El próximo `git push` lleva la migración `0003` a producción por
   `vercel-build`. En el registro del build debe aparecer `migrations applied successfully`.
2. **El branch `dev` de Neon expira el 02/10/2026.** Procedimiento de recuperación en
   `docs/ARCHITECTURE.md`.

Si se retoma el producto en vez del curso, la deuda pendiente, por orden de valor:

- **Indicar en la tabla de R3 qué sesiones tienen evidencia.** Es la mejora natural tras R7, pero
  acopla la sección de R3 al repositorio de R4: cuatro archivos y una consulta nueva.
- `plannedSessions` no se captura por la interfaz y `RF-36` lo necesita para proyectar.
- No hay edición ni borrado de programas ni de sesiones.
- **R6**, si se cumple alguna de las cuatro condiciones de `RF-40`.
