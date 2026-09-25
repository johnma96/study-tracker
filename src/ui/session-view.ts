import type { SessionTiming } from '@/core/model/session';

/**
 * Forma de la sesión en curso tal como viaja del servidor al cliente.
 *
 * Las marcas de tiempo van como cadenas ISO en UTC: es lo que se almacena
 * (invariante 5) y no depende de la zona de nadie. El cliente las vuelve a
 * convertir en `Date` y recalcula el reloj **desde ese valor**, que es el de la
 * base. Sigue sin haber ningún contador acumulado en el navegador (RF-21).
 */
export interface RunningSessionView {
  readonly id: string;
  readonly programId: string;
  readonly programName: string | null;
  readonly sessionTypeId: string | null;
  readonly sessionTypeLabel: string | null;
  readonly startedAtIso: string;
  readonly pausedAtIso: string | null;
  readonly pausedSeconds: number;
  /** RF-2G — lleva más de ocho horas abierta. */
  readonly abandoned: boolean;
}

/** Lo que necesita cualquier vista para pintar el estado de la sesión (RF-2I). */
export interface SessionSnapshot {
  readonly running: RunningSessionView | null;
  /** Instante del servidor, para que el primer render del cliente coincida. */
  readonly nowIso: string;
  /** La base no respondió. La aplicación sigue usable y lo dice. */
  readonly unavailable: boolean;
}

/** Reconstruye la forma que consumen los cálculos de `core/services`. */
export function toTiming(view: RunningSessionView): SessionTiming {
  return {
    startedAt: new Date(view.startedAtIso),
    endedAt: null,
    pausedAt: view.pausedAtIso === null ? null : new Date(view.pausedAtIso),
    pausedSeconds: view.pausedSeconds,
    minutesOverride: null,
  };
}
