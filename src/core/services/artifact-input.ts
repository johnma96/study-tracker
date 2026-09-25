import { z } from 'zod';

import { ARTIFACT_KINDS, type ArtifactKind, type NewArtifactInput } from '../model/artifact';

import { validateArtifactTarget } from './artifact-target';
import { charLength } from './text';

/**
 * RF-44, RF-50, RF-51 — validación de entrada del servidor para adjuntar un
 * artefacto a una sesión.
 *
 * Mismo criterio que `program-input.ts` y `session-input.ts`: el esquema vive
 * en `core/` y la Server Action es solo el adaptador de `FormData`. Así estas
 * reglas se prueban sin levantar Next ni base de datos.
 *
 * `ARTIFACT_LABEL_MAX_LENGTH` lo fija esta implementación; el DDL de
 * docs/DATA-MODEL.md solo exige `NOT NULL`. La aplicación puede ser más
 * estricta que el motor sin riesgo (decisión 17 de docs/ARCHITECTURE.md).
 */

export const ARTIFACT_LABEL_MAX_LENGTH = 120;

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fieldErrors: Record<string, string> };

/** Entrada cruda: lo que llega de un formulario, todo cadenas. */
export type RawInput = Record<string, string>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RF-51 — los valores admitidos salen de la constante del modelo, no de una
 * lista repetida. Agregar un tipo es un cambio en un solo lugar (más el CHECK
 * del motor, que es la última línea).
 */
const artifactKindField = z
  .string()
  .refine((value) => (ARTIFACT_KINDS as readonly string[]).includes(value), {
    message: `Tipo de artefacto no válido. Usa uno de: ${ARTIFACT_KINDS.join(', ')}.`,
  })
  .transform((value) => value as ArtifactKind);

/** RF-50 — la etiqueta es obligatoria: es lo que se lee en la lista. */
const artifactLabelField = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (charLength(value) < 1) {
      ctx.addIssue({ code: 'custom', message: 'La etiqueta es obligatoria.' });
      return;
    }

    if (charLength(value) > ARTIFACT_LABEL_MAX_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        message: `La etiqueta no puede superar ${ARTIFACT_LABEL_MAX_LENGTH} caracteres.`,
      });
    }
  });

/**
 * RF-50 — destino obligatorio. La regla no se reescribe aquí: se delega en
 * `validateArtifactTarget`, que es su única definición.
 *
 * Se evalúa dos veces —una para decidir y otra para obtener el valor
 * normalizado— porque `transform` solo corre si la validación pasó. Es el mismo
 * patrón del nombre de programa en `program-input.ts`.
 */
const artifactTargetField = z
  .string()
  .superRefine((value, ctx) => {
    const check = validateArtifactTarget(value);
    if (!check.ok) ctx.addIssue({ code: 'custom', message: check.message });
  })
  .transform((value) => {
    const check = validateArtifactTarget(value);
    return check.ok ? check.target : value;
  });

const newArtifactSchema = z.object({
  sessionId: z.string().refine((value) => UUID_PATTERN.test(value), {
    message: 'Sesión no válida.',
  }),
  kind: artifactKindField,
  label: artifactLabelField,
  target: artifactTargetField,
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
 * Un campo ausente se trata como cadena vacía, no como error de forma: un
 * cliente hostil puede omitir cualquier campo y debe ver el mismo mensaje que
 * quien lo dejó en blanco.
 */
function text(raw: RawInput, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value : '';
}

/** Campos que lee la acción. La Server Action usa esta misma lista. */
export const NEW_ARTIFACT_FIELDS = ['sessionId', 'kind', 'label', 'target'] as const;

/** RF-50, RF-51 — entrada para adjuntar un artefacto a una sesión. */
export function parseNewArtifact(raw: RawInput): ParseResult<NewArtifactInput> {
  const parsed = newArtifactSchema.safeParse(
    Object.fromEntries(NEW_ARTIFACT_FIELDS.map((key) => [key, text(raw, key)])),
  );

  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: toFieldErrors(parsed.error.issues) };
}
