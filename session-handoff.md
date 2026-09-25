# session-handoff.md

**Last Updated:** 25/09/2026

> Encabezados de sección en inglés a propósito: son los marcadores estructurales que buscan las
> herramientas de auditoría del harness. El contenido va en español.

## Current Objective

Implementar **R1 — Programas**: crear y listar programas, y ampliar la semilla con los cuatro
tipos de sesión y la métrica del curso.

Requerimientos: `RF-10` a `RF-15` en `docs/REQUIREMENTS.md`.

**Vitest se instala al abrir esta rebanada.** R1 sí introduce lógica de dominio —validación de
nombre, orden de listado— así que aplica la regla completa de la *Definition of Done*: al menos
una prueba que falle si se revierte el cambio.

## What was done

**R0 cerrada en `passing`.** La aplicación está desplegada y sirviendo datos de Neon en
<https://study-tracker-eight-sigma.vercel.app/>. La cadena completa —repositorio, build,
despliegue, base de datos, render— quedó probada, que era el único propósito de esa rebanada.

Después del despliegue se corrigieron **cinco huecos del harness** detectados al construir R0.
Todos salieron de ejecutarlo contra código real; ninguno habría aparecido releyendo documentos:

1. `docs/ARCHITECTURE.md` indicaba `create-next-app .`, que **falla** sobre un repositorio con
   archivos propios. Documentado el andamiaje en subdirectorio temporal.
2. La *Definition of Done* era insatisfacible para una rebanada de infraestructura. Ahora
   distingue rebanadas con lógica de dominio de las que no la tienen.
3. La regla de selección de feature podía quedarse sin candidata. Se agregó el caso 3.
4. `check` estaba documentado como `tsc --noEmit`; sobre un clon limpio hace falta
   `next typegen` antes.
5. `ARCHITECTURE` contradecía al `ROADMAP` sobre shadcn en R0.

También: `TZ` renombrada a `APP_TIMEZONE` porque Vercel reserva ese nombre.

## What is broken or unverified

- **Sin pruebas automatizadas todavía.** Vitest no está instalado. Es lo primero de R1.
- **Sin migraciones versionadas.** Se usa `drizzle-kit push`. Sirve mientras la base no tenga
  datos que importe perder; deja de servir en cuanto haya sesiones reales registradas.
- **Un solo branch de Neon.** Local y producción apuntan a la misma base, contra lo que plantea
  `docs/ARCHITECTURE.md`. Crear un branch `dev` es barato y conviene hacerlo antes de que haya
  datos reales.
- **`APP_TIMEZONE` no la lee ningún código.** Y según el análisis registrado en
  `ARCHITECTURE.md` probablemente deba ser una constante en `core/`, no una variable de
  entorno. Se decide cuando R3 implemente la agrupación por día.
- **La verificación de despliegues exige un dispositivo fuera de la red corporativa.** La VPN
  de Protección bloquea `vercel.app` y la interceptación TLS impide comprobarlo desde la
  máquina de trabajo, incluso por línea de comandos.

## Files

Sin cambios de código en esta sesión. Modificados: `feature_list.json`, `progress.md`,
`README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `.env.example` y este archivo.

## Blockers

Ninguno. R1 puede empezar de inmediato.

## Next Session

Recommended Next Step: implementar **R1 — Programas**.

1. `cd study-tracker` y confirmar con `pwd`. No trabajar desde el repositorio del curso.
2. `./init.sh` — debe terminar en "Init OK".
3. Instalar Vitest y dejar corriendo una primera prueba antes de escribir la feature.
4. `RF-10` a `RF-14`: crear y listar programas, con validación **en el servidor** (`RF-14`:
   nombre entre 1 y 120 caracteres) y el orden de `RF-13` (`active` primero, luego fecha de
   inicio descendente).
5. `RF-15`: tipos de sesión propios de cada programa. Ampliar `scripts/seed.mjs` con los cuatro
   del curso —`E` Estudio, `C` Construcción, `K` Consolidación, `V` Checkpoint— y la métrica
   "Harness score" (unidad "puntos", dirección `up`, objetivo 80).
6. Cerrar según el procedimiento "End of Session" de `AGENTS.md`.

Recordatorio de alcance: R1 **no** incluye cronómetro. Eso es R2, y trae consigo las pausas y
el flujo de recuperación de sesión abandonada.
