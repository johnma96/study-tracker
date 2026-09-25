'use server';

import { revalidatePath } from 'next/cache';

import {
  parseManualSession,
  parseSessionId,
  parseStartSession,
  parseStopSession,
  type RawInput,
} from '@/core/services/session-input';
import {
  decidePause,
  decideResume,
  decideStop,
  manualSessionEnd,
} from '@/core/services/session-transitions';
import { toCivilDateInAppZone, toCivilTimeInAppZone } from '@/core/services/timezone';
import { drizzleSessionRepository } from '@/infra/repos/drizzle-session-repository';
import {
  EMPTY_SESSION_ACTION_STATE,
  type SessionActionState,
} from '@/ui/session-form-state';

/**
 * Server Actions del cronómetro (R2).
 *
 * **RF-44 — la validación que cuenta ocurre aquí, en el servidor.** Este archivo
 * es un adaptador: convierte `FormData` en cadenas, llama al validador de
 * `core/services/session-input`, pide la decisión a `core/services/session-transitions`
 * y traduce el resultado a estado de formulario. Sin reglas de negocio propias
 * (regla de capas de docs/ARCHITECTURE.md): por eso el comportamiento del
 * cronómetro se prueba sin levantar Next.
 */

/** Convierte `FormData` en cadenas. Los `File` se descartan: aquí no se suben archivos. */
function toRawInput(formData: FormData, keys: readonly string[]): RawInput {
  const raw: RawInput = {};

  for (const key of keys) {
    const value = formData.get(key);
    raw[key] = typeof value === 'string' ? value : '';
  }

  return raw;
}

function invalid(message: string, fieldErrors: Record<string, string>): SessionActionState {
  return { ...EMPTY_SESSION_ACTION_STATE, status: 'error', message, fieldErrors };
}

function notice(message: string): SessionActionState {
  return { ...EMPTY_SESSION_ACTION_STATE, status: 'notice', message };
}

function success(message: string): SessionActionState {
  return { ...EMPTY_SESSION_ACTION_STATE, status: 'success', message };
}

/**
 * Traduce un fallo inesperado.
 *
 * El detalle se queda en el servidor: la cadena de conexión no puede llegar al
 * cliente (RF-43).
 */
function failure(scope: string, error: unknown): SessionActionState {
  console.error(`[${scope}]`, error);

  return {
    ...EMPTY_SESSION_ACTION_STATE,
    status: 'error',
    message: 'No se pudo completar la operación. Vuelve a intentarlo.',
  };
}

/**
 * RF-20, RF-22 — inicia una sesión.
 *
 * El rechazo de la segunda sesión lo decide el índice único de la base, no una
 * comprobación de interfaz: una validación de cliente se salta abriendo dos
 * pestañas. Lo que hace esta acción es traducir ese rechazo a un mensaje que
 * dice **cuál** sesión está abierta.
 */
export async function startSessionAction(
  _previous: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const parsed = parseStartSession(toRawInput(formData, ['programId', 'sessionTypeId']));

  if (!parsed.ok) {
    return invalid('No se pudo iniciar la sesión. Revisa los campos marcados.', parsed.fieldErrors);
  }

  try {
    const result = await drizzleSessionRepository.start(parsed.value);

    if (!result.ok) {
      const running = await drizzleSessionRepository.findRunning();
      revalidatePath('/', 'layout');

      // RF-22 — el mensaje dice **cuál** sesión está abierta. La marca se
      // presenta en hora de Colombia (RF-00), no en UTC ni en la del servidor.
      return notice(
        running
          ? `Ya hay una sesión en curso, iniciada el ${toCivilDateInAppZone(running.startedAt)} a las ${toCivilTimeInAppZone(running.startedAt)}. Detenla o descártala antes de iniciar otra.`
          : 'Ya hay una sesión en curso. Detenla o descártala antes de iniciar otra.',
      );
    }

    revalidatePath('/', 'layout');
    return success('Sesión iniciada.');
  } catch (error) {
    return failure('startSessionAction', error);
  }
}

/** RF-2A — pausa la sesión en curso. */
export async function pauseSessionAction(
  _previous: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const parsed = parseSessionId(toRawInput(formData, ['sessionId']));

  if (!parsed.ok) return invalid('Sesión no válida.', parsed.fieldErrors);

  try {
    const session = await drizzleSessionRepository.findById(parsed.value.sessionId);

    if (!session) return notice('Esa sesión ya no existe.');

    const now = await drizzleSessionRepository.now();
    const decision = decidePause(session, now);

    if (!decision.ok) {
      return notice(
        decision.reason === 'already_paused'
          ? 'La sesión ya estaba pausada.'
          : 'La sesión ya estaba cerrada.',
      );
    }

    const updated = await drizzleSessionRepository.markPaused(session.id, decision.pausedAt);
    revalidatePath('/', 'layout');

    return updated ? success('Sesión pausada.') : notice('La sesión cambió de estado. Vuelve a intentarlo.');
  } catch (error) {
    return failure('pauseSessionAction', error);
  }
}

