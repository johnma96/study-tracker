import type { Artifact } from '../model/artifact';

/**
 * RF-52 — agrupa artefactos por sesión conservando el orden de entrada.
 *
 * Existe para que cualquier listado de sesiones —la sección de evidencia de R4
 * o el listado de R3 (RF-30)— lea los artefactos de **todas** sus sesiones en
 * una sola consulta (`listBySessionIds`) y los reparta aquí, en vez de hacer
 * una consulta por fila.
 *
 * Una sesión sin artefactos no aparece en el mapa: quien lo consulta usa
 * `?? []`.
 */
export function groupArtifactsBySession(
  artifacts: readonly Artifact[],
): Map<string, Artifact[]> {
  const grouped = new Map<string, Artifact[]>();

  for (const artifact of artifacts) {
    const current = grouped.get(artifact.sessionId);
    if (current) current.push(artifact);
    else grouped.set(artifact.sessionId, [artifact]);
  }

  return grouped;
}
