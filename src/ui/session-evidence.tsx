import type { Program } from '@/core/model/program';
import type { SessionType } from '@/core/model/session-type';
import type { SessionEvidence as SessionEvidenceItem } from '@/core/ports/artifact-repository';
import { effectiveMinutes } from '@/core/services/session-duration';
import { toCivilDateInAppZone, toCivilTimeInAppZone } from '@/core/services/timezone';
import { Badge } from '@/ui/primitives/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/primitives/card';
import { SessionArtifacts } from '@/ui/session-artifacts';

/**
 * R4 — evidencia de las sesiones recientes (RF-50 a RF-53).
 *
 * Componente de presentación: recibe las sesiones y sus artefactos ya cargados
 * por `app/evidence.ts`, y los programas y tipos que la página ya había leído.
 * No accede a datos.
 *
 * Cada sesión muestra su evidencia y un formulario para adjuntar más. No es la
 * lista de sesiones de un programa —eso es RF-30, de R3—: es el lugar desde el
 * que se cuelga la evidencia de lo que se acaba de estudiar. El contenido de
 * cada tarjeta es `SessionArtifacts`, que es lo que se reutiliza si la
 * evidencia pasa a colgarse del listado de R3.
 */
function sessionHeading(
  item: SessionEvidenceItem,
  programNames: ReadonlyMap<string, string>,
  sessionTypes: ReadonlyMap<string, SessionType>,
) {
  const { session } = item;
  const type = session.sessionTypeId ? sessionTypes.get(session.sessionTypeId) : undefined;
  const minutes = effectiveMinutes(session);

  return {
    program: programNames.get(session.programId) ?? 'Programa desconocido',
    // RF-00 — la fecha y la hora se presentan en Colombia, no en UTC.
    when: `${toCivilDateInAppZone(session.startedAt)} · ${toCivilTimeInAppZone(session.startedAt)}`,
    type: type ? `${type.code} · ${type.label}` : null,
    duration: minutes === null ? 'En curso' : `${minutes} min`,
  };
}

export function SessionEvidence({
  items,
  unavailable,
  programs,
  sessionTypes,
}: {
  items: readonly SessionEvidenceItem[];
  unavailable: boolean;
  programs: readonly Program[];
  sessionTypes: readonly SessionType[];
}) {
  const programNames = new Map(programs.map((program) => [program.id, program.name]));
  const typesById = new Map(sessionTypes.map((sessionType) => [sessionType.id, sessionType]));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="evidence-heading">
      <div>
        <h2 id="evidence-heading" className="text-xl font-semibold">
          Evidencia de las sesiones recientes
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Enlaza lo que produjo cada sesión: el documento, el commit, la captura. Se guarda la
          referencia, nunca el archivo.
        </p>
      </div>

      {unavailable ? (
        <p className="rounded-lg border border-destructive/40 p-4 text-sm">
          No se pudo leer la evidencia de la base de datos.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm opacity-80">
          Todavía no hay sesiones. Cuando registres la primera, aquí podrás adjuntarle evidencia.
        </p>
      ) : (
        items.map((item) => {
          const heading = sessionHeading(item, programNames, typesById);

          return (
            <Card key={item.session.id} size="sm">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {heading.program}
                  <Badge variant={item.session.endedAt === null ? 'default' : 'secondary'}>
                    {heading.duration}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {heading.when}
                  {heading.type ? ` · ${heading.type}` : ''}
                  {` · ${item.artifacts.length} artefacto${item.artifacts.length === 1 ? '' : 's'}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SessionArtifacts sessionId={item.session.id} artifacts={item.artifacts} />
              </CardContent>
            </Card>
          );
        })
      )}
    </section>
  );
}
