# ROADMAP.md — plan de desarrollo del MVP rápido

## Objetivo del MVP rápido

**Poder cronometrar y guardar la Sesión 0 del curso de harness engineering.**

Esa es la meta, y es deliberadamente pequeña. Todo lo que no sirva para cronometrar una sesión
y guardarla espera. El criterio de corte: después de la rebanada 2 la herramienta ya es útil y
el resto es visualización sobre datos que ya se están capturando.

## Método

**Esqueleto caminante y rebanadas verticales.**

1. **El esqueleto va primero.** La rebanada 0 despliega una aplicación real a Vercel,
   conectada a Neon, sin ninguna feature. Esto prueba la cadena completa —repositorio, build,
   despliegue, base de datos, render— antes de que exista código que perder. Si algo del
   camino está roto, quieres saberlo con 20 líneas de código, no con 2.000.
2. **Cada rebanada es vertical**: base de datos → dominio → interfaz → desplegado. Nunca
   construyas una capa horizontal completa; terminas con tres capas que no se hablan.
3. **Una rebanada activa a la vez.** Lo impone `feature_list.json`.
4. **Cada rebanada cierra con el árbol limpio**: `npm run check` y `npm run build` pasan,
   `feature_list.json` actualizado con evidencia, `progress.md` y `session-handoff.md`
   escritos, commit hecho.

## Ruta crítica

```
R0 Esqueleto ──► R1 Programas ──► R2 Cronómetro  ◄── aquí ya sirve
                                       │
                                       ├─► R3 Totales y mapa de calor
                                       ├─► R4 Evidencia
                                       ├─► R5 Métricas
                                       └─► R6 Autenticación (compuerta antes de datos reales)
```

R3 a R5 son independientes entre sí: después de R2 se pueden hacer en cualquier orden.

## Rebanadas

### R0 — Esqueleto caminante · 1 sesión

Next.js 16 con App Router, Tailwind, TypeScript estricto. Conexión a Neon con Drizzle. Una
tabla, una fila, una página que la muestra. Desplegado en Vercel.

- **Requerimientos:** RF-01
- **Verificación ejecutable:** `./init.sh` termina en `Init OK`; `npm run dev` y
  `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` devuelve `200`, y el HTML
  contiene el nombre del programa semilla.
- **Confirmación humana (bloquea, excepcionalmente):** la URL de Vercel carga el dato. Es la
  única rebanada donde la confirmación humana bloquea, porque probar la cadena de despliegue
  **es** su propósito.
- **Trampa conocida:** la variable `DATABASE_URL` debe existir tanto en local (`.env`) como en
  las variables de entorno del proyecto en Vercel. Es el fallo más común de esta rebanada.

### R1 — Programas · 1 sesión

Crear, listar y sembrar. Al final debe existir el programa "Harness Engineering" con sus
cuatro tipos de sesión.

- **Requerimientos:** RF-10 … RF-15
- **Verificación ejecutable:** `npm run test` pasa, con pruebas de `core/` que cubran el orden
  de `RF-13` (incluidas fechas nulas) y los límites de nombre de `RF-14`; revertir cualquiera de
  las dos reglas hace fallar la suite. `npm run db:seed` dos veces demuestra idempotencia.
- **Confirmación humana:** crear un programa desde el formulario y verlo tras recargar.

### R2 — Cronómetro · 2 sesiones · **el corazón del MVP**

Iniciar, pausar, reanudar, detener, cancelar, registro manual y recuperación de sesión
abandonada.

- **Requerimientos:** RF-00, RF-20 … RF-29, RF-2A … RF-2I
- **Verificación ejecutable:** `npm run test` cubre los seis casos de duración efectiva de
  `docs/DATA-MODEL.md` sin tocar la base; y `npm run test:integration`, contra el branch `dev`
  de Neon, (1) inicia una sesión, la lee de nuevo desde la base y comprueba que el tiempo se
  deriva de `started_at`, (2) intenta iniciar una segunda y verifica que el índice único la
  rechaza, (3) fabrica una sesión con `started_at` de hace 9 horas y comprueba que la consulta
  de recuperación la detecta y que cerrarla libera el índice.
- **Confirmación humana:** iniciar, cerrar el navegador, reabrir y ver el cronómetro corriendo
  con el tiempo correcto.

> El punto (1) es la prueba clave y **se hace releyendo desde la base**, no inspeccionando la
> pantalla: lo que se verifica es que el tiempo no vive en el navegador.

Cuatro cosas que definen si esta rebanada quedó bien:

