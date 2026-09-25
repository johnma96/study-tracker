import type { HeatLevel, Heatmap as HeatmapData } from '@/core/services/study-stats';
import { formatCivilDate, formatMinutes, pluralize } from '@/ui/stats-format';

/**
 * RF-33 — mapa de calor de calendario, en SVG propio.
 *
 * Sin librería, por decisión de docs/ARCHITECTURE.md: es una rejilla de
 * rectángulos y no necesita más. Se renderiza en el servidor, así que llega
 * completo en el HTML aunque el navegador no ejecute JavaScript.
 *
 * Escala secuencial de un solo tono, de claro a oscuro (a la inversa en modo
 * oscuro, donde más intensidad es más luz). Los niveles los decide el dominio
 * con umbrales fijos en minutos; aquí solo se pintan. Cada celda lleva su
 * `<title>` con fecha, minutos y sesiones, que el navegador muestra al pasar
 * el puntero y que leen los lectores de pantalla: el color nunca es el único
 * portador del dato.
 */

const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;
const LEFT = 18;
const TOP = 14;

/** Clases de relleno por nivel. El tono es el mismo; cambia la luminosidad. */
const LEVEL_CLASSES: Record<HeatLevel, string> = {
  0: 'fill-black/5 dark:fill-white/10',
  1: 'fill-emerald-200 dark:fill-emerald-900',
  2: 'fill-emerald-400 dark:fill-emerald-700',
  3: 'fill-emerald-600 dark:fill-emerald-500',
  4: 'fill-emerald-800 dark:fill-emerald-300',
};

const WEEKDAY_LABELS: Record<number, string> = { 0: 'L', 2: 'X', 4: 'V' };

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Etiqueta de mes sobre la primera columna cuyo lunes cae en un mes nuevo. */
function monthLabels(heatmap: HeatmapData): { index: number; label: string }[] {
  const labels: { index: number; label: string }[] = [];
  let previous = '';

  heatmap.weeks.forEach((week, index) => {
    const month = week[0].date.slice(5, 7);
    if (month !== previous) {
      labels.push({ index, label: MONTHS[Number(month) - 1] });
      previous = month;
    }
  });

  // La primera etiqueta se omite si la siguiente llega enseguida: se pisarían.
  return labels.length > 1 && labels[1].index - labels[0].index < 3 ? labels.slice(1) : labels;
}

function cellTitle(date: string, minutes: number, sessions: number): string {
  if (sessions === 0) return `${formatCivilDate(date)} · sin sesiones`;
  return `${formatCivilDate(date)} · ${formatMinutes(minutes)} · ${pluralize(sessions, 'sesión', 'sesiones')}`;
}

export function Heatmap({ heatmap }: { heatmap: HeatmapData }) {
  const width = LEFT + heatmap.weeks.length * STEP;
  const height = TOP + 7 * STEP;

  return (
    <figure className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={`Mapa de calor de minutos por día, del ${formatCivilDate(heatmap.firstDate)} al ${formatCivilDate(heatmap.lastDate)}`}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full max-w-xl"
      >
        {monthLabels(heatmap).map(({ index, label }) => (
          <text
            key={`${index}-${label}`}
            x={LEFT + index * STEP}
            y={TOP - 4}
            className="fill-current text-[8px] opacity-60"
          >
            {label}
          </text>
        ))}

        {Object.entries(WEEKDAY_LABELS).map(([row, label]) => (
          <text
            key={row}
            x={0}
            y={TOP + Number(row) * STEP + CELL - 2}
            className="fill-current text-[8px] opacity-60"
          >
            {label}
          </text>
        ))}

        {heatmap.weeks.map((week, column) =>
          week.map((cell, row) =>
            cell.future ? null : (
              <rect
                key={cell.date}
                x={LEFT + column * STEP}
                y={TOP + row * STEP}
                width={CELL}
                height={CELL}
                rx={2}
                className={LEVEL_CLASSES[cell.level]}
                data-date={cell.date}
                data-level={cell.level}
              >
                <title>{cellTitle(cell.date, cell.minutes, cell.sessions)}</title>
              </rect>
            ),
          ),
        )}
      </svg>

      <figcaption className="flex items-center gap-1 text-xs opacity-70">
        <span className="mr-1">Menos</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <svg key={level} width={CELL} height={CELL} aria-hidden="true">
            <rect width={CELL} height={CELL} rx={2} className={LEVEL_CLASSES[level]} />
          </svg>
        ))}
        <span className="ml-1">Más · menos de 30 min, 30, 60 y 120 min o más</span>
      </figcaption>
    </figure>
  );
}
