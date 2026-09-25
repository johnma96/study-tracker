/**
 * Aritmética de calendario sobre fechas civiles `AAAA-MM-DD` (R3).
 *
 * Las estadísticas de R3 —racha, cadencia semanal, mapa de calor— recorren
 * días, no instantes. Un día civil de Colombia no es "24 horas desde un
 * instante": es una etiqueta de calendario. Por eso aquí se opera sobre la
 * cadena, apoyándose en `Date.UTC` solo como calculadora de calendario, y
 * **nunca** en la zona del proceso. `new Date('2026-09-24')` más
 * `setDate(...)` depende de la zona del servidor y puede saltar un día.
 *
 * La conversión de un instante a su fecha civil de Colombia vive en
 * `timezone.ts` (RF-00). Este módulo empieza donde aquel termina: con la fecha
 * civil ya resuelta.
 */

const MS_PER_DAY = 86_400_000;

function toUtcMs(civilDate: string): number {
  const [year, month, day] = civilDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Fecha civil desplazada `days` días (negativo hacia atrás). */
export function addDays(civilDate: string, days: number): string {
  return fromUtcMs(toUtcMs(civilDate) + days * MS_PER_DAY);
}

/** Días de `from` a `to`. Positivo si `to` es posterior. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(civilDate: string): number {
  const weekday = new Date(toUtcMs(civilDate)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/**
 * Lunes de la semana a la que pertenece la fecha.
 *
 * La semana empieza el lunes, que es la convención del calendario en Colombia
 * y la de ISO-8601. Con semanas de domingo a sábado la sesión del domingo se
 * contaría en la semana siguiente de la que el usuario tiene en la cabeza.
 */
export function startOfWeek(civilDate: string): string {
  return addDays(civilDate, 1 - isoWeekday(civilDate));
}
