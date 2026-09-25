# session-handoff.md

**Last Updated:** 25/09/2026

> Encabezados de sección en inglés a propósito: son los marcadores estructurales que buscan las
> herramientas de auditoría del harness. El contenido va en español.

## Current Objective

**Ninguno en marcha.** La sesión 9 fue **trabajo de infraestructura, no una rebanada**:
`drizzle-kit push` quedó sustituido por migraciones versionadas. No hay ninguna feature en
`active`, que es el estado normal cuando nadie está trabajando, y `feature_list.json` no
cambió: este trabajo no tiene requerimiento EARS asociado porque no añade comportamiento.

R2 — Cronómetro sigue en `passing`. La siguiente rebanada la elige el paso 8 del *Startup
Workflow*: R3, R4 y R5 dependen solo de R2 y son independientes entre sí, así que califican las
tres y se puede empezar por cualquiera. R6 es compuerta, no etapa.

## What was done

**El esquema dejó de aplicarse a mano.** Antes, `npm run db:push` aplicaba la diferencia contra
la base a la que apuntara `.env`, sin dejar rastro de qué se aplicó ni dónde. Eso ya había roto
producción una vez —la tabla `sessions` quedó solo en `dev`— y el procedimiento manual de
cambiar `.env`, aplicar y devolverlo falló dos veces seguidas, porque equivocarse de base no
produce ningún error: simplemente trabajas contra la base equivocada, en silencio.

- **Migración base versionada** en `src/infra/db/migrations/0000_baseline.sql`, con su
  `meta/_journal.json` y `meta/0000_snapshot.json`. Cubre las tres tablas, sus 34 restricciones
  y sus seis índices, **incluido el parcial `one_running_session`**: `drizzle-kit` 0.31.11 sí lo
  emite en `generate`, y se comprobó leyendo el `.sql`, no suponiéndolo.
- **La migración base es idempotente a propósito.** `dev` y producción ya tenían el esquema
  completo aplicado con `push`, es decir sin ninguna fila en la tabla de control de Drizzle: un
  `CREATE TABLE` pelado habría fallado contra las dos. Escrita con `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS` y bloques `DO ... EXCEPTION WHEN duplicate_object` para las
  claves foráneas, **cada base se auto-marca como migrada en su primera corrida sin tocar
  nada**, y el mismo archivo sirve para una base vacía. La alternativa —insertar a mano el
  registro de control— exigía SQL manual contra producción, que es justo lo que este cambio
  elimina.
- **Vercel aplica el esquema en el build.** El script `vercel-build` es
  `drizzle-kit migrate && next build`. Si la migración falla, el build falla y Vercel conserva
  el despliegue anterior. **`build` se queda en `next build` a secas** porque `./init.sh` lo
  ejecuta: encadenar ahí las migraciones volvería la puerta de entrada dependiente de que Neon
  responda, que es justo lo que `init.sh` evita.
- **`db:push` ya no es el camino.** Se renombró a `db:push:emergency`. No se borró porque la
  migración base idempotente no repara una base a medio aplicar, y esa herramienta hace falta;
  el nombre impide usarla por inercia. Usarla se registra en `progress.md`.
- **`init.sh` ejecuta `db:check`** —valida el historial de migraciones sin abrir conexión— y
  **exige que existan** `db:generate`, `db:migrate` y `vercel-build`. Si `vercel-build`
  desapareciera, el despliegue dejaría de aplicar el esquema sin que nada avisara.
- **Documentación corregida donde contradecía la realidad**, por la excepción de alcance de
  `AGENTS.md`: `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md` —sección nueva *El esquema
  viaja con el despliegue* y el procedimiento de recuperación del branch `dev` caducado, que
  seguía diciendo `db:push`—, `docs/DATA-MODEL.md`, y los comentarios de
  `src/infra/db/schema.ts` y de la prueba de integración. Decisiones 18 a 21 registradas en la
  tabla de `docs/ARCHITECTURE.md`.

**Verificación, con la línea base tomada antes de tocar nada.** Conteos y esquema comparados
antes y después: la única diferencia en toda la base es el esquema `drizzle` nuevo y **una**
fila en `drizzle.__drizzle_migrations`. `programs` = 1, `session_types` = 4, `sessions` = 0 en
los dos momentos, y el programa semilla conserva su `id` y su `created_at`. `db:migrate` se
corrió cinco veces: no-op a partir de la primera. Sobre una base auxiliar **vacía**, las
migraciones dejaron las mismas 34 restricciones que había dejado `push` en `dev`, comparadas
una a una sin diferencias. `./init.sh` termina en `Init OK`; 118 pruebas de `core/` y 8 de
integración pasan.

## What is broken or unverified

- **El primer despliegue con `vercel-build` todavía no se ha hecho.** El commit está hecho pero
  **no se ha empujado**. Qué esperar cuando se empuje, paso a paso, está en *Next Session*.
- **Defecto nuevo que introduce este modelo:** cambiar `src/infra/db/schema.ts` sin correr
  `npm run db:generate` deja el despliegue aplicando un esquema viejo, y en local todo compila y
  pasa. `db:check` valida la coherencia del historial pero **no** detecta la omisión. La regla
  está en `AGENTS.md`; una guardia automática sería trabajo propio.
- **La migración base idempotente no repara una base a medio aplicar.** Los `CHECK` y `UNIQUE`
  declarados dentro de `CREATE TABLE IF NOT EXISTS` se saltan si la tabla ya existe; las claves
  foráneas y los índices sí se reparan. Para eso está `db:push:emergency`.
