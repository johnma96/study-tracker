import type { Program } from '../model/program';

/**
 * RF-13 — orden del listado de programas.
 *
 * Dominio puro: el orden se decide aquí y no en un ORDER BY, para poder
 * probarlo sin levantar base de datos. docs/ARCHITECTURE.md dice que ese es el
 * valor real de la separación por capas, y este es un caso donde se cobra: los
 * empates y las fechas nulas son justo donde se esconden los errores.
 */

/** Campos mínimos que el orden necesita. */
export type ProgramOrderFields = Pick<Program, 'name' | 'status' | 'startedAt'>;

/**
 * RF-13 solo fija que `active` va primero; no ordena los otros cuatro estados
 * entre sí. Se implementa literalmente: dos grupos, `active` y el resto. Si más
 * adelante hace falta un orden completo de estados, es un cambio de
 * requerimiento, no una decisión de implementación.
 */
function statusRank(status: Program['status']): number {
  return status === 'active' ? 0 : 1;
}

/**
 * Compara dos fechas civiles `YYYY-MM-DD` en orden descendente, con las nulas
 * al final.
 *
 * El formato ISO permite comparar como cadena: el orden lexicográfico coincide
 * con el cronológico, sin construir objetos `Date` ni arrastrar zonas horarias
 * a una fecha que no tiene hora.
 *
 * Las nulas van al final por decisión explícita. Postgres, con `ORDER BY
 * started_at DESC`, las pondría primero; un programa sin fecha encabezando el
 * listado por encima del más reciente es lo contrario de lo que RF-13 quiere
 * mostrar.
 */
function compareStartedAtDesc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? 1 : -1;
}

/** Orden total de RF-13. El nombre desempata para que el listado sea estable. */
export function compareProgramsForList(a: ProgramOrderFields, b: ProgramOrderFields): number {
  const byStatus = statusRank(a.status) - statusRank(b.status);
  if (byStatus !== 0) return byStatus;

  const byDate = compareStartedAtDesc(a.startedAt, b.startedAt);
  if (byDate !== 0) return byDate;

  return a.name.localeCompare(b.name, 'es');
}

/** Devuelve una copia ordenada. No muta la lista recibida. */
export function sortPrograms<T extends ProgramOrderFields>(programs: readonly T[]): T[] {
  return [...programs].sort(compareProgramsForList);
}
