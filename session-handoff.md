# session-handoff.md

**Last Updated:** 24/09/2026

> Encabezados de sección en inglés a propósito: son los marcadores estructurales que buscan las
> herramientas de auditoría del harness. El contenido va en español.

## Current Objective

Cerrar **R0 — Esqueleto caminante**. La aplicación ya existe y funciona en local contra Neon;
falta lo único que R0 exige para considerarse hecha: **la URL de producción en Vercel cargando
el dato leído de la base**. Ese paso necesita el navegador del usuario.

Mientras R0 no esté en `passing`, **no se empieza R1**: la dependencia es explícita en
`feature_list.json`.

## What was done

Implementación completa de R0 en local, como rebanada vertical: esquema → repositorio →
página.

- **Andamiaje.** `create-next-app@latest`: Next.js 16.3.6, React 19.2.8, TypeScript estricto,
  Tailwind 4, ESLint, `src/`. Sin shadcn/ui ni Recharts: entran en R3.
- **Datos.** `drizzle-orm` 0.45.3, `@neondatabase/serverless` 1.1.0, `drizzle-kit` 0.31.11.
  Tabla `programs` aplicada a Neon con `npm run db:push`, programa semilla "Harness
  Engineering" insertado con `npm run db:seed`.
- **Capas** de `docs/ARCHITECTURE.md` respetadas desde el primer archivo: `core/` no importa
  nada de `app/`, `infra/` ni `ui/`.
- **Scripts nuevos:** `check`, `db:push`, `db:seed`.
- **Verificado:** `npm run check`, `npm run lint`, `npm run build` y `./init.sh` completo pasan.
  `npm run dev` sirve `http://localhost:3000/` con HTTP 200 y el HTML contiene "Harness
  Engineering", "walkinglabs", "course", "active" y 41, leídos de la tabla.

El DDL de `docs/DATA-MODEL.md` se ejecutó por primera vez y el motor no rechazó nada. Las tres
diferencias entre lo especificado y lo aplicado están registradas en `progress.md`, sesión 3.

## What is broken or unverified

- **Sin desplegar.** Nada de la cadena de despliegue —importación del repositorio, build en
  Vercel, variable de entorno en producción— ha sido ejercitado. Es exactamente lo que R0
  existe para probar, y es lo que falta.
- **Sin pruebas automatizadas.** No hay Vitest todavía. R0 no tiene lógica de dominio que
  probar; la primera prueba real llega con R1/R2, donde viven las reglas de cálculo.
- **Sin migraciones versionadas.** Se usa `drizzle-kit push`. Sirve mientras la base no tenga
  datos que importe perder; deja de servir en cuanto haya sesiones reales.
- **`npm run check` incluye `next typegen`.** `AGENTS.md` lo documenta como `tsc --noEmit`, pero
  sobre un clon limpio eso falla: la plantilla usa el tipo global `LayoutProps<"/">`, que Next
  genera. El script ya hace lo correcto; el que quedó desactualizado es `AGENTS.md`.
- **`docs/ARCHITECTURE.md` sigue listando `npx shadcn@latest init` entre los comandos de R0**,
  en contra de `docs/ROADMAP.md`. No se tocó: corregirlo está fuera del alcance de R0.

## Files

Nuevos:

```
next.config.ts  next-env.d.ts  tsconfig.json  eslint.config.mjs  postcss.config.mjs
package.json  package-lock.json  drizzle.config.ts
scripts/seed.mjs
src/app/{layout.tsx,page.tsx,globals.css,favicon.ico}
src/core/model/program.ts
src/core/ports/program-repository.ts
src/infra/db/{schema.ts,client.ts}
src/infra/repos/drizzle-program-repository.ts
src/ui/program-card.tsx
public/*.svg
```

Modificados: `.gitignore` (se agregó `*.tsbuildinfo`), `README.md` (estado y arranque),
`feature_list.json`, `progress.md`, este archivo.

`AGENTS.md` quedó **intacto**: `next dev` intentó inyectarle un bloque propio y se desactivó
con `agentRules: false` en `next.config.ts`. Ver `progress.md`, sesión 3.

## Blockers

**Uno, y depende del usuario: el despliegue en Vercel.** Pasos exactos:

1. Empujar la rama: `git push origin main`. El commit de esta sesión ya está hecho, sin push.
2. En `vercel.com/new`, importar `johnma96/study-tracker`. Vercel detecta Next.js solo: no hay
   que cambiar framework, comando de build ni directorio de salida.
3. **Antes de pulsar Deploy**, en *Environment Variables* agregar `DATABASE_URL` con el mismo
   valor que tiene el `.env` local, marcada para Production, Preview y Development. Es la
   trampa conocida de R0: la variable tiene que existir **en los dos lados**.
4. Desplegar y abrir la URL. Debe mostrar la tarjeta "Harness Engineering · walkinglabs ·
   course · active · 41".
5. Si la página muestra "No se pudo leer de la base de datos", la variable no llegó: revisarla
   en *Settings → Environment Variables* y volver a desplegar (un cambio de variable no
   redespliega solo).
6. Con la URL funcionando, pasar R0 a `passing` en `feature_list.json` y poner la URL en
   `evidence`.

Opcional y recomendable después: en Neon, crear un branch `dev` para desarrollo local y dejar
el branch principal para producción, como plantea `docs/ARCHITECTURE.md`. Hoy local y
producción apuntan a la misma base.

## Next Session

Recommended Next Step: **desplegar y cerrar R0**, después arrancar **R1 — Programas**.

1. `cd study-tracker` y confirmar con `pwd`. No trabajar desde el repositorio del curso.
2. `./init.sh` — debe terminar en "Init OK".
3. Cerrar R0 con la URL de producción como evidencia, según los pasos de *Blockers*.
4. Poner R1 en `active` y leer `docs/REQUIREMENTS.md`, RF-10 a RF-15.
5. R1 trae lo que R0 dejó deliberadamente afuera: `session_types`, el orden de listado de
   RF-13, la validación de nombre de RF-14 en el servidor con `zod` o equivalente, y la
   semilla completa (los cuatro tipos de sesión E/C/K/V y la métrica "Harness score").
   `scripts/seed.mjs` es el sitio natural para ampliarla.
6. Instalar Vitest al empezar R1: desde ahí sí hay comportamiento que probar y `AGENTS.md`
   exige una prueba que falle si se revierte el cambio.
