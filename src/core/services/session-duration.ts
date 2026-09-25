import type { SessionStatus, SessionTiming } from '../model/session';

/**
 * RF-24 — duración efectiva de una sesión. Regla única del sistema.
 *
 * Transcrita de la sección "Duración efectiva" de docs/DATA-MODEL.md:
 *
 * ```
 * pausaTotal(s) = s.pausedSeconds + (ahora - s.pausedAt)   si hay pausa abierta
 *
 * duracionEfectiva(s) =
 *   s.minutesOverride                                       si minutesOverride != null
 *   redondear(((endedAt - startedAt) - pausaTotal) / 60)     si endedAt != null
 *   null                                                     si la sesión está en curso
 * ```
 *
 * Vive en `core/` y se prueba **sin base de datos**: es exactamente la clase de
 * lógica que justifica la separación por capas de docs/ARCHITECTURE.md.
 */

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

/** RF-25 — por encima de esto se pide confirmación antes de guardar. */
export const LONG_SESSION_MINUTES = 8 * 60;

/** RF-2G — una sesión en curso que pasa de aquí se considera abandonada. */
export const ABANDONED_AFTER_MINUTES = 8 * 60;

/** Estado observable. Se deriva, no se almacena. */
export function sessionStatus(session: SessionTiming): SessionStatus {
  if (session.endedAt !== null) return 'ended';
  return session.pausedAt !== null ? 'paused' : 'running';
}

/**
 * Segundos que la sesión lleva en la pausa abierta. Cero si no está pausada.
 *
 * Nunca negativo: si el reloj de referencia va por detrás de la marca de pausa
 * —desfase entre servidor y navegador—, el resultado se recorta a cero en vez
 * de restar tiempo que sí se trabajó.
 */
export function openPauseSeconds(session: SessionTiming, now: Date): number {
  if (session.pausedAt === null) return 0;

  const elapsed = (now.getTime() - session.pausedAt.getTime()) / MS_PER_SECOND;
  return Math.max(0, elapsed);
}

/**
 * `pausaTotal` de docs/DATA-MODEL.md: pausas consolidadas más la abierta.
 *
 * `now` es el instante contra el que se mide la pausa abierta. Al cerrar la
 * sesión, ese instante es el de cierre (RF-2D): la pausa se consolida antes de
 * calcular, no después.
 */
export function totalPausedSeconds(session: SessionTiming, now: Date): number {
  return session.pausedSeconds + openPauseSeconds(session, now);
}

/**
 * RF-24 — duración efectiva en minutos.
 *
 * Devuelve `null` —nunca 0— mientras la sesión esté en curso: una sesión sin
 * cerrar no tiene duración todavía, y confundir "no se sabe" con "cero" es lo
 * que arruina los promedios de la rebanada R3.
 *
 * Si hay pausa abierta en una sesión ya cerrada —estado que la base impide con
 * `no_open_pause_when_ended`, pero que el dominio debe saber calcular— la pausa
 * se mide hasta el instante de cierre.
 */
export function effectiveMinutes(session: SessionTiming): number | null {
  if (session.minutesOverride !== null) return session.minutesOverride;
  if (session.endedAt === null) return null;

  const grossSeconds = (session.endedAt.getTime() - session.startedAt.getTime()) / MS_PER_SECOND;
  const netSeconds = grossSeconds - totalPausedSeconds(session, session.endedAt);

  return Math.round(netSeconds / SECONDS_PER_MINUTE);
}

/**
 * RF-21, RF-2B — segundos efectivos acumulados hasta `now`, para una sesión que
 * todavía corre o está pausada.
 *
 * **Se deriva de `startedAt`**, que es el valor almacenado. El reloj de la
 * interfaz vuelve a llamar a esta función en cada tic con el mismo dato de la
 * base: es presentación, no una fuente de verdad paralela. Por eso cerrar la
 * pestaña, apagar el equipo o cambiar de dispositivo no pierde nada.
 */
export function effectiveSecondsSoFar(session: SessionTiming, now: Date): number {
  const reference = session.endedAt ?? now;
  const grossSeconds = (reference.getTime() - session.startedAt.getTime()) / MS_PER_SECOND;

  return Math.max(0, grossSeconds - totalPausedSeconds(session, reference));
}

/** RF-25 — ¿el cálculo supera el umbral que obliga a pedir confirmación? */
export function isSuspiciouslyLong(minutes: number): boolean {
  return minutes > LONG_SESSION_MINUTES;
}

/**
 * RF-2G — ¿la sesión en curso lleva abierta más de 8 horas?
 *
 * El criterio es el **inicio**, no el tiempo efectivo: una sesión pausada hace
 * diez horas también está abandonada. Se mide sobre `startedAt` porque es lo
 * que dice RF-2G y porque es el dato que sobrevive a todo.
 */
export function isAbandoned(session: SessionTiming, now: Date): boolean {
  if (session.endedAt !== null) return false;

  const minutesOpen =
    (now.getTime() - session.startedAt.getTime()) / MS_PER_SECOND / SECONDS_PER_MINUTE;

  return minutesOpen > ABANDONED_AFTER_MINUTES;
}

/** Presentación `H:MM:SS` de una cantidad de segundos. */
export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}
