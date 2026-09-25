import type { Reading } from '@/core/model/metric';
import { compareLatestReadings } from '@/core/services/metric-trend';
import { drizzleMetricRepository } from '@/infra/repos/drizzle-metric-repository';
import { formatDateTime, type MetricView, type SessionOptionView } from '@/ui/metric-view';

/**
 * Carga de las métricas de progreso para la página (R5).
 *
 * Adaptador entre el repositorio y la presentación: agrupa las lecturas por
 * métrica y pide a `core/services/metric-trend` el veredicto de RF-63. No
 * decide nada por su cuenta.
 *
 * Si la base no responde, la página no se cae: devuelve `unavailable` y la
 * sección lo dice. El detalle del fallo se queda en el servidor (RF-43).
 */

/** Sesiones recientes que se ofrecen al registrar una lectura (RF-61). */
const LINKABLE_SESSIONS_LIMIT = 30;

export interface MetricsSnapshot {
  readonly metrics: readonly MetricView[];
  readonly sessionOptions: readonly SessionOptionView[];
  readonly unavailable: boolean;
}

function groupByMetric(readings: readonly Reading[]): Map<string, Reading[]> {
  const grouped = new Map<string, Reading[]>();

  // `listReadings` ya las entrega en orden cronológico; agrupar conserva el orden.
  for (const reading of readings) {
    const current = grouped.get(reading.metricId);
    if (current) current.push(reading);
    else grouped.set(reading.metricId, [reading]);
  }

  return grouped;
}

export async function loadMetricsSnapshot(): Promise<MetricsSnapshot> {
  try {
    const [metrics, readings, sessions] = await Promise.all([
      drizzleMetricRepository.listMetrics(),
      drizzleMetricRepository.listReadings(),
      drizzleMetricRepository.listLinkableSessions(LINKABLE_SESSIONS_LIMIT),
    ]);

    const readingsByMetric = groupByMetric(readings);

    return {
      unavailable: false,
      metrics: metrics.map((metric) => {
        const series = readingsByMetric.get(metric.id) ?? [];

        return {
          id: metric.id,
          programId: metric.programId,
          name: metric.name,
          unit: metric.unit,
          direction: metric.direction,
          target: metric.target,
          readings: series.map((reading) => ({
            id: reading.id,
            value: reading.value,
            recordedAtIso: reading.recordedAt.toISOString(),
            sessionId: reading.sessionId,
          })),
          trend: compareLatestReadings(metric.direction, series),
        };
      }),
      sessionOptions: sessions.map((session) => ({
        id: session.id,
        programId: session.programId,
        label: formatDateTime(session.startedAt),
        running: session.endedAt === null,
      })),
    };
  } catch (error) {
    console.error('[loadMetricsSnapshot]', error);

    return { metrics: [], sessionOptions: [], unavailable: true };
  }
}
