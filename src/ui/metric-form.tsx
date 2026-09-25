'use client';

import { useActionState } from 'react';

import { createMetricAction } from '@/app/metric-actions';
import { METRIC_NAME_MAX_LENGTH, METRIC_UNIT_MAX_LENGTH } from '@/core/services/metric-input';
import { EMPTY_FORM_STATE } from '@/ui/form-state';

/**
 * RF-60 — define una métrica propia del programa: nombre, unidad, dirección de
 * mejora y objetivo opcional.
 *
 * Nombre y unidad son texto libre a propósito: cada programa mide su progreso a
 * su manera, y una lista cerrada obligaría a cambiar el código con el segundo
 * programa. El `programId` viaja en un campo oculto y la Server Action lo vuelve
 * a validar (RF-44).
 */
const inputClass =
  'w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20';

export function MetricForm({ programId }: { programId: string }) {
  const [state, formAction, pending] = useActionState(createMetricAction, EMPTY_FORM_STATE);
  const id = (field: string) => `metric-${field}-${programId}`;

  const fieldError = (field: string) =>
    state.fieldErrors[field] ? (
      <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
        {state.fieldErrors[field]}
      </p>
    ) : null;

  return (
    <form action={formAction} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="programId" value={programId} />

      <div>
        <label htmlFor={id('name')} className="block text-xs opacity-60">
          Nombre
        </label>
        <input
          id={id('name')}
          name="name"
          type="text"
          required
          maxLength={METRIC_NAME_MAX_LENGTH}
          placeholder="Score, módulos, nota…"
          className={inputClass}
        />
        {fieldError('name')}
      </div>

      <div>
        <label htmlFor={id('unit')} className="block text-xs opacity-60">
          Unidad
        </label>
        <input
          id={id('unit')}
          name="unit"
          type="text"
          maxLength={METRIC_UNIT_MAX_LENGTH}
          className={inputClass}
        />
        {fieldError('unit')}
      </div>

      <div>
        <label htmlFor={id('direction')} className="block text-xs opacity-60">
          Mejora si
        </label>
        <select id={id('direction')} name="direction" defaultValue="up" className={inputClass}>
          <option value="up">sube</option>
          <option value="down">baja</option>
        </select>
        {fieldError('direction')}
      </div>

      <div>
        <label htmlFor={id('target')} className="block text-xs opacity-60">
          Objetivo
        </label>
        <input
          id={id('target')}
          name="target"
          type="text"
          inputMode="decimal"
          placeholder="opcional"
          className={inputClass}
        />
        {fieldError('target')}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-black/15 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/20"
      >
        {pending ? 'Guardando…' : 'Crear métrica'}
      </button>

      {state.message ? (
        <p
          role="status"
          className={`text-xs sm:col-span-5 ${
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