- **El tiempo transcurrido se deriva de la marca de inicio almacenada**, nunca de un contador
  en JavaScript. Es lo que hace que sobreviva a cerrar la pestaña.
- **La sesión única en curso se impone con el índice de base de datos**, no con una validación
  de interfaz.
- **El flujo de recuperación se implementa junto con el índice, no después.** El índice y el
  punto muerto son la misma moneda: sin válvula de escape, una sesión huérfana deja la
  aplicación inutilizable y solo se arregla entrando a la base a mano.
- **`minutes_override` y las pausas existen desde el primer día.** Vas a olvidar detener el
  cronómetro, y tus sesiones de estudio tienen un descanso intermedio por diseño. Agregar
  cualquiera de los dos después implica migrar datos reales.

### R3 — Totales y mapa de calor · 1 sesión

Días trabajados, horas, media, racha, mapa de calor, cadencia.

- **Requerimientos:** RF-30 … RF-37
- **Verificación ejecutable:** `npm run test` con funciones puras de `core/` que reciban una
  lista de sesiones y devuelvan días, horas, media, racha y cadencia, contrastadas contra
  valores calculados a mano en la propia prueba. **Caso obligatorio:** una sesión iniciada a
  las 23:40 hora de Colombia cuenta en ese día y no en el siguiente.
- **Trampa conocida:** agrupar por día sin convertir a `America/Bogota`. Prueba con una sesión
  iniciada después de las 19:00 hora de Colombia; si aparece en el día siguiente, está mal.

### R4 — Evidencia · 1 sesión

Adjuntar artefactos a una sesión y verlos como enlaces.

- **Requerimientos:** RF-50 … RF-54
- **Verificación ejecutable:** `npm run test` cubre la validación de artefactos (tipos
  permitidos de `RF-51`, destino obligatorio) y que `RF-54` se cumple: ninguna ruta del
  repositorio escribe archivos. Una prueba de integración adjunta dos artefactos a una sesión y
  los recupera.
- **Confirmación humana:** un artefacto de tipo `doc` abre el archivo real en GitHub.

### R5 — Métricas · 1-2 sesiones

Definir métricas por programa, registrar lecturas, graficar la serie.

- **Requerimientos:** RF-60 … RF-63
- **Verificación ejecutable:** `npm run test` cubre la comparación de `RF-63` —si la última
  lectura mejoró o empeoró— para métricas con dirección `up` y `down`, incluido el empate. Una
  prueba de integración crea una métrica, registra tres lecturas y las recupera en orden.
- **Confirmación humana:** cargar los scores reales de `validate-harness.mjs` y ver la curva
  con su línea de objetivo en 80.

### R6 — Autenticación · 1 sesión · compuerta · **DIFERIDA**

Auth.js con un proveedor OAuth y lista blanca por variable de entorno.

> **Diferida el 25/09/2026 con riesgo aceptado.** Las condiciones que la vuelven obligatoria
> están en `RF-40` de `docs/REQUIREMENTS.md`. Revísalas antes de descartarla otra vez.

- **Requerimientos:** RF-40 … RF-44
- **Verificación ejecutable:** `curl` sin credenciales contra una ruta de lectura y contra una
  Server Action devuelve 401 o 403, nunca 200 con datos. Una prueba cubre que un correo fuera
  de la lista blanca se rechaza (`RF-42`).
- **Confirmación humana:** un navegador sin sesión no puede leer ni escribir nada.
- **Cuándo hacerla:** no es la última rebanada del cronograma, es una **compuerta**. Mientras
  la base solo tenga datos de prueba puede esperar. En el momento en que registre sesiones
  reales que te importe perder o exponer, es obligatoria antes del siguiente despliegue.

## Paralelización de R3, R4 y R5

R3, R4 y R5 dependen de R2 pero **no entre sí**. Es el único punto del MVP donde el abanico es
legítimo, y por eso se hace aquí.

```
R0 → R1 → R2 ─┬─→ R3  totales y mapa de calor   (sin tablas nuevas)
              ├─→ R4  evidencia                  (tabla artifacts)
              └─→ R5  métricas                   (tablas metrics, readings)
```

> **Vertical no significa independiente.** Todas las rebanadas son verticales —atraviesan base
> de datos, dominio e interfaz—, pero solo estas tres son independientes entre sí. R1 y R2 son
> verticales y encadenadas: `sessions` referencia a `programs`, así que paralelizarlas es
> imposible. Solo la independencia habilita el abanico.

### Preparación, en serie, antes de abrir el abanico

