import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Esquema Drizzle de `programs`, transcrito del DDL de docs/DATA-MODEL.md.
 *
 * Diferencia deliberada frente al DDL del documento: las restricciones CHECK
 * llevan nombre explícito. Drizzle exige nombrarlas, y un nombre estable evita
 * que Postgres genere uno automático distinto en cada entorno.
 *
 * `defaultRandom()` emite `gen_random_uuid()`. En Postgres 13+ viene de fábrica;
 * si el motor la rechazara, se requiere `CREATE EXTENSION IF NOT EXISTS pgcrypto;`.
 *
 * Las columnas `timestamptz` guardan siempre UTC (invariante 5 de
 * docs/DATA-MODEL.md). La conversión a `America/Bogota` ocurre al presentar.
 */
export const programs = pgTable(
  'programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    provider: text('provider'),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('planned'),
    startedAt: date('started_at'),
    targetAt: date('target_at'),
    plannedSessions: integer('planned_sessions'),
    /**
     * R7 — URL base del repositorio del programa, opcional.
     *
     * Existe por RF-52: un artefacto cuyo `target` es una ruta relativa no se
     * podía enlazar, porque un `href` relativo apuntaría a esta aplicación y no
     * al repositorio. Con esta base, la ruta se une y el enlace funciona; sin
     * ella, la ruta se sigue mostrando como texto.
     *
     * El CHECK repite en el motor la lista blanca `http`/`https` que ya aplica
     * `core/services`: esta columna termina construyendo un `href`, y una base
     * con esquema `javascript:` convertiría cada ruta relativa en un enlace
     * ejecutable. Es defensa en profundidad, no duplicación gratuita.
     */
    repoUrl: text('repo_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // RF-14 — el nombre es obligatorio y no supera 120 caracteres.
    check('programs_name_length', sql`char_length(${table.name}) between 1 and 120`),
    // R7 — la base del repositorio, si existe, es http o https y no va vacía.
    check(
      'programs_repo_url_scheme',
      sql`${table.repoUrl} is null or ${table.repoUrl} ~* '^https?://.{1,2040}$'`,
    ),
    // RF-11
    check(
      'programs_kind_valid',
      sql`${table.kind} in ('course','certification','diploma','bootcamp','selfstudy')`,
    ),
    // RF-12
    check(
      'programs_status_valid',
      sql`${table.status} in ('planned','active','paused','done','abandoned')`,
    ),
  ],
);

export type ProgramRow = typeof programs.$inferSelect;

/**
 * Esquema Drizzle de `session_types` (RF-15), transcrito del DDL de
 * docs/DATA-MODEL.md.
 *
 * `ON DELETE CASCADE` cumple el invariante 6: borrar un programa se lleva sus
 * tipos de sesión.
 *
 * Los CHECK de longitud **no** están en el DDL del documento: lo añade esta
 * rebanada porque RF-15 exige "código corto" sin fijar un tope, y una columna
 * `text` sin límite acepta un párrafo como código. Los valores coinciden con
 * `core/services/session-type.ts`, que es donde se valida antes de llegar aquí.
 */
export const sessionTypes = pgTable(
  'session_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label').notNull(),
  },
  (table) => [
    unique('session_types_program_code').on(table.programId, table.code),
    check('session_types_code_length', sql`char_length(${table.code}) between 1 and 8`),
    check('session_types_label_length', sql`char_length(${table.label}) between 1 and 80`),
  ],
);

export type SessionTypeRow = typeof sessionTypes.$inferSelect;

