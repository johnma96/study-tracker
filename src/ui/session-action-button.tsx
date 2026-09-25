'use client';

import { useActionState } from 'react';

import {
  EMPTY_SESSION_ACTION_STATE,
  type SessionActionState,
} from '@/ui/session-form-state';

/**
 * Botón que dispara una Server Action sobre la sesión en curso.
 *
 * Es un `<form>` y no un `onClick`: así funciona también sin JavaScript en el
 * cliente, que es la garantía de que la operación la decide el servidor y no el
 * navegador (RF-44). El `sessionId` viaja en un campo oculto y la acción lo
 * vuelve a validar: un campo oculto es tan editable como cualquier otro.
 */
export function SessionActionButton({
  action,
  sessionId,
  label,
  pendingLabel,
  tone = 'neutral',
  confirmMessage,
}: {
  action: (state: SessionActionState, formData: FormData) => Promise<SessionActionState>;
  sessionId: string;
  label: string;
  pendingLabel: string;
  tone?: 'neutral' | 'danger' | 'primary';
  /** Confirmación del navegador para lo que destruye datos (RF-27). */
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_SESSION_ACTION_STATE);

  const toneClass =
    tone === 'danger'
      ? 'border-red-500/50 text-red-700 dark:text-red-400'
      : tone === 'primary'
        ? 'border-transparent bg-foreground text-background'
        : 'border-black/15 dark:border-white/20';

  return (
    <form
      action={formAction}
      className="inline-flex flex-col gap-1"
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <input type="hidden" name="sessionId" value={sessionId} />

      <button
        type="submit"
        disabled={pending}
        className={`rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${toneClass}`}
      >
        {pending ? pendingLabel : label}
      </button>

      {state.message ? (
        <p
          role="status"
          className={
            state.status === 'error'
              ? 'text-xs text-red-600 dark:text-red-400'
              : state.status === 'success'
                ? 'text-xs text-green-700 dark:text-green-400'
                : 'text-xs opacity-70'
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
