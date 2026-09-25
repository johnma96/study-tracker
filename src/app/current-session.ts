import { isAbandoned } from '@/core/services/session-duration';
import { drizzleProgramRepository } from '@/infra/repos/drizzle-program-repository';
import { drizzleSessionRepository } from '@/infra/repos/drizzle-session-repository';
import type { SessionSnapshot } from '@/ui/session-view';

/**
 * Carga de la sesión en curso, compartida por todas las vistas.
 *
 * **RF-2I exige mostrar el estado de la sesión en todas las vistas**, así que
 * quien la lee es el layout y no una página concreta. Poner esta lectura en la
 * página del cronómetro dejaría la barra fuera del resto de la aplicación, que
 * es justo lo que el requerimiento evita: si la única forma de cerrar una
 * sesión estuviera en la pantalla donde se inició, una sesión olvidada
 * bloquearía la aplicación desde cualquier otra (RF-2F).
 *
 * Si la base no responde, la aplicación no se cae: devuelve `unavailable` y
 * cada vista decide cómo decirlo. El detalle del fallo se queda en el servidor
 * (RF-43).
 */
export async function loadSessionSnapshot(): Promise<SessionSnapshot> {
  try {
    const [running, now] = await Promise.all([
      drizzleSessionRepository.findRunning(),
      drizzleSessionRepository.now(),
    ]);

    if (running === null) {
      return { running: null, nowIso: now.toISOString(), unavailable: false };
    }

    // El nombre del programa y la etiqueta del tipo se leen aparte porque la
    // barra los muestra en todas las vistas y las dos tablas son diminutas.
    const [programs, sessionTypes] = await Promise.all([
      drizzleProgramRepository.list(),
      drizzleProgramRepository.listSessionTypes(),
    ]);

    const program = programs.find((candidate) => candidate.id === running.programId);
    const sessionType = sessionTypes.find((candidate) => candidate.id === running.sessionTypeId);

    return {
      nowIso: now.toISOString(),
      unavailable: false,
      running: {
        id: running.id,
        programId: running.programId,
        programName: program?.name ?? null,
        sessionTypeId: running.sessionTypeId,
        sessionTypeLabel: sessionType ? `${sessionType.code} · ${sessionType.label}` : null,
        startedAtIso: running.startedAt.toISOString(),
        pausedAtIso: running.pausedAt === null ? null : running.pausedAt.toISOString(),
        pausedSeconds: running.pausedSeconds,
        abandoned: isAbandoned(running, now),
      },
    };
  } catch (error) {
    console.error('[loadSessionSnapshot]', error);

    return { running: null, nowIso: new Date().toISOString(), unavailable: true };
  }
}
