import type { MetricDirection, Reading } from '../model/metric';

/**
 * RF-62 y RF-63 — orden de las lecturas y comparación de la última con la
 * anterior.
 *
 * Vive en `core/` y no en un `ORDER BY` ni en el componente de la gráfica por la
 * misma razón que el orden de RF-13 (decisión 12 de docs/ARCHITECTURE.md): los
 * empates son donde se esconden los errores, y en SQL o en la interfaz no se
 * prueban sin base de datos ni navegador.
 */

/** Lo mínimo que hace falta para ordenar lecturas en el tiempo. */
export type OrderableReading = Pick<Reading, 'id' | 'recordedAt' | 'createdAt'>;

/** Lo mínimo que hace falta para comparar lecturas. */
export type ComparableReading = OrderableReading & Pick<Reading, 'value'>;

/**
 * Orden cronológico ascendente de las lecturas: es el de la serie de tiempo
 * (RF-62) y el que define cuál es "la última" (RF-63).
 *
 * Criterios, en este orden:
 *
 * 1. `recordedAt` — el momento de la lectura, que es lo que el usuario declara.
 * 2. `createdAt` — dos lecturas del mismo minuto: la registrada después es la
 *    última. Sin este criterio el orden lo decidiría el motor, y RF-63 diría
 *    "mejoró" o "empeoró" según el azar del plan de consulta.
 * 3. `id` — último recurso para que el orden sea total y estable. No tiene
 *    significado; solo evita que dos corridas den resultados distintos.
 *
 * No modifica la lista recibida.
 */
export function sortReadings<T extends OrderableReading>(readings: readonly T[]): T[] {
  return [...readings].sort(
    (a, b) =>
      a.recordedAt.getTime() - b.recordedAt.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** RF-63 — veredicto de la última lectura frente a la anterior. */
export type ReadingTrend =
  /** No hay lecturas: no hay nada que comparar. */
  | { readonly kind: 'no_readings' }
  /** Hay una sola lectura: no hay anterior contra la cual comparar. */
  | { readonly kind: 'first'; readonly latest: number }
  | {
      readonly kind: 'improved' | 'worsened' | 'unchanged';
      readonly latest: number;
      readonly previous: number;
      /** `latest − previous`, con su signo. La dirección no lo altera. */
      readonly delta: number;
    };

/**
 * RF-63 — ¿la última lectura mejoró o empeoró respecto a la anterior?
 *
 * "Mejorar" depende de la métrica, no del número: un score sube para mejorar y
 * un tiempo de respuesta baja. La dirección es un dato de la métrica (RF-60), así
 * que esta función no sabe —ni necesita saber— qué mide.
 *
 * El empate se decide comparando los valores, no el signo de `delta`: los
 * valores vienen tal cual de la base, mientras que la resta en coma flotante
 * puede dejar un residuo distinto de cero entre dos números iguales en decimal.
 */
export function compareLatestReadings(
  direction: MetricDirection,
  readings: readonly ComparableReading[],
): ReadingTrend {
  const ordered = sortReadings(readings);

  if (ordered.length === 0) return { kind: 'no_readings' };

  const latest = ordered[ordered.length - 1].value;

  if (ordered.length === 1) return { kind: 'first', latest };

  const previous = ordered[ordered.length - 2].value;
  const delta = latest - previous;

  if (latest === previous) return { kind: 'unchanged', latest, previous, delta: 0 };

  const wentUp = latest > previous;
  const improved = direction === 'up' ? wentUp : !wentUp;

  return { kind: improved ? 'improved' : 'worsened', latest, previous, delta };
}
