import type { SessionEvidence } from '@/core/ports/artifact-repository';
import { drizzleArtifactRepository } from '@/infra/repos/drizzle-artifact-repository';

/**
 * Carga de la evidencia de las sesiones recientes (R4).
 *
 * Vive en `app/` y no en `ui/` porque lee de la base: la capa de presentación
 * no accede a datos (docs/ARCHITECTURE.md). Es el mismo reparto que
 * `current-session.ts`.
 *
 * Si la base no responde, la página no se cae: devuelve `unavailable` y la
 * sección lo dice. El detalle del fallo se queda en el servidor (RF-43).
 */

/** Cuántas sesiones recientes se muestran para adjuntarles evidencia. */
export const RECENT_EVIDENCE_LIMIT = 10;

export interface EvidenceSnapshot {
  readonly items: readonly SessionEvidence[];
  readonly unavailable: boolean;
}

export async function loadRecentEvidence(): Promise<EvidenceSnapshot> {
  try {
    const items = await drizzleArtifactRepository.listRecentEvidence(RECENT_EVIDENCE_LIMIT);
    return { items, unavailable: false };
  } catch (error) {
    console.error('[loadRecentEvidence]', error);
    return { items: [], unavailable: true };
  }
}
