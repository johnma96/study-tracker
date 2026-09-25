# session-handoff.md

**Last Updated:** 25/09/2026

> Encabezados de sección en inglés a propósito: son los marcadores estructurales que buscan las
> herramientas de auditoría del harness. El contenido va en español.

## Current Objective

**Ninguno en marcha.** R2 — Cronómetro quedó cerrada en `passing` y no hay ninguna feature en
`active`, que es el estado normal cuando nadie está trabajando.

Con R2 cerrada se cumple el criterio de corte que fija `docs/ROADMAP.md`: la herramienta **ya
es útil**. Cronometra una sesión, la guarda y sobrevive a cerrar el navegador. Todo lo que
queda es visualización sobre datos que ya se están capturando.

La siguiente rebanada la elige el paso 8 del *Startup Workflow*: R3, R4 y R5 dependen solo de
R2 y son independientes entre sí, así que califican las tres y se puede empezar por cualquiera.
R6 es compuerta, no etapa: se vuelve obligatoria en el momento en que la base guarde sesiones
reales que importe perder o exponer — y R2 es justo la rebanada que empieza a generarlas.

## What was done

**R2 cerrada en `passing`.** `RF-00`, `RF-20` a `RF-29`, `RF-2A` a `RF-2E` y `RF-2F` a `RF-2I`
implementados y verificados en local. Las tres partes —índice único, pausas y recuperación—
fueron juntas, no en tandas.

- **El tiempo se deriva de `started_at`.** No hay ninguna columna de tiempo transcurrido ni
  ningún contador en el navegador. `src/core/services/session-duration.ts` lo calcula todo
  desde las marcas almacenadas, y el reloj de la interfaz llama a esa misma función en cada tic
  con el valor que vino de la base. Comprobado sin navegador: con una sesión de hace 90 minutos
  en la base, el HTML que devuelve `curl` ya trae `1:30:00`.
- **`one_running_session` está en la base y lo aplica `npm run db:push`.** Se temía que
  `drizzle-kit` no supiera expresar un índice único sobre la expresión constante `(true)`; se
  comprobó y sí lo emite, y además lo lee de vuelta sin recrearlo (`No changes detected` en la
  segunda corrida). Por eso se declara en `src/infra/db/schema.ts` y no en un paso de SQL
  manual: un clon limpio que corra `db:push` queda con la restricción puesta. El detalle y la
  consulta de comprobación están en `docs/DATA-MODEL.md`.
- **La válvula de escape existe desde el primer día.** La barra de sesión vive en el layout, así
  que el estado se ve y la sesión se puede detener o descartar desde cualquier vista
  (`RF-2I`, `RF-2F`). Una sesión abierta hace más de ocho horas abre el diálogo de recuperación
  con las tres opciones de `RF-2G`, y la duración indicada se guarda en `minutes_override`
  (`RF-2H`).
- **Dos niveles de prueba.** `npm run test`: 118 pruebas de `core/` sin base de datos, con los
  seis casos de duración efectiva de `docs/DATA-MODEL.md` uno a uno, incluido el que más se
  olvida —`minutesOverride` gana incluso sobre las pausas—. `npm run test:integration`: 8
  pruebas contra el branch `dev` de Neon con las tres comprobaciones que solo tienen sentido
  contra la base real.
- **La regla completa de la *Definition of Done* se cumplió, comprobándola.** Al revertir la
  consolidación de la pausa abierta en `decideStop` (`RF-2D`), falla la prueba que la cubre con
  60 minutos en vez de 50; restaurado, vuelven las 118. Al borrar el índice
  `one_running_session` de la base, fallan 6 de las 8 pruebas de integración; restaurado con
  `npm run db:push`, vuelven las 8.
- **Seis correcciones al harness y a la especificación**, todas sobre defectos comprobados.
  Están detalladas en la entrada de la sesión 8 de `progress.md`. La de más consecuencia: la
  *Clean restart path* de `AGENTS.md` prometía un estado ejecutable sin pasar por `db:push`, y
  `db:push` es lo que crea el índice único.

## What is broken or unverified

- **Producción sin verificar.** La VPN corporativa bloquea `vercel.app` y la interceptación TLS
  impide comprobarlo por línea de comandos. El criterio de hecho de R2 no exige la URL de
  producción —eso era exclusivo de R0— y la confirmación humana no bloquea, así que no impidió
  el cierre. **Queda pendiente que el usuario lo confirme desde un dispositivo fuera de la red
  corporativa:** iniciar una sesión, cerrar el navegador, reabrir y ver el cronómetro corriendo
  con el tiempo correcto.
- **Las sesiones guardadas todavía no se pueden ver en una lista.** `RF-30` pertenece a R3. Es
  coherente con el corte del plan, pero hasta entonces la única forma de ver una sesión cerrada
  es consultar la base.
