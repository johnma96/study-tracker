import type { Program } from '@/core/model/program';

/**
 * Componente de presentación puro: recibe un programa ya cargado y lo pinta.
 *
 * La capa `ui/` no accede a datos (docs/ARCHITECTURE.md). Quien lee de la base
 * es la página, a través del repositorio.
 */
export function ProgramCard({ program }: { program: Program }) {
  return (
    <article className="rounded-lg border border-black/10 p-6 dark:border-white/15">
      <h2 className="text-xl font-semibold">{program.name}</h2>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="opacity-60">Proveedor</dt>
        <dd>{program.provider ?? '—'}</dd>

        <dt className="opacity-60">Tipo</dt>
        <dd>{program.kind}</dd>

        <dt className="opacity-60">Estado</dt>
        <dd>{program.status}</dd>

        <dt className="opacity-60">Sesiones planeadas</dt>
        <dd>{program.plannedSessions ?? '—'}</dd>
      </dl>
    </article>
  );
}
