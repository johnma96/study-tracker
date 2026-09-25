import type { SessionTiming } from '../model/session';

import { addDays, daysBetween, startOfWeek } from './civil-calendar';
import { effectiveMinutes } from './session-duration';
import { toCivilDateInAppZone } from './timezone';

/**
 * R3 — totales, racha, cadencia, proyección y mapa de calor (RF-31 a RF-37).
 *
 * Todo se calcula aquí, en funciones puras que reciben una lista de sesiones y
 * devuelven valores. La interfaz solo presenta. Es la lógica donde viven los
 * errores reales —dónde cae la medianoche, qué cuenta como semana, qué pasa
 * con una sesión sin cerrar—, y por eso se prueba sin base de datos
 * (docs/ARCHITECTURE.md, sección Capas).
 *
 * **Tres reglas atraviesan el módulo:**
 *
 * 1. **El día de una sesión es la fecha de Colombia de su inicio** (RF-00,
 *    RF-32). Una sesión de 23:40 a 00:20 cuenta entera en el día en que
 *    empezó. Agrupar por la fecha UTC mueve al día siguiente toda sesión
 *    iniciada después de las 19:00 de Colombia: es el error silencioso más
 *    probable de todo el modelo (docs/DATA-MODEL.md, "Agrupación por día").
 * 2. **La duración es la efectiva de RF-24**, la de `session-duration.ts`:
 *    respeta `minutesOverride` y descuenta las pausas. No hay una segunda
 *    fórmula de duración en el sistema.
 * 3. **Una sesión en curso no entra en las estadísticas.** Su duración es
 *    `null` —"todavía no se sabe"—, y contarla como cero bajaría la media y
 *    sumaría un día con cero minutos. Entra en cuanto se cierra.
 *
 * Nada aquí sabe qué programa es: los mismos cálculos sirven para un curso,
 * una certificación o un diplomado (CLAUDE.md, "no acoples nada al primer
 * programa").
 */

/** Minutos y sesiones de un día civil de Colombia. */
export interface DayTotal {
  /** Fecha civil `AAAA-MM-DD` en `America/Bogota`. */
  readonly date: string;
  readonly minutes: number;
  readonly sessions: number;
}

/** RF-31 — totales de un programa. */
export interface StudySummary {
  readonly sessionCount: number;
  /** RF-32 — días distintos con al menos una sesión cerrada. */
  readonly daysWorked: number;
  readonly totalMinutes: number;
  /** Media por sesión, sin redondear: redondear es cosa de la presentación. */
  readonly averageMinutes: number;
}

/** RF-34 — racha de días consecutivos con al menos una sesión. */
export interface Streak {
  readonly days: number;
  /**
   * ¿Hoy ya tiene sesión? Si no, la racha se cuenta hasta ayer: el día de hoy
   * todavía no terminó, así que no la ha roto. La interfaz lo dice para que el
   * número no parezca más de lo que es.
   */
  readonly includesToday: boolean;
}

/** RF-35 — una semana de la cadencia, de lunes a domingo. */
export interface WeekTotal {
  /** Lunes de la semana, `AAAA-MM-DD`. */
  readonly weekStart: string;
  readonly sessions: number;
  readonly minutes: number;
}

/** RF-35 — cadencia de las últimas semanas. */
export interface Cadence {
  /** De la más antigua a la actual, con las semanas vacías en cero. */
  readonly weeks: readonly WeekTotal[];
  readonly sessionsPerWeek: number;
  readonly minutesPerWeek: number;
}

/** RF-36 — proyección de la fecha de finalización. */
export type Projection =
  /** Ya se registraron tantas sesiones como las planeadas, o más. */
  | { readonly kind: 'completed'; readonly completedSessions: number }
  /** Sin sesiones en la ventana no hay ritmo del que proyectar. */
  | { readonly kind: 'no_pace'; readonly remainingSessions: number }
  | {
      readonly kind: 'projected';
      readonly remainingSessions: number;
      readonly sessionsPerWeek: number;
      /** Fecha civil estimada de la última sesión planeada. */
      readonly estimatedDate: string;
    };

/** RF-33 — una celda del mapa de calor. */
export interface HeatmapCell {
  readonly date: string;
  readonly minutes: number;
  readonly sessions: number;
  /** 0 = nada; 1 a 4 = intensidad creciente. */
  readonly level: HeatLevel;
  /** Días de la semana en curso que todavía no llegan. */
  readonly future: boolean;
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** RF-33 — el mapa de calor: una columna por semana, siete filas (lunes a domingo). */
export interface Heatmap {
  readonly weeks: readonly (readonly HeatmapCell[])[];
  readonly firstDate: string;
  readonly lastDate: string;
}

/** Todo lo que la interfaz necesita de un programa. */
export type ProgramStats =
  /**
   * RF-37 — sin sesiones cerradas no hay tablero que mostrar. Se modela como
   * un caso propio, no como un resumen en ceros, para que ninguna vista pueda
   * pintar "0 días · 0 h" por descuido.
   */
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'ready';
      readonly summary: StudySummary;
      readonly streak: Streak;
      readonly cadence: Cadence;
      readonly heatmap: Heatmap;
      /** `null` si el programa no tiene sesiones planeadas (RF-36 es opcional). */
      readonly projection: Projection | null;
    };

