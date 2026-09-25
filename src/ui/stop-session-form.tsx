'use client';

import { useActionState } from 'react';

import { stopSessionAction } from '@/app/session-actions';
import type { SessionType } from '@/core/model/session-type';
import { EMPTY_SESSION_ACTION_STATE } from '@/ui/session-form-state';
import type { RunningSessionView } from '@/ui/session-view';

/**
 * RF-23, RF-25, RF-28, RF-2H — detener la sesión y guardarla.
 *
 * **El flujo de confirmación de RF-25 vive aquí.** Cuando el cronómetro marca
 * más de ocho horas, la acción no guarda nada: devuelve `status: 'confirm'` con
 * los minutos calculados y este formulario abre el campo de corrección. Es el
 * caso real de "se me olvidó detenerlo y lo noto al día siguiente": sin esta
 * puerta, un olvido mete catorce horas falsas y arruina las estadísticas.
 *
 * En la variante `compact` —la barra que acompaña a todas las vistas (RF-2F)—
 * no se piden nota ni minutos de atasco, pero el tipo de sesión viaja igual en
 * un campo oculto: cerrar desde la barra no puede borrar lo que se eligió al
 * iniciar.
 */
export function StopSessionForm({
  session,
  sessionTypes,
  variant,
}: {
  session: RunningSessionView;
  sessionTypes: readonly SessionType[];
  variant: 'compact' | 'full';
}) {
  const [state, formAction, pending] = useActionState(
    stopSessionAction,
    EMPTY_SESSION_ACTION_STATE,
  );

  const confirming = state.status === 'confirm';
  const inputClass =
    'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20';

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="sessionId" value={session.id} />

      {/* RF-25 — la confirmación se pide una vez; a partir de ahí el envío la lleva. */}
      {confirming ? <input type="hidden" name="confirmed" value="1" /> : null}

      {variant === 'compact' ? (
        <input type="hidden" name="sessionTypeId" value={session.sessionTypeId ?? ''} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="stop-session-type" className="block text-sm font-medium">
              Tipo de sesión
            </label>
            <select
              id="stop-session-type"
              name="sessionTypeId"
              defaultValue={session.sessionTypeId ?? ''}
              className={inputClass}
            >
              <option value="">Sin tipo</option>
              {sessionTypes.map((sessionType) => (
                <option key={sessionType.id} value={sessionType.id}>
                  {sessionType.code} · {sessionType.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="stop-stuck-minutes" className="block text-sm font-medium">
              Minutos de atasco
            </label>
            <input
              id="stop-stuck-minutes"
              name="stuckMinutes"
              type="number"
              min={0}
              defaultValue={0}
              className={inputClass}
            />
            <p className="mt-1 text-xs opacity-60">
              Tiempo bloqueado sin avanzar. Es el dato que más enseña.
            </p>
            {state.fieldErrors.stuckMinutes ? (
              <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.stuckMinutes}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="stop-note" className="block text-sm font-medium">
              Nota
            </label>
            <textarea id="stop-note" name="note" rows={2} className={inputClass} />
            {state.fieldErrors.note ? (
              <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.note}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {confirming ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3">
          <p role="alert" className="text-sm">
            {state.message}
          </p>

          <label htmlFor="stop-minutes-override" className="mt-3 block text-sm font-medium">
            Duración real en minutos
          </label>
          <input
            id="stop-minutes-override"
            name="minutesOverride"
            type="number"
            min={1}
            placeholder={`Déjalo vacío para aceptar ${state.pendingMinutes ?? 0}`}
            className={inputClass}
          />
          {state.fieldErrors.minutesOverride ? (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.minutesOverride}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? 'Guardando…' : confirming ? 'Guardar con esta duración' : 'Detener y guardar'}
        </button>

        {state.message && !confirming ? (
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
