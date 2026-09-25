import { charLength } from './text';

/**
 * RF-15 — tipos de sesión propios de cada programa, con código corto y
 * etiqueta.
 *
 * Deliberadamente **no** son un enum del código. Un diplomado tiene "clase" y
 * "taller"; un bootcamp tiene "lab". Codificarlos fijos obligaría a migrar el
 * esquema con el segundo programa (nota de RF-15 en docs/REQUIREMENTS.md).
 *
 * RF-15 dice "código corto" y "etiqueta" sin fijar longitudes. Los límites de
 * abajo los define esta implementación y quedan registrados como decisión en
 * progress.md: sin un tope, "corto" no es verificable y la columna `code`
 * aceptaría un párrafo.
 */

export const SESSION_TYPE_CODE_MAX_LENGTH = 8;
export const SESSION_TYPE_LABEL_MAX_LENGTH = 80;

export type SessionTypeRejection = 'code_empty' | 'code_too_long' | 'label_empty' | 'label_too_long';

export interface SessionTypeFields {
  readonly code: string;
  readonly label: string;
}

export type SessionTypeCheck =
  | { readonly ok: true; readonly value: SessionTypeFields }
  | { readonly ok: false; readonly reason: SessionTypeRejection; readonly message: string };

/**
 * Valida y normaliza código y etiqueta.
 *
 * El código se recorta pero **no** se cambia de caja: la unicidad es
 * `(program_id, code)` y alterar la caja en silencio convertiría dos códigos
 * que el usuario escribió distintos en un choque de clave que él no pidió.
 */
export function validateSessionType(rawCode: string, rawLabel: string): SessionTypeCheck {
  const code = rawCode.trim();
  const label = rawLabel.trim();

  if (charLength(code) < 1) {
    return { ok: false, reason: 'code_empty', message: 'El código del tipo de sesión es obligatorio.' };
  }

  if (charLength(code) > SESSION_TYPE_CODE_MAX_LENGTH) {
    return {
      ok: false,
      reason: 'code_too_long',
      message: `El código no puede superar ${SESSION_TYPE_CODE_MAX_LENGTH} caracteres.`,
    };
  }

  if (charLength(label) < 1) {
    return { ok: false, reason: 'label_empty', message: 'La etiqueta del tipo de sesión es obligatoria.' };
  }

  if (charLength(label) > SESSION_TYPE_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      reason: 'label_too_long',
      message: `La etiqueta no puede superar ${SESSION_TYPE_LABEL_MAX_LENGTH} caracteres.`,
    };
  }

  return { ok: true, value: { code, label } };
}