/** RF-35 — cuántas semanas mide la cadencia. */
export const CADENCE_WEEKS = 8;

/** RF-36 — la proyección usa el ritmo de las últimas cuatro semanas. */
export const PROJECTION_WINDOW_WEEKS = 4;

/** RF-33 — semanas que muestra el mapa de calor (unos seis meses). */
export const HEATMAP_WEEKS = 26;

/**
 * RF-33 — umbrales de intensidad, en minutos por día.
 *
 * Son fijos, no relativos al máximo: con una escala relativa, un día de dos
 * horas se vería "flojo" solo porque otro día hubo cinco, y el color de un día
 * pasado cambiaría con el tiempo. Una hora es una hora en cualquier programa.
 */
export const HEAT_THRESHOLDS_MINUTES = [1, 30, 60, 120] as const;

/** Duración efectiva de las sesiones ya cerradas. Las que siguen en curso se omiten. */
function closedMinutes(sessions: readonly SessionTiming[]): { date: string; minutes: number }[] {
  const result: { date: string; minutes: number }[] = [];

  for (const session of sessions) {
    const minutes = effectiveMinutes(session);
    if (minutes === null) continue;

    // RF-00, RF-32 — el día es el de Colombia y el del **inicio**.
    result.push({ date: toCivilDateInAppZone(session.startedAt), minutes });
  }

  return result;
}

/**
 * RF-32 — minutos y sesiones por día civil de Colombia, ordenados por fecha
 * ascendente.
 */
