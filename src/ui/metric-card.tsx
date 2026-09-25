import type { ReadingTrend } from '@/core/services/metric-trend';
import { MetricChart } from '@/ui/metric-chart';
import {
  formatDateTime,
  formatDelta,
  formatValue,
  type MetricView,
  type SessionOptionView,
} from '@/ui/metric-view';
import { ReadingForm } from '@/ui/reading-form';

/**
 * Una métrica de progreso: veredicto de la última lectura (RF-63), serie de
 * tiempo con objetivo (RF-62), tabla de lecturas y formulario para registrar
 * otra (RF-61).
 *
 * Componente de presentación: recibe todo ya calculado. El veredicto lo decide
 * `core/services/metric-trend` en el servidor; aquí solo se pone en palabras.
 */

/** Lecturas visibles en la tabla. La serie completa va en la gráfica. */
const TABLE_ROWS = 10;

function TrendBadge({ trend, unit }: { trend: ReadingTrend; unit: string | null }) {
  // El estado nunca va solo en el color: lleva flecha y palabra.
  switch (trend.kind) {
    case 'no_readings':
      return <p className="text-sm opacity-70">Sin lecturas todavía.</p>;

    case 'first':
      return (
        <p className="text-sm">
          <span className="font-mono font-semibold">{formatValue(trend.latest, unit)}</span>
          <span className="opacity-70"> · primera lectura, sin anterior para comparar</span>
        </p>
      );

    case 'unchanged':
      return (
        <p className="text-sm" data-trend="unchanged">
          <span className="font-mono font-semibold">{formatValue(trend.latest, unit)}</span>{' '}
          <span className="opacity-80">→ Sin cambio respecto a la anterior</span>
        </p>
      );

    case 'improved':
    case 'worsened': {
      const improved = trend.kind === 'improved';

      return (
        <p className="text-sm" data-trend={trend.kind}>
          <span className="font-mono font-semibold">{formatValue(trend.latest, unit)}</span>{' '}
          <span
            className={
              improved ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }
          >
            {improved ? '▲ Mejoró' : '▼ Empeoró'} {formatDelta(trend.delta, unit)}
          </span>
          <span className="opacity-70"> respecto a la anterior ({formatValue(trend.previous, unit)})</span>
        </p>
      );
    }
  }
}

export function MetricCard({
  metric,
  sessionOptions,
  todayInAppZone,
  nowTimeInAppZone,
}: {
  metric: MetricView;
  sessionOptions: readonly SessionOptionView[];
  todayInAppZone: string;
  nowTimeInAppZone: string;
}) {
  const latestFirst = [...metric.readings].reverse().slice(0, TABLE_ROWS);

  return (
    <article className="rounded-md border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold">{metric.name}</h4>
        <p className="text-xs opacity-60">
          {metric.unit ?? 'sin unidad'} · mejora si {metric.direction === 'up' ? 'sube' : 'baja'}
          {metric.target === null ? '' : ` · objetivo ${formatValue(metric.target, metric.unit)}`}
        </p>
      </div>

      <div className="mt-2">
        <TrendBadge trend={metric.trend} unit={metric.unit} />
      </div>

      {metric.readings.length > 0 ? (
        <>
          <div className="mt-3">
            <MetricChart
              name={metric.name}
              unit={metric.unit}
              target={metric.target}
              readings={metric.readings}
            />
          </div>

          {/* Vista en tabla: la gráfica no es la única forma de leer la serie. */}
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-xs opacity-70">
              {metric.readings.length} lectura{metric.readings.length === 1 ? '' : 's'}
            </summary>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="opacity-60">
                <tr>
                  <th className="py-1 font-normal">Fecha</th>
                  <th className="py-1 text-right font-normal">Valor</th>
                </tr>
              </thead>
              <tbody>
                {latestFirst.map((reading) => (
                  <tr key={reading.id} className="border-t border-black/5 dark:border-white/10">
                    <td className="py-1">{formatDateTime(new Date(reading.recordedAtIso))}</td>
                    <td className="py-1 text-right font-mono tabular-nums">
                      {formatValue(reading.value, metric.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : null}

      <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/15">
        <ReadingForm
          metricId={metric.id}
          unit={metric.unit}
          sessionOptions={sessionOptions}
          todayInAppZone={todayInAppZone}
          nowTimeInAppZone={nowTimeInAppZone}
        />
      </div>
    </article>
  );
}
