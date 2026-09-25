# session-handoff.md

**Last Updated:** 25/09/2026

> Encabezados de sección en inglés a propósito: son los marcadores estructurales que buscan las
> herramientas de auditoría del harness. El contenido va en español.

## Current Objective

Implementar **R2 — Cronómetro**: `RF-00` y `RF-20` a `RF-29`, más las pausas (`RF-2A` a `RF-2E`)
y la recuperación de sesión abandonada (`RF-2F` a `RF-2I`).

Es el corazón del MVP y la rebanada más grande del plan: dos sesiones estimadas. Las tres partes
van **juntas**, no en tandas. El índice único de "máximo una sesión en curso" y el flujo de
recuperación son la misma moneda: implementar el índice sin la válvula de escape deja la
aplicación en un estado del que el usuario no puede salir sin entrar a la base a mano.

## What was done

**R1 cerrada en `passing`.** Crear y listar programas, tipos de sesión propios de cada programa
y la semilla ampliada. `RF-10` a `RF-15` implementados y verificados en local.

- **Vitest en marcha.** 51 pruebas en 5 archivos, todas sobre `core/` y sin base de datos.
  `npm run test` y `npm run test:watch` existen y `./init.sh` los ejecuta.
- **La regla completa de la *Definition of Done* se cumplió**: al revertir `sortPrograms()` y el
  límite de 120 caracteres de `RF-14`, fallan 13 pruebas; restaurado el cambio, vuelven las 51.
- **Validación en el servidor (`RF-44`).** El esquema `zod` vive en
  `src/core/services/program-input.ts`, no en la Server Action, para poder probarlo sin levantar
  Next ni base de datos. `src/app/actions.ts` es solo el adaptador de `FormData`.
- **`session_types` en Neon**, con `UNIQUE (program_id, code)`, `ON DELETE CASCADE` y `CHECK` de
  longitud. La semilla dejó `E` Estudio, `C` Construcción, `K` Consolidación, `V` Checkpoint, y
  es idempotente.
- **Un defecto real corregido:** Drizzle envuelve el error del driver en `DrizzleQueryError` y
  deja el `NeonDbError` en `cause`. La detección del código `23505` solo funciona recorriendo la
  cadena de `cause`; sin eso, un código de tipo de sesión repetido llegaba al usuario como
  excepción de Postgres.

**`metrics` y `readings` no se crearon.** Son tablas de R5, junto con la siembra de la métrica
"Harness score". `docs/DATA-MODEL.md` ya lo dice explícitamente en su sección de datos semilla.

## What is broken or unverified

- **Producción sin verificar.** La VPN corporativa bloquea `vercel.app` y la interceptación TLS
  impide comprobarlo por línea de comandos. Toda verificación de despliegue exige un dispositivo
  fuera de la red corporativa. R1 no tiene la URL de producción en su criterio de hecho —eso era
  exclusivo de R0—, así que no bloquea el cierre, pero **conviene confirmar el despliegue antes
  de empezar R2**.
- **Un solo branch de Neon.** Local y producción comparten base. La verificación de esta sesión
  insertó y borró filas de prueba en la base que sirve producción. Antes de que R2 registre
  sesiones reales, crear el branch `dev` deja de ser opcional.
- **Sin migraciones versionadas.** `drizzle-kit push` sirve mientras la base solo tenga la fila
  semilla. R2 es la rebanada en la que aparecen datos que importa no perder: el cambio a
  migraciones versionadas debería ser trabajo propio, no un agregado dentro de R2.
- **`APP_TIMEZONE` sigue sin leerla ningún código.** R2 es donde `RF-00` empieza a pesar de
  verdad. Según el análisis de `docs/ARCHITECTURE.md`, la zona debería ser una constante en
  `core/` y no una variable de entorno: decídelo al implementar la agrupación por día.
- **`CLAUDE.md` describe el repositorio como semilla sin código.** Es falso desde la sesión 4 y
  el flujo de arranque lo hace leer en el paso 2, antes de `feature_list.json`. No se corrigió
  por la regla "Stay in scope"; corrígelo al abrir la próxima sesión, antes de empezar R2.
- **Ninguna feature quedó en `status: "active"`.** Es correcto: la política dice "como máximo
  una". El caso 2 de la regla de selección elige R2, cuya única dependencia (R1) ya está en
  `passing`.

## Files

**Nuevos:** `vitest.config.mts`, `src/app/actions.ts`, `src/core/model/session-type.ts`,
`src/core/services/` (`program-name.ts`, `program-order.ts`, `program-input.ts`,
`session-type.ts`, `civil-date.ts`, `text.ts` y sus cinco archivos de prueba),
`src/ui/form-state.ts`, `src/ui/labels.ts`, `src/ui/program-form.tsx`,
`src/ui/session-type-form.tsx`.

**Modificados:** `package.json`, `package-lock.json`, `scripts/seed.mjs`, `src/app/page.tsx`,
`src/core/model/program.ts`, `src/core/ports/program-repository.ts`, `src/infra/db/schema.ts`,
`src/infra/repos/drizzle-program-repository.ts`, `src/ui/program-card.tsx`, `AGENTS.md`,
`docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `feature_list.json`, `progress.md` y este archivo.

## Blockers

**Ninguno.** El branch `dev` de Neon quedó creado y `DATABASE_URL` local ya apunta a él; la
cadena de producción vive solo en Vercel. Esquema y semilla verificados contra `dev`.

**Aviso con fecha: el branch `dev` expira el 02/10/2026** (TTL de 7 días del panel de Neon).
Si un comando de base falla con error de conexión después de esa fecha, no es el código:
recrear el branch y correr `npm run db:push` y `npm run db:seed`. El procedimiento está en
`docs/ARCHITECTURE.md`.

## Next Session

Recommended Next Step: implementar **R2 — Cronómetro**.

1. `cd study-tracker` y confirmar con `pwd`. No trabajar desde el repositorio del curso: la
   terminal tiende a reposicionarse ahí sola.
2. `./init.sh` — debe terminar en "Init OK" y ejecutar las 51 pruebas.
3. Corregir el estado que `CLAUDE.md` declara. Es parte de la ruta de reinicio limpio.
4. Antes de escribir código de sesiones, decidir el branch `dev` de Neon y si se pasa a
   migraciones versionadas. Las dos cosas son más baratas ahora que con sesiones registradas.
5. Escribir primero las pruebas de duración efectiva: los seis casos de la tabla de
   `docs/DATA-MODEL.md` viven en `core/services` y se prueban sin base de datos.
6. Implementar el índice único **junto con** el flujo de recuperación (`RF-2F` a `RF-2I`).
7. `RF-21`: el tiempo transcurrido se deriva de la marca de inicio almacenada, nunca de un
   contador en JavaScript. Es lo que hace que sobreviva a cerrar la pestaña.
8. Cerrar según el procedimiento "End of Session" de `AGENTS.md`.

Recordatorio de alcance: shadcn/ui y Recharts entran en **R3**, no antes. `metrics` y `readings`
son de **R5**.
