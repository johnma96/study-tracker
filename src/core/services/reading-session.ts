/**
 * RF-61 — a qué sesión puede asociarse una lectura.
 *
 * La sesión es opcional, pero cuando se indica tiene que ser **del mismo
 * programa que la métrica**. La clave foránea de `readings.session_id` solo
 * garantiza que la sesión exista; no impide que el score del curso de harness
 * quede colgado de una sesión del diplomado. Esa lectura sería un dato
 * corrupto que ninguna restricción del motor detecta.
 *
 * La regla vive aquí y no en la Server Action para probarla sin base de datos.
 */

export type ReadingSessionRejection = 'session_not_found' | 'session_other_program';

export type ReadingSessionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ReadingSessionRejection; readonly message: string };

/**
 * @param metricProgramId programa de la métrica a la que pertenece la lectura.
 * @param requestedSessionId sesión que pidió el usuario, o `null` si ninguna.
 * @param session la sesión leída de la base, o `null` si no existe.
 */
export function checkReadingSession(
  metricProgramId: string,
  requestedSessionId: string | null,
  session: { readonly programId: string } | null,
): ReadingSessionCheck {
  if (requestedSessionId === null) return { ok: true };

  if (session === null) {
    return {
      ok: false,
      reason: 'session_not_found',
      message: 'La sesión indicada ya no existe.',
    };
  }

  if (session.programId !== metricProgramId) {
    return {
      ok: false,
      reason: 'session_other_program',
      message: 'La sesión indicada es de otro programa.',
    };
  }

  return { ok: true };
}
