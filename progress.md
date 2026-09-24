# progress.md — bitácora de sesiones

## Current State

**Última actualización:** 24/09/2026
**Feature activa:** R0 — Esqueleto caminante
**Estado del repositorio:** semilla publicada en `github.com/johnma96/study-tracker`.
Documentación y harness completos; **sin código todavía**.
**Bloqueos externos:** ninguno. Neon y Vercel resueltos; `DATABASE_URL` en `.env`.
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

---

### Sesión 2 — 24/09/2026 — corrección del spec de R2 y desbloqueo

**Duración:** ~30 min
**Objetivo:** cerrar dos defectos de diseño detectados por análisis de competencia antes de
que un agente construyera el cronómetro con ellos adentro.

**What was done**

- Publicado en `github.com/johnma96/study-tracker`, rama `main`.
- Bloqueos externos resueltos por el usuario: proyecto de Neon creado con `DATABASE_URL` en
  `.env`, y cuenta de Vercel (plan Hobby) disponible.
- **Defecto 1 — sesión huérfana.** El índice único de "máximo una sesión en curso" podía dejar
  la aplicación en punto muerto: si el navegador se cerraba sin llamar al cierre, ninguna
  sesión nueva podía iniciar. Se agregaron `RF-2F` a `RF-2I` (cierre desde cualquier vista y
  diálogo de recuperación a partir de 8 horas) y se documentó en `docs/DATA-MODEL.md` que el
  flujo de recuperación es la válvula de escape del índice, no una feature aparte.
- **Defecto 2 — pausas.** No existía modelo para los descansos, pese a que la estructura de
  sesión de estudio prevista tiene uno intermedio. Se agregaron `RF-2A` a `RF-2E`, las columnas
  `paused_at` y `paused_seconds`, la restricción `no_open_pause_when_ended`, y se reescribió la
  regla de duración efectiva con seis casos de prueba.
- R2 pasa de 1-2 sesiones a 2 sesiones y absorbe ambos bloques: son un solo corte vertical
  porque entregar el cronómetro sin ellos sería entregar un defecto conocido.

**Decisions**

1. Pausas y recuperación entran en R2, no en una rebanada posterior. Ambas tocan el esquema y
   el índice; agregarlas después implicaría migrar datos reales.
2. El tercer defecto detectado —`readings.value` es `numeric` y no admite series categóricas
   tipo *Mastered/Learning/Not started*— **se pospone a R5** a propósito. No bloquea el MVP y
   para entonces se sabrá qué métricas se usan de verdad.

**Issues**

Ninguno.

**Hallazgos fuera de alcance**

- El nombre `study-tracker` ya está tomado por al menos dos productos del nicho, uno con ese
  dominio exacto. Irrelevante para uso personal; relevante si algún día se publica.
- Los tres competidores analizados (study-track.app, study-tracker.app, athenify.io) evitan el
  problema del progreso heterogéneo reduciendo todo a horas contra meta, y ninguno modela
  evidencia de la sesión. Confirma que `artifacts` y `metrics` son la diferenciación real.

**Next session**

Implementar R0 (esqueleto caminante). Ya no hay bloqueos externos.