- **Sin migraciones versionadas.** `drizzle-kit push` sirvió mientras la base solo tenía la fila
  semilla. Con R2 ya hay datos que importa no perder, y `push` puede dejar `dev` y producción
  divergentes sin que nada avise. Debería ser trabajo propio, no un agregado dentro de otra
  rebanada.
- **`APP_TIMEZONE` sigue sin leerla ningún código, y ahora es deliberado.** `RF-00` se
  implementó como constante de dominio en `src/core/services/timezone.ts`, siguiendo el análisis
  de `docs/ARCHITECTURE.md`: una zona que no cambia entre entornos no debe ser variable de
  entorno, porque si falta o se escribe mal en producción la agrupación por día se rompe en
  silencio. La variable queda documentada en `.env.example` por si algún día la zona se vuelve
  preferencia del usuario, en cuyo caso pertenece a la base de datos.
- **`RF-40` se acerca.** R2 es la rebanada que empieza a generar sesiones reales. La
  autenticación es una compuerta, no una etapa: antes del primer despliegue con datos que
  importen, R6.
- **Ninguna feature quedó en `status: "active"`.** Es lo correcto: cero activas es el estado
  normal cuando nadie está trabajando.

## Files

**Nuevos:** `src/core/model/session.ts`, `src/core/ports/session-repository.ts`,
`src/core/services/timezone.ts`, `src/core/services/session-duration.ts`,
`src/core/services/session-transitions.ts`, `src/core/services/session-input.ts` y sus cuatro
archivos de prueba; `src/infra/db/unique-violation.ts`,
`src/infra/repos/drizzle-session-repository.ts`; `src/app/session-actions.ts`,
`src/app/current-session.ts`; `src/ui/session-view.ts`, `src/ui/session-form-state.ts`,
`src/ui/session-clock.tsx`, `src/ui/session-bar.tsx`, `src/ui/session-action-button.tsx`,
`src/ui/stop-session-form.tsx`, `src/ui/start-session-form.tsx`,
`src/ui/manual-session-form.tsx`, `src/ui/session-recovery-dialog.tsx`;
`vitest.integration.mts`, `tests/integration/session.integration.test.ts`.

**Modificados:** `src/infra/db/schema.ts` (tabla `sessions`, índices y CHECK),
`src/infra/repos/drizzle-program-repository.ts` (usa el detector de unicidad compartido),
`src/app/layout.tsx` (barra de sesión, `force-dynamic`), `src/app/page.tsx`, `package.json`
(script `test:integration`), `init.sh`, `AGENTS.md`, `README.md`, `docs/ROADMAP.md`,
`docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `feature_list.json`, `progress.md` y este archivo.

## Blockers

**Ninguno.**

**Aviso con fecha: el branch `dev` de Neon expira el 02/10/2026** (TTL de 7 días del panel).
Si un comando de base falla con error de conexión después de esa fecha, no es el código:
recrear el branch y correr `npm run db:push`, `npm run db:seed` y `npm run test:integration`.
El procedimiento está en `docs/ARCHITECTURE.md`. El último comando no sobra: `db:push` es lo
que crea el índice único, y sin él la aplicación parece sana y admite dos sesiones a la vez.

## Next Session

Recommended Next Step: **R3 — Totales y mapa de calor**, por dos razones: es la que hace
visibles las sesiones que R2 ya guarda (`RF-30`), y es donde entra `shadcn/ui` y Recharts, que
el resto de rebanadas van a reutilizar. R4 y R5 califican igual si se prefiere otro orden.

1. `cd study-tracker` y confirmar con `pwd`. No trabajar desde el repositorio del curso: la
   terminal tiende a reposicionarse ahí sola.
2. `./init.sh` — debe terminar en "Init OK" y ejecutar las 118 pruebas.
3. `npm run test:integration` — 8 pruebas contra `dev`. Si falla por conexión, el branch
   caducó: ver *Blockers*.
4. Poner la feature elegida en `active` antes de escribir código, y dejarla en `passing` o
   `blocked` al cerrar.
5. Para R3, la trampa conocida ya tiene herramienta: `toCivilDateInAppZone` de
   `src/core/services/timezone.ts` convierte a `America/Bogota` y está probada con el caso de
   las 23:40. Agrupar por `started_at::date` sin convertir es el error silencioso más probable
   del modelo.
6. Corregir el campo `verification` de la rebanada que se abra: los de R3 a R6 todavía mezclan
   verificación ejecutable y confirmación humana en una sola frase.
7. Cerrar según el procedimiento "End of Session" de `AGENTS.md`.

Recordatorio de alcance: `metrics` y `readings` son de **R5**; la autenticación, de **R6**, que
es compuerta y no etapa final.
