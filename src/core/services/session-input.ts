import { z } from 'zod';

import type { ManualSessionInput, StartSessionInput, StopSessionInput } from '../model/session';

import { isCivilDate } from './civil-date';
import { charLength } from './text';
import { appZoneDateTimeToInstant, isCivilTime } from './timezone';

/**
 * RF-44 — validación de entrada del servidor para el cronómetro.
 *
 * Mismo criterio que `program-input.ts`: el esquema vive en `core/` y la Server
 * Action es solo el adaptador de `FormData`. Así estas reglas se prueban sin
 * levantar Next ni base de datos.
 *
 * Las cotas superiores (`MINUTES_MAX`, `STUCK_MINUTES_MAX`, `NOTE_MAX_LENGTH`)
 * las fija esta implementación; el DDL de docs/DATA-MODEL.md solo exige
 * positividad. La aplicación puede ser **más** estricta que el motor sin riesgo:
 * el defecto peligroso es el contrario —que la aplicación acepte lo que la base
 * rechaza—, y ninguna de estas cotas relaja un CHECK.
 */

export const MINUTES_MAX = 24 * 60;
export const STUCK_MINUTES_MAX = 24 * 60;
export const NOTE_MAX_LENGTH = 2000;

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fieldErrors: Record<string, string> };

/** Entrada cruda: lo que llega de un formulario, todo cadenas. */
export type RawInput = Record<string, string>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidField = (message: string) =>
  z.string().refine((value) => UUID_PATTERN.test(value), { message });

/** RF-28 — el tipo de sesión es opcional: en blanco equivale a "sin tipo". */
const optionalUuidField = (message: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === '' || UUID_PATTERN.test(value), { message })
    .transform((value) => (value === '' ? null : value));

/** RF-28 — nota libre. En blanco equivale a ausente (columna nula). */
const noteField = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => charLength(value) <= NOTE_MAX_LENGTH, {
    message: `La nota no puede superar ${NOTE_MAX_LENGTH} caracteres.`,
  })
  .transform((value) => (value === '' ? null : value));

/**
 * Entero no negativo con tope. En blanco vale 0.
 *
 * `Number('')` es 0 y `Number(' ')` también, así que la cadena vacía se decide
 * antes de convertir y el resto pasa por una comprobación de forma. Sin ella,
 * `" 5 "` y `"5abc"` darían resultados sorprendentes.
 */
const nonNegativeIntegerField = (max: number, label: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .superRefine((value, ctx) => {
      if (value === '') return;

      if (!/^\d+$/.test(value)) {
        ctx.addIssue({ code: 'custom', message: `${label} debe ser un número entero.` });
        return;
      }

      if (Number(value) > max) {
        ctx.addIssue({ code: 'custom', message: `${label} no puede superar ${max}.` });
      }
    })
    .transform((value) => (value === '' ? 0 : Number(value)));

/**
 * RF-2H, invariante 3 — `minutes_override` es opcional y, cuando existe, es
 * estrictamente mayor que cero. En blanco significa "calcula tú", no "cero".
 */
const optionalPositiveMinutesField = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (value === '') return;

    if (!/^\d+$/.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'La duración debe ser un número entero de minutos.',
      });
      return;
    }

    const minutes = Number(value);

    if (minutes < 1) {
      ctx.addIssue({ code: 'custom', message: 'La duración debe ser de al menos un minuto.' });
      return;
    }

    if (minutes > MINUTES_MAX) {
      ctx.addIssue({
        code: 'custom',
        message: `La duración no puede superar ${MINUTES_MAX} minutos.`,
      });
    }
  })
  .transform((value) => (value === '' ? null : Number(value)));

/** RF-26 — duración obligatoria de la sesión manual. */
const requiredPositiveMinutesField = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (!/^\d+$/.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'Indica la duración en minutos.' });
      return;
    }

    const minutes = Number(value);

    if (minutes < 1) {
      ctx.addIssue({ code: 'custom', message: 'La duración debe ser de al menos un minuto.' });
      return;
    }

    if (minutes > MINUTES_MAX) {
      ctx.addIssue({
        code: 'custom',
        message: `La duración no puede superar ${MINUTES_MAX} minutos.`,
      });
    }
  })
  .transform((value) => Number(value));

