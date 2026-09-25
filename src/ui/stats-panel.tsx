import type { SessionListItem } from '@/core/services/session-listing';
import type { ProgramStats, Projection, Streak } from '@/core/services/study-stats';
import { CadenceChart } from '@/ui/cadence-chart';
import { Heatmap } from '@/ui/heatmap';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/primitives/card';
import { SessionList } from '@/ui/session-list';
import {
  formatCivilDate,
  formatDecimal,
  formatHours,
  formatMinutes,
  pluralize,
} from '@/ui/stats-format';

/**
 * R3 — tablero de un programa: totales, racha, proyección, mapa de calor,
 * cadencia y listado (RF-30 a RF-37).
 *
 * Presentación pura. Todos los números llegan calculados por
 * `core/services/study-stats.ts`; aquí no se suma ni se agrupa nada. La capa
 * `ui/` no accede a datos (docs/ARCHITECTURE.md): quien lee es
 * `app/stats-section.tsx`.
 */

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/15">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

function streakHint(streak: Streak): string | undefined {
  if (streak.days === 0) return 'sin sesión ayer ni hoy';
  return streak.includesToday ? 'incluye hoy' : 'hasta ayer; hoy aún no registras';
}

/** RF-36 — la frase de proyección, según el caso que decidió el dominio. */
function projectionText(projection: Projection): string {
  switch (projection.kind) {
    case 'completed':
      return `Ya registraste ${pluralize(projection.completedSessions, 'sesión', 'sesiones')}: las planeadas están cumplidas.`;
    case 'no_pace':
      return `Faltan ${pluralize(projection.remainingSessions, 'sesión', 'sesiones')}, pero no hubo ninguna en las últimas 4 semanas: no hay ritmo del que proyectar.`;
    case 'projected':
      return `Faltan ${pluralize(projection.remainingSessions, 'sesión', 'sesiones')}. Al ritmo de las últimas 4 semanas (${formatDecimal(projection.sessionsPerWeek)} por semana), terminarías hacia el ${formatCivilDate(projection.estimatedDate)}.`;
  }
}

export function StatsPanel({
  title,
  stats,
  sessions,
  typeLabels,
}: {
  /** R8 — el contexto: el nombre del programa elegido, o «Todos los programas». */
  title: string;
  stats: ProgramStats;
  sessions: readonly SessionListItem[];
  typeLabels: ReadonlyMap<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {stats.kind === 'empty' ? (
          <CardDescription>
            Todavía no hay sesiones cerradas aquí. Cuando detengas la primera —o registres una
            a mano— aparecerán los días trabajados, las horas, la racha, el mapa de calor y la
            cadencia semanal.
          </CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {stats.kind === 'ready' ? (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label="Días trabajados" value={formatDecimal(stats.summary.daysWorked)} />
              <Tile label="Horas totales" value={formatHours(stats.summary.totalMinutes)} />
              <Tile label="Sesiones" value={formatDecimal(stats.summary.sessionCount)} />
              <Tile
                label="Media por sesión"
                value={formatMinutes(stats.summary.averageMinutes)}
              />
              <Tile
                label="Racha actual"
                value={pluralize(stats.streak.days, 'día', 'días')}
                hint={streakHint(stats.streak)}
              />
            </dl>

            {stats.projection ? (
              <p className="text-sm">
                <span className="font-medium">Proyección. </span>
                {projectionText(stats.projection)}
              </p>
            ) : null}

            <section className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">Mapa de calor</h4>
              <Heatmap heatmap={stats.heatmap} />
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">Cadencia de las últimas 8 semanas</h4>
              <p className="text-sm text-muted-foreground">
                {formatDecimal(stats.cadence.sessionsPerWeek)} sesiones y{' '}
                {formatMinutes(stats.cadence.minutesPerWeek)} por semana, en promedio.
              </p>
              <CadenceChart weeks={stats.cadence.weeks} />
            </section>
          </>
        ) : null}

        {sessions.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h4 className="text-sm font-medium">Sesiones</h4>
            <SessionList items={sessions} typeLabels={typeLabels} />
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
