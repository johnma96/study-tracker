/**
 * RF-14 — regla de nombre de programa.
 *
 * Dominio puro: no importa nada de `app/`, `infra/` ni `ui/`. Es la única
 * definición de la regla en todo el sistema; la Server Action y el formulario
 * la consumen, no la reimplementan.
 *
 * Los límites coinciden con el CHECK `char_length(name) between 1 and 120` de
 * docs/DATA-MODEL.md **a propósito**: la restricción del motor es la última
 * línea de defensa, no la primera. Si un usuario llega a verla como excepción
 * de Postgres, el defecto está en la aplicación.
 */

import { charLength } from './text';

export const PROGRAM_NAME_MIN_LENGTH = 1;
export const PROGRAM_NAME_MAX_LENGTH = 120;

/** Motivos de rechazo de RF-14. */
export type ProgramNameRejection = 'empty' | 'too_long';

export type ProgramNameCheck =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly reason: ProgramNameRejection; readonly message: string };

/**
 * Longitud en **puntos de código**, igual que `char_length()` de Postgres.
 *
 * `String.prototype.length` cuenta unidades UTF-16: un emoji mide 2. Medir así
 * dejaría un desacuerdo entre la validación y el CHECK del motor, que es
 * exactamente el defecto que esta capa existe para evitar.
 */
export const programNameLength = charLength;

/**
 * Valida y normaliza el nombre de un programa.
 *
 * El recorte de espacios ocurre **antes** de medir, y el valor devuelto es el ya
 * normalizado: quien persiste guarda exactamente lo que se validó, sin poder
 * introducir una diferencia entre ambos pasos.
 */
export function validateProgramName(raw: string): ProgramNameCheck {
  const name = raw.trim();
  const length = programNameLength(name);

  if (length < PROGRAM_NAME_MIN_LENGTH) {
    return {
      ok: false,
      reason: 'empty',
      message: 'El nombre del programa es obligatorio.',
    };
  }

  if (length > PROGRAM_NAME_MAX_LENGTH) {
    return {
      ok: false,
      reason: 'too_long',
      message: `El nombre del programa no puede superar ${PROGRAM_NAME_MAX_LENGTH} caracteres (tiene ${length}).`,
    };
  }

  return { ok: true, name };
}
