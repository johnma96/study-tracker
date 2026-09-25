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
./init.sh            # instala, verifica tipos, lint y build. Puerta de entrada.
npm run check        # next typegen && tsc --noEmit
npm run lint         # eslint
npm run test         # vitest run  (existe a partir de R1)
npm run build        # next build
npm run dev          # servidor local
npm run db:push      # aplica el esquema a la base de datos
npm run db:seed      # siembra los datos iniciales (idempotente)
```

`check` **debe** incluir `next typegen` antes de `tsc`. Sobre un clon limpio, `tsc --noEmit`
a secas falla: la plantilla de Next 16 usa tipos globales como `LayoutProps<"/">` que Next
genera en `.next/types`. Sin el typegen previo, un clon recién hecho no compila.

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

## Scope

**One feature at a time.** `feature_list.json` admite como máximo un `status: "active"`. Si
encuentras dos, es un error: detente y corrígelo antes de programar.

**Stay in scope.** Si detectas un problema fuera de la feature activa, **no lo arregles**.
Anótalo en `progress.md` bajo "Hallazgos fuera de alcance" y sigue.

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
npm run dev             # servidor en marcha
```

Si esta secuencia no funciona desde un clon limpio, arreglarla es más prioritario que
cualquier feature. El estado del repositorio, no la memoria de nadie, es lo que permite
reiniciar.

## Reglas de seguridad

- **Nunca** subas secretos. `.env` está en `.gitignore`; documenta variables nuevas en
  `.env.example` con valores falsos.
- Este repositorio es personal. **No debe contener** código, datos, capturas ni nombres de
  sistemas internos de Protección S.A.
- La aplicación no almacena datos personales de terceros. Si una feature futura lo requiriera,
  primero se documenta la decisión y se revisa el impacto.
- Antes del primer despliegue público con datos reales, la autenticación debe estar activa
  (`RF-40`). Es una compuerta, no una etapa del cronograma.
- Valida toda entrada en el servidor. La validación del cliente es conveniencia, no control.
