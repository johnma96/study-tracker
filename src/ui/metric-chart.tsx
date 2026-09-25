'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/ui/primitives/chart';
import {
  formatDateTime,
  formatShortDate,
  formatValue,
  type ReadingView,
} from '@/ui/metric-view';

/**
 * RF-62 — serie de tiempo de una métrica, con la línea de objetivo si existe.
 *
 * **No sabe qué mide.** Recibe valores, instantes, una unidad y un objetivo
 * opcional; el mismo componente grafica un score de 0 a 100, módulos
 * completados o una nota por corte.
 *
 * El eje X es **temporal** (`type="number"` sobre milisegundos), no una lista
 * de categorías: dos lecturas separadas por un mes y dos separadas por un día
 * no deben verse a la misma distancia, o la pendiente de la curva mentiría
 * sobre la velocidad de avance.
 *
 * Una sola serie: no lleva leyenda, el título de la tarjeta la nombra. La
 * identidad de la línea de objetivo va en su etiqueta, no en un color.
 */

const chartConfig = {
  value: { label: 'Valor', color: 'var(--foreground)' },
} satisfies ChartConfig;

interface Point {
  /** Instante en milisegundos: la coordenada del eje temporal. */
  readonly t: number;
  readonly value: number;
}

export function MetricChart({
  name,
  unit,
  target,
  readings,
}: {
  name: string;
  unit: string | null;
  target: number | null;
  readings: readonly ReadingView[];
}) {
  const points: Point[] = readings.map((reading) => ({
    t: new Date(reading.recordedAtIso).getTime(),
    value: reading.value,
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-56 w-full"
      role="img"
      aria-label={`Evolución de ${name}${target === null ? '' : `, con objetivo ${formatValue(target, unit)}`}`}
    >
      <LineChart data={points} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          // Con una sola lectura el dominio colapsa a un punto; el relleno lo
          // deja visible en vez de pegado al borde.
          padding={{ left: 16, right: 16 }}
          tickFormatter={(t: number) => formatShortDate(new Date(t))}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          dataKey="value"
          width={48}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(value: number) => formatValue(value, null)}
        />
        <ChartTooltip
          cursor
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) => {
                const t = (payload?.[0]?.payload as Point | undefined)?.t;
                return t === undefined ? '' : formatDateTime(new Date(t));
              }}
              formatter={(value) => (
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {formatValue(Number(value), unit)}
                </span>
              )}
            />
          }
        />
        {target === null ? null : (
          <ReferenceLine
            y={target}
            // Sin esto, un objetivo fuera del rango de las lecturas —el caso
            // normal al empezar— quedaría fuera del dominio y no se dibujaría.
            ifOverflow="extendDomain"
            stroke="var(--muted-foreground)"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: `Objetivo ${formatValue(target, unit)}`,
              position: 'insideTopRight',
              fill: 'var(--muted-foreground)',
              fontSize: 11,
            }}
          />
        )}
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--color-value)', stroke: 'var(--background)', strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: 'var(--background)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
