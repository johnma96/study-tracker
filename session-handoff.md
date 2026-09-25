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

Recommended Next Step: **abrir el abanico de R3, R4 y R5 en paralelo.**

El plan completo, con su justificación y la tabla de conflictos esperados, está en
`docs/ROADMAP.md`, sección **"Paralelización de R3, R4 y R5"**. Léelo antes de empezar: aquí va
solo la secuencia de ejecución.

### Por qué aquí sí y antes no

R3, R4 y R5 dependen de R2 pero no entre sí. R1 y R2 eran verticales igual que estas, pero
encadenadas —`sessions` referencia a `programs`—, así que paralelizarlas era imposible. Vertical
no significa independiente; solo la independencia habilita el abanico.

### Paso 0 — preparación, en serie. No se reparte

Si cada agente hace estos pasos por su cuenta, colisionan.

1. **En `main`, instalar shadcn/ui y Recharts**, y commitear. Es infraestructura de interfaz
   compartida: tres `shadcn init` en paralelo se pisan.
2. **Crear en Neon tres branches desde `dev`**: `dev-r3`, `dev-r4`, `dev-r5`. Requiere la consola,
   lo hace el usuario.

   > Esto no es higiene opcional. El índice `one_running_session` es **global**: la sesión que
   > crea la prueba de integración de un agente hace fallar las de los otros dos. Con una sola
   > base, las pruebas fallan de forma intermitente y sin causa aparente.

3. **Crear los tres worktrees:**

   ```bash
   git worktree add ../study-tracker-r3 -b r3-totales
   git worktree add ../study-tracker-r4 -b r4-evidencia
   git worktree add ../study-tracker-r5 -b r5-metricas
   ```

   Cada uno necesita su propio `npm install` y su propio `.env` con la cadena de **su** branch.

### Paso 1 — los tres agentes, en paralelo

| Agente | Rebanada | Requerimientos | Worktree | Branch de Neon |
|---|---|---|---|---|
| A | R3 Totales y mapa de calor | `RF-30`…`RF-37` | `../study-tracker-r3` | `dev-r3` |
| B | R4 Evidencia | `RF-50`…`RF-54` | `../study-tracker-r4` | `dev-r4` |
| C | R5 Métricas | `RF-60`…`RF-63` | `../study-tracker-r5` | `dev-r5` |

Reglas que van en el encargo de **cada** agente:

- Trabaja solo en tu worktree y contra tu branch de Neon.
- Toca **únicamente tu propia entrada** de `feature_list.json`.
- **No reescribas `session-handoff.md`.** Es de un solo escritor. Deja tus hallazgos en
  `notas-rN.md` en la raíz de tu worktree.
- Monta tu interfaz en un componente propio de `src/ui/` y toca `src/app/page.tsx` lo mínimo:
  es el archivo con más probabilidad de conflicto.
- Commitea en tu rama. **No empujes.**
- Sigue el resto de `AGENTS.md` como siempre, incluido el cierre de sesión.

### Paso 2 — integración, en serie: R3 → R4 → R5

El orden importa:

1. **R3 primero**: no agrega tablas, no genera migración, no compite por la numeración.
2. **R4 después**: genera `0001_*` para `artifacts`.
3. **R5 al final**: también generaría `0001_*`. Tras integrar R4 ese número ya existe, así que
   **hay que borrar su migración y regenerarla** con `npm run db:generate` para que salga
   `0002_*`. Fusionar dos archivos `0001` corrompe el historial; `npm run db:check` lo detecta.

Después de **cada** integración: `npm run db:check`, `npm run db:migrate` contra `dev`,
`npm run test` y `npm run test:integration`.

Al final, quien integra consolida las tres `notas-rN.md` en `progress.md`, reescribe este archivo
y limpia los worktrees con `git worktree remove`.

### Lo que hay que medir

Este abanico es además el **Experimento 2 del Proyecto 08** del curso, hecho sobre código propio.
Registra en `progress.md`: tiempo de preparación, tiempo de cada agente, tiempo de integración y
número de conflictos. La pregunta a responder con datos, no con impresión: **¿el tiempo ahorrado
compensó el costo de coordinación?**

Un resultado negativo es un resultado válido y vale tanto como uno positivo.

### Si prefieres no paralelizar

R3, R4 y R5 en serie funcionan igual de bien y sin nada de esta coordinación. El orden sugerido
sería R3 primero, porque hace visibles las sesiones que R2 ya guarda (`RF-30`) y porque trae la
infraestructura de interfaz que las otras dos reutilizan.
