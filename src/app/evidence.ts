import type { SessionEvidence } from '@/core/ports/artifact-repository';
import {
  filterSessionEvidenceByProgramContext,
  type ProgramContext,
} from '@/core/services/program-context';
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

/**
 * R8 — cuántas sesiones se leen antes de recortar por programa.
 *
 * El recorte por contexto ocurre en `core/`, sobre lo ya leído, para que la
 * regla se pruebe sin base de datos. La consecuencia es que hay que leer un
 * poco más de lo que se muestra: si se leyeran solo diez sesiones y todas
 * fueran del otro programa, el programa elegido saldría vacío **teniendo**
 * evidencia. Con una ventana mayor, lo que se ve son de verdad las sesiones
 * recientes del contexto.
 */
const EVIDENCE_POOL_LIMIT = 50;

export interface EvidenceSnapshot {
  readonly items: readonly SessionEvidence[];
  readonly unavailable: boolean;
}

export async function loadRecentEvidence(context: ProgramContext): Promise<EvidenceSnapshot> {
  try {
    const pool = await drizzleArtifactRepository.listRecentEvidence(EVIDENCE_POOL_LIMIT);
    const items = filterSessionEvidenceByProgramContext(pool, context).slice(
      0,
      RECENT_EVIDENCE_LIMIT,
    );

    return { items, unavailable: false };
  } catch (error) {
    console.error('[loadRecentEvidence]', error);
    return { items: [], unavailable: true };
  }
}
