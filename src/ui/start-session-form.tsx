'use client';

import { useActionState, useState } from 'react';

import { startSessionAction } from '@/app/session-actions';
import type { Program } from '@/core/model/program';
import type { SessionType } from '@/core/model/session-type';
import { EMPTY_SESSION_ACTION_STATE } from '@/ui/session-form-state';

/**
 * RF-20, RF-22, RF-28 — iniciar una sesión.
 *
 * El formulario **no** comprueba si ya hay una sesión en curso. Esa regla la
 * impone el índice único de la base (`one_running_session`) y la acción del
 * servidor traduce su rechazo a un mensaje: una validación que solo viva aquí
 * se salta abriendo dos pestañas.
 *
 * Los botones se deshabilitan cuando ya hay una sesión corriendo porque es
 * información útil, no porque sea el control. *
 * R8 — el programa llega preseleccionado desde el contexto de la URL. Sigue
 * siendo un selector completo: con «todos» no hay nada que preseleccionar y
 * con un programa elegido el formulario ya viene apuntando ahí, pero se puede
 * cambiar. Quien monta este formulario le pone una `key` que depende del
 * contexto: sin ella React conserva la instancia al navegar y el estado inicial
 * de `useState` no se vuelve a evaluar, así que el selector se quedaría en el
 * programa anterior.
 */
export function StartSessionForm({
  programs,
  sessionTypes,
  hasRunningSession,
  selectedProgramId,
}: {
  programs: readonly Program[];
  sessionTypes: readonly SessionType[];
  hasRunningSession: boolean;
  /** R8 — programa del contexto, o `null` con «todos». */
  selectedProgramId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    startSessionAction,
    EMPTY_SESSION_ACTION_STATE,
  );
  const [programId, setProgramId] = useState(selectedProgramId ?? programs[0]?.id ?? '');

  const inputClass =
    'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20';
  const typesOfProgram = sessionTypes.filter((type) => type.programId === programId);

  if (programs.length === 0) {
    return (
      <p className="text-sm opacity-80">
        Crea primero un programa: una sesión siempre pertenece a uno.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="start-program" className="block text-sm font-medium">
            Programa
          </label>
          <select
            id="start-program"
            name="programId"
            value={programId}
            onChange={(event) => setProgramId(event.target.value)}
            className={inputClass}
          >
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          {state.fieldErrors.programId ? (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.programId}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="start-session-type" className="block text-sm font-medium">
            Tipo de sesión
          </label>
          <select id="start-session-type" name="sessionTypeId" className={inputClass}>
            <option value="">Sin tipo</option>
            {typesOfProgram.map((sessionType) => (
              <option key={sessionType.id} value={sessionType.id}>
                {sessionType.code} · {sessionType.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs opacity-60">Se puede cambiar al detener la sesión.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || hasRunningSession}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? 'Iniciando…' : 'Iniciar sesión'}
        </button>

        {hasRunningSession ? (
          <p className="text-sm opacity-70">
            Ya hay una sesión en curso. Detenla o descártala desde la barra superior.
          </p>
        ) : null}

        {state.message ? (
          <p
            role="status"
            className={
              state.status === 'error'
                ? 'text-sm text-red-600 dark:text-red-400'
                : state.status === 'success'
                  ? 'text-sm text-green-700 dark:text-green-400'
                  : 'text-sm opacity-70'
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