/**
 * Esquema Drizzle de `sessions` (R2), transcrito del DDL de docs/DATA-MODEL.md.
 *
 * Las columnas que definen la rebanada son `started_at` y `ended_at`: **no hay
 * una columna de "tiempo transcurrido"**. Todo se deriva de esas dos marcas más
 * `paused_seconds` (RF-21, RF-24). Un contador acumulado sería un segundo dueño
 * del mismo dato y se perdería al cerrar la pestaña.
 *
 * `minutes_override` existe desde el primer día a propósito: agregarlo después
 * obligaría a migrar sesiones ya registradas (RF-25, RF-2H).
 *
 * **`one_running_session` se declara aquí y lo aplica `npm run db:migrate`.**
 * Es el índice único parcial del invariante 1 y va sobre la expresión constante
 * `(true)`, una forma que se temía que `drizzle-kit` no supiera expresar. Se
 * comprobó y sí la expresa: emite
 * `CREATE UNIQUE INDEX "one_running_session" ON "sessions" USING btree ((true))
 * WHERE "sessions"."ended_at" is null`, y eso es literalmente lo que quedó
 * escrito en `migrations/0000_baseline.sql`. Por eso no hace falta ningún paso
 * de SQL manual: un clon limpio que corra `db:migrate` queda con la restricción
 * puesta. La prueba de integración verifica que el índice existe, para que una
 * migración generada sin él no pase inadvertida.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    // Invariante 6: borrar un tipo de sesión no borra las sesiones que lo usan.
    sessionTypeId: uuid('session_type_id').references(() => sessionTypes.id, {
      onDelete: 'set null',
    }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    pausedSeconds: integer('paused_seconds').notNull().default(0),
    minutesOverride: integer('minutes_override'),
    stuckMinutes: integer('stuck_minutes').notNull().default(0),
    note: text('note'),
    source: text('source').notNull().default('timer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('sessions_paused_seconds_non_negative', sql`${table.pausedSeconds} >= 0`),
    // Invariante 3 — un override, si existe, es estrictamente positivo.
    check(
      'sessions_minutes_override_positive',
      sql`${table.minutesOverride} is null or ${table.minutesOverride} > 0`,
    ),
    check('sessions_stuck_minutes_non_negative', sql`${table.stuckMinutes} >= 0`),
    check('sessions_source_valid', sql`${table.source} in ('timer','manual')`),
    // Invariante 2 — el cierre es estrictamente posterior al inicio.
    check(
      'ended_after_started',
      sql`${table.endedAt} is null or ${table.endedAt} > ${table.startedAt}`,
    ),
    // Invariante 4b (RF-2D) — una sesión cerrada no deja una pausa abierta.
    check(
      'no_open_pause_when_ended',
      sql`${table.endedAt} is null or ${table.pausedAt} is null`,
    ),
    uniqueIndex('one_running_session').on(sql`(true)`).where(sql`${table.endedAt} is null`),
    index('sessions_by_program_date').on(table.programId, table.startedAt.desc()),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;

// R4 — artifacts ---------------------------------------------------------------

/**
 * Esquema Drizzle de `artifacts` (R4, RF-50 a RF-54), transcrito del DDL de
 * docs/DATA-MODEL.md.
 *
 * **Referencias, nunca archivos (RF-54).** `target` guarda una URL o una ruta
 * relativa de repositorio; no hay ninguna columna binaria ni de contenido. La
 * prueba `src/core/no-file-storage.test.ts` lee este archivo y las migraciones
 * y falla si aparece una.
 *
 * `ON DELETE CASCADE`: un artefacto no tiene sentido sin su sesión. Descartar
 * una sesión (RF-27, RF-2G) se lleva su evidencia, y borrar un programa se la
 * lleva a través de la cascada de `sessions` (invariante 6).
 *
 * Diferencias deliberadas frente al DDL del documento, mismo criterio que
 * `session_types` en R1:
 *
 * - Los CHECK llevan nombre explícito (Drizzle lo exige y un nombre estable no
 *   cambia entre entornos).
 * - Se añaden `artifacts_label_not_empty` y `artifacts_target_not_empty`. RF-50
 *   hace obligatorios la etiqueta y el destino, y `NOT NULL` solo impide el
 *   nulo: deja pasar la cadena vacía. **No** se replican en el motor los topes
 *   de longitud de `core/services` (120 y 2048): son criterio de interfaz, y la
 *   decisión 17 de docs/ARCHITECTURE.md evita migrar el esquema por uno.
 * - El índice `artifacts_by_session` no está en el DDL. La lectura de R4 es
 *   siempre "los artefactos de estas sesiones", y Postgres **no** indexa por su
 *   cuenta la columna de una clave foránea.
 */
