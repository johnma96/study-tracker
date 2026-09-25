# session-handoff.md

**Last Updated:** 25/09/2026

> Encabezados de sección en inglés a propósito: son los marcadores estructurales que buscan las
> herramientas de auditoría del harness. El contenido va en español.

## Current Objective

**Ninguno en marcha.** La sesión 15 cerró **R8 — Contexto de programa** en `passing`. No hay
ninguna feature en `active`, que es el estado normal cuando nadie está trabajando.

Según el paso 8 del *Startup Workflow*, la siguiente es **R9 — Reorganización visual**: es la
primera `not_started` cuya dependencia (R8) está en `passing`. La otra `not_started` es R6, que
sigue diferida con riesgo aceptado y condiciones escritas en `RF-40`.

## What was done

- **R8 — Contexto de programa, en `passing`.** Un selector gobierna la página entera: al elegir
  un programa, el mapa de calor, los totales, la racha, la cadencia, la proyección, las métricas
  y la evidencia corresponden solo a ese programa. Con «todos» todo agrega.
- **El estado vive en la URL** (`/?programa=<id>`, con `todos` por defecto), no en estado de
  cliente. En Next 16 `searchParams` es una **promesa** y hay que esperarla; `PageProps<'/'>` la
  tipa sin importar nada, porque la genera `next typegen`.
- **El selector son enlaces**, no un `onChange`: funciona sin JavaScript, entra en el historial
  del navegador y el enlace se puede compartir.
- **Un valor inexistente o malformado en `?programa=` cae en «todos» sin error** (RF-39).
  Comprobado con `no-existe-123` y con `' OR 1=1 --` codificado: HTTP 200 las dos veces.
- **El filtrado tiene un solo dueño:** `src/core/services/program-context.ts`, funciones puras
  probadas sin base de datos. `listProgramSessions` pasó a ser `listSessionsInContext` para no
  dejar la misma regla escrita en dos sitios.
- **`RF-38` y `RF-39` nuevos** en `docs/REQUIREMENTS.md`, y decisiones 25 y 26 en
  `docs/ARCHITECTURE.md`. No existía ningún requerimiento EARS que describiera el contexto ni el
  valor inválido, y la *Definition of Done* exige citar uno.

## Verification

- `npm run test`: **304 pruebas en 19 archivos** (antes 281 en 18).
- **Reversión comprobada ejecutándola, no por suposición.** Con `filterByProgramContext`
  devolviendo siempre la lista completa caen **5 pruebas en 2 archivos**; al restaurar el filtro
  vuelven 304/304.
- `npm run test:integration`: **26/26** contra el branch `dev` de Neon.
- `npm run check`, `npm run lint` y `npm run build` sin errores. `./init.sh` termina en `Init OK`.
- Humo con `curl` contra el servidor local y los datos reales de `dev`: con «todos» el tablero
  dice «Todos los programas» con 3 sesiones; con `Harness Engineering` el tablero es suyo y sale
  en estado vacío, porque las tres sesiones son de `Prueba R7` y **no cuentan para él**; con
  `Prueba R7` salen sus tres.

## What is broken or unverified

- **Nada de esto se ha empujado.** `main` sigue por delante de `origin/main`. El próximo `git
  push` llevará a producción las migraciones pendientes por `vercel-build`; en el registro del
  build debe aparecer `migrations applied successfully`.
- **Sin verificar en producción.** La VPN corporativa bloquea `vercel.app`. Todo se verificó en
  local contra el branch `dev` de Neon.
- **Confirmación humana de R8 pendiente (no bloquea):** abrir la página en un navegador, elegir
  un programa y comprobar que el mapa, los totales, las métricas y la evidencia cambian, que la
  URL refleja la selección y que recargar la conserva.
- **Las `key` por contexto no tienen prueba automatizada.** Los tres componentes que alternan
  según el programa llevan `key` y un comentario que explica por qué, pero no hay entorno de
  pruebas de componentes React, así que quitarlas no rompe nada en la suite. Es la misma deuda
  que dejó la sesión 14 con el defecto de «Pausar»/«Reanudar».
- **Quedó un `next dev` vivo en el puerto 3000** (PID 26240 durante esta sesión), de una sesión
  anterior. En Windows detener `next dev` deja el proceso hijo escuchando; si el puerto está
  ocupado, `taskkill /PID <pid> /F`.

## Files

**Nuevos:**
- `src/core/services/program-context.ts` y `src/core/services/program-context.test.ts`.
- `src/ui/program-selector.tsx`.

**Modificados:**
- `src/app/page.tsx` — lee `searchParams`, resuelve el contexto y lo baja a cada sección.
- `src/app/stats-section.tsx` — un tablero, el del contexto, en vez de uno por programa.
- `src/app/evidence.ts` — lee una ventana de 50 sesiones y muestra 10 tras filtrar.
- `src/core/services/session-listing.ts` y su prueba — `listSessionsInContext`.
- `src/ui/stats-panel.tsx` — la prop `programName` pasó a `title`.
- `src/ui/start-session-form.tsx`, `src/ui/manual-session-form.tsx` — preselección por contexto.
- `src/ui/session-evidence.tsx` — texto del estado vacío.
- `tests/integration/stats.integration.test.ts` — usa el contexto.
- `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `feature_list.json`, `progress.md` y este
  archivo.

**Sin tocar:** el esquema de la base. R8 no cambió `src/infra/db/schema.ts`, así que no hay
migración nueva.

## Blockers

**Ninguno técnico.** Decisiones que son del usuario:

1. **Si la administración de programas debía filtrarse también por el contexto.** Se decidió que
   **no**: `docs/ROADMAP.md` enumera qué recorta R8 —mapa, totales, métricas y evidencia— y ese
   listado no está en la lista, y además es el único sitio donde se ven todos. Si la intención
   era la contraria, es un cambio de una línea en `page.tsx`.
2. **Validar `RF-38` y `RF-39` tal como quedaron escritos.** Los redactó esta sesión para que R8
   pudiera citar un requerimiento, siguiendo lo que ya decía el ROADMAP.
3. **Si R6 va antes de empujar.** La aplicación desplegada sigue aceptando escrituras sin
   autenticación.
4. **Borrar en la consola de Neon los branches `dev-r3`, `dev-r4` y `dev-r5`**, si siguen ahí.

**Aviso con fecha: el branch `dev` de Neon expira el 02/10/2026.** El procedimiento de
recuperación está en `docs/ARCHITECTURE.md`. Si un comando de base falla por conexión, no es el
código.

## Next Session

**R9 — Reorganización visual.** Está planificada en `docs/ROADMAP.md` y es exactamente lo que R8
tenía prohibido tocar:

- Jerarquía: barra de sesión y selector arriba; luego acción; luego avance; métricas; evidencia;
  y **administración de programas al final**.
- **Dos columnas en escritorio, una en móvil.** `max-w-2xl` pasa a `max-w-6xl`. La degradación a
  una columna no es opcional: la verificación de producción se hace desde el teléfono.
- **Selector de sesión en la evidencia**: un desplegable con las sesiones del programa y debajo
  solo los artefactos de esa sesión más el formulario. Desaparecen las N tarjetas.

Recommended Next Step: R9, o el curso de harness engineering. El tracker ya puede registrar su
propia sesión y ahora, con el contexto, separar el curso de cualquier otro programa.
