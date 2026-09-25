# AGENTS.md — harness operativo

Archivo canónico de instrucciones para cualquier agente que trabaje en este repositorio.
Léelo completo antes de escribir código. El objetivo y el contexto del producto están en
[`CLAUDE.md`](./CLAUDE.md).

## Startup Workflow

Before writing code, en este orden:

1. Lee este archivo completo.
2. Lee [`CLAUDE.md`](./CLAUDE.md) — objetivo del repositorio y por qué existe.
3. Lee [`docs/PRODUCT.md`](./docs/PRODUCT.md) — qué es el producto y qué **no** es.
4. Lee [`docs/REQUIREMENTS.md`](./docs/REQUIREMENTS.md) — requerimientos EARS. Es la fuente de
   verdad del comportamiento.
5. Lee [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — decisiones ya tomadas. **No las
   re-litigues.**
6. Lee [`docs/DATA-MODEL.md`](./docs/DATA-MODEL.md) — entidades, invariantes y DDL.
7. Ejecuta `./init.sh` y corrige cualquier error antes de continuar.
8. Lee [`feature_list.json`](./feature_list.json) y selecciona la feature a trabajar:
   1. La que tenga `status: "active"`.
   2. Si ninguna está activa, la primera `not_started` cuyas `dependencies` estén todas en
      `passing`.
   3. **Si ninguna califica** —porque la única avanzada quedó en `blocked` y las demás dependen
      de ella— **no empieces ninguna feature.** Reporta cuál es el bloqueo, qué hace falta para
      levantarlo y quién puede hacerlo. Detente ahí.

   > El caso 3 es real y ya ocurrió: con R0 en `blocked` esperando un despliegue que depende del
   > usuario, y R1 dependiendo de R0 en `passing`, la regla no seleccionaba nada. Un agente sin
   > esta cláusula se queda sin siguiente paso, o peor, se inventa uno.
9. Lee [`session-handoff.md`](./session-handoff.md) para saber dónde quedó la sesión anterior.

## Verification Commands

```bash
./init.sh                 # instala, verifica tipos, lint, pruebas y build. Puerta de entrada.
npm run check             # next typegen && tsc --noEmit
npm run lint              # eslint
npm run test              # vitest run  (pruebas de core/, sin base de datos)
npm run test:watch        # vitest en modo observador
npm run test:integration  # vitest contra el branch dev de Neon. Requiere DATABASE_URL.
npm run build             # next build
npm run dev               # servidor local
npm run db:generate       # genera la migración después de tocar src/infra/db/schema.ts
npm run db:migrate        # aplica las migraciones pendientes. Idempotente. Requiere DATABASE_URL
npm run db:check          # valida el historial de migraciones. No abre conexión: init.sh lo corre
npm run db:seed           # siembra los datos iniciales (idempotente)
```

**El esquema viaja con el despliegue, no se aplica a mano.** El camino normal es
`db:generate` —que escribe un archivo `.sql` versionado en `src/infra/db/migrations/`— y
`db:migrate`, que lo aplica. En Vercel lo aplica el script `vercel-build`
(`drizzle-kit migrate && next build`): si la migración falla, el build falla y Vercel conserva
el despliegue anterior.

**`npm run db:push:emergency` sigue existiendo, pero ya no es el camino.** `push` compara el
esquema TypeScript contra la base y aplica la diferencia sin dejar rastro de qué se aplicó ni
dónde, así que `dev` y producción pueden divergir sin que nada avise. Ya ocurrió: la tabla
`sessions` quedó solo en `dev` y el despliegue se rompió. Úsalo únicamente para reparar a
mano una base que quedó a medias, y regístralo en `progress.md` cuando lo hagas.

> **Si tocas `src/infra/db/schema.ts`, `npm run db:generate` y el `.sql` que salga van en el
> mismo commit.** Un esquema cambiado sin migración generada es el defecto nuevo que introduce
> este modelo: en local todo compila y pasa, y el despliegue aplica un esquema viejo.
> `db:check` valida que el historial sea coherente, pero **no** detecta esa omisión.

`check` **debe** incluir `next typegen` antes de `tsc`. Sobre un clon limpio, `tsc --noEmit`
a secas falla: la plantilla de Next 16 usa tipos globales como `LayoutProps<"/">` que Next
genera en `.next/types`. Sin el typegen previo, un clon recién hecho no compila.

**`test` y `test:integration` están separados a propósito.** `test` recoge solo `src/core/**`
y corre sin red ni base de datos, y por eso puede formar parte de `./init.sh`: la puerta de
entrada del repositorio no puede depender de que Neon responda, o un branch caducado se leería
como código roto. `test:integration` cubre lo que **no tiene sentido** probar sin base —que el
tiempo se derive de la marca almacenada, que un índice único rechace lo que debe rechazar— y se
ejecuta a mano. `init.sh` comprueba que el script **exista**, aunque no lo ejecute: un comando
de verificación que desaparece del `package.json` sin que nada avise es el mismo defecto del
`--if-present` con otra cara.

## Definition of Done

Una feature está *done* **only when** se cumple todo esto:

- `npm run check` pasa sin errores.
- `npm run lint` pasa sin errores.
- `npm run build` construye sin errores.
- **Prueba automatizada**, según el tipo de rebanada:
  - Si la rebanada **introduce lógica de dominio** (cálculos, reglas, validaciones):
    `npm run test` pasa y hay al menos una prueba que **falla si se revierte el cambio**.
  - Si la rebanada **es de infraestructura** y no introduce lógica de dominio (por ejemplo un
    esqueleto caminante): la verificación exigida es de humo — un comando que comprueba que la
    cadena responde de punta a punta. La evidencia es ese comando y su salida.

  > Una rebanada de infraestructura no puede tener una prueba unitaria que falle al revertirla,
  > porque no hay lógica que revertir. Exigirla igual convierte la definición de *done* en algo
  > insatisfacible, y un criterio imposible se ignora en vez de cumplirse. Lo que **no** se
  > negocia es que haya *alguna* verificación ejecutable.
- El comportamiento cumple el requerimiento EARS correspondiente de
  [`docs/REQUIREMENTS.md`](./docs/REQUIREMENTS.md), citado por su identificador `RF-XX`.
- En `feature_list.json` la feature quedó en `status: "passing"` **con el campo `evidence`
  lleno**: comando ejecutado y salida resumida.
- `progress.md` tiene la entrada de la sesión.

Nunca marques `passing` por inspección visual ni porque "debería funcionar". El estado avanza
únicamente con evidencia de un comando ejecutado.

### Todo criterio de hecho debe nombrar un comando

Un criterio de verificación tiene que poder ejecutarlo **quien lo va a ejecutar**. Los criterios
de `docs/ROADMAP.md` se escriben en dos partes:

| Parte | Qué es | ¿Bloquea `passing`? |
|---|---|---|
| **Verificación ejecutable** | Comandos concretos, con su salida esperada | **Sí** |
| **Confirmación humana** | Lo que una persona comprueba en el navegador | **No**, salvo que la rebanada trate justamente de la cadena de despliegue |

> Esta regla salió de un defecto real. Los siete criterios de hecho del ROADMAP estaban escritos
> como *"creas un programa por la interfaz, recargas y sigue ahí"* — imposible para un agente sin
> navegador, y sin embargo la *Definition of Done* exigía evidencia ejecutable. El harness pedía
> dos cosas incompatibles a la vez.
>
> Consecuencia de diseño: si una regla de negocio solo se puede comprobar con un clic, es que
> está en la capa equivocada. Muévela a `core/`, donde se prueba sin navegador y sin base de
> datos. La interfaz debe quedarse con lo que de verdad es presentación.

La confirmación humana **sí se registra**: va en `evidence`, diciendo quién verificó, desde
dónde y cuándo. Una evidencia que nadie puede reproducir tiene que declarar en qué condiciones
se obtuvo, o deja de ser evidencia y pasa a ser una afirmación.

## Scope

**One feature at a time.** `active` significa **"alguien la está trabajando ahora mismo"**, no
"es la siguiente". Reglas:

- Nunca más de una `active`. Si encuentras dos, es un error: detente y corrígelo antes de
  programar.
- **Cero `active` es el estado normal cuando nadie está trabajando.** No reserves la siguiente
  poniéndola en `active` por adelantado: una reserva se queda vieja y miente igual que un
  estado desactualizado. El paso 8 del *Startup Workflow* ya sabe cuál sigue.
- Al empezar, pon en `active` la que vas a trabajar. Al cerrar la sesión, déjala en `passing`
  o en `blocked`. **Nunca termines una sesión con una feature en `active`**: eso significa que
  alguien está trabajando, y nadie lo está.

**Stay in scope.** Si detectas un problema fuera de la feature activa, **no lo arregles**.
Anótalo en `progress.md` bajo "Hallazgos fuera de alcance" y sigue.

**Excepción: la documentación de arranque siempre está en alcance.** Si encuentras que
`AGENTS.md`, `CLAUDE.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md` o
`docs/DATA-MODEL.md` **contradicen la realidad** —un comando que no funciona, un estado falso,
dos documentos que se contradicen entre sí— corrígelo en la misma sesión y regístralo en
`progress.md`. No esperes a que "esté en alcance".

> Esta excepción existe porque la regla anterior, sola, era incoherente: protegía el código
> pero dejaba pudrirse los documentos que el propio harness declara más importantes que
> cualquier feature. Un agente que obedece "Stay in scope" al pie de la letra deja una
> instrucción falsa en pie para el siguiente, y el error se compone.
>
> El límite: corriges lo que es **falso**, no lo que te parece mejorable. Reescribir un
> documento porque lo redactarías distinto sí está fuera de alcance.

**Completion gate.** Una feature no se cierra si su cierre requiere tocar código de otra
feature. Si al terminar descubres que necesitas cambiar algo fuera de su alcance, la feature
queda en `blocked` con el motivo, no en `passing`.

Reglas adicionales:

- No agregues dependencias que no estén en `docs/ARCHITECTURE.md` sin registrar la decisión y
  su motivo en `progress.md`.
- No construyas nada de la lista "Fuera de alcance" de `docs/PRODUCT.md`. Esa lista es
  vinculante.

## End of Session

Before ending cualquier sesión, sin excepción:

1. Deja el árbol limpio: `npm run check` y `npm run build` deben pasar.
2. Actualiza `feature_list.json` con estado y evidencia de lo que tocaste.
3. Agrega la entrada de la sesión en `progress.md`.
4. Reescribe `session-handoff.md` completo: objetivo actual, qué quedó hecho, qué quedó roto o
   sin verificar, archivos tocados, bloqueos y siguiente paso recomendado.
5. Haz commit. No dejes cambios sin confirmar.

Que la sesión se corte a mitad de una feature es normal. Lo inaceptable es que la siguiente
sesión no pueda saber dónde quedó todo.

## Clean restart path

Cualquier sesión nueva debe poder llegar a un estado ejecutable con estos pasos y nada más:

```bash
git clone <repo> && cd study-tracker
cp .env.example .env    # completa DATABASE_URL
./init.sh               # instala y verifica
npm run db:migrate      # crea tablas e índices en esa base
npm run db:seed         # siembra el programa inicial (idempotente)
npm run dev             # servidor en marcha
```

Los dos pasos de base **no son opcionales y antes faltaban aquí**: `init.sh` no toca la base,
así que sobre una base vacía —un branch de Neon recién creado— el servidor arrancaba sin tablas
y la aplicación no servía para nada. `db:migrate` es además lo que crea el índice único
`one_running_session`, del que depende el invariante "como máximo una sesión en curso": sin
ese paso, un clon limpio queda sin la restricción y nada lo avisa hasta que conviven dos
sesiones. Si la base ya tenía el esquema, los dos comandos no hacen nada y lo dicen.

**`db:migrate` sustituyó a `db:push` en esta ruta el 25/09/2026.** La migración base está
escrita de forma idempotente, así que el mismo archivo sirve para una base vacía y para una
que ya tiene el esquema. Comprobado contra una base recién creada: deja las tres tablas, las
34 restricciones y los seis índices, incluido `one_running_session` con la definición exacta
que verifica `npm run test:integration`.

Si esta secuencia no funciona desde un clon limpio, arreglarla es más prioritario que
cualquier feature. El estado del repositorio, no la memoria de nadie, es lo que permite
reiniciar.

## Reglas de seguridad

- **Nunca** subas secretos. `.env` está en `.gitignore`; documenta variables nuevas en
  `.env.example` con valores falsos.
- **Nunca pidas una credencial en la conversación.** Si necesitas que el usuario aporte una
  cadena de conexión, una clave o un token, pídele que la escriba **él mismo en el archivo que
  corresponda** y que te avise cuando esté. Una credencial pegada en un chat queda en el
  transcript sin ninguna necesidad, y el comando que la necesita puede correrlo él en una línea.
- **Verifica las credenciales sin imprimirlas.** Para comprobar que una `DATABASE_URL` apunta a
  donde debe, extrae y compara el **host**, nunca el valor completo. Vale también para tus
  propias comprobaciones: un `grep` sobre el `.env` que imprima la línea entera deja el secreto
  en la salida, y esa salida se queda en el registro de la sesión.
- Este repositorio es personal. **No debe contener** código, datos, capturas ni nombres de
  sistemas internos de Protección S.A.
- La aplicación no almacena datos personales de terceros. Si una feature futura lo requiriera,
  primero se documenta la decisión y se revisa el impacto.
- Antes del primer despliegue público con datos reales, la autenticación debe estar activa
  (`RF-40`). Es una compuerta, no una etapa del cronograma.
- Valida toda entrada en el servidor. La validación del cliente es conveniencia, no control.
