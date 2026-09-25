import type { ArtifactKind } from '@/core/model/artifact';

/**
 * Etiquetas en español de los tipos de RF-51.
 *
 * Viven en `ui/` porque son presentación: el dominio y la base guardan los
 * códigos en inglés (`doc`, `image`…), que son los que fija el requerimiento y
 * el CHECK del motor. Archivo propio, y no una entrada más en `labels.ts`, para
 * que la rebanada no toque un archivo compartido con R1.
 */
export const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  doc: 'Documento',
  image: 'Imagen',
  repo: 'Repositorio',
  link: 'Enlace',
  commit: 'Commit',
};
