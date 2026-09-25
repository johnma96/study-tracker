# ARCHITECTURE.md — decisiones tomadas

Las decisiones de este documento **ya están tomadas**. Un agente que implemente no debe
re-litigarlas. Si una resulta equivocada durante el desarrollo, se registra el hallazgo en
`progress.md` y se consulta antes de cambiarla.

## Stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | **Next.js 16, App Router** | Despliegue nativo en Vercel. Server Actions eliminan la capa de API en el MVP. El Pages Router está en mantenimiento: no usarlo. |
| Lenguaje | **TypeScript**, modo estricto | |
| UI | **React 19** + **Tailwind** + **shadcn/ui** | Componentes accesibles sin trabajo de diseño. |
| Gráficas | **Recharts** | El mapa de calor de calendario se hace con SVG propio; no requiere librería. |
| ORM | **Drizzle** | Esquema en TypeScript, sin binarios nativos, compatible con entornos edge. Migraciones **versionadas** con `drizzle-kit generate` / `migrate`; `push` quedó retirado. |
| Base de datos | **Postgres (Neon)** | Es la integración nativa de Vercel desde que Vercel Postgres se migró a Neon (dic 2024). Tiene *branching* para separar entornos. |
| Pruebas | **Vitest** | |
| Autenticación | **Auth.js**, diferido a la rebanada 6 | Ver `RF-40`. |

**No fijes versiones a mano.** Instala con `@latest` y deja que `package.json` registre lo que
quedó. Verificado al 24/09/2026: Next.js 16.3.6 es LTS activo. Las versiones de las demás
dependencias no fueron verificadas en esa fecha: confírmalas al instalar.

## Postgres en todos los entornos

Decisión explícita: **no** usar archivos JSON ni SQLite en desarrollo.

La secuencia intuitiva (JSON local → SQLite → Postgres en producción) obliga a reescribir la
capa de datos dos veces e introduce defectos que solo aparecen en producción. Con Postgres en
todos lados no hay migración de motor en ningún momento.

- **Desarrollo:** el branch `dev` de Neon.
- **Producción:** el branch principal, vía la integración de Vercel.

Misma sintaxis SQL, mismas migraciones, cero conversión de datos.

### Una sola variable, valor distinto por entorno

`DATABASE_URL` se llama igual en todos lados y cambia de valor según el entorno: local apunta a
`dev`, Vercel al principal. **La cadena de producción no debe existir en el `.env` local.**

No inventes nombres como `DATABASE_URL_DEV` que el código tenga que elegir: eso mete la decisión
de entorno dentro de la aplicación, que es exactamente lo que las variables de entorno existen
para evitar. Y mientras el código siga leyendo `DATABASE_URL`, agregar una variable paralela no
cambia a qué base te conectas — solo lo aparenta.

> Ocurrió el 25/09/2026: se creó el branch `dev` y se agregó `DATABASE_URL_DEV`, pero
> `DATABASE_URL` seguía apuntando a producción, así que el entorno local seguía escribiendo en
> la base del despliegue. El síntoma es invisible: todo funciona, solo que contra la base
> equivocada.

### El branch `dev` caduca

**Creado el 25/09/2026 con TTL de 7 días: expira el 02/10/2026.** Es configuración del panel de
Neon, no del repositorio.

Síntoma cuando expire: los comandos que tocan la base fallan con error de conexión o host
desconocido. **No es un problema del código** — no lo depures ahí.

Recuperación, unos cinco minutos:

```bash
# 1. En el panel de Neon, crear de nuevo un branch dev desde el principal
# 2. Copiar su cadena pooled a DATABASE_URL en .env
npm run db:migrate       # aplica las migraciones pendientes, con sus índices
npm run db:seed          # siembra, es idempotente
npm run test:integration # comprueba que la base quedó utilizable
```

Un branch de Neon es un clon *copy-on-write* del padre, así que nace con el esquema, los datos
**y el historial de migraciones** del principal ya adentro: `db:migrate` no encuentra nada
pendiente y la semilla reporta "ya presente". Es lo esperado, no una señal de que algo falló.

`db:migrate` es también lo que crea el índice único parcial `one_running_session`, del que
depende el invariante "como máximo una sesión en curso". Por eso la comprobación final no
sobra: si el índice faltara, la aplicación seguiría pareciendo sana y admitiría dos sesiones a
la vez. El detalle está en la sección correspondiente de `docs/DATA-MODEL.md`.

Si el trabajo se extiende más allá del 02/10, conviene revisar en el panel si el TTL se puede
extender o quitar, antes de que expire a mitad de una sesión.

