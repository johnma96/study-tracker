import { z } from 'zod';

import { METRIC_DIRECTIONS, type MetricDirection, type NewMetric, type NewReading } from '../model/metric';

import { isCivilDate } from './civil-date';
import { charLength } from './text';
import { appZoneDateTimeToInstant, isCivilTime } from './timezone';

/**
 * RF-44 — validación de entrada del servidor para métricas (RF-60) y lecturas
 * (RF-61).
 *
 * Mismo criterio que `program-input.ts` y `session-input.ts`: el esquema vive
 * en `core/` y la Server Action es solo el adaptador de `FormData`, así que
 * estas reglas se prueban sin levantar Next ni base de datos.
 *
 * Las cotas de longitud las fija esta implementación —RF-60 no da ninguna— y
 * coinciden con los CHECK `metrics_name_length` y `metrics_unit_length` del
 * esquema. La cota de los valores numéricos no tiene CHECK: la aplicación puede
 * ser más estricta que el motor sin riesgo (decisión 17 de
 * docs/ARCHITECTURE.md), y lo que protege es la precisión, no la base.
 */

export const METRIC_NAME_MAX_LENGTH = 80;
export const METRIC_UNIT_MAX_LENGTH = 24;

/**
 * Dígitos admitidos en un valor: hasta 9 enteros y 6 decimales.
 *
 * `numeric` de Postgres guarda cualquier precisión, pero el valor viaja como
 * `number` de JavaScript, que conserva unas 15 cifras significativas. Aceptar
 * más dejaría guardar un número que se lee de vuelta distinto, y la
 * comparación de RF-63 trabajaría sobre un valor que el usuario no escribió.
 */
const DECIMAL_PATTERN = /^[+-]?\d{1,9}(?:[.,]\d{1,6})?$/;

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fieldErrors: Record<string, string> };

/** Entrada cruda: lo que llega de un formulario, todo cadenas. */
export type RawInput = Record<string, string>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidField = (message: string) =>
  z.string().refine((value) => UUID_PATTERN.test(value.trim()), { message }).transform((value) => value.trim());

/** RF-61 — la sesión asociada es opcional: en blanco equivale a "sin sesión". */
const optionalUuidField = (message: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === '' || UUID_PATTERN.test(value), { message })
    .transform((value) => (value === '' ? null : value));

/**
 * Convierte el texto de un número decimal.
 *
 * Se acepta la coma como separador decimal porque es la convención en
 * Colombia: `80,5` y `80.5` son el mismo valor. Lo que **no** se acepta es un
 * separador de miles —`1.000` sería ambiguo con un decimal— ni notación
 * científica, ni espacios intermedios.
 */
export function parseDecimal(raw: string): number | null {
  const value = raw.trim();
  if (!DECIMAL_PATTERN.test(value)) return null;

  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

const DECIMAL_MESSAGE = 'Usa un número, con hasta 9 cifras enteras y 6 decimales (80 u 80,5).';

/** RF-61 — valor obligatorio de la lectura. */
const requiredDecimalField = z
  .string()
  .superRefine((value, ctx) => {
    if (value.trim() === '') {
      ctx.addIssue({ code: 'custom', message: 'El valor de la lectura es obligatorio.' });
      return;
    }

    if (parseDecimal(value) === null) ctx.addIssue({ code: 'custom', message: DECIMAL_MESSAGE });
  })
  .transform((value) => parseDecimal(value) as number);

/** RF-60 — objetivo opcional: en blanco significa "sin objetivo", no cero. */
const optionalDecimalField = z
  .string()
  .superRefine((value, ctx) => {
    if (value.trim() === '') return;
    if (parseDecimal(value) === null) ctx.addIssue({ code: 'custom', message: DECIMAL_MESSAGE });
  })
  .transform((value) => (value.trim() === '' ? null : parseDecimal(value)));

/** RF-60 — nombre obligatorio de la métrica. */
const metricNameField = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (charLength(value) < 1) {
      ctx.addIssue({ code: 'custom', message: 'El nombre de la métrica es obligatorio.' });
      return;
    }

    if (charLength(value) > METRIC_NAME_MAX_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        message: `El nombre no puede superar ${METRIC_NAME_MAX_LENGTH} caracteres.`,
      });
    }
  });

/**
 * RF-60 — unidad opcional y de texto libre: "puntos", "módulos", "nota". No es
 * una lista cerrada: el segundo programa trae unidades que el primero no tenía.
 */
const metricUnitField = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => charLength(value) <= METRIC_UNIT_MAX_LENGTH, {
    message: `La unidad no puede superar ${METRIC_UNIT_MAX_LENGTH} caracteres.`,
  })
  .transform((value) => (value === '' ? null : value));

/** RF-60 — los valores admitidos salen de la constante del modelo. */
const metricDirectionField = z
  .string()
  .refine((value) => (METRIC_DIRECTIONS as readonly string[]).includes(value), {
    message: 'Dirección de mejora no válida.',
  })
  .transform((value) => value as MetricDirection);

const newMetricSchema = z.object({
  programId: uuidField('Programa no válido.'),
  name: metricNameField,
  unit: metricUnitField,
  direction: metricDirectionField,
  target: optionalDecimalField,
});

/** RF-00, RF-61 — fecha y hora civiles de Colombia. */
const civilDateField = z.string().refine((value) => isCivilDate(value.trim()), {
  message: 'Usa una fecha real con formato AAAA-MM-DD.',
});

const civilTimeField = z.string().refine((value) => isCivilTime(value.trim()), {
  message: 'Usa una hora real con formato HH:MM.',
});

const newReadingSchema = z
  .object({
    metricId: uuidField('Métrica no válida.'),
    sessionId: optionalUuidField('Sesión no válida.'),
    value: requiredDecimalField,
    recordedOn: civilDateField,
    recordedAtTime: civilTimeField,
  })
  .transform((value) => ({
    metricId: value.metricId,
    sessionId: value.sessionId,
    value: value.value,
    // RF-00 — lo que el usuario escribe es hora de Colombia; lo que se almacena
    // es el instante UTC equivalente.
    recordedAt: appZoneDateTimeToInstant(value.recordedOn.trim(), value.recordedAtTime.trim()),
  }));

/** Primer motivo por campo, en el orden en que zod los reporta. */
function toFieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }

  return errors;
}

/**
 * Un campo ausente se trata como cadena vacía, no como error de forma: un
 * cliente hostil puede omitir cualquier campo y debe ver el mismo mensaje que
 * quien lo dejó en blanco.
 */
function pick(raw: RawInput, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    keys.map((key) => [key, typeof raw[key] === 'string' ? raw[key] : '']),
  );
}

/** RF-60 — valida y normaliza la entrada de creación de métrica. */
export function parseNewMetric(raw: RawInput): ParseResult<NewMetric> {
  const parsed = newMetricSchema.safeParse(
    pick(raw, ['programId', 'name', 'unit', 'direction', 'target']),
  );

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: toFieldErrors(parsed.error.issues) };
}

/** RF-61 — valida y normaliza la entrada de registro de lectura. */
export function parseNewReading(raw: RawInput): ParseResult<NewReading> {
  const parsed = newReadingSchema.safeParse(
    pick(raw, ['metricId', 'sessionId', 'value', 'recordedOn', 'recordedAtTime']),
  );

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: toFieldErrors(parsed.error.issues) };
}
