'use client';

import { useActionState, useState } from 'react';

import { discardSessionAction, stopSessionAction } from '@/app/session-actions';
import { toCivilDateInAppZone, toCivilTimeInAppZone } from '@/core/services/timezone';
import { EMPTY_SESSION_ACTION_STATE } from '@/ui/session-form-state';
import type { RunningSessionView } from '@/ui/session-view';

/**
 * RF-2G — diálogo de recuperación de sesión abandonada.
 *
 * **Es la válvula de escape del índice único.** El mismo mecanismo que garantiza
 * "como máximo una sesión en curso" puede dejar la aplicación en un punto
 * muerto: si el navegador se cierra sin llamar al cierre, la sesión queda
 * abierta y ninguna otra puede empezar. Sin este diálogo, la única salida es
 * entrar a la base a mano. Por eso se implementa junto con el índice y no
 * después.
 *
 * Las tres opciones son las que fija el requerimiento: cerrarla indicando la
 * duración real —que se guarda en `minutes_override` (RF-2H)—, descartarla, o
 * continuarla. "Continuar" no escribe nada: solo cierra el aviso en esta vista.
 */
export function SessionRecoveryDialog({
  session,
  children,
}: {
  session: RunningSessionView;
  /** El reloj de la sesión, para que se vea cuánto lleva abierta. */
  children?: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [stopState, stopAction, stopPending] = useActionState(
    stopSessionAction,
    EMPTY_SESSION_ACTION_STATE,
  );
  const [discardState, discardAction, discardPending] = useActionState(
    discardSessionAction,
    EMPTY_SESSION_ACTION_STATE,
  );

  if (dismissed) return null;

  const startedAt = new Date(session.startedAtIso);
  const inputClass =
    'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20';

  return (
    <section
      role="alertdialog"
      aria-labelledby="session-recovery-title"
      className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-6"
    >
      <h2 id="session-recovery-title" className="text-lg font-semibold">
        Hay una sesión abierta desde hace más de 8 horas
      </h2>

      <p className="mt-2 text-sm opacity-80">
        Empezó el {toCivilDateInAppZone(startedAt)} a las {toCivilTimeInAppZone(startedAt)}
        {session.programName ? ` en "${session.programName}"` : ''}. Lo más probable es que se te
        haya olvidado detener el cronómetro. Mientras siga abierta no puedes iniciar otra.
      </p>

      {children}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <form action={stopAction} className="flex flex-col gap-2">
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="sessionTypeId" value={session.sessionTypeId ?? ''} />
          {/* RF-2H — la duración que se indique aquí se guarda como minutes_override. */}
          <input type="hidden" name="confirmed" value="1" />

          <label htmlFor="recovery-minutes" className="text-sm font-medium">
            Cerrarla con la duración real
          </label>
          <input
            id="recovery-minutes"
            name="minutesOverride"
            type="number"
            min={1}
            required
            placeholder="minutos"
            className={inputClass}
          />
          {stopState.fieldErrors.minutesOverride ? (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {stopState.fieldErrors.minutesOverride}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={stopPending}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {stopPending ? 'Guardando…' : 'Cerrar sesión'}
          </button>

          {stopState.message ? (
            <p role="status" className="text-xs opacity-80">
              {stopState.message}
            </p>
          ) : null}
        </form>

        <div className="flex flex-col justify-end gap-2">
          <form action={discardAction} className="flex flex-col gap-2">
            <input type="hidden" name="sessionId" value={session.id} />
            <button
              type="submit"
              disabled={discardPending}
              className="rounded-md border border-red-500/50 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:text-red-400"
            >
              {discardPending ? 'Descartando…' : 'Descartarla'}
            </button>
            <p className="text-xs opacity-60">Se borra: no queda registrada ninguna duración.</p>

            {discardState.message ? (
              <p role="status" className="text-xs opacity-80">
                {discardState.message}
              </p>
            ) : null}
          </form>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
          >
            Continuarla
          </button>
          <p className="text-xs opacity-60">
            La sesión sigue corriendo. Este aviso vuelve a aparecer al recargar.
          </p>
        </div>
      </div>
    </section>
  );
}