## El esquema viaja con el despliegue

Decisión del 25/09/2026: **el esquema se aplica con migraciones versionadas, no con
`drizzle-kit push`.** Los archivos `.sql` viven en `src/infra/db/migrations/` y se versionan
junto al código, de modo que el commit que cambia el esquema es el mismo que lo aplica.

### Por qué se retiró `push`

`push` compara el esquema TypeScript contra la base a la que apunte `DATABASE_URL` y aplica la
diferencia. No deja rastro de qué se aplicó ni dónde, así que dos entornos pueden divergir sin
que nada avise.

> Ocurrió en R2: `push` creó la tabla `sessions` solo en el branch `dev`. El despliegue quedó
> sin ella y **la aplicación en producción se rompió** hasta que alguien recordó aplicarla a
> mano. El procedimiento manual —cambiar `.env`, aplicar, devolverlo— falló además dos veces
> seguidas, porque equivocarse de base **no produce ningún error**: simplemente trabajas contra
> la base equivocada, en silencio.

`push` sigue instalado como `npm run db:push:emergency`, con ese nombre a propósito: sirve para
reparar a mano una base que quedó a medias, no para el trabajo diario. Usarlo se registra en
`progress.md`.

### La migración base es idempotente, y eso fue una decisión

`src/infra/db/migrations/0000_baseline.sql` usa `CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS` y, para las claves foráneas —que en PostgreSQL no admiten
`IF NOT EXISTS`—, un bloque `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$`.

El historial se introdujo cuando `dev` y producción **ya tenían el esquema completo** aplicado
con `push`, es decir sin ninguna fila en la tabla de control de Drizzle. Un `CREATE TABLE`
pelado habría fallado contra las dos. Las dos salidas posibles eran:

| Camino | Qué exige | Por qué se descartó / se eligió |
|---|---|---|
| Insertar a mano el registro "ya aplicada" en `drizzle.__drizzle_migrations` | Ejecutar SQL manual contra **producción**, con el hash correcto del archivo | **Descartado.** Es exactamente el procedimiento manual contra la base equivocada que este cambio existe para eliminar, y un hash mal copiado vuelve a ejecutar la migración |
| Escribir la migración base de forma idempotente | Nada | **Elegido.** Cada base se auto-marca como migrada en su primera corrida sin tocar nada. Mismo archivo para una base vacía y para una que ya tiene el esquema |

Límite conocido y deliberado: sobre una base **a medio aplicar**, los `CHECK` y `UNIQUE`
declarados dentro de `CREATE TABLE IF NOT EXISTS` se saltan en silencio porque la tabla ya
existe. Las claves foráneas y los índices sí se reparan, porque van en sentencias propias con
guarda. Reparar una base a medias no es trabajo de una migración base: para eso está
`db:push:emergency`.

De aquí en adelante las migraciones **no se escriben a mano**: las genera `npm run db:generate`
a partir de `src/infra/db/schema.ts` y del snapshot de `meta/`, y se aplican tal cual salen.

### Cómo se aplica en Vercel

`package.json` separa dos scripts a propósito:

| Script | Quién lo corre | Qué hace |
|---|---|---|
| `build` | el desarrollador y `./init.sh` | `next build`. **No toca la base.** |
| `vercel-build` | Vercel | `drizzle-kit migrate && next build` |

Vercel ejecuta `vercel-build` en lugar de `build` cuando existe. Encadenar la migración al
build aprovecha que Vercel ya tiene `DATABASE_URL` en su entorno, y hace que **una migración
fallida rompa el build**: Vercel conserva entonces el despliegue anterior en vez de publicar
código contra un esquema que no existe. Eso es lo deseable.

**No se encadenó a `build`** porque `./init.sh` lo ejecuta, y entonces la puerta de entrada
del repositorio correría migraciones contra `dev` en cada corrida —y dependería de que Neon
responda, que es justo lo que `init.sh` evita: un branch caducado se leería como código roto.
El desarrollador aplica migraciones cuando quiere, con `npm run db:migrate`.

`drizzle-kit` es `devDependency`, y Vercel instala también las de desarrollo durante el build,
así que está disponible. `vercel-build` **no** usa `node --env-file=.env`: `.env` no existe en
Vercel y `--env-file` falla si el archivo falta.

### Lo único que el usuario hace una vez, en producción

**No hay ningún comando de base que correr contra producción.** La primera corrida de
`vercel-build` crea el esquema `drizzle`, aplica `0000_baseline` —que no toca nada, porque el
esquema ya está— y deja la base marcada como migrada.

