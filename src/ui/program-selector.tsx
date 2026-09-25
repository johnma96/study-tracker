import Link from 'next/link';

import type { Program } from '@/core/model/program';
import {
  ALL_PROGRAMS,
  isSelectedProgram,
  PROGRAM_PARAM,
  type ProgramContext,
} from '@/core/services/program-context';

/**
 * R8 — selector del programa que gobierna la página.
 *
 * **Son enlaces, no un `onChange`.** El estado vive en la URL, así que cambiar
 * de programa *es* navegar: un `<select>` que llama a `router.push` haría lo
 * mismo pero solo con JavaScript activo, y dejaría la selección fuera del
 * historial del navegador. Con enlaces, «atrás» vuelve al programa anterior, el
 * enlace se puede copiar y compartir, y la página entera se sigue renderizando
 * en el servidor sin un solo `useState`. Es el mismo criterio que documenta
 * `SessionActionButton`: quien decide es el servidor, no el navegador.
 *
 * `Link` degrada a un `<a href>` corriente cuando no hay JavaScript; lo que
 * añade es la transición de cliente y el prefetch.
 *
 * Componente de presentación: los programas los lee la página.
 */
export function ProgramSelector({
  programs,
  context,
}: {
  programs: readonly Program[];
  context: ProgramContext;
}) {
  const base =
    'rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10';
  const selected = 'border-transparent bg-foreground text-background hover:bg-foreground';
  const idle = 'border-black/15 dark:border-white/20';

  return (
    <nav aria-label="Programa en contexto" className="flex flex-col gap-2">
      <p className="text-sm font-medium">Ver</p>

      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <Link
            href={`/?${PROGRAM_PARAM}=${ALL_PROGRAMS}`}
            aria-current={context.kind === 'all' ? 'page' : undefined}
            className={`${base} ${context.kind === 'all' ? selected : idle}`}
          >
            Todos los programas
          </Link>
        </li>

        {programs.map((program) => {
          const active = isSelectedProgram(context, program.id);

          return (
            <li key={program.id}>
              <Link
                // `encodeURIComponent` aunque el identificador sea un UUID: el
                // valor sale de la base y el enlace no debe depender de que su
                // formato no cambie nunca.
                href={`/?${PROGRAM_PARAM}=${encodeURIComponent(program.id)}`}
                aria-current={active ? 'page' : undefined}
                className={`${base} ${active ? selected : idle}`}
              >
                {program.name}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-xs opacity-60">
        {context.kind === 'all'
          ? 'Totales, mapa de calor, métricas y evidencia suman todos los programas.'
          : 'Todo lo que sigue corresponde solo a este programa. La URL conserva la selección.'}
      </p>
    </nav>
  );
}
