'use server';

import { revalidatePath } from 'next/cache';

import { parseNewMetric, parseNewReading, type RawInput } from '@/core/services/metric-input';
import { checkReadingSession } from '@/core/services/reading-session';
import { drizzleMetricRepository } from '@/infra/repos/drizzle-metric-repository';
import { drizzleSessionRepository } from '@/infra/repos/drizzle-session-repository';
import type { FormState } from '@/ui/form-state';

/**
 * Server Actions de métricas de progreso (R5).
 *
 * **RF-44 — la validación que cuenta ocurre aquí, en el servidor.** Este
 * archivo es un adaptador: convierte `FormData` en cadenas, llama a los
 * validadores de `core/services/metric-input` y a la regla de
 * `core/services/reading-session`, y traduce el resultado a estado de
 * formulario. Sin reglas de negocio propias (regla de capas de
 * docs/ARCHITECTURE.md).
 */

/** Convierte `FormData` en cadenas. Los `File` se descartan: aquí no se suben archivos. */
function toRawInput(formData: FormData, keys: readonly string[]): RawInput {
  const raw: RawInput = {};

  for (const key of keys) {
    const value = formData.get(key);
    raw[key] = typeof value === 'string' ? value : '';
  }

  return raw;
}

function invalid(message: string, fieldErrors: Record<string, string> = {}): FormState {
  return { status: 'error', message, fieldErrors };
}

/**
 * Traduce un fallo inesperado. El detalle se queda en el servidor: la cadena de
 * conexión no puede llegar al cliente (RF-43).
 */
function failure(scope: string, error: unknown): FormState {
  console.error(`[${scope}]`, error);
  return invalid('No se pudo guardar. Vuelve a intentarlo.');
}

/** RF-60 — define una métrica propia de un programa. */
export async function createMetricAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseNewMetric(
    toRawInput(formData, ['programId', 'name', 'unit', 'direction', 'target']),
  );

  if (!parsed.ok) {
    return invalid('No se pudo crear la métrica. Revisa los campos marcados.', parsed.fieldErrors);
  }

  try {
    const created = await drizzleMetricRepository.createMetric(parsed.value);

    if (created === null) {
      return invalid(`El programa ya tiene una métrica llamada "${parsed.value.name}".`, {
        name: 'Nombre repetido en este programa.',
      });
    }

    revalidatePath('/');

    return { status: 'success', message: `Métrica "${created.name}" creada.`, fieldErrors: {} };
  } catch (error) {
    // Un programa inexistente llega aquí como violación de clave foránea: el
    // identificador viaja en un campo oculto, tan editable como cualquier otro.
    return failure('createMetricAction', error);
  }
}

/** RF-61 — registra una lectura de una métrica. */
export async function recordReadingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseNewReading(
    toRawInput(formData, ['metricId', 'sessionId', 'value', 'recordedOn', 'recordedAtTime']),
  );

  if (!parsed.ok) {
    return invalid('No se pudo registrar la lectura. Revisa los campos marcados.', parsed.fieldErrors);
  }

  try {
    const metric = await drizzleMetricRepository.findMetricById(parsed.value.metricId);

    if (metric === null) return invalid('La métrica ya no existe.', { metricId: 'Métrica no válida.' });

    const session =
      parsed.value.sessionId === null
        ? null
        : await drizzleSessionRepository.findById(parsed.value.sessionId);
    const link = checkReadingSession(metric.programId, parsed.value.sessionId, session);

    if (!link.ok) return invalid(link.message, { sessionId: link.message });

    await drizzleMetricRepository.createReading(parsed.value);
    revalidatePath('/');

    return {
      status: 'success',
      message: `Lectura de "${metric.name}" registrada.`,
      fieldErrors: {},
    };
  } catch (error) {
    return failure('recordReadingAction', error);
  }
}