Lo que sí hay que hacer una vez es **confirmar que Vercel está ejecutando `vercel-build`**. En
el primer despliegue después de este cambio, abrir *Deployments → el despliegue → Building* y
comprobar que el registro incluye la línea:

```
[✓] migrations applied successfully!
```

Si no aparece, forzar el comando de build en *Settings → Build and Deployment → Build Command*,
activando el override con exactamente:

```
npm run vercel-build
```

Válvula de escape, solo si alguna vez hay que aplicar migraciones a producción desde la máquina
local. Pasa la cadena **en la propia línea**, nunca al `.env` (bash / Git Bash):

```bash
DATABASE_URL='<cadena-de-produccion>' node ./node_modules/drizzle-kit/bin.cjs migrate
```

En PowerShell, borrándola después para que no quede en la sesión:

```powershell
$env:DATABASE_URL='<cadena-de-produccion>'; node ./node_modules/drizzle-kit/bin.cjs migrate; Remove-Item Env:DATABASE_URL
```

### La regla que hay que recordar

Tocar `src/infra/db/schema.ts` obliga a `npm run db:generate` y a subir el `.sql` en el mismo
commit. Ese es el defecto nuevo que introduce este modelo —en local todo compila y pasa, y el
despliegue aplica un esquema viejo— y `npm run db:check`, que `init.sh` ejecuta, valida que el
historial sea coherente pero **no** detecta la omisión.

## Capas

```
app/            Next.js App Router. Páginas y Server Actions. Sin lógica de negocio.
  └ (rutas)
core/           Dominio puro. Sin imports de React, Next, Drizzle ni de la base de datos.
  ├ model/      Tipos y entidades
  ├ services/   Reglas: duración efectiva, racha, cadencia, proyección
  └ ports/      Interfaces de repositorio
infra/
  ├ db/         Esquema Drizzle, cliente, migraciones
  └ repos/      Implementaciones de los puertos de core/ports
ui/             Componentes de presentación, sin acceso a datos
  └ primitives/ Primitivas de shadcn/ui. Las escribe `npx shadcn add`, no se editan a mano
```

**shadcn/ui escribe en `src/ui/`, no en `src/components/`.** `components.json` redirige sus
alias (`ui` → `@/ui/primitives`, `utils` → `@/ui/utils`) para que las primitivas queden en la
capa de presentación que ya existía, en vez de abrir una carpeta paralela que nadie documentó.
Un `npx shadcn add <componente>` respeta esos alias sin configuración adicional.

**La regla que importa:** `core/` no importa nada de `app/`, `infra/` ni `ui/`.

> **Hoy no la verifica nada automáticamente.** Este párrafo decía que era "la única regla de
> capas que se verifica automáticamente", pero no hay regla de `eslint`, paso de `init.sh` ni
> prueba que la compruebe. Lo detectó el agente de R4 el 25/09/2026. Ese mismo día se comprobó a
> mano, con un `grep` de imports `@/app`, `@/infra` y `@/ui` sobre `src/core/`, que se cumple.
> Una prueba en `src/core/` del estilo de `no-file-storage.test.ts` la volvería automática. Está
> pendiente y registrada en `session-handoff.md`.

Justificación honesta: el valor de esta separación **no** es sobrevivir a un cambio de base de
datos — esa migración ya la eliminamos. Es poder probar la lógica de cálculo (duración
efectiva con `minutes_override`, racha con cambio de día en `America/Bogota`, proyección de
fecha) **sin levantar una base de datos**. Esa lógica es donde viven los errores reales.

No se implementa CQRS. En una aplicación de un usuario sería ceremonia sin beneficio.

## Flujo de datos

Lectura: Server Component → repositorio → Drizzle → Postgres.
Escritura: formulario → Server Action → validación → servicio de dominio → repositorio.

Toda Server Action valida su entrada en el servidor con un esquema (`zod` o equivalente).
`RF-44` es obligatorio: la validación del cliente es conveniencia, no control.

## Seguridad

- Secretos solo en variables de entorno. `.env` nunca se versiona. `.env.example` documenta
  cada variable con valores falsos.
- La cadena de conexión nunca llega al cliente. No usar el prefijo `NEXT_PUBLIC_` para nada
  sensible.
- Escapar o parametrizar toda consulta. Drizzle lo hace por defecto: no construyas SQL por
  concatenación de cadenas.
- `RF-40` es una compuerta de despliegue: sin autenticación, no se publica con datos reales.

## Comandos de arranque para la rebanada 0

