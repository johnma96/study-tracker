import type { Session } from '../model/session';

import { effectiveMinutes } from './session-duration';
import { toCivilDateInAppZone, toCivilTimeInAppZone } from './timezone';

/**
 * RF-30 — listado de sesiones de un programa.
 *
 * El orden y la conversión de fechas se deciden aquí y no en un `ORDER BY` ni
 * en el componente: es el mismo criterio de la decisión 12 de
 * docs/ARCHITECTURE.md para RF-13. La regla que corre en producción es la que
 * cubren las pruebas, sin base de datos.
 */

/** Una fila del listado, lista para presentar. */
export interface SessionListItem {
  readonly id: string;
  /** Fecha civil `AAAA-MM-DD` del inicio, en `America/Bogota` (RF-00). */
  readonly date: string;
  /** Hora civil `HH:MM` del inicio, en `America/Bogota`. */
  readonly startTime: string;
  readonly sessionTypeId: string | null;
  /** RF-24 — duración efectiva. `null` mientras la sesión sigue en curso. */
  readonly minutes: number | null;
  readonly note: string | null;
}

/**
 * RF-30 — sesiones de un programa ordenadas por inicio descendente.
 *
 * El empate —dos sesiones con el mismo instante de inicio, posible con
 * registros manuales— se resuelve por identificador para que el orden no
 * cambie entre una recarga y la siguiente.
 */
export function listProgramSessions(
  sessions: readonly Session[],
  programId: string,
): SessionListItem[] {
  return sessions
    .filter((session) => session.programId === programId)
    .sort(
      (a, b) =>
        b.startedAt.getTime() - a.startedAt.getTime() || a.id.localeCompare(b.id),
    )
    .map((session) => ({
      id: session.id,
      date: toCivilDateInAppZone(session.startedAt),
      startTime: toCivilTimeInAppZone(session.startedAt),
      sessionTypeId: session.sessionTypeId,
      minutes: effectiveMinutes(session),
      note: session.note,
    }));
}