/** RF-00, RF-26 — fecha y hora civiles de Colombia. */
const civilDateField = z.string().refine((value) => isCivilDate(value.trim()), {
  message: 'Usa una fecha real con formato AAAA-MM-DD.',
});

const civilTimeField = z.string().refine((value) => isCivilTime(value.trim()), {
  message: 'Usa una hora real con formato HH:MM.',
});

/** Una casilla de formulario: cualquier valor no vacío significa marcada. */
const checkboxField = z.string().transform((value) => value.trim() !== '');

const startSessionSchema = z.object({
  programId: uuidField('Programa no válido.'),
  sessionTypeId: optionalUuidField('Tipo de sesión no válido.'),
});

const stopSessionSchema = z.object({
  sessionId: uuidField('Sesión no válida.'),
  minutesOverride: optionalPositiveMinutesField,
  note: noteField,
  stuckMinutes: nonNegativeIntegerField(STUCK_MINUTES_MAX, 'Los minutos de atasco'),
  sessionTypeId: optionalUuidField('Tipo de sesión no válido.'),
  confirmed: checkboxField,
});

const manualSessionSchema = z
  .object({
    programId: uuidField('Programa no válido.'),
    sessionTypeId: optionalUuidField('Tipo de sesión no válido.'),
    startedOn: civilDateField,
    startedAtTime: civilTimeField,
    minutes: requiredPositiveMinutesField,
    note: noteField,
    stuckMinutes: nonNegativeIntegerField(STUCK_MINUTES_MAX, 'Los minutos de atasco'),
  })
  .transform((value) => ({
    programId: value.programId,
    sessionTypeId: value.sessionTypeId,
    // RF-00 — lo que el usuario escribe es hora de Colombia; lo que se almacena
    // es el instante UTC equivalente.
    startedAt: appZoneDateTimeToInstant(value.startedOn.trim(), value.startedAtTime.trim()),
    minutes: value.minutes,
    note: value.note,
    stuckMinutes: value.stuckMinutes,
  }));

const sessionIdSchema = z.object({ sessionId: uuidField('Sesión no válida.') });

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
function text(raw: RawInput, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value : '';
}

function pick(raw: RawInput, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, text(raw, key)]));
}

/** RF-20 — entrada de inicio de sesión. */
export function parseStartSession(raw: RawInput): ParseResult<StartSessionInput> {
  const parsed = startSessionSchema.safeParse(pick(raw, ['programId', 'sessionTypeId']));

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: toFieldErrors(parsed.error.issues) };
}

/** RF-23, RF-25, RF-28 — entrada de cierre de sesión. */
export function parseStopSession(raw: RawInput): ParseResult<StopSessionInput> {
  const parsed = stopSessionSchema.safeParse(
    pick(raw, [
      'sessionId',
      'minutesOverride',
      'note',
      'stuckMinutes',
      'sessionTypeId',
      'confirmed',
    ]),
  );

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: toFieldErrors(parsed.error.issues) };
}

/** RF-26 — entrada de registro manual. */
export function parseManualSession(raw: RawInput): ParseResult<ManualSessionInput> {
  const parsed = manualSessionSchema.safeParse(
    pick(raw, [
      'programId',
      'sessionTypeId',
      'startedOn',
      'startedAtTime',
      'minutes',
      'note',
      'stuckMinutes',
    ]),
  );

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: toFieldErrors(parsed.error.issues) };
}

/** RF-27, RF-2A, RF-2C — acciones que solo necesitan identificar la sesión. */
export function parseSessionId(raw: RawInput): ParseResult<{ sessionId: string }> {
  const parsed = sessionIdSchema.safeParse(pick(raw, ['sessionId']));

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: toFieldErrors(parsed.error.issues) };
}