> **`create-next-app` se niega a escribir sobre este repositorio.** El directorio ya tiene
> archivos propios (`AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `init.sh`…) y la plantilla
> trae su propio `AGENTS.md`, `CLAUDE.md`, `README.md` y `.gitignore`, que pisarían el harness.
> Andamia en un subdirectorio temporal y mueve solo lo que no colisiona. Comprobado el
> 24/09/2026: el comando con `.` falla.

```bash
npx create-next-app@latest .tmp-scaffold --typescript --tailwind --app --eslint --src-dir
# mover de .tmp-scaffold lo que no pise el harness, y borrar el temporal
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

**Vitest entra en R1, no en R0**, y **shadcn/ui y Recharts justo antes de R3**, en `main`, como
preparación del abanico de R3, R4 y R5 (decisión 22). R0 no tiene lógica de dominio que
probar ni tableros que construir; instalarlos antes es configuración para código que todavía
no existe. `docs/ROADMAP.md` manda sobre el alcance de cada rebanada.

Además, en `next.config.ts` queda `agentRules: false`. `next dev` inyecta por su cuenta un
bloque `nextjs-agent-rules` dentro de `AGENTS.md` y lo re-agrega en cada arranque. En este
repositorio `AGENTS.md` es el harness canónico: su contenido es decisión del autor, no de una
herramienta del build.

Variables de entorno necesarias (documéntalas en `.env.example`):

```
DATABASE_URL=postgres://usuario:clave@host/base?sslmode=require
APP_TIMEZONE=America/Bogota
```

> **No uses el nombre `TZ`.** Vercel lo tiene reservado: es una variable de sistema que fija la
> zona horaria del runtime de Node, y el despliegue se rechaza con
> *"The name of your Environment Variable is reserved"*. Comprobado el 25/09/2026.
>
> La razón de fondo va más allá del nombre. `RF-00` fija `America/Bogota` como **regla de
> dominio**, no como configuración: no cambia entre entornos. Una constante que no varía por
> entorno no debería ser variable de entorno, porque si falta o se escribe mal en producción,
> la agrupación por día se rompe **en silencio**. El lugar correcto es una constante en
> `core/`. `APP_TIMEZONE` queda documentada por si algún día la zona se vuelve preferencia del
> usuario, en cuyo caso pertenece a la base de datos, no al entorno.

## Registro de decisiones

| # | Decisión | Fecha | Motivo |
|---|---|---|---|
| 1 | Next.js App Router, no Pages Router | 24/09/2026 | Pages Router en mantenimiento |
| 2 | Postgres en todos los entornos | 24/09/2026 | Evita dos migraciones de motor |
| 3 | Drizzle sobre Prisma | 24/09/2026 | Sin binarios, más cerca del SQL, mejor para aprender |
| 4 | Sin subida de archivos en el MVP | 24/09/2026 | La evidencia vive en sus repos; aquí se enlaza |
| 5 | Sin CQRS | 24/09/2026 | Ceremonia sin beneficio para un usuario |
| 6 | Autenticación como compuerta, no como etapa | 24/09/2026 | Vercel publica en internet abierto |
| 7 | Vitest en R1, shadcn/ui en R3, no en R0 | 25/09/2026 | R0 no tiene lógica que probar ni tableros que construir |
| 8 | `agentRules: false` en `next.config.ts` | 25/09/2026 | `next dev` reescribe `AGENTS.md`, el archivo canónico del harness |
| 9 | `APP_TIMEZONE` en vez de `TZ` | 25/09/2026 | Vercel reserva `TZ`; de fondo, la zona es regla de dominio, no configuración |
| 10 | `zod` para validar la entrada del servidor | 25/09/2026 | RF-44. Es la implementación concreta del "esquema (`zod` o equivalente)" que ya preveía la sección "Flujo de datos" |
| 11 | El esquema de entrada vive en `core/services`, no en la Server Action | 25/09/2026 | Permite probar RF-14 y RF-44 sin levantar Next ni base de datos, que es la justificación declarada de la separación por capas. `zod` no viola la regla: no es React, Next, Drizzle ni la base |
| 12 | El orden de RF-13 se calcula en `core/`, no en un `ORDER BY` | 25/09/2026 | Los empates y las fechas nulas son donde se esconden los errores; en SQL no se prueban sin base de datos |
| 13 | `@types/node` sube de `^20` a `^24` | 25/09/2026 | Vitest 5 lo exige (`^22 \|\| >=24`) y el runtime real de la máquina es Node 24. La plantilla de `create-next-app` había dejado `^20` |
| 14 | Pruebas de integración en `tests/integration/`, con configuración y comando propios | 25/09/2026 | `npm run test` debe poder correr en un clon limpio sin red ni `.env`, porque `init.sh` lo ejecuta. Mezclar las que tocan Neon volvería la puerta de entrada dependiente de la red y un branch caducado se leería como código roto |
| 15 | El índice `one_running_session` se declara en el esquema de Drizzle, no en SQL suelto | 25/09/2026 | Se comprobó que `drizzle-kit` 0.31.11 sí emite el índice único sobre la expresión constante `(true)` y lo lee de vuelta sin recrearlo. Un paso manual habría dejado la restricción fuera de la ruta de reinicio limpio |
| 16 | El reloj de referencia es `now()` del motor, no el del proceso de Node | 25/09/2026 | `started_at` lo pone la base; medir el cierre con otro reloj mezcla dos relojes que nadie sincroniza, y un desfase de segundos basta para violar `ended_after_started` o para restar tiempo trabajado |
| 17 | `zod` no valida longitudes de `note` contra un CHECK del motor | 25/09/2026 | La aplicación puede ser más estricta que la base sin riesgo; lo peligroso es lo contrario, que acepte lo que el motor rechaza. Añadir CHECK por cada cota inventada haría migrar el esquema por un cambio de criterio de interfaz |
| 18 | Migraciones versionadas en vez de `drizzle-kit push` | 25/09/2026 | `push` aplica la diferencia contra la base a la que apunte `.env` sin dejar rastro: `sessions` quedó solo en `dev` y producción se rompió. Con migraciones el esquema viaja con el commit y con el despliegue |
| 19 | La migración base se escribe idempotente, no se marca a mano como aplicada | 25/09/2026 | Las dos bases ya tenían el esquema y ninguna historial. Insertar el registro de control a mano exigía SQL manual contra producción, que es el procedimiento que este cambio elimina. Idempotente, cada base se auto-marca en su primera corrida y el mismo archivo sirve para una base vacía |
| 20 | `vercel-build` separado de `build`, no `migrate` encadenado a `build` | 25/09/2026 | `./init.sh` ejecuta `build`; encadenar ahí las migraciones volvería la puerta de entrada dependiente de Neon y aplicaría esquema en cada corrida. Vercel prefiere `vercel-build` cuando existe, así que el despliegue migra y el desarrollador no |
| 21 | `db:push` se conserva renombrado a `db:push:emergency` | 25/09/2026 | Borrarlo dejaría sin herramienta la reparación de una base a medio aplicar, que la migración base idempotente no cubre. El nombre hace imposible usarlo por inercia |
| 22 | shadcn/ui y Recharts se instalan en `main` antes del abanico, no dentro de R3 | 25/09/2026 | Precisa la decisión 7. Tres `shadcn init` o `add` en paralelo se pisan en `package.json`, `components.json` y `globals.css`. Se instaló además un juego base de primitivas (`button`, `card`, `input`, `label`, `textarea`, `select`, `badge`, `table`, `tooltip`, `chart`) y el `TooltipProvider` en el layout, para que ningún agente necesite tocar esos archivos compartidos |
| 23 | Se acepta `cn` en lugar de `clsx` + `tailwind-merge` | 25/09/2026 | Es lo que instala shadcn 4.21. Lo publica el propio autor de shadcn (`shadcn-ui/cn`). Riesgo registrado: es 0.x y muy reciente; si da problemas, `src/ui/utils.ts` y los imports de `src/ui/primitives/` son lo único que cambia para volver a `clsx` + `tailwind-merge` |
| 24 | Modo oscuro por `prefers-color-scheme`, no por clase `.dark` | 25/09/2026 | `shadcn init` declara un variant por clase que exige un conmutador de tema inexistente; con él, la interfaz de R1 y R2 quedaba siempre en claro. Se conserva el comportamiento anterior |
| 25 | El contexto de programa vive en la URL (`?programa=<id>`), no en estado de cliente | 25/09/2026 | RF-38. Es compartible, sobrevive a recargar y lo lee un Server Component sin hidratar nada. El selector son enlaces y no un `onChange`: cambiar de programa **es** navegar, así que entra en el historial del navegador y funciona sin JavaScript. Un valor desconocido se resuelve como «todos» (RF-39) |
| 26 | El filtrado por programa tiene un solo dueño: `core/services/program-context.ts` | 25/09/2026 | Listado, totales, mapa, métricas y evidencia tienen que coincidir en qué sesiones entran. Por eso `listProgramSessions` pasó a ser `listSessionsInContext` en vez de dejar dos definiciones de la misma regla, que es el defecto que ya apareció dos veces en este repositorio |
