import type { Program } from '@/core/model/program';
import type { SessionType } from '@/core/model/session-type';
import { PROGRAM_KIND_LABELS, PROGRAM_STATUS_LABELS } from '@/ui/labels';
import { SessionTypeForm } from '@/ui/session-type-form';

/**
 * Componente de presentación: recibe un programa ya cargado y lo pinta.
 *
 * La capa `ui/` no accede a datos (docs/ARCHITECTURE.md). Quien lee de la base
 * es la página, a través del repositorio.
 */
export function ProgramCard({
  program,
  sessionTypes,
}: {
  program: Program;
  sessionTypes: readonly SessionType[];
}) {
  return (
    <article className="rounded-lg border border-black/10 p-6 dark:border-white/15">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{program.name}</h3>
        <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs dark:border-white/20">
          {PROGRAM_STATUS_LABELS[program.status]}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="opacity-60">Proveedor</dt>
        <dd>{program.provider ?? '—'}</dd>

        <dt className="opacity-60">Tipo</dt>
        <dd>{PROGRAM_KIND_LABELS[program.kind]}</dd>

        <dt className="opacity-60">Inicio</dt>
        <dd>{program.startedAt ?? '—'}</dd>

        <dt className="opacity-60">Objetivo</dt>
        <dd>{program.targetAt ?? '—'}</dd>
      </dl>

      <section className="mt-5 border-t border-black/10 pt-4 dark:border-white/15">
        <h4 className="text-sm font-medium">Tipos de sesión</h4>

        {sessionTypes.length === 0 ? (
          <p className="mt-2 text-sm opacity-70">
            Este programa todavía no tiene tipos de sesión.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {sessionTypes.map((sessionType) => (
              <li
                key={sessionType.id}
                className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/15"
              >
                <span className="font-mono font-semibold">{sessionType.code}</span>{' '}
                {sessionType.label}
              </li>
            ))}
          </ul>
        )}

        <SessionTypeForm programId={program.id} />
      </section>
    </article>
  );
}
