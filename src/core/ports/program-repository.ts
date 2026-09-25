import type { NewProgram, Program } from '../model/program';
import type { NewSessionType, SessionType } from '../model/session-type';

/**
 * Puerto de persistencia de programas y sus tipos de sesión.
 *
 * `core/` define la interfaz; `infra/repos` la implementa con Drizzle. El
 * dominio nunca conoce el motor de base de datos.
 */
export interface ProgramRepository {
  /** RF-13 — programas ya ordenados: `active` primero, luego fecha desc. */
  list(): Promise<Program[]>;

  /** RF-10 — crea un programa y devuelve la fila resultante. */
  create(input: NewProgram): Promise<Program>;

  /** RF-15 — tipos de sesión de todos los programas. */
  listSessionTypes(): Promise<SessionType[]>;

  /**
   * RF-15 — crea un tipo de sesión.
   *
   * Devuelve `null` si el programa ya tiene ese código. La unicidad la impone
   * la base con `UNIQUE (program_id, code)`; el repositorio traduce el choque a
   * un valor de dominio para que no llegue al usuario como excepción del motor.
   */
  createSessionType(input: NewSessionType): Promise<SessionType | null>;
}
