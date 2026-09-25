'use client';

import { useActionState } from 'react';

import { createSessionTypeAction } from '@/app/actions';
import {
  SESSION_TYPE_CODE_MAX_LENGTH,
  SESSION_TYPE_LABEL_MAX_LENGTH,
} from '@/core/services/session-type';
import { EMPTY_FORM_STATE } from '@/ui/form-state';

/**
 * RF-15 — alta de un tipo de sesión propio del programa.
 *
 * El `programId` viaja en un campo oculto y la Server Action lo vuelve a
 * validar: un campo oculto es tan editable como cualquier otro (RF-44).
 */
const inputClass =
  'w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20';

export function SessionTypeForm({ programId }: { programId: string }) {
  const [state, formAction, pending] = useActionState(createSessionTypeAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="programId" value={programId} />

      <div className="w-20">
        <label htmlFor={`code-${programId}`} className="block text-xs opacity-60">
          Código
        </label>
        <input
          id={`code-${programId}`}
          name="code"
          type="text"
          required
          maxLength={SESSION_TYPE_CODE_MAX_LENGTH}
          className={inputClass}
        />
      </div>

      <div className="min-w-40 flex-1">
        <label htmlFor={`label-${programId}`} className="block text-xs opacity-60">
          Etiqueta
        </label>
        <input
          id={`label-${programId}`}
          name="label"
          type="text"
          required
          maxLength={SESSION_TYPE_LABEL_MAX_LENGTH}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-black/15 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/20"
      >
        {pending ? 'Guardando…' : 'Agregar'}
      </button>

      {state.message ? (
        <p
          role="status"
          className={`w-full text-xs ${
            state.status === 'error'
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-700 dark:text-green-400'
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
