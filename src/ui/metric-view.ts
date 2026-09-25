import type { MetricDirection } from '@/core/model/metric';
import type { ReadingTrend } from '@/core/services/metric-trend';
import { toZonedParts } from '@/core/services/timezone';

/**
 * Forma de las métricas tal como viajan del servidor al cliente (R5).
 *
 * Los instantes van como cadenas ISO en UTC: es lo que se almacena
 * (invariante 5) y no depende de la zona de nadie. La conversión a
 * `America/Bogota` ocurre solo al presentar (RF-00), con las funciones de
 * abajo, que dan el mismo texto en el servidor y en el navegador.
 */

export interface ReadingView {
  readonly id: string;
  readonly value: number;
  readonly recordedAtIso: string;
  readonly sessionId: string | null;
}

export interface MetricView {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly unit: string | null;
  readonly direction: MetricDirection;
  readonly target: number | null;
  /** En orden cronológico ascendente: el de la serie (RF-62). */
  readonly readings: readonly ReadingView[];
  /** RF-63 — calculado en el servidor por `compareLatestReadings`. */
  readonly trend: ReadingTrend;
}

/** Una sesión que se puede asociar a una lectura (RF-61). */
export interface SessionOptionView {
  readonly id: string;
  readonly programId: string;
  readonly label: string;
  readonly running: boolean;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** `DD/MM/AAAA` en hora de Colombia. */
export function formatDate(instant: Date): string {
  const { year, month, day } = toZonedParts(instant);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** `DD/MM` en hora de Colombia, para las marcas del eje. */
export function formatShortDate(instant: Date): string {
  const { month, day } = toZonedParts(instant);
  return `${pad(day)}/${pad(month)}`;
}

/** `DD/MM/AAAA HH:MM` en hora de Colombia. */
export function formatDateTime(instant: Date): string {
  const { hour, minute } = toZonedParts(instant);
  return `${formatDate(instant)} ${pad(hour)}:${pad(minute)}`;
}

/**
 * Número con la convención colombiana: coma decimal. Se fija la configuración
 * regional para que el servidor y el navegador escriban lo mismo; sin ella, la
 * hidratación compara textos distintos según el idioma del sistema.
 */
const NUMBER_FORMAT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 6 });

export function formatValue(value: number, unit: string | null): string {
  const text = NUMBER_FORMAT.format(value);
  return unit ? `${text} ${unit}` : text;
}

/** Diferencia con signo explícito: `+15`, `−3,5`. */
export function formatDelta(delta: number, unit: string | null): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${formatValue(Math.abs(delta), unit)}`;
}
