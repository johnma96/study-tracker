import type { Metric, NewMetric, NewReading, Reading } from '../model/metric';

/**
 * Puerto de persistencia de métricas y lecturas (R5).
 *
 * `core/` define la interfaz; `infra/repos` la implementa con Drizzle. El
 * dominio nunca conoce el motor.
 *
 * El orden de las lecturas lo decide `core/services/metric-trend`, no la
 * consulta: las implementaciones devuelven las lecturas ya pasadas por
 * `sortReadings`, que es la misma regla que cubren las pruebas.
 */

/**
 * Una sesión a la que se puede asociar una lectura (RF-61).
 *
 * Es una vista mínima de `sessions`, no la entidad completa: el formulario de
 * lecturas solo necesita reconocerla por su programa y su fecha.
 */
export interface LinkableSession {
  readonly id: string;
  readonly programId: string;
  readonly startedAt: Date;
  /** Nulo si la sesión sigue en curso. */
  readonly endedAt: Date | null;
}

export interface MetricRepository {
  /** RF-60 — métricas de todos los programas, agrupables por `programId`. */
  listMetrics(): Promise<Metric[]>;

  findMetricById(id: string): Promise<Metric | null>;

  /**
   * RF-60 — crea una métrica.
   *
   * Devuelve `null` si el programa ya tiene una métrica con ese nombre. La
   * unicidad la impone la base con `UNIQUE (program_id, name)`; el repositorio
   * traduce el choque a un valor de dominio.
   */
  createMetric(input: NewMetric): Promise<Metric | null>;

  /** RF-61 — registra una lectura ya validada. */
  createReading(input: NewReading): Promise<Reading>;

  /** RF-62 — lecturas de una métrica, en orden cronológico ascendente. */
  listReadingsByMetric(metricId: string): Promise<Reading[]>;

  /** RF-62 — lecturas de todas las métricas, en orden cronológico ascendente. */
  listReadings(): Promise<Reading[]>;

  /** RF-61 — las sesiones más recientes, para ofrecerlas al registrar una lectura. */
  listLinkableSessions(limit: number): Promise<LinkableSession[]>;
}
