'use client';

import { useActionState } from 'react';

import { createProgramAction } from '@/app/actions';
import { PROGRAM_KINDS, PROGRAM_STATUSES } from '@/core/model/program';
import { PROGRAM_NAME_MAX_LENGTH } from '@/core/services/program-name';
import { EMPTY_FORM_STATE } from '@/ui/form-state';
import { PROGRAM_KIND_LABELS, PROGRAM_STATUS_LABELS } from '@/ui/labels';

/**
 * RF-10 — formulario de creación de programa.
 *
 * Los atributos `required` y `maxLength` son **conveniencia**, no control: la
 * validación que decide es la de la Server Action (RF-44). Por eso el
 * formulario muestra los motivos que devuelve el servidor y no duplica las
 * reglas en el navegador.
 */
const inputClass =
  'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20';

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;

  return (
    <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

export function ProgramForm() {
  const [state, formAction, pending] = useActionState(createProgramAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Nombre <span aria-hidden="true">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={PROGRAM_NAME_MAX_LENGTH}
          aria-describedby={state.fieldErrors.name ? 'name-error' : undefined}
          className={inputClass}
        />
        <span id="name-error">
          <FieldError message={state.fieldErrors.name} />
        </span>
      </div>

      <div>
        <label htmlFor="provider" className="block text-sm font-medium">
          Proveedor
        </label>
        <input id="provider" name="provider" type="text" className={inputClass} />
        <FieldError message={state.fieldErrors.provider} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="kind" className="block text-sm font-medium">
            Tipo
          </label>
          <select id="kind" name="kind" defaultValue="course" className={inputClass}>
            {PROGRAM_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {PROGRAM_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors.kind} />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium">
            Estado
          </label>
          <select id="status" name="status" defaultValue="planned" className={inputClass}>
            {PROGRAM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PROGRAM_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors.status} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startedAt" className="block text-sm font-medium">
            Fecha de inicio
          </label>
          <input id="startedAt" name="startedAt" type="date" className={inputClass} />
          <FieldError message={state.fieldErrors.startedAt} />
        </div>

        <div>
          <label htmlFor="targetAt" className="block text-sm font-medium">
            Fecha objetivo
          </label>
          <input id="targetAt" name="targetAt" type="date" className={inputClass} />
          <FieldError message={state.fieldErrors.targetAt} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Crear programa'}
        </button>

        {state.message ? (
          <p
            role="status"
            className={
              state.status === 'error'
                ? 'text-sm text-red-600 dark:text-red-400'
                : 'text-sm text-green-700 dark:text-green-400'
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
