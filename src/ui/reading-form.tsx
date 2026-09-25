'use client';

import { useActionState } from 'react';

import { recordReadingAction } from '@/app/metric-actions';
import { EMPTY_FORM_STATE } from '@/ui/form-state';
import type { SessionOptionView } from '@/ui/metric-view';

/**
 * RF-61 — registra una lectura: valor, fecha y sesión asociada opcional.
 *
 * La fecha y la hora se escriben en **hora de Colombia** (RF-00) y el servidor
 * las convierte al instante UTC que se almacena. Los valores por defecto —hoy y
 * ahora en Colombia— los calcula el servidor, no el navegador.
 *
 * Si hay una sesión en curso de este programa, se propone por defecto: es el
 * caso más frecuente —la métrica se mide al terminar el trabajo de la sesión—
 * y ahorra un clic cada vez. La Server Action vuelve a comprobar que la sesión
 * sea del mismo programa que la métrica.
 */
const inputClass =
  'w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20';

export function ReadingForm({
  metricId,
  unit,
  sessionOptions,
  todayInAppZone,
  nowTimeInAppZone,
}: {
  metricId: string;
  unit: string | null;
  /** Solo las sesiones del programa de la métrica, de la más reciente a la más antigua. */
  sessionOptions: readonly SessionOptionView[];
  todayInAppZone: string;
  nowTimeInAppZone: string;
}) {
  const [state, formAction, pending] = useActionState(recordReadingAction, EMPTY_FORM_STATE);
  const id = (field: string) => `reading-${field}-${metricId}`;
  const running = sessionOptions.find((option) => option.running);

  const fieldError = (field: string) =>
    state.fieldErrors[field] ? (
      <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
        {state.fieldErrors[field]}
      </p>
    ) : null;

  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_2fr_auto] sm:items-end">
      <input type="hidden" name="metricId" value={metricId} />

      <div>
        <label htmlFor={id('value')} className="block text-xs opacity-60">
          Valor
        </label>
        <input
          id={id('value')}
          name="value"
          type="text"
          inputMode="decimal"
          required
          placeholder={unit ?? undefined}
          className={inputClass}
        />
        {fieldError('value')}
      </div>

      <div>
        <label htmlFor={id('date')} className="block text-xs opacity-60">
          Fecha
        </label>
        <input
          id={id('date')}
          name="recordedOn"
          type="date"
          required
          defaultValue={todayInAppZone}
          className={inputClass}
        />
        {fieldError('recordedOn')}
      </div>

      <div>
        <label htmlFor={id('time')} className="block text-xs opacity-60">
          Hora
        </label>
        <input
          id={id('time')}
          name="recordedAtTime"
          type="time"
          required
          defaultValue={nowTimeInAppZone}
          className={inputClass}
        />
        {fieldError('recordedAtTime')}
      </div>

      <div>
        <label htmlFor={id('session')} className="block text-xs opacity-60">
          Sesión
        </label>
        <select
          id={id('session')}
          name="sessionId"
          defaultValue={running?.id ?? ''}
          className={inputClass}
        >
          <option value="">Sin sesión</option>
          {sessionOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
              {option.running ? ' (en curso)' : ''}
            </option>
          ))}
        </select>
        {fieldError('sessionId')}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-black/15 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/20"
      >
        {pending ? 'Guardando…' : 'Registrar'}
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
