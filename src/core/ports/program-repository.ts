import type { Program } from '../model/program';

/**
 * Puerto de persistencia de programas.
 *
 * `core/` define la interfaz; `infra/repos` la implementa con Drizzle. El
 * dominio nunca conoce el motor de base de datos.
 *
 * En R0 solo existe la lectura: es lo único que exige RF-01 para probar la
 * cadena completa. Las operaciones de escritura entran con R1.
 */
export interface ProgramRepository {
  /** Devuelve todos los programas. El orden de RF-13 se implementa en R1. */
  list(): Promise<Program[]>;
}
