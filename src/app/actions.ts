'use server';

import { revalidatePath } from 'next/cache';

import { parseNewProgram, parseNewSessionType, type RawInput } from '@/core/services/program-input';
import { drizzleProgramRepository } from '@/infra/repos/drizzle-program-repository';
import type { FormState } from '@/ui/form-state';

/**
 * Server Actions de R1.
 *
 * **RF-44 — la validación que cuenta ocurre aquí, en el servidor.** La del
 * formulario es conveniencia: se salta con `curl`, con JavaScript desactivado o
 * desde el inspector del navegador. Los CHECK de la base son la última línea,
 * no la primera; una violación de restricción que llega al usuario como
 * excepción de Postgres es un defecto de la aplicación, no una validación.
 *
 * Este archivo es un **adaptador**: convierte `FormData` en cadenas, llama al
 * validador de `core/services/program-input` y traduce el resultado a estado de
 * formulario. Sin lógica de negocio, según la regla de capas de
 * docs/ARCHITECTURE.md — y por eso las reglas se prueban sin levantar Next.
 */

/** Convierte `FormData` en cadenas. Los `File` se descartan: R1 no sube archivos. */
function toRawInput(formData: FormData, keys: readonly string[]): RawInput {
  const raw: RawInput = {};

  for (const key of keys) {
    const value = formData.get(key);
    raw[key] = typeof value === 'string' ? value : '';
  }

  return raw;
}

/** RF-10 — crea un programa. */
export async function createProgramAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseNewProgram(
    toRawInput(formData, ['name', 'provider', 'kind', 'status', 'startedAt', 'targetAt']),
  );

  if (!parsed.ok) {
    return {
      status: 'error',
      message: 'No se pudo crear el programa. Revisa los campos marcados.',
      fieldErrors: parsed.fieldErrors,
    };
  }

  try {
    const program = await drizzleProgramRepository.create(parsed.value);
    revalidatePath('/');

    return {
      status: 'success',
      message: `Programa "${program.name}" creado.`,
      fieldErrors: {},
    };
  } catch (error) {
    // El detalle se queda en el servidor: la cadena de conexión no puede llegar
    // al cliente (RF-43).
    console.error('[createProgramAction]', error);

    return {
      status: 'error',
      message: 'No se pudo guardar el programa. Vuelve a intentarlo.',
      fieldErrors: {},
    };
  }
}

/** RF-15 — agrega un tipo de sesión a un programa. */
export async function createSessionTypeAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseNewSessionType(toRawInput(formData, ['programId', 'code', 'label']));

  if (!parsed.ok) {
    return {
      status: 'error',
      message: 'No se pudo crear el tipo de sesión. Revisa los campos marcados.',
      fieldErrors: parsed.fieldErrors,
    };
  }

  try {
    const created = await drizzleProgramRepository.createSessionType(parsed.value);

    if (created === null) {
      return {
        status: 'error',
        message: `El programa ya tiene un tipo de sesión con el código "${parsed.value.code}".`,
        fieldErrors: { code: 'Código repetido en este programa.' },
      };
    }

    revalidatePath('/');

    return {
      status: 'success',
      message: `Tipo de sesión "${created.code} · ${created.label}" agregado.`,
      fieldErrors: {},
    };
  } catch (error) {
    console.error('[createSessionTypeAction]', error);

    return {
      status: 'error',
      message: 'No se pudo guardar el tipo de sesión. Vuelve a intentarlo.',
      fieldErrors: {},
    };
  }
}
