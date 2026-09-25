/**
 * Dominio puro: un programa de estudio.
 *
 * Esta capa no importa nada de `app/`, `infra/` ni `ui/` (regla de capas de
 * docs/ARCHITECTURE.md). Los valores admitidos salen de RF-11 y RF-12 y viven
 * aquí como constantes de dominio, no como enums de base de datos: el modelo
 * debe poder crecer sin migrar el esquema.
 */

/** RF-11 — tipos de programa admitidos. */
export const PROGRAM_KINDS = [
  'course',
  'certification',
  'diploma',
  'bootcamp',
  'selfstudy',
] as const;

export type ProgramKind = (typeof PROGRAM_KINDS)[number];

/** RF-12 — estados de programa admitidos. */
export const PROGRAM_STATUSES = [
  'planned',
  'active',
  'paused',
  'done',
  'abandoned',
] as const;

export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

/**
 * Entidad `programs` de docs/DATA-MODEL.md.
 *
 * `startedAt` y `targetAt` son fechas civiles (`date` en Postgres), sin hora ni
 * zona: se representan como `YYYY-MM-DD`. `createdAt` sí es un instante y se
 * almacena en UTC (`timestamptz`, invariante 5).
 */
export interface Program {
  id: string;
  name: string;
  provider: string | null;
  kind: ProgramKind;
  status: ProgramStatus;
  startedAt: string | null;
  targetAt: string | null;
  plannedSessions: number | null;
  /**
   * R7 — URL base del repositorio, opcional. Resuelve las rutas relativas de
   * los artefactos a enlaces reales (RF-52). Ver `services/artifact-target.ts`.
   */
  repoUrl: string | null;
  createdAt: Date;
}

/**
 * Datos para crear un programa (RF-10).
 *
 * Los campos son exactamente los que enumera RF-10: nombre, proveedor, tipo,
 * estado, fecha de inicio y fecha objetivo. `plannedSessions` existe en la
 * tabla pero **no** se captura aquí: RF-10 no lo pide y su uso aparece en
 * RF-36, que pertenece a R3. `id` y `createdAt` los genera la base.
 */
export interface NewProgram {
  name: string;
  provider: string | null;
  kind: ProgramKind;
  status: ProgramStatus;
  startedAt: string | null;
  targetAt: string | null;
  /** R7 — opcional. Sin ella, las rutas relativas siguen mostrándose como texto. */
  repoUrl: string | null;
}
