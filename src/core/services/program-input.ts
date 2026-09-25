import { z } from 'zod';

import { safeExternalHref } from './artifact-target';

import {
  PROGRAM_KINDS,
  PROGRAM_STATUSES,
  type NewProgram,
  type ProgramKind,
  type ProgramStatus,
} from '../model/program';
import type { NewSessionType } from '../model/session-type';

import { isCivilDate } from './civil-date';
import { validateProgramName } from './program-name';
import { validateSessionType } from './session-type';

/**
 * RF-44 — validación de entrada del servidor.
 *
 * Vive en `core/` y no en la Server Action por la razón que da
 * docs/ARCHITECTURE.md para toda la separación por capas: poder probarla sin
 * levantar Next ni base de datos. La Server Action queda como adaptador —
 * convierte `FormData` en un objeto de cadenas y llama aquí—, que es lo que
 * exige la regla "app/ sin lógica de negocio".
 *
 * `zod` no rompe la regla de capas: `core/` no puede importar React, Next,
 * Drizzle ni la base de datos, y `zod` no es ninguna de esas cosas.
 *
 * **La del formulario es conveniencia; esta es el control.** Se salta con
 * `curl`, con JavaScript desactivado o desde el inspector del navegador.
 */

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fieldErrors: Record<string, string> };

/** Entrada cruda: lo que llega de un formulario, todo cadenas. */
export type RawInput = Record<string, string>;

/**
 * RF-14 — el nombre. La regla no se reescribe aquí: se delega en
 * `validateProgramName`, que es su única definición.
 *
 * Se evalúa dos veces —una para decidir y otra para obtener el valor
 * normalizado— porque `transform` solo corre si la validación pasó.
 */
const programNameField = z
  .string()
  .superRefine((value, ctx) => {
    const check = validateProgramName(value);
    if (!check.ok) ctx.addIssue({ code: 'custom', message: check.message });
  })
  .transform((value) => {
    const check = validateProgramName(value);
    return check.ok ? check.name : value;
  });

/** Texto opcional: en blanco equivale a ausente (columna nula). */
const optionalTextField = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === '' ? null : value));

/** Fecha civil opcional. RF-10 no obliga a informarlas. */
const optionalCivilDateField = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === '' || isCivilDate(value), {
    message: 'Usa una fecha real con formato AAAA-MM-DD.',
  })
  .transform((value) => (value === '' ? null : value));

/**
 * RF-11 y RF-12 — los valores admitidos salen de las constantes del modelo, no
 * de una lista repetida. Agregar un tipo de programa es un cambio en un solo
 * lugar.
 */
const programKindField = z
  .string()
  .refine((value) => (PROGRAM_KINDS as readonly string[]).includes(value), {
    message: 'Tipo de programa no válido.',
  })
  .transform((value) => value as ProgramKind);

const programStatusField = z
  .string()
  .refine((value) => (PROGRAM_STATUSES as readonly string[]).includes(value), {
    message: 'Estado de programa no válido.',
  })
  .transform((value) => value as ProgramStatus);

/** RF-10 — campos exactos que enumera el requerimiento. */
/**
 * R7 — URL base del repositorio del programa, opcional.
 *
 * Reutiliza `safeExternalHref` en vez de una regla propia: es la misma lista
 * blanca `http`/`https` que ya gobierna los destinos de artefactos, y esta URL
 * termina exactamente en el mismo sitio, dentro de un `href`. Una segunda
 * definición de "URL aceptable" en este archivo se desincronizaría con la otra.
 *
 * Se guarda la forma normalizada que devuelve `URL`, no lo que escribió el
 * usuario, para que lo almacenado sea lo que se presenta.
 */
const optionalRepoUrlField = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (value === '' || safeExternalHref(value) !== null) return;

    ctx.addIssue({
      code: 'custom',
      message: 'La URL del repositorio debe empezar por http:// o https:// y no llevar clave.',
    });
  })
  .transform((value) => (value === '' ? null : safeExternalHref(value)));

const newProgramSchema = z.object({
  name: programNameField,
  provider: optionalTextField,
  kind: programKindField,
  status: programStatusField,
  startedAt: optionalCivilDateField,
  targetAt: optionalCivilDateField,
  repoUrl: optionalRepoUrlField,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RF-15 — código corto y etiqueta; la regla vive en `session-type.ts`. */
const newSessionTypeSchema = z
  .object({
    programId: z.string().refine((value) => UUID_PATTERN.test(value), {
      message: 'Programa no válido.',
    }),
    code: z.string(),
    label: z.string(),
  })
  .superRefine((value, ctx) => {
    const check = validateSessionType(value.code, value.label);
    if (check.ok) return;

    ctx.addIssue({
      code: 'custom',
      path: [check.reason.startsWith('code') ? 'code' : 'label'],
      message: check.message,
    });
  })
  .transform((value) => {
    const check = validateSessionType(value.code, value.label);
    return {
      programId: value.programId,
      code: check.ok ? check.value.code : value.code,
      label: check.ok ? check.value.label : value.label,
    };
  });

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
 * Un campo ausente se trata como cadena vacía, no como error de forma.
 *
 * Un cliente hostil puede omitir cualquier campo; el resultado debe ser el
 * mismo mensaje que vería quien lo dejó en blanco, no una excepción.
 */
function text(raw: RawInput, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value : '';
}

/** RF-10 — valida y normaliza la entrada de creación de programa. */
export function parseNewProgram(raw: RawInput): ParseResult<NewProgram> {
  const parsed = newProgramSchema.safeParse({
    name: text(raw, 'name'),
    provider: text(raw, 'provider'),
    kind: text(raw, 'kind'),
    status: text(raw, 'status'),
    startedAt: text(raw, 'startedAt'),
    targetAt: text(raw, 'targetAt'),
    repoUrl: text(raw, 'repoUrl'),
  });

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: toFieldErrors(parsed.error.issues) };
}

/** RF-15 — valida y normaliza la entrada de creación de tipo de sesión. */
export function parseNewSessionType(raw: RawInput): ParseResult<NewSessionType> {
  const parsed = newSessionTypeSchema.safeParse({
    programId: text(raw, 'programId'),
    code: text(raw, 'code'),
    label: text(raw, 'label'),
  });

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: toFieldErrors(parsed.error.issues) };
}