Estos tres pasos **no se pueden repartir**: si cada agente los hace por su cuenta, colisionan.

| # | Paso | Por qué en serie |
|---|---|---|
| 1 | Instalar **shadcn/ui y Recharts** en `main` y commitear | Es infraestructura de interfaz compartida. Tres `shadcn init` en paralelo se pisan en `package.json`, `components.json` y los estilos |
| 2 | Crear en Neon **tres branches desde `dev`**: `dev-r3`, `dev-r4`, `dev-r5` | El índice `one_running_session` es global: la sesión que crea la prueba de integración de un agente **hace fallar las de los otros dos**. Sin bases separadas, las pruebas se vuelven inestables sin motivo aparente |
| 3 | Crear tres worktrees | Aislamiento de archivos |

```bash
git worktree add ../study-tracker-r3 -b r3-totales
git worktree add ../study-tracker-r4 -b r4-evidencia
git worktree add ../study-tracker-r5 -b r5-metricas
```

Cada worktree necesita su **propio `npm install`** —`node_modules` no se comparte— y su propio
`.env` con la cadena de **su** branch de Neon. Ese costo es parte de lo que hay que medir: si
tres `npm install` y tres branches cuestan más que hacerlo en serie, el abanico no valió la pena.

### Reglas para los tres agentes

- Cada uno trabaja **solo** en su worktree y contra **su** branch de Neon.
- Cada uno toca **únicamente su propia entrada** de `feature_list.json`. Nada más de ese archivo.
- **Ninguno reescribe `session-handoff.md`.** Es un archivo de un solo escritor: tres reescrituras
  completas garantizan conflicto. Cada agente deja sus hallazgos en `notas-rN.md` en la raíz de su
  worktree, y quien integra los consolida en `progress.md`.
- Cada uno commitea en su rama. **Ninguno empuja.**

### Integración, en serie: R3 → R4 → R5

El orden no es arbitrario:

1. **R3 primero** porque no agrega tablas: no genera migración y por tanto no compite por la
   numeración.
2. **R4 después.** Genera `0001_*` para `artifacts`.
3. **R5 al final.** También querría generar `0001_*`. Tras integrar R4 ese número ya existe, así
   que **hay que borrar su migración y volver a generarla** con `npm run db:generate` para que
   salga `0002_*`. Es el conflicto más fácil de resolver mal: si se fusionan dos archivos `0001`,
   el historial de migraciones queda corrupto y `npm run db:check` lo detecta.

Después de **cada** integración: `npm run db:check`, `npm run db:migrate` contra `dev`,
`npm run test` y `npm run test:integration`.

### Conflictos esperados

| Archivo | Por qué choca | Cómo se resuelve |
|---|---|---|
| `src/infra/db/migrations/` | R4 y R5 generan ambos `0001_*` | R5 regenera tras integrar R4 |
| `feature_list.json` | Los tres actualizan su estado | Cada agente toca solo su bloque; el conflicto es mecánico |
| `progress.md` | Los tres querrían escribir | Solo escribe quien integra, desde las `notas-rN.md` |
| `src/app/page.tsx` | Los tres agregan interfaz | Probable y real: conviene que cada uno monte su sección en un componente propio de `src/ui/` y toque `page.tsx` lo mínimo |

### Qué se está midiendo

Esto no es solo una forma de ir más rápido: es el **Experimento 2 del Proyecto 08** del curso,
hecho sobre código propio. La pregunta a responder al final, con datos y no con impresión:
**¿el tiempo ahorrado compensó el costo de coordinación?** Registra en `progress.md` el tiempo de
preparación, el de cada agente, el de integración y cuántos conflictos hubo.

## Fuera del MVP

Ver la lista vinculante en `docs/PRODUCT.md`. No la amplíes sin decisión explícita.

## Notas para el agente implementador

- Lee `CLAUDE.md` completo antes de empezar. El flujo de arranque no es opcional.
- Las decisiones de `docs/ARCHITECTURE.md` están tomadas. Si una te parece equivocada, anótala
  en `progress.md` y consulta; no la cambies por tu cuenta.
- El SQL de `docs/DATA-MODEL.md` es especificación, no código ejecutado. Aplícalo y corrige lo
  que el motor rechace.
- Las versiones de dependencias distintas de Next.js no fueron verificadas al 24/09/2026.
  Instala con `@latest` y confirma.
- Si una rebanada te toma más del doble de lo estimado, detente y escribe el handoff. Un
  atasco documentado vale más que una rebanada a medio terminar sin registro.
