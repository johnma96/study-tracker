import type { Artifact } from '@/core/model/artifact';
import { artifactHref, thumbnailSrc } from '@/core/services/artifact-target';
import { ARTIFACT_KIND_LABELS } from '@/ui/artifact-labels';
import { ArtifactThumbnail } from '@/ui/artifact-thumbnail';
import { Badge } from '@/ui/primitives/badge';

/**
 * RF-52, RF-53 — artefactos de una sesión.
 *
 * Componente de presentación: recibe los artefactos ya cargados (la capa `ui/`
 * no accede a datos).
 *
 * **Seguridad al presentar (OWASP).** El `href` no sale de `artifact.target`
 * directamente sino de `safeExternalHref`, que vuelve a aplicar la lista blanca
 * `http`/`https` aunque la fila ya esté en la base: un `javascript:` escrito
 * saltándose la Server Action se pinta como texto, nunca como enlace. Todo
 * enlace externo abre en pestaña nueva (RF-52) con `rel="noopener noreferrer"`,
 * para que la página de destino no pueda manipular esta con `window.opener` ni
 * reciba la URL de origen.
 *
 * R7 — una ruta relativa de repositorio **sí** se enlaza cuando el programa
 * tiene `repoUrl`: `artifactHref` la resuelve contra esa base. Sin base sigue
 * mostrándose como texto, porque un `href` relativo apuntaría a esta misma
 * aplicación y no al repositorio.
 */
export function ArtifactList({
  artifacts,
  repoUrl,
}: {
  artifacts: readonly Artifact[];
  /** Base del repositorio del programa de la sesión, si la tiene (R7). */
  repoUrl?: string | null;
}) {
  if (artifacts.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin evidencia adjunta todavía.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {artifacts.map((artifact) => {
        const href = artifactHref(artifact.target, repoUrl);
        const thumbnail = thumbnailSrc(artifact);

        return (
          <li key={artifact.id} className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{ARTIFACT_KIND_LABELS[artifact.kind]}</Badge>

              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-4 hover:opacity-80"
                >
                  {artifact.label}
                  <span className="sr-only"> (abre en una pestaña nueva)</span>
                </a>
              ) : (
                <span className="font-medium">{artifact.label}</span>
              )}
            </div>

            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {artifact.target}
            </p>

            {thumbnail ? (
              <a href={thumbnail} target="_blank" rel="noopener noreferrer" className="w-fit">
                <ArtifactThumbnail src={thumbnail} alt={artifact.label} />
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
