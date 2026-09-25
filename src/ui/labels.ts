import type { ProgramKind, ProgramStatus } from '@/core/model/program';

/**
 * Etiquetas en español de los valores de RF-11 y RF-12.
 *
 * Viven en `ui/` porque son presentación: el dominio y la base guardan los
 * códigos en inglés (`course`, `active`…), que son los que fijan los
 * requerimientos y las restricciones CHECK. Traducir en la capa de datos
 * obligaría a migrar el esquema para cambiar una palabra de la pantalla.
 */
export const PROGRAM_KIND_LABELS: Record<ProgramKind, string> = {
  course: 'Curso',
  certification: 'Certificación',
  diploma: 'Diplomado',
  bootcamp: 'Bootcamp',
  selfstudy: 'Autoestudio',
};

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  planned: 'Planeado',
  active: 'Activo',
  paused: 'En pausa',
  done: 'Terminado',
  abandoned: 'Abandonado',
};
