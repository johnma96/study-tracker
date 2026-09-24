# session-handoff.md

**Last Updated:** 24/09/2026

> Encabezados de sección en inglés a propósito: son los marcadores estructurales que buscan las
> herramientas de auditoría del harness. El contenido va en español.

## Current Objective

Implementar **R0 — Esqueleto caminante**: una aplicación Next.js 16 real, conectada a Neon con
Drizzle y desplegada en Vercel, que muestre una fila leída de la base de datos. Sin features.

## What was done

La semilla completa del repositorio: harness y documentación funcional. Un agente puede
empezar a implementar sin necesitar contexto hablado.

- `AGENTS.md` — harness operativo: arranque, verificación, definición de done, alcance, cierre
- `CLAUDE.md` — objetivo del repositorio y la decisión de diseño que lo define
- `docs/REQUIREMENTS.md` — 44 requerimientos EARS con trazabilidad a las rebanadas
- `docs/ARCHITECTURE.md` — stack y decisiones tomadas, con su registro
- `docs/DATA-MODEL.md` — entidades, invariantes y DDL
- `docs/ROADMAP.md` — las siete rebanadas del MVP
- `feature_list.json` — R0 en `active`, el resto en `not_started`

## What is broken or unverified

- **No hay código.** No hay `package.json`, ni `node_modules`, ni aplicación.
- **El DDL de `docs/DATA-MODEL.md` nunca se ejecutó.** Es especificación. Al aplicarlo puede
  requerir ajustes; el más probable es `CREATE EXTENSION pgcrypto` si el motor no trae
  `gen_random_uuid()`.
- **Las versiones de dependencias distintas de Next.js no fueron verificadas.** Solo se
  confirmó que Next.js 16.3.6 es LTS activo al 24/09/2026.
- `./init.sh` hoy solo valida el entorno, porque todavía no hay nada que instalar. Es
  correcto; se probó y termina con código 0.

## Files

Todos los archivos del repositorio: es el commit inicial.

```
AGENTS.md  CLAUDE.md  README.md  feature_list.json  init.sh  progress.md
session-handoff.md  .gitignore  .env.example
docs/PRODUCT.md  docs/REQUIREMENTS.md  docs/ARCHITECTURE.md
docs/DATA-MODEL.md  docs/ROADMAP.md
```

## Blockers

**Ninguno.** Los dos bloqueos externos quedaron resueltos:

- Proyecto de Neon creado, `DATABASE_URL` puesta en `.env` (no versionado).
- Cuenta de Vercel disponible, plan Hobby. Falta importar el repositorio, lo cual es parte
  de R0.
- Remoto configurado: `github.com/johnma96/study-tracker`, rama `main`.

## Next Session

Recommended Next Step: implementar **R0 — Esqueleto caminante**.

1. `cd study-tracker` y confirmar con `pwd`. No trabajar desde el repositorio del curso.
2. Ejecutar `./init.sh` y corregir lo que reporte.
3. Leer `docs/ROADMAP.md`, sección R0.
4. Andamiaje, según `docs/ARCHITECTURE.md`:
   `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir`
   más `drizzle-orm` y `@neondatabase/serverless`.
   **Sin shadcn/ui ni Recharts todavía**: entran en R3, cuando haya tableros.
5. Implementar como rebanada vertical: esquema → repositorio → página → despliegue en Vercel.
6. Verificar el criterio de hecho: la URL de Vercel carga y muestra un dato leído de la base.
7. Cerrar según el procedimiento "End of Session" de `AGENTS.md`.

Trampa conocida de R0: `DATABASE_URL` debe existir **en los dos lados** — en `.env` local y en
las variables de entorno del proyecto en Vercel. Es el fallo más común de esta rebanada.