- **Producción sin verificar desde esta máquina.** La VPN corporativa bloquea `vercel.app` y la
  interceptación TLS impide llegar por línea de comandos. Queda pendiente de R2: abrir el
  despliegue desde un dispositivo fuera de la red corporativa, iniciar una sesión, cerrar el
  navegador y ver el cronómetro corriendo con el tiempo correcto.
- **Las sesiones guardadas todavía no se pueden ver en una lista.** `RF-30` pertenece a R3.
- **`RF-40` se acerca.** La autenticación es compuerta, no etapa: antes del primer despliegue
  con datos que importen, R6.
- **Ninguna feature quedó en `status: "active"`.**

## Files

**Nuevos:** `src/infra/db/migrations/0000_baseline.sql`,
`src/infra/db/migrations/meta/_journal.json`, `src/infra/db/migrations/meta/0000_snapshot.json`.

**Modificados:** `package.json` (scripts `db:generate`, `db:migrate`, `db:check`,
`db:push:emergency`, `vercel-build`), `init.sh`, `AGENTS.md`, `README.md`,
`docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `src/infra/db/schema.ts` (comentario),
`tests/integration/session.integration.test.ts` (comentario), `progress.md` y este archivo.

`feature_list.json` **no se tocó**: esto no es una feature.

## Blockers

**Ninguno.**

**Acción de una sola vez que depende del usuario, y no es un comando de base de datos.** No hay
nada que ejecutar contra producción: la primera corrida de `vercel-build` crea el esquema
`drizzle`, aplica `0000_baseline` —que no toca nada, porque el esquema ya está— y deja la base
marcada. Lo que sí hay que hacer una vez es **confirmar en el registro del primer build de
Vercel** que aparece `migrations applied successfully`. Si no aparece, forzar el comando de
build en *Settings → Build and Deployment → Build Command* con `npm run vercel-build`. El
procedimiento completo, con la válvula de escape para aplicar migraciones a producción desde la
máquina local sin guardar la cadena en `.env`, está en `docs/ARCHITECTURE.md`.

**Aviso con fecha: el branch `dev` de Neon expira el 02/10/2026** (TTL de 7 días del panel). Si
un comando de base falla con error de conexión después de esa fecha, no es el código: recrear
el branch y correr `npm run db:migrate`, `npm run db:seed` y `npm run test:integration`. El
procedimiento está en `docs/ARCHITECTURE.md`. El último comando no sobra: `db:migrate` es lo que
crea el índice único, y sin él la aplicación parece sana y admite dos sesiones a la vez.

## Next Session

**Antes de nada, el commit de infraestructura está hecho pero sin empujar.** Al empujarlo,
Vercel hará esto, en este orden:

1. Instala dependencias, **incluidas las de desarrollo**, así que `drizzle-kit` está
   disponible.
2. Ve el script `vercel-build` en `package.json` y lo ejecuta **en lugar de** `build`.
3. `drizzle-kit migrate` se conecta con la `DATABASE_URL` del entorno de Vercel —el branch
   principal— y aplica `0000_baseline`. Como la base ya tiene el esquema, **no cambia nada**:
   crea el esquema `drizzle`, inserta una fila de control y termina con
   `migrations applied successfully`.
4. Si ese paso fallara, el build se detiene ahí, `next build` **no llega a ejecutarse** y
   Vercel conserva el despliegue anterior. Está comprobado en local con una cadena inválida.
5. `next build` construye y el despliegue sale a producción como siempre.

De ahí en adelante, cada despliegue aplica las migraciones pendientes antes de construir.

Recommended Next Step: **R3 — Totales y mapa de calor**, por dos razones: es la que hace
visibles las sesiones que R2 ya guarda (`RF-30`), y es donde entra `shadcn/ui` y Recharts, que
el resto de rebanadas van a reutilizar. R4 y R5 califican igual si se prefiere otro orden.

1. `cd study-tracker` y confirmar con `pwd`. No trabajar desde el repositorio del curso: la
   terminal tiende a reposicionarse ahí sola.
2. `./init.sh` — debe terminar en "Init OK" y ejecutar las 118 pruebas.
3. `npm run db:migrate` — no debería haber nada pendiente. Si falla por conexión, el branch
   caducó: ver *Blockers*.
4. `npm run test:integration` — 8 pruebas contra `dev`.
5. Poner la feature elegida en `active` antes de escribir código, y dejarla en `passing` o
   `blocked` al cerrar.
6. **Si la rebanada toca `src/infra/db/schema.ts`** —R4 y R5 lo harán, con `artifacts`,
   `metrics` y `readings`— correr `npm run db:generate`, **leer el `.sql` que salga** y subirlo
   en el mismo commit. Leerlo no es ceremonia: es donde se comprueba que no se perdió ninguna
   restricción por el camino.
7. Para R3, la trampa conocida ya tiene herramienta: `toCivilDateInAppZone` de
   `src/core/services/timezone.ts` convierte a `America/Bogota` y está probada con el caso de
   las 23:40. Agrupar por `started_at::date` sin convertir es el error silencioso más probable
   del modelo.
8. Corregir el campo `verification` de la rebanada que se abra: los de R3 a R6 todavía mezclan
   verificación ejecutable y confirmación humana en una sola frase.
9. Cerrar según el procedimiento "End of Session" de `AGENTS.md`.

Recordatorio de alcance: `metrics` y `readings` son de **R5**; la autenticación, de **R6**, que
es compuerta y no etapa final.
