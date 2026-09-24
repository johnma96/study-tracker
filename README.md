# study-tracker

Registro de sesiones de estudio para **varios programas de aprendizaje** — cursos,
certificaciones, diplomados, bootcamps, autoestudio — con tres preguntas que la aplicación
responde siempre:

1. ¿Qué días trabajé y cuánto tiempo?
2. ¿Qué produjo cada sesión? (evidencia enlazable)
3. ¿Cómo avanza el progreso de cada programa?

El primer programa que vive aquí es **Harness Engineering**. El diseño no se acopla a ese
curso: cada programa define sus propias métricas de progreso, así que el score de un
validador, los módulos de una certificación y las notas de un diplomado caben en el mismo
modelo.

## Estado

**Semilla.** El repositorio tiene el harness y la documentación funcional completos. **No hay
código todavía.** La primera rebanada por implementar es R0 (esqueleto caminante).

## Stack

Next.js 16 (App Router) · TypeScript · React 19 · Tailwind · shadcn/ui · Drizzle ORM ·
Postgres (Neon) · Vercel · Vitest

## Arranque

```bash
cp .env.example .env     # completa DATABASE_URL con tu base de Neon
./init.sh
```

Mientras no exista `package.json`, `init.sh` solo valida el entorno y termina. Es lo esperado.

## Documentación

| Archivo | Contenido |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Harness: flujo de arranque, definición de done, alcance, cierre |
| [`docs/PRODUCT.md`](./docs/PRODUCT.md) | Problema, usuario, alcance y no-objetivos |
| [`docs/REQUIREMENTS.md`](./docs/REQUIREMENTS.md) | 44 requerimientos funcionales en formato EARS |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Stack, capas y registro de decisiones |
| [`docs/DATA-MODEL.md`](./docs/DATA-MODEL.md) | Entidades, invariantes y DDL |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Plan de desarrollo del MVP en siete rebanadas |

## Nota sobre el harness

Este repositorio es también el campo de práctica del curso de harness engineering: los
artefactos que el curso enseña se aplican aquí sobre código real. Por eso `CLAUDE.md`,
`feature_list.json`, `init.sh`, `progress.md` y `session-handoff.md` no son decoración —
son el objeto de estudio.