export function dailyTotals(sessions: readonly SessionTiming[]): DayTotal[] {
  const byDate = new Map<string, { minutes: number; sessions: number }>();

  for (const { date, minutes } of closedMinutes(sessions)) {
    const current = byDate.get(date) ?? { minutes: 0, sessions: 0 };
    byDate.set(date, { minutes: current.minutes + minutes, sessions: current.sessions + 1 });
  }

  return [...byDate.entries()]
    .map(([date, total]) => ({ date, ...total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** RF-31 — totales. `null` si no hay ninguna sesión cerrada (RF-37). */
export function summarize(sessions: readonly SessionTiming[]): StudySummary | null {
  const days = dailyTotals(sessions);
  const sessionCount = days.reduce((sum, day) => sum + day.sessions, 0);

  if (sessionCount === 0) return null;

  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);

  return {
    sessionCount,
    daysWorked: days.length,
    totalMinutes,
    averageMinutes: totalMinutes / sessionCount,
  };
}

/**
 * RF-34 — racha actual: días consecutivos, hasta hoy, con al menos una sesión.
 *
 * Si hoy todavía no hay sesión, la racha se cuenta desde ayer en vez de caer a
 * cero: a las 7:00 no se ha roto nada todavía. Se rompe cuando pasa un día
 * entero sin sesión. `today` es la fecha civil de Colombia.
 */
export function currentStreak(days: readonly DayTotal[], today: string): Streak {
  const worked = new Set(days.filter((day) => day.sessions > 0).map((day) => day.date));
  const includesToday = worked.has(today);

  let cursor = includesToday ? today : addDays(today, -1);
  let count = 0;

  while (worked.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }

  return { days: count, includesToday };
}

/**
 * RF-35 — sesiones y minutos por semana de las últimas `weeks` semanas.
 *
 * Semanas de calendario, de lunes a domingo, terminando en la semana en curso
 * (que va incompleta). Las semanas sin sesiones aparecen en cero: una semana
 * vacía es justo el dato que la cadencia existe para mostrar.
 */
export function weeklyCadence(
  days: readonly DayTotal[],
  today: string,
  weeks: number = CADENCE_WEEKS,
): Cadence {
  const currentWeek = startOfWeek(today);
  const series: { weekStart: string; sessions: number; minutes: number }[] = [];

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    series.push({ weekStart: addDays(currentWeek, -7 * offset), sessions: 0, minutes: 0 });
  }

  const firstWeek = series[0].weekStart;

  for (const day of days) {
    // Las sesiones con fecha posterior a hoy no deberían existir; si existen
    // —un registro manual con la fecha mal puesta— no inflan la semana actual.
    if (day.date < firstWeek || day.date > today) continue;

    const index = daysBetween(firstWeek, startOfWeek(day.date)) / 7;
    series[index].sessions += day.sessions;
    series[index].minutes += day.minutes;
  }

  const totalSessions = series.reduce((sum, week) => sum + week.sessions, 0);
  const totalMinutes = series.reduce((sum, week) => sum + week.minutes, 0);

  return {
    weeks: series,
    sessionsPerWeek: totalSessions / weeks,
    minutesPerWeek: totalMinutes / weeks,
  };
}

/**
 * RF-36 — fecha estimada de finalización.
 *
 * El ritmo es el de las últimas cuatro semanas **corridas** —los 28 días que
 * terminan hoy—, no el de cuatro semanas de calendario: con semanas de
 * calendario, un lunes por la mañana la semana actual valdría cero y hundiría
 * el ritmo sin que nada haya cambiado.
 *
 * `fecha = hoy + ceil(sesionesRestantes / sesionesPorSemana × 7)` días.
 */
export function projectCompletion(
  days: readonly DayTotal[],
  plannedSessions: number,
  today: string,
): Projection {
  const completedSessions = days.reduce((sum, day) => sum + day.sessions, 0);
  const remainingSessions = plannedSessions - completedSessions;

  if (remainingSessions <= 0) return { kind: 'completed', completedSessions };

  const windowStart = addDays(today, -(PROJECTION_WINDOW_WEEKS * 7 - 1));
  const sessionsInWindow = days
    .filter((day) => day.date >= windowStart && day.date <= today)
    .reduce((sum, day) => sum + day.sessions, 0);

  if (sessionsInWindow === 0) return { kind: 'no_pace', remainingSessions };

  const sessionsPerWeek = sessionsInWindow / PROJECTION_WINDOW_WEEKS;
  const daysNeeded = Math.ceil((remainingSessions / sessionsPerWeek) * 7);

  return {
    kind: 'projected',
    remainingSessions,
    sessionsPerWeek,
    estimatedDate: addDays(today, daysNeeded),
  };
}

/** RF-33 — nivel de intensidad de un día. */
export function heatLevel(minutes: number, sessions: number): HeatLevel {
  if (sessions === 0) return 0;

  // Un día con sesión nunca se pinta como vacío, aunque la sesión haya durado
  // menos de un minuto: el día sí se trabajó y cuenta en RF-32.
  let level: HeatLevel = 1;
  for (let index = 1; index < HEAT_THRESHOLDS_MINUTES.length; index += 1) {
    if (minutes >= HEAT_THRESHOLDS_MINUTES[index]) level = (index + 1) as HeatLevel;
  }

  return level;
}

/**
 * RF-33 — mapa de calor de calendario: `weeks` columnas de lunes a domingo,
 * terminando en la semana de hoy. Los días posteriores a hoy van marcados como
 * `future` para que la interfaz no los pinte como días sin trabajo.
 */
export function buildHeatmap(
  days: readonly DayTotal[],
  today: string,
  weeks: number = HEATMAP_WEEKS,
): Heatmap {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const firstDate = addDays(startOfWeek(today), -7 * (weeks - 1));
  const columns: HeatmapCell[][] = [];

  for (let week = 0; week < weeks; week += 1) {
    const column: HeatmapCell[] = [];

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addDays(firstDate, week * 7 + weekday);
      const day = byDate.get(date);
      const minutes = day?.minutes ?? 0;
      const sessions = day?.sessions ?? 0;

      column.push({
        date,
        minutes,
        sessions,
        level: heatLevel(minutes, sessions),
        future: date > today,
      });
    }

    columns.push(column);
  }

  return { weeks: columns, firstDate, lastDate: addDays(firstDate, weeks * 7 - 1) };
}

/**
 * Todas las estadísticas de un programa, a partir de sus sesiones.
 *
 * `today` es la fecha civil de Colombia de "ahora" según el reloj de la base
 * (decisión 16 de docs/ARCHITECTURE.md): quien llama la obtiene con
 * `toCivilDateInAppZone(now)`. Recibirla como argumento es lo que permite
 * probar la racha y la cadencia con un "hoy" fijo.
 */
export function buildProgramStats(
  sessions: readonly SessionTiming[],
  options: { readonly today: string; readonly plannedSessions: number | null },
): ProgramStats {
  const days = dailyTotals(sessions);
  const summary = summarize(sessions);

  if (summary === null) return { kind: 'empty' };

  const { today, plannedSessions } = options;

  return {
    kind: 'ready',
    summary,
    streak: currentStreak(days, today),
    cadence: weeklyCadence(days, today),
    heatmap: buildHeatmap(days, today),
    projection:
      plannedSessions !== null && plannedSessions > 0
        ? projectCompletion(days, plannedSessions, today)
        : null,
  };
}
