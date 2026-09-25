import type { Artifact } from '@/core/model/artifact';
import { ArtifactForm } from '@/ui/artifact-form';
import { ArtifactList } from '@/ui/artifact-list';

/**
 * R4 — la evidencia de **una** sesión: sus artefactos y el formulario para
 * adjuntar otro (RF-50 a RF-53).
 *
 * Es la pieza autocontenida que se engancha a cualquier listado de sesiones:
 * solo necesita el id de la sesión y sus artefactos ya cargados. Para cargarlos
 * sin una consulta por fila: `drizzleArtifactRepository.listBySessionIds(ids)`
 * y `groupArtifactsBySession` de `core/services`, y aquí
 * `artifacts={grouped.get(session.id) ?? []}`.
 *
 * Componente de presentación: no accede a datos.
 */
export function SessionArtifacts({
  sessionId,
  artifacts,
  repoUrl,
}: {
  sessionId: string;
  artifacts: readonly Artifact[];
  /** R7 — base del repositorio del programa, para enlazar rutas relativas. */
  repoUrl?: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ArtifactList artifacts={artifacts} repoUrl={repoUrl} />
      <div className="border-t border-border pt-4">
        <ArtifactForm sessionId={sessionId} />
      </div>
    </div>
  );
}
