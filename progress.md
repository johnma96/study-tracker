# progress.md — bitácora de sesiones

## Current State

**Última actualización:** 24/09/2026
**Feature activa:** R0 — Esqueleto caminante
**Estado del repositorio:** semilla. Documentación y harness completos; **sin código todavía**.
**Siguiente paso:** ejecutar `./init.sh`, luego implementar R0 siguiendo `docs/ROADMAP.md`.

---

## Sesiones

### Sesión 1 — 24/09/2026 — siembra del repositorio

**Duración:** ~40 min
**Objetivo:** dejar el repositorio listo para que otro agente implemente sin necesitar contexto oral.

**What was done**

- Repositorio creado e inicializado en `main`.
- Harness mínimo: `CLAUDE.md`, `AGENTS.md`, `feature_list.json`, `init.sh`,
  `session-handoff.md`, este archivo.
- Documentación funcional: `docs/PRODUCT.md`, `docs/REQUIREMENTS.md` (44 requerimientos EARS),
  `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/ROADMAP.md`.
- Las siete rebanadas del MVP quedaron definidas con dependencias y comandos de verificación.

**Decisions**

Registradas con su motivo en la tabla final de `docs/ARCHITECTURE.md`. Las tres que más
condicionan la implementación:

1. Postgres en todos los entornos. Descarta la secuencia JSON → SQLite → Postgres, que
   obligaría a reescribir la capa de datos dos veces.
2. El tiempo transcurrido del cronómetro se deriva de la marca de inicio almacenada, nunca de
   un contador en el navegador. Es lo que permite cerrar la pestaña sin perder la sesión.
3. La autenticación es una compuerta de despliegue, no la última etapa del cronograma.

**Issues**

Ninguno.

**Hallazgos fuera de alcance**

- Existe `../hard-pomodoro`, un temporizador en Python con su propio `CLAUDE.md`. Podría
  alimentar sesiones al tracker más adelante. **No se integra en el MVP.**

**Next session**

Implementar R0 (esqueleto caminante). Antes de escribir código: leer `CLAUDE.md` completo,
ejecutar `./init.sh` y crear las cuentas de Neon y Vercel.
