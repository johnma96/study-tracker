import type { Session, StartSessionInput } from '../model/session';

/**
 * Puerto de persistencia de sesiones (R2).
 *
 * `core/` define la interfaz; `infra/repos` la implementa con Drizzle. El
 * dominio nunca conoce el motor.
 *
 * **Reparto de responsabilidades.** Las reglas —cuándo se puede pausar, cómo se
 * consolida una pausa, qué duración resulta— viven en `core/services` y se
 * prueban sin base de datos. Este puerto solo *aplica* lo ya decidido y, en la
 * escritura, vuelve a comprobar la condición sobre la que se decidió: entre la
 * lectura y la escritura puede haber otra pestaña. Por eso los métodos de
 * transición devuelven `null` cuando la fila ya no está en el estado esperado,
 * en vez de pisar el cambio ajeno.
 */

/** RF-20, RF-22 — resultado de intentar abrir una sesión. */
export type StartSessionResult =
  | { readonly ok: true; readonly session: Session }
  /**
   * RF-22 — ya hay una sesión en curso. Lo decide el índice único parcial
   * `one_running_session`, no una consulta previa: comprobar antes e insertar
   * después deja una ventana en la que dos pestañas pasan las dos
   * comprobaciones.
   */
  | { readonly ok: false; readonly reason: 'already_running' };

/** RF-23, RF-2D, RF-2H — valores con los que se cierra una sesión. */
export interface CloseSessionPatch {
  readonly endedAt: Date;
  /** Pausas consolidadas, incluida la que estuviera abierta (RF-2D). */
  readonly pausedSeconds: number;
  readonly minutesOverride: number | null;
  readonly note: string | null;
  readonly stuckMinutes: number;
  readonly sessionTypeId: string | null;
}

/** RF-26 — sesión que nace cerrada, sin pasar por el cronómetro. */
export interface ClosedSessionInput {
  readonly programId: string;
  readonly sessionTypeId: string | null;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly note: string | null;
  readonly stuckMinutes: number;
}

export interface SessionRepository {
  /**
   * Instante actual **según el motor de base de datos**.
   *
   * Es el mismo reloj que fija `started_at`, así que todo lo que se calcule
   * contra él —la pausa, el cierre, la duración— es coherente con el inicio.
   * Usar el reloj del proceso de Node mezclaría dos relojes que nadie garantiza
   * sincronizados, y un desfase de pocos segundos basta para violar el CHECK
   * `ended_after_started` o para restar tiempo que sí se trabajó.
   */
  now(): Promise<Date>;

  /**
   * RF-20, RF-22 — abre una sesión con `started_at = now()` del servidor de
   * base de datos.
   *
   * La marca la pone el motor y no el navegador ni el proceso de Node: es el
   * único reloj común a todos los dispositivos, y de ese valor se deriva todo
   * el tiempo transcurrido (RF-21).
   */
  start(input: StartSessionInput): Promise<StartSessionResult>;

  /** RF-21, RF-2I — la sesión en curso, si existe. Como máximo hay una. */
  findRunning(): Promise<Session | null>;

  /** Lee una sesión por identificador. */
  findById(id: string): Promise<Session | null>;

  /** RF-2A — marca la pausa. `null` si la sesión ya no estaba corriendo. */
  markPaused(id: string, pausedAt: Date): Promise<Session | null>;

  /** RF-2C — consolida la pausa. `null` si la sesión ya no estaba pausada. */
  markResumed(id: string, pausedSeconds: number): Promise<Session | null>;

  /** RF-23 — cierra la sesión. `null` si ya estaba cerrada. */
  close(id: string, patch: CloseSessionPatch): Promise<Session | null>;

  /** RF-27, RF-2G — descarta la sesión: la borra en vez de cerrarla. */
  remove(id: string): Promise<boolean>;

  /** RF-26 — registra una sesión ya terminada. */
  createClosed(input: ClosedSessionInput): Promise<Session>;
}
