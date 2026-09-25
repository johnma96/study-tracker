/**
 * Entidad `session_types` de docs/DATA-MODEL.md.
 *
 * RF-15: los tipos de sesión son **datos de cada programa**, no un enum del
 * código. `E/C/K/V` son los del curso de harness engineering; otro programa
 * tendrá "clase", "taller" o "lab" sin tocar el esquema.
 */
export interface SessionType {
  id: string;
  programId: string;
  code: string;
  label: string;
}

/** Datos para crear un tipo de sesión. El `id` lo genera la base. */
export interface NewSessionType {
  programId: string;
  code: string;
  label: string;
}