/** RF-2C, RF-2E — reanuda la sesión pausada. */
export async function resumeSessionAction(
  _previous: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const parsed = parseSessionId(toRawInput(formData, ['sessionId']));

  if (!parsed.ok) return invalid('Sesión no válida.', parsed.fieldErrors);

  try {
    const session = await drizzleSessionRepository.findById(parsed.value.sessionId);

    if (!session) return notice('Esa sesión ya no existe.');

    const now = await drizzleSessionRepository.now();
    const decision = decideResume(session, now);

    if (!decision.ok) {
      return notice(
        decision.reason === 'not_paused'
          ? 'La sesión no estaba pausada.'
          : 'La sesión ya estaba cerrada.',
      );
    }

    const updated = await drizzleSessionRepository.markResumed(session.id, decision.pausedSeconds);
    revalidatePath('/', 'layout');

    return updated ? success('Sesión reanudada.') : notice('La sesión cambió de estado. Vuelve a intentarlo.');
  } catch (error) {
    return failure('resumeSessionAction', error);
  }
}

/**
 * RF-23, RF-24, RF-25, RF-29, RF-2D, RF-2H — detiene la sesión en curso.
 *
 * Si no hay ninguna sesión que detener, se informa sin generar error (RF-29).
 */
export async function stopSessionAction(
  _previous: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const parsed = parseStopSession(
    toRawInput(formData, [
      'sessionId',
      'minutesOverride',
      'note',
      'stuckMinutes',
      'sessionTypeId',
      'confirmed',
    ]),
  );

  if (!parsed.ok) {
    return invalid('No se pudo detener la sesión. Revisa los campos marcados.', parsed.fieldErrors);
  }

  try {
    const session = await drizzleSessionRepository.findById(parsed.value.sessionId);

    // RF-29 — no hay nada que detener. Es información, no un fallo.
    if (!session || session.endedAt !== null) {
      revalidatePath('/', 'layout');
      return notice('No hay ninguna sesión en curso.');
    }

    const now = await drizzleSessionRepository.now();
    const decision = decideStop(session, {
      now,
      minutesOverride: parsed.value.minutesOverride,
      confirmed: parsed.value.confirmed,
    });

    if (decision.kind === 'rejected') {
      return notice('No hay ninguna sesión en curso.');
    }

    // RF-25 — el cálculo pasa de ocho horas: se pide confirmación y se ofrece
    // corregir la duración **antes** de guardar. Nada se ha escrito todavía.
    if (decision.kind === 'needs_confirmation') {
      return {
        ...EMPTY_SESSION_ACTION_STATE,
        status: 'confirm',
        message: `El cronómetro marca ${decision.minutes} minutos, más de 8 horas. ¿Fue así de larga, o se te olvidó detenerlo? Confirma o corrige la duración antes de guardar.`,
        pendingMinutes: decision.minutes,
      };
    }

    const closed = await drizzleSessionRepository.close(session.id, {
      endedAt: decision.endedAt,
      pausedSeconds: decision.pausedSeconds,
      minutesOverride: decision.minutesOverride,
      note: parsed.value.note,
      stuckMinutes: parsed.value.stuckMinutes,
      sessionTypeId: parsed.value.sessionTypeId,
    });

    revalidatePath('/', 'layout');

    return closed
      ? success(`Sesión guardada: ${decision.minutes} minutos efectivos.`)
      : notice('No hay ninguna sesión en curso.');
  } catch (error) {
    return failure('stopSessionAction', error);
  }
}

/**
 * RF-27, RF-2F, RF-2G — descarta la sesión en curso: la borra en vez de
 * cerrarla.
 *
 * Es la válvula de escape del índice único. Sin ella, una sesión que quedó
 * abierta porque se cerró el navegador bloquea el inicio de cualquier otra y
 * solo se arregla entrando a la base a mano.
 */
export async function discardSessionAction(
  _previous: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const parsed = parseSessionId(toRawInput(formData, ['sessionId']));

  if (!parsed.ok) return invalid('Sesión no válida.', parsed.fieldErrors);

  try {
    const removed = await drizzleSessionRepository.remove(parsed.value.sessionId);
    revalidatePath('/', 'layout');

    return removed ? success('Sesión descartada.') : notice('Esa sesión ya no existe.');
  } catch (error) {
    return failure('discardSessionAction', error);
  }
}

/**
 * RF-26 — registra una sesión a mano, sin cronómetro.
 *
 * Nace cerrada, así que queda fuera del índice parcial: se puede registrar la
 * sesión de ayer aunque ahora mismo haya otra corriendo.
 */
export async function createManualSessionAction(
  _previous: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const parsed = parseManualSession(
    toRawInput(formData, [
      'programId',
      'sessionTypeId',
      'startedOn',
      'startedAtTime',
      'minutes',
      'note',
      'stuckMinutes',
    ]),
  );

  if (!parsed.ok) {
    return invalid('No se pudo registrar la sesión. Revisa los campos marcados.', parsed.fieldErrors);
  }

  try {
    await drizzleSessionRepository.createClosed({
      programId: parsed.value.programId,
      sessionTypeId: parsed.value.sessionTypeId,
      startedAt: parsed.value.startedAt,
      endedAt: manualSessionEnd(parsed.value.startedAt, parsed.value.minutes),
      note: parsed.value.note,
      stuckMinutes: parsed.value.stuckMinutes,
    });

    revalidatePath('/', 'layout');

    return success(`Sesión registrada: ${parsed.value.minutes} minutos.`);
  } catch (error) {
    return failure('createManualSessionAction', error);
  }
}
