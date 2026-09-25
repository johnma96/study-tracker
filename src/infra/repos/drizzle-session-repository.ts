import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import type { Session, SessionSource, StartSessionInput } from '@/core/model/session';
import type {
  ClosedSessionInput,
  CloseSessionPatch,
  SessionRepository,
  StartSessionResult,
} from '@/core/ports/session-repository';
import { getDb } from '@/infra/db/client';
import { sessions, type SessionRow } from '@/infra/db/schema';
import { isUniqueViolationOf } from '@/infra/db/unique-violation';

/**
 * Implementación del puerto `SessionRepository` con Drizzle sobre Neon (R2).
 *
 * Toda consulta va parametrizada por el constructor de Drizzle: no se arma SQL
 * por concatenación de cadenas (docs/ARCHITECTURE.md, sección Seguridad).
 *
 * **Las transiciones se escriben con la condición dentro del `WHERE`.** Pausar,
 * reanudar y cerrar comprueban en el propio `UPDATE` que la fila sigue en el
 * estado sobre el que se decidió. Entre la lectura y la escritura puede haber
 * otra pestaña, y un `UPDATE ... WHERE id = ?` a secas pisaría ese cambio en
 * silencio. Si no actualiza ninguna fila, el método devuelve `null` y la capa
 * de arriba vuelve a leer el estado real.
 */

/** Nombre del índice único parcial que impone el invariante 1 (RF-22). */
export const ONE_RUNNING_SESSION_INDEX = 'one_running_session';

export function toDomain(row: SessionRow): Session {
  return {
    id: row.id,
    programId: row.programId,
    sessionTypeId: row.sessionTypeId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    pausedAt: row.pausedAt,
    pausedSeconds: row.pausedSeconds,
    minutesOverride: row.minutesOverride,
    stuckMinutes: row.stuckMinutes,
    note: row.note,
    // El motor garantiza el dominio con el CHECK `sessions_source_valid`; aquí
    // solo se estrecha el tipo `text`.
    source: row.source as SessionSource,
    createdAt: row.createdAt,
  };
}

export const drizzleSessionRepository: SessionRepository = {
  /**
   * Instante actual del motor: el mismo reloj que fija `started_at`.
   *
   * Se pide como segundos desde la época y no como marca de tiempo porque el
   * driver HTTP de Neon devuelve `now()` en el formato de Postgres
   * (`2026-09-25 12:00:46.381862+00`), que **no** es ISO-8601: pasarlo a
   * `new Date()` depende de la tolerancia del motor de JavaScript. Un número
   * no tiene ambigüedad de formato ni de zona.
   */
  async now(): Promise<Date> {
    const result = await getDb().execute<{ epoch: string }>(
      sql`select extract(epoch from now()) as epoch`,
    );

    return new Date(Number(result.rows[0].epoch) * 1000);
  },

  /**
   * RF-20, RF-22 — abre una sesión.
   *
   * `started_at` lo pone `now()` **del motor**, no el proceso de Node ni el
   * navegador: es el único reloj común a todos los dispositivos, y de ese valor
   * se deriva todo el tiempo transcurrido (RF-21).
   *
   * El rechazo de la segunda sesión lo decide el índice único parcial, no una
   * consulta previa: comprobar antes e insertar después deja una ventana en la
   * que dos pestañas pasan las dos comprobaciones. Lo que hace el repositorio es
   * traducir la violación a un valor de dominio para que no llegue al usuario
   * como excepción de Postgres.
   */
  async start(input: StartSessionInput): Promise<StartSessionResult> {
    try {
      const [row] = await getDb()
        .insert(sessions)
        .values({
          programId: input.programId,
          sessionTypeId: input.sessionTypeId,
          startedAt: sql`now()`,
          source: 'timer',
        })
        .returning();

      return { ok: true, session: toDomain(row) };
    } catch (error) {
      if (isUniqueViolationOf(error, ONE_RUNNING_SESSION_INDEX)) {
        return { ok: false, reason: 'already_running' };
      }

      throw error;
    }
  },

  /** RF-21, RF-2I — la sesión en curso. El índice garantiza que hay a lo sumo una. */
  async findRunning(): Promise<Session | null> {
    const rows = await getDb()
      .select()
      .from(sessions)
      .where(isNull(sessions.endedAt))
      .orderBy(desc(sessions.startedAt))
      .limit(1);

    return rows.length > 0 ? toDomain(rows[0]) : null;
  },

  async findById(id: string): Promise<Session | null> {
    const rows = await getDb().select().from(sessions).where(eq(sessions.id, id)).limit(1);

    return rows.length > 0 ? toDomain(rows[0]) : null;
  },

  /** RF-2A — abre la pausa solo si la sesión sigue corriendo y sin pausa abierta. */
  async markPaused(id: string, pausedAt: Date): Promise<Session | null> {
    const rows = await getDb()
      .update(sessions)
      .set({ pausedAt })
      .where(and(eq(sessions.id, id), isNull(sessions.endedAt), isNull(sessions.pausedAt)))
      .returning();

    return rows.length > 0 ? toDomain(rows[0]) : null;
  },

  /** RF-2C — consolida la pausa solo si sigue abierta. */
  async markResumed(id: string, pausedSeconds: number): Promise<Session | null> {
    const rows = await getDb()
      .update(sessions)
      .set({ pausedAt: null, pausedSeconds })
      .where(and(eq(sessions.id, id), isNull(sessions.endedAt), isNotNull(sessions.pausedAt)))
      .returning();

    return rows.length > 0 ? toDomain(rows[0]) : null;
  },

  /**
   * RF-23, RF-2D — cierra la sesión.
   *
   * `paused_at` se pone a `null` en el mismo `UPDATE` que fija `ended_at`: el
   * CHECK `no_open_pause_when_ended` rechazaría la fila si quedaran las dos, y
   * el valor consolidado ya viene dentro de `pausedSeconds`.
   */
  async close(id: string, patch: CloseSessionPatch): Promise<Session | null> {
    const rows = await getDb()
      .update(sessions)
      .set({
        endedAt: patch.endedAt,
        pausedAt: null,
        pausedSeconds: patch.pausedSeconds,
        minutesOverride: patch.minutesOverride,
        note: patch.note,
        stuckMinutes: patch.stuckMinutes,
        sessionTypeId: patch.sessionTypeId,
      })
      .where(and(eq(sessions.id, id), isNull(sessions.endedAt)))
      .returning();

    return rows.length > 0 ? toDomain(rows[0]) : null;
  },

  /**
   * RF-27, RF-2G — descarta la sesión.
   *
   * Se borra, no se cierra: una sesión cancelada nunca ocurrió, y dejarla con
   * duración cero contaminaría los promedios de la rebanada R3. Al desaparecer
   * la fila, el índice `one_running_session` queda libre.
   */
  async remove(id: string): Promise<boolean> {
    const rows = await getDb().delete(sessions).where(eq(sessions.id, id)).returning();

    return rows.length > 0;
  },

  /**
   * RF-26 — registra una sesión ya terminada, sin pasar por el cronómetro.
   *
   * Nace con `ended_at`, así que queda fuera del índice parcial: se puede
   * registrar a mano una sesión de ayer aunque ahora mismo haya otra corriendo.
   */
  async createClosed(input: ClosedSessionInput): Promise<Session> {
    const [row] = await getDb()
      .insert(sessions)
      .values({
        programId: input.programId,
        sessionTypeId: input.sessionTypeId,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        note: input.note,
        stuckMinutes: input.stuckMinutes,
        source: 'manual',
      })
      .returning();

    return toDomain(row);
  },
};
