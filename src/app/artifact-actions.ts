'use server';

import { revalidatePath } from 'next/cache';

import { NEW_ARTIFACT_FIELDS, parseNewArtifact, type RawInput } from '@/core/services/artifact-input';
import { drizzleArtifactRepository } from '@/infra/repos/drizzle-artifact-repository';
import type { FormState } from '@/ui/form-state';

/**
 * Server Actions de la evidencia (R4).
 *
 * **RF-44 — la validación que cuenta ocurre aquí, en el servidor.** Este archivo
 * es un adaptador: convierte `FormData` en cadenas, llama al validador de
 * `core/services/artifact-input` y traduce el resultado a estado de formulario.
 * Sin reglas de negocio propias (regla de capas de docs/ARCHITECTURE.md).
 *
 * **RF-54 — aquí no se sube nada.** Si un cliente hostil manda un archivo en el
 * `FormData`, `toRawInput` lo convierte en cadena vacía y el validador lo
 * rechaza como destino vacío. El contenido nunca se lee.
 */

/** Convierte `FormData` en cadenas. Los `File` se descartan sin leerlos (RF-54). */
function toRawInput(formData: FormData, keys: readonly string[]): RawInput {
  const raw: RawInput = {};

  for (const key of keys) {
    const value = formData.get(key);
    raw[key] = typeof value === 'string' ? value : '';
  }

  return raw;
}

/** RF-50 — adjunta un artefacto a una sesión. */
export async function attachArtifactAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseNewArtifact(toRawInput(formData, NEW_ARTIFACT_FIELDS));

  if (!parsed.ok) {
    return {
      status: 'error',
      message: 'No se pudo adjuntar la evidencia. Revisa los campos marcados.',
      fieldErrors: parsed.fieldErrors,
    };
  }

  try {
    const result = await drizzleArtifactRepository.attach(parsed.value);
    revalidatePath('/', 'layout');

    if (!result.ok) {
      return {
        status: 'error',
        message: 'Esa sesión ya no existe: se descartó en otra pestaña.',
        fieldErrors: {},
      };
    }

    return {
      status: 'success',
      message: `Evidencia "${result.artifact.label}" adjuntada.`,
      fieldErrors: {},
    };
  } catch (error) {
    // El detalle se queda en el servidor: la cadena de conexión no puede llegar
    // al cliente (RF-43).
    console.error('[attachArtifactAction]', error);

    return {
      status: 'error',
      message: 'No se pudo adjuntar la evidencia. Vuelve a intentarlo.',
      fieldErrors: {},
    };
  }
}
