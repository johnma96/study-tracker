'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import type { WeekTotal } from '@/core/services/study-stats';
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/ui/primitives/chart';
import { formatCivilDate, formatMinutes, formatShortCivilDate, pluralize } from '@/ui/stats-format';

/**
 * RF-35 — minutos por semana de las últimas 8 semanas, en barras.
 *
 * Una sola serie y un solo eje: las sesiones por semana van en el tooltip y en
 * el texto de la tarjeta, no en un segundo eje con otra escala. El tono es el
 * mismo del mapa de calor para que la tarjeta se lea como un solo sistema.
 *
 * El color se declara como variable CSS sobre el contenedor con la variante
 * `dark:` de Tailwind, que en este proyecto responde a `prefers-color-scheme`
 * (decisión 24 de docs/ARCHITECTURE.md). El tema por clase `.dark` que trae la
 * primitiva de shadcn nunca se activaría.
 */

const chartConfig = {
  minutes: { label: 'Minutos', color: 'var(--cadence-bar)' },
} satisfies ChartConfig;

interface TooltipPayloadItem {
  readonly payload: WeekTotal;
}

function CadenceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;

  const week = payload[0].payload;

  return (
    <div className="grid gap-0.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="font-medium">Semana del {formatCivilDate(week.weekStart)}</span>
      <span>{formatMinutes(week.minutes)}</span>
      <span className="text-muted-foreground">{pluralize(week.sessions, 'sesión', 'sesiones')}</span>
    </div>
  );
}

export function CadenceChart({ weeks }: { weeks: readonly WeekTotal[] }) {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-44 w-full [--cadence-bar:var(--color-emerald-600)] dark:[--cadence-bar:var(--color-emerald-400)]"
    >
      <BarChart data={[...weeks]} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          tickFormatter={formatShortCivilDate}
        />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<CadenceTooltip />} />
        <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ChartContainer>
  );
}
