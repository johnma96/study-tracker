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

Dos, ambos externos y a resolver por el usuario antes de R0:

1. **Cuenta de Neon** con una base creada, y su `DATABASE_URL`.
2. **Cuenta de Vercel** conectada al repositorio remoto.

El repositorio no tiene remoto configurado todavía.

## Next Session

Recommended Next Step:

1. Resolver los dos bloqueos de arriba.
2. Ejecutar `./init.sh` y corregir lo que reporte.
3. Leer `docs/ROADMAP.md`, sección R0.
4. Implementar R0 como rebanada vertical: esquema → repositorio → página → despliegue.
5. Cerrar la sesión según el procedimiento "End of Session" de `AGENTS.md`.
