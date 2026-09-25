import { asc, desc, eq } from 'drizzle-orm';

import type { Metric, MetricDirection, NewMetric, NewReading, Reading } from '@/core/model/metric';
import type { LinkableSession, MetricRepository } from '@/core/ports/metric-repository';
import { sortReadings } from '@/core/services/metric-trend';
import { getDb } from '@/infra/db/client';
import {
  metrics,
  readings,
  sessions,
  type MetricRow,
  type ReadingRow,
} from '@/infra/db/schema';
import { isUniqueViolationOf } from '@/infra/db/unique-violation';

/**
 * Implementación del puerto `MetricRepository` con Drizzle sobre Neon (R5).
 *
 * Toda consulta va parametrizada por el constructor de Drizzle: no se arma SQL
 * por concatenación de cadenas (docs/ARCHITECTURE.md, sección Seguridad).
 *
 * Las columnas `numeric` se declaran en modo `number` en el esquema, así que
 * aquí ya llegan como número y no como cadena.
 */

/** Restricción de unicidad del nombre de métrica dentro de un programa. */
export const METRIC_PROGRAM_NAME_CONSTRAINT = 'metrics_program_name';

function toMetricDomain(row: MetricRow): Metric {
  return {
    id: row.id,
    programId: row.programId,
    name: row.name,
    unit: row.unit,
    // El motor garantiza el dominio con el CHECK `metrics_direction_valid`;
    // aquí solo se estrecha el tipo `text`.
    direction: row.direction as MetricDirection,
    target: row.target,
  };
}

function toReadingDomain(row: ReadingRow): Reading {
  return {
    id: row.id,
    metricId: row.metricId,
    sessionId: row.sessionId,
    value: row.value,
    recordedAt: row.recordedAt,
    createdAt: row.createdAt,
  };
}

export const drizzleMetricRepository: MetricRepository = {
  async listMetrics(): Promise<Metric[]> {
    const rows = await getDb()
      .select()
      .from(metrics)
      .orderBy(asc(metrics.programId), asc(metrics.name));

    return rows.map(toMetricDomain);
  },

  async findMetricById(id: string): Promise<Metric | null> {
    const rows = await getDb().select().from(metrics).where(eq(metrics.id, id)).limit(1);

    return rows.length > 0 ? toMetricDomain(rows[0]) : null;
  },

  /**
   * RF-60 — el choque de nombre se detecta por el error del motor y no por una
   * consulta previa: comprobar antes e insertar después deja una ventana en la
   * que dos peticiones pasan las dos comprobaciones.
   */
  async createMetric(input: NewMetric): Promise<Metric | null> {
    try {
      const [row] = await getDb()
        .insert(metrics)
        .values({
          programId: input.programId,
          name: input.name,
          unit: input.unit,
          direction: input.direction,
          target: input.target,
        })
        .returning();

      return toMetricDomain(row);
    } catch (error) {
      if (isUniqueViolationOf(error, METRIC_PROGRAM_NAME_CONSTRAINT)) return null;
      throw error;
    }
  },

  /** RF-61 — `created_at` lo pone el motor: es el desempate de RF-63. */
  async createReading(input: NewReading): Promise<Reading> {
    const [row] = await getDb()
      .insert(readings)
      .values({
        metricId: input.metricId,
        sessionId: input.sessionId,
        value: input.value,
        recordedAt: input.recordedAt,
      })
      .returning();

    return toReadingDomain(row);
  },

  /**
   * RF-62 — el `ORDER BY` aprovecha el índice `readings_by_metric_time`, pero
   * el orden que cuenta es el de `sortReadings`, que además desempata.
   */
  async listReadingsByMetric(metricId: string): Promise<Reading[]> {
    const rows = await getDb()
      .select()
      .from(readings)
      .where(eq(readings.metricId, metricId))
      .orderBy(asc(readings.recordedAt));

    return sortReadings(rows.map(toReadingDomain));
  },

  async listReadings(): Promise<Reading[]> {
    const rows = await getDb().select().from(readings).orderBy(asc(readings.recordedAt));

    return sortReadings(rows.map(toReadingDomain));
  },

  /**
   * RF-61 — lee `sessions` solo para ofrecerlas en el formulario. Se deja aquí,
   * y no en el repositorio de sesiones, para no ensanchar un puerto ajeno con
   * una consulta que solo necesita esta rebanada.
   */
  async listLinkableSessions(limit: number): Promise<LinkableSession[]> {
    return getDb()
      .select({
        id: sessions.id,
        programId: sessions.programId,
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
      })
      .from(sessions)
      .orderBy(desc(sessions.startedAt))
      .limit(limit);
  },
};
