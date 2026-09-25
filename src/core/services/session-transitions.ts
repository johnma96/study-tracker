import type { SessionTiming } from '../model/session';

import {
  effectiveMinutes,
  isSuspiciouslyLong,
  totalPausedSeconds,
} from './session-duration';

/**
 * Transiciones de la sesión: pausar, reanudar y detener.
 *
 * Son **decisiones puras**: reciben la sesión tal como está en la base y
 * devuelven qué debería quedar escrito, sin escribir nada. El repositorio
 * aplica el resultado; la Server Action lo traduce a mensajes. Así la regla que
 * corre en producción es la misma que cubren las pruebas, sin levantar base de
 * datos ni navegador — que es la justificación declarada de la separación por
 * capas en docs/ARCHITECTURE.md.
 */

const MS_PER_SECOND = 1000;

export type TransitionRejection =
  | 'already_ended'
  | 'already_paused'
  | 'not_paused'
  | 'not_elapsed';

export type PauseDecision =
  | { readonly ok: true; readonly pausedAt: Date }
  | { readonly ok: false; readonly reason: TransitionRejection };

export type ResumeDecision =
  | { readonly ok: true; readonly pausedSeconds: number }
  | { readonly ok: false; readonly reason: TransitionRejection };

export type StopDecision =
  /** RF-25 — el cálculo pasa de 8 horas: hay que confirmar o corregir antes de guardar. */
  | { readonly kind: 'needs_confirmation'; readonly minutes: number }
  | {
      readonly kind: 'commit';
      readonly endedAt: Date;
      /** Pausas ya consolidadas, incluida la que estuviera abierta (RF-2D). */
      readonly pausedSeconds: number;
      readonly minutesOverride: number | null;
      /** Duración efectiva resultante (RF-24). */
      readonly minutes: number;
    }
  | { readonly kind: 'rejected'; readonly reason: TransitionRejection };

export interface StopRequest {
  readonly now: Date;
  /** RF-2H — duración indicada por el usuario. `null` significa "calcula tú". */
  readonly minutesOverride: number | null;
  /** RF-25 — el usuario ya vio la advertencia de sesión larga y la aceptó. */
  readonly confirmed: boolean;
}

/** RF-2A — pausar la sesión en curso. */
export function decidePause(session: SessionTiming, now: Date): PauseDecision {
  if (session.endedAt !== null) return { ok: false, reason: 'already_ended' };
  if (session.pausedAt !== null) return { ok: false, reason: 'already_paused' };

  return { ok: true, pausedAt: now };
}

/**
 * RF-2C, RF-2E — reanudar: el intervalo de la pausa se **suma** al acumulado.
 *
 * Sumar en vez de reemplazar es lo que permite pausar y reanudar cualquier
 * número de veces dentro de la misma sesión (RF-2E) sin perder las anteriores.
 * `paused_seconds` es una columna `integer`, así que el valor se redondea aquí
 * y no en el borde de la base.
 */
export function decideResume(session: SessionTiming, now: Date): ResumeDecision {
  if (session.endedAt !== null) return { ok: false, reason: 'already_ended' };
  if (session.pausedAt === null) return { ok: false, reason: 'not_paused' };

  const elapsed = Math.max(0, (now.getTime() - session.pausedAt.getTime()) / MS_PER_SECOND);

  return { ok: true, pausedSeconds: Math.round(session.pausedSeconds + elapsed) };
}

/**
 * RF-23, RF-24, RF-25, RF-2D — detener la sesión.
 *
 * El orden importa y es el que fija RF-2D: **primero** se consolida la pausa
 * abierta, **después** se calcula la duración. Calcular antes dejaría dentro
 * del total el tiempo de descanso que el usuario nunca trabajó.
 */
export function decideStop(session: SessionTiming, request: StopRequest): StopDecision {
  if (session.endedAt !== null) return { kind: 'rejected', reason: 'already_ended' };

  // `ended_after_started` exige un cierre estrictamente posterior al inicio.
  if (request.now.getTime() <= session.startedAt.getTime()) {
    return { kind: 'rejected', reason: 'not_elapsed' };
  }

  // RF-2D — la pausa abierta se cierra contra el instante de cierre.
  const pausedSeconds = Math.round(totalPausedSeconds(session, request.now));

  const closed: SessionTiming = {
    startedAt: session.startedAt,
    endedAt: request.now,
    pausedAt: null,
    pausedSeconds,
    minutesOverride: request.minutesOverride,
  };

  // `effectiveMinutes` solo devuelve `null` con la sesión en curso, y aquí ya
  // está cerrada; el `?? 0` es para el verificador de tipos, no un caso real.
  const minutes = effectiveMinutes(closed) ?? 0;

  // RF-25 — el usuario que corrige la duración ya está respondiendo a la
  // advertencia: un `minutesOverride` explícito es la confirmación.
  const needsConfirmation =
    request.minutesOverride === null && !request.confirmed && isSuspiciouslyLong(minutes);

  if (needsConfirmation) return { kind: 'needs_confirmation', minutes };

  return {
    kind: 'commit',
    endedAt: request.now,
    pausedSeconds,
    minutesOverride: request.minutesOverride,
    minutes,
  };
}

/**
 * RF-26 — instante de cierre de una sesión registrada a mano.
 *
 * La sesión manual nace cerrada y sin pausas: `endedAt = startedAt + minutos`.
 * No se usa `minutes_override` porque no hay nada que corregir — las marcas de
 * tiempo ya dicen exactamente lo que el usuario informó, y así la sesión manual
 * y la cronometrada se calculan con la misma regla (RF-24).
 */
export function manualSessionEnd(startedAt: Date, minutes: number): Date {
  return new Date(startedAt.getTime() + minutes * 60 * MS_PER_SECOND);
}
