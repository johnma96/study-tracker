/**
 * Detección de violaciones de unicidad de Postgres a través de Drizzle.
 *
 * **Defecto real, encontrado al construir R1 y reutilizado en R2.** Drizzle no
 * propaga el error del driver tal cual: lo envuelve en un `DrizzleQueryError`
 * que **no** lleva la propiedad `code`, y deja el `NeonDbError` original en
 * `cause`. Mirar solo el error de primer nivel deja la comprobación siempre en
 * falso y la excepción de Postgres termina en la cara del usuario.
 *
 * En R1 el choque era `UNIQUE (program_id, code)` de `session_types`. En R2 es
 * el índice único parcial `one_running_session`, que impone "como máximo una
 * sesión en curso" (RF-22). Son el mismo mecanismo, así que la detección vive
 * en un solo sitio: duplicarla dejaría dos copias de una corrección que costó
 * encontrar y solo una se acordaría de mantener.
 */

/** `unique_violation` de Postgres. */
export const UNIQUE_VIOLATION = '23505';

/** Profundidad máxima al recorrer `cause`: una cadena cíclica colgaría el proceso. */
const MAX_CAUSE_DEPTH = 5;

/** ¿El error, o alguna de sus causas, es una violación de unicidad? */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (
    let depth = 0;
    depth < MAX_CAUSE_DEPTH && typeof current === 'object' && current !== null;
    depth += 1
  ) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/**
 * ¿La violación de unicidad corresponde a este índice o restricción?
 *
 * `constraint` viene del `NeonDbError`, no del envoltorio, así que se busca por
 * la misma cadena de `cause`. Distinguir el índice importa: en R2 conviven el
 * choque de `one_running_session` —que es un caso de negocio con mensaje
 * propio (RF-22)— y cualquier otro, que sí es un defecto y debe propagarse.
 */
export function isUniqueViolationOf(error: unknown, constraintName: string): boolean {
  let current: unknown = error;

  for (
    let depth = 0;
    depth < MAX_CAUSE_DEPTH && typeof current === 'object' && current !== null;
    depth += 1
  ) {
    const candidate = current as { code?: unknown; constraint?: unknown };

    if (candidate.code === UNIQUE_VIOLATION && candidate.constraint === constraintName) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}
