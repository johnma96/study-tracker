/**
 * Dominio puro: una sesión de estudio (entidad `sessions` de
 * docs/DATA-MODEL.md).
 *
 * Esta capa no importa nada de `app/`, `infra/` ni `ui/` (regla de capas de
 * docs/ARCHITECTURE.md).
 *
 * **La decisión que define la rebanada R2:** una sesión no guarda "tiempo
 * transcurrido". Guarda `startedAt` y, cuando termina, `endedAt`. Todo lo demás
 * —el reloj que corre en pantalla, la duración efectiva, el tiempo en pausa— se
 * *deriva* de esas marcas (RF-21). Un contador acumulado en el navegador se
 * pierde al cerrar la pestaña; una marca de tiempo en la base, no.
 */

/** RF-26 — cómo nació la sesión: con el cronómetro o registrada a mano. */
export const SESSION_SOURCES = ['timer', 'manual'] as const;

export type SessionSource = (typeof SESSION_SOURCES)[number];

/**
 * Estado observable de una sesión.
 *
 * No es una columna: se deriva de `endedAt` y `pausedAt`. Guardarlo sería un
 * segundo dueño del mismo dato, que tarde o temprano discrepa del primero.
 */
export type SessionStatus = 'running' | 'paused' | 'ended';

/** Entidad `sessions` de docs/DATA-MODEL.md. */
export interface Session {
  id: string;
  programId: string;
  /** RF-28 — tipo de sesión del programa. Nulo mientras no se elija. */
  sessionTypeId: string | null;
  /** RF-20 — instante de inicio. Siempre UTC (invariante 5). */
  startedAt: Date;
  /** RF-23 — instante de cierre. Nulo mientras la sesión está en curso. */
  endedAt: Date | null;
  /** RF-2A — instante de la pausa abierta. Nulo si no está pausada. */
  pausedAt: Date | null;
  /** RF-2C — segundos de pausas ya consolidadas. */
  pausedSeconds: number;
  /** RF-24, RF-2H — si existe, gana sobre el cálculo por marcas de tiempo. */
  minutesOverride: number | null;
  /** RF-28 — minutos bloqueado sin avanzar. */
  stuckMinutes: number;
  /** RF-28 — nota libre. */
  note: string | null;
  source: SessionSource;
  createdAt: Date;
}

/**
 * Lo mínimo que necesitan los cálculos de duración.
 *
 * Los servicios de `core/services` trabajan sobre esta forma y no sobre
 * `Session` completa para poder probarse con objetos literales, sin fabricar
 * identificadores ni fechas de creación que no intervienen en la regla.
 */
export interface SessionTiming {
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly pausedAt: Date | null;
  readonly pausedSeconds: number;
  readonly minutesOverride: number | null;
}

/** RF-20 — datos para abrir una sesión con el cronómetro. */
export interface StartSessionInput {
  programId: string;
  sessionTypeId: string | null;
}

/**
 * RF-23, RF-25, RF-2H — datos para cerrar la sesión en curso.
 *
 * `minutesOverride` llega del usuario cuando corrige la duración; `null`
 * significa "calcula tú". No se confunde con "cero minutos": el invariante 3
 * de docs/DATA-MODEL.md prohíbe un override no positivo.
 */
export interface StopSessionInput {
  sessionId: string;
  minutesOverride: number | null;
  note: string | null;
  stuckMinutes: number;
  sessionTypeId: string | null;
  /** RF-25 — el usuario ya vio la advertencia de sesión larga y la aceptó. */
  confirmed: boolean;
}

/** RF-26 — datos de una sesión registrada a mano, sin cronómetro. */
export interface ManualSessionInput {
  programId: string;
  sessionTypeId: string | null;
  /** Instante de inicio ya convertido a UTC desde la hora local (RF-00). */
  startedAt: Date;
  minutes: number;
  note: string | null;
  stuckMinutes: number;
}