export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    label: text('label').notNull(),
    target: text('target').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // RF-51
    check(
      'artifacts_kind_valid',
      sql`${table.kind} in ('doc','image','repo','link','commit')`,
    ),
    // RF-50 — etiqueta y destino obligatorios: tampoco vale la cadena vacía.
    check('artifacts_label_not_empty', sql`char_length(${table.label}) >= 1`),
    check('artifacts_target_not_empty', sql`char_length(${table.target}) >= 1`),
    index('artifacts_by_session').on(table.sessionId, table.createdAt),
  ],
);

export type ArtifactRow = typeof artifacts.$inferSelect;

// R5 — metrics y readings ----------------------------------------------------

/**
 * Esquema Drizzle de `metrics` (RF-60), transcrito del DDL de docs/DATA-MODEL.md.
 *
 * **Una métrica es un dato del programa, no un concepto del código.** El score
 * de un curso, los módulos de una certificación o la nota de un diplomado son
 * filas de esta tabla; el sistema grafica cualquier serie sin saber qué
 * significa. Por eso ni el nombre ni la unidad tienen dominio cerrado.
 *
 * `numeric` se lee en modo `number`: por defecto Drizzle devuelve `numeric`
 * como cadena, y un valor que el dominio compara (RF-63) no puede llegar como
 * texto — `'9' > '10'` es verdadero.
 *
 * Como en R1, los CHECK de longitud **no** están en el DDL del documento: los
 * añade esta rebanada para que el motor no acepte un párrafo como nombre o como
 * unidad. Coinciden con `core/services/metric-input.ts`.
 */
export const metrics = pgTable(
  'metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    unit: text('unit'),
    direction: text('direction').notNull().default('up'),
    target: numeric('target', { mode: 'number' }),
  },
  (table) => [
    unique('metrics_program_name').on(table.programId, table.name),
    check('metrics_direction_valid', sql`${table.direction} in ('up','down')`),
    check('metrics_name_length', sql`char_length(${table.name}) between 1 and 80`),
    check(
      'metrics_unit_length',
      sql`${table.unit} is null or char_length(${table.unit}) between 1 and 24`,
    ),
  ],
);

export type MetricRow = typeof metrics.$inferSelect;

/**
 * Esquema Drizzle de `readings` (RF-61), transcrito del DDL de docs/DATA-MODEL.md.
 *
 * Borrar la métrica se lleva sus lecturas (invariante 6); borrar la sesión
 * asociada **no**: la lectura sigue siendo un dato de progreso válido aunque ya
 * no se sepa en qué sesión se tomó.
 *
 * **`created_at` no está en el DDL del documento.** Lo añade esta rebanada
 * porque RF-63 compara "la última lectura" con "la anterior", y con solo
 * `recorded_at` dos lecturas registradas en el mismo minuto no tienen orden
 * definido: la comparación dependería del azar del motor. `created_at` es el
 * desempate — la que se registró después es la última.
 *
 * El índice cubre la única consulta de lectura: las lecturas de una métrica en
 * orden de tiempo, que es lo que se grafica (RF-62).
 */
export const readings = pgTable(
  'readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    metricId: uuid('metric_id')
      .notNull()
      .references(() => metrics.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    value: numeric('value', { mode: 'number' }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('readings_by_metric_time').on(table.metricId, table.recordedAt)],
);

export type ReadingRow = typeof readings.$inferSelect;
