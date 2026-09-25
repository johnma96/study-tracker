/**
 * Dominio puro: métricas de progreso y sus lecturas (entidades `metrics` y
 * `readings` de docs/DATA-MODEL.md).
 *
 * Esta capa no importa nada de `app/`, `infra/` ni `ui/` (regla de capas de
 * docs/ARCHITECTURE.md).
 *
 * **La decisión que define la rebanada R5:** el progreso no es un porcentaje
 * único. Cada programa define sus propias métricas —un score, módulos
 * completados, una nota por corte— y el sistema grafica cualquier serie sin
 * saber qué significa. Por eso el nombre y la unidad son texto libre: son datos
 * del programa, no valores que el código conozca. Lo único cerrado es la
 * dirección de mejora, que es lo que el sistema necesita para decir si una
 * lectura fue mejor o peor (RF-63).
 */

/** RF-60 — dirección de mejora: `up` si más es mejor, `down` si menos es mejor. */
export const METRIC_DIRECTIONS = ['up', 'down'] as const;

export type MetricDirection = (typeof METRIC_DIRECTIONS)[number];

/** Entidad `metrics` de docs/DATA-MODEL.md (RF-60). */
export interface Metric {
  id: string;
  programId: string;
  name: string;
  /** Texto libre: "puntos", "módulos", "nota". Nulo si la métrica no tiene unidad. */
  unit: string | null;
  direction: MetricDirection;
  /** Valor objetivo opcional. Si existe, la gráfica lo muestra (RF-62). */
  target: number | null;
}

/** Datos para crear una métrica. El `id` lo genera la base. */
export interface NewMetric {
  programId: string;
  name: string;
  unit: string | null;
  direction: MetricDirection;
  target: number | null;
}

/** Entidad `readings` de docs/DATA-MODEL.md (RF-61). */
export interface Reading {
  id: string;
  metricId: string;
  /** Sesión en la que se tomó la lectura. Opcional (RF-61). */
  sessionId: string | null;
  value: number;
  /** Instante de la lectura. Siempre UTC (invariante 5). */
  recordedAt: Date;
  /**
   * Instante en que se registró. Desempata dos lecturas con el mismo
   * `recordedAt`: sin él, "la última lectura" de RF-63 no estaría definida.
   */
  createdAt: Date;
}

/** Datos para registrar una lectura (RF-61). */
export interface NewReading {
  metricId: string;
  sessionId: string | null;
  value: number;
  recordedAt: Date;
}
