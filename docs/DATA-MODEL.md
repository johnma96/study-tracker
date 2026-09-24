# DATA-MODEL.md — entidades, invariantes y DDL

Especificación del modelo. El agente que implemente genera `src/infra/db/schema.ts` a partir
de aquí. **El SQL de este documento no ha sido ejecutado**: es la especificación, no código
verificado. Al implementar, aplícalo y corrige lo que el motor rechace.

## Entidades

```
programs ──┬── session_types
           ├── metrics ──── readings
           └── sessions ──┬── artifacts
                          └── readings
```

| Entidad | Qué representa |
|---|---|
| `programs` | Un programa de estudio: curso, certificación, diplomado, bootcamp, autoestudio |
| `session_types` | Tipos de sesión **propios de cada programa** (E/C/K/V para el curso de harness) |
| `sessions` | Un bloque de trabajo con inicio y fin |
| `artifacts` | Evidencia enlazada a una sesión. Referencias, nunca archivos |
| `metrics` | Definición de una métrica de progreso propia del programa |
| `readings` | Una lectura puntual de una métrica |

## Invariantes

Estas reglas se imponen **en la base de datos**, no solo en la aplicación.

1. **Como máximo una sesión en curso en todo el sistema** (`ended_at IS NULL`). No se puede
   estudiar dos cosas a la vez. Se impone con un índice único parcial sobre una expresión
   constante. Una validación que solo viva en el cliente se salta abriendo dos pestañas.
2. `ended_at`, cuando existe, es estrictamente posterior a `started_at`.
3. `minutes_override`, cuando existe, es mayor que cero.
4. `stuck_minutes` es mayor o igual a cero.
5. Toda marca de tiempo se almacena en UTC (`timestamptz`). La conversión a `America/Bogota`
   ocurre al presentar y al agrupar por día — nunca al almacenar.
6. Borrar un programa borra en cascada sus sesiones, tipos, métricas y lecturas.

## Duración efectiva

Regla única, implementada en `core/services` y probada sin base de datos:

```
duracionEfectiva(sesion) =
  sesion.minutesOverride              si minutesOverride no es nulo
  redondear((endedAt - startedAt)/60) si endedAt no es nulo
  null                                si la sesión está en curso
```

`RF-25` obliga a pedir confirmación cuando el cálculo supera 480 minutos.

## DDL

```sql
CREATE TABLE programs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  provider     text,
  kind         text        NOT NULL CHECK (kind IN
                 ('course','certification','diploma','bootcamp','selfstudy')),
  status       text        NOT NULL DEFAULT 'planned' CHECK (status IN
                 ('planned','active','paused','done','abandoned')),
  started_at   date,
  target_at    date,
  planned_sessions integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  code       text NOT NULL,
  label      text NOT NULL,
  UNIQUE (program_id, code)
);

CREATE TABLE sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id       uuid        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_type_id  uuid        REFERENCES session_types(id) ON DELETE SET NULL,
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,
  minutes_override integer     CHECK (minutes_override IS NULL OR minutes_override > 0),
  stuck_minutes    integer     NOT NULL DEFAULT 0 CHECK (stuck_minutes >= 0),
  note             text,
  source           text        NOT NULL DEFAULT 'timer'
                               CHECK (source IN ('timer','manual')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ended_after_started CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- Invariante 1: como máximo una sesión en curso en todo el sistema.
CREATE UNIQUE INDEX one_running_session
  ON sessions ((true)) WHERE ended_at IS NULL;

CREATE INDEX sessions_by_program_date
  ON sessions (program_id, started_at DESC);

CREATE TABLE artifacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('doc','image','repo','link','commit')),
  label      text NOT NULL,
  target     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE metrics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name       text NOT NULL,
  unit       text,
  direction  text NOT NULL DEFAULT 'up' CHECK (direction IN ('up','down')),
  target     numeric,
  UNIQUE (program_id, name)
);

CREATE TABLE readings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id   uuid        NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  session_id  uuid        REFERENCES sessions(id) ON DELETE SET NULL,
  value       numeric     NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
```

> `gen_random_uuid()` requiere `pgcrypto` en Postgres anteriores a 13. Neon corre versiones
> recientes donde la función está disponible de fábrica. Si el motor la rechaza, ejecuta
> `CREATE EXTENSION IF NOT EXISTS pgcrypto;`.

## Agrupación por día

`RF-32` exige agrupar por fecha local, no por fecha UTC:

```sql
SELECT (started_at AT TIME ZONE 'America/Bogota')::date AS dia,
       count(*) AS sesiones
FROM sessions
WHERE program_id = $1
GROUP BY dia
ORDER BY dia DESC;
```

Agrupar por `started_at::date` sin conversión produce días equivocados para cualquier sesión
posterior a las 19:00 hora de Colombia. Es el error silencioso más probable de todo el modelo.

## Datos semilla

La rebanada 1 debe sembrar el primer programa:

```
name: "Harness Engineering"
provider: "walkinglabs"
kind: "course"
status: "active"
planned_sessions: 41

session_types: E Estudio · C Construcción · K Consolidación · V Checkpoint
metrics: "Harness score" (unit "puntos", direction "up", target 80)
```
