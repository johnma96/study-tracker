/**
 * Dominio puro: un artefacto de evidencia (entidad `artifacts` de
 * docs/DATA-MODEL.md, rebanada R4).
 *
 * Esta capa no importa nada de `app/`, `infra/` ni `ui/` (regla de capas de
 * docs/ARCHITECTURE.md).
 *
 * **La decisión que define la rebanada:** un artefacto es una *referencia*, no
 * un archivo (RF-54, y "Subida de archivos" en la lista vinculante de
 * docs/PRODUCT.md). La evidencia vive en su repositorio, en su documento o en
 * su servicio de imágenes; aquí solo se guarda **dónde** está.
 */

/**
 * RF-51 — tipos de artefacto admitidos.
 *
 * Son constantes de dominio y no un enum de base de datos, igual que los tipos
 * de programa de RF-11: el CHECK del motor repite esta lista, pero el código la
 * lee de aquí.
 */
export const ARTIFACT_KINDS = ['doc', 'image', 'repo', 'link', 'commit'] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Entidad `artifacts` de docs/DATA-MODEL.md. */
export interface Artifact {
  id: string;
  sessionId: string;
  kind: ArtifactKind;
  label: string;
  /**
   * RF-50 — destino: una URL `http`/`https` o una ruta relativa de
   * repositorio. Nunca el contenido del archivo (RF-54).
   */
  target: string;
  createdAt: Date;
}

/** RF-50 — datos para adjuntar un artefacto a una sesión, ya validados. */
export interface NewArtifactInput {
  sessionId: string;
  kind: ArtifactKind;
  label: string;
  target: string;
}
