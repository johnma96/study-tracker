import type { Session } from '../model/session';

import { filterByProgramContext, type ProgramContext } from './program-context';
import { effectiveMinutes } from './session-duration';
import { toCivilDateInAppZone, toCivilTimeInAppZone } from './timezone';

/**
 * RF-30 — listado de sesiones del contexto de programa.
 *
 * El orden y la conversión de fechas se deciden aquí y no en un `ORDER BY` ni
 * en el componente: es el mismo criterio de la decisión 12 de
 * docs/ARCHITECTURE.md para RF-13. La regla que corre en producción es la que
 * cubren las pruebas, sin base de datos.
 *
 * R8 cambió el recorte de «un programa» a «el contexto»
 * (`program-context.ts`), que con «todos» no recorta nada. **El filtro no se
 * duplicó**: el listado y los totales tienen que coincidir en qué sesiones
 * entran, y dos definiciones de la misma regla se desincronizan.
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
 * RF-30 — sesiones del contexto, ordenadas por inicio descendente.
 *
 * El empate —dos sesiones con el mismo instante de inicio, posible con
 * registros manuales— se resuelve por identificador para que el orden no
 * cambie entre una recarga y la siguiente.
 */
export function listSessionsInContext(
  sessions: readonly Session[],
  context: ProgramContext,
): SessionListItem[] {
  return filterByProgramContext(sessions, context)
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
