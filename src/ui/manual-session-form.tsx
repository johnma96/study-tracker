'use client';

import { useActionState, useState } from 'react';

import { createManualSessionAction } from '@/app/session-actions';
import type { Program } from '@/core/model/program';
import type { SessionType } from '@/core/model/session-type';
import { EMPTY_SESSION_ACTION_STATE } from '@/ui/session-form-state';

/**
 * RF-26 — registrar una sesión a mano, sin cronómetro.
 *
 * La fecha y la hora se escriben en **hora de Colombia** (RF-00): el servidor
 * las convierte al instante UTC que se almacena. Si se guardara la hora tal
 * cual, una sesión de las 20:00 registrada desde un servidor en UTC aparecería
 * cinco horas movida, y con ella el día en que cuenta.
 *
 * Esta sesión nace cerrada, así que no choca con el índice `one_running_session`:
 * se puede anotar la sesión de ayer aunque ahora mismo haya otra corriendo. *
 * R8 — el programa llega preseleccionado desde el contexto de la URL. Sigue
 * siendo un selector completo: con «todos» no hay nada que preseleccionar y
 * con un programa elegido el formulario ya viene apuntando ahí, pero se puede
 * cambiar. Quien monta este formulario le pone una `key` que depende del
 * contexto: sin ella React conserva la instancia al navegar y el estado inicial
 * de `useState` no se vuelve a evaluar, así que el selector se quedaría en el
 * programa anterior.
 */
export function ManualSessionForm({
  programs,
  sessionTypes,
  todayInAppZone,
  selectedProgramId,
}: {
  programs: readonly Program[];
  sessionTypes: readonly SessionType[];
  /** Fecha de hoy en `America/Bogota`, calculada en el servidor. */
  todayInAppZone: string;
  /** R8 — programa del contexto, o `null` con «todos». */
  selectedProgramId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    createManualSessionAction,
    EMPTY_SESSION_ACTION_STATE,
  );
  const [programId, setProgramId] = useState(selectedProgramId ?? programs[0]?.id ?? '');

  const inputClass =
    'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20';
  const typesOfProgram = sessionTypes.filter((type) => type.programId === programId);

  if (programs.length === 0) return null;

  const fieldError = (field: string) =>
    state.fieldErrors[field] ? (
      <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
        {state.fieldErrors[field]}
      </p>
    ) : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="manual-program" className="block text-sm font-medium">
            Programa
          </label>
          <select
            id="manual-program"
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
          {fieldError('programId')}
        </div>

        <div>
          <label htmlFor="manual-session-type" className="block text-sm font-medium">
            Tipo de sesión
          </label>
          <select id="manual-session-type" name="sessionTypeId" className={inputClass}>
            <option value="">Sin tipo</option>
            {typesOfProgram.map((sessionType) => (
              <option key={sessionType.id} value={sessionType.id}>
                {sessionType.code} · {sessionType.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="manual-date" className="block text-sm font-medium">
            Fecha
          </label>
          <input
            id="manual-date"
            name="startedOn"
            type="date"
            required
            defaultValue={todayInAppZone}
            className={inputClass}
          />
          {fieldError('startedOn')}
        </div>

        <div>
          <label htmlFor="manual-time" className="block text-sm font-medium">
            Hora de inicio
          </label>
          <input
            id="manual-time"
            name="startedAtTime"
            type="time"
            required
            className={inputClass}
          />
          <p className="mt-1 text-xs opacity-60">Hora de Colombia.</p>
          {fieldError('startedAtTime')}
        </div>

        <div>
          <label htmlFor="manual-minutes" className="block text-sm font-medium">
            Duración en minutos
          </label>
          <input
            id="manual-minutes"
            name="minutes"
            type="number"
            min={1}
            required
            className={inputClass}
          />
          {fieldError('minutes')}
        </div>

        <div>
          <label htmlFor="manual-stuck" className="block text-sm font-medium">
            Minutos de atasco
          </label>
          <input
            id="manual-stuck"
            name="stuckMinutes"
            type="number"
            min={0}
            defaultValue={0}
            className={inputClass}
          />
          {fieldError('stuckMinutes')}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="manual-note" className="block text-sm font-medium">
            Nota
          </label>
          <textarea id="manual-note" name="note" rows={2} className={inputClass} />
          {fieldError('note')}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/20"
        >
          {pending ? 'Registrando…' : 'Registrar sesión'}
        </button>

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
