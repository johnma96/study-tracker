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
  createdAt: Date;
}
