import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // RF-14 — el nombre es obligatorio y no supera 120 caracteres.
    check('programs_name_length', sql`char_length(${table.name}) between 1 and 120`),
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
