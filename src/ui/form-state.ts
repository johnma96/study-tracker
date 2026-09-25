/**
 * Estado compartido entre las Server Actions y los formularios.
 *
 * Vive fuera del módulo `'use server'` a propósito: Next exige que **todo** lo
 * que ese módulo exporta sea una función asíncrona, así que una constante no
 * puede declararse allí.
 */
export interface FormState {
  status: 'idle' | 'error' | 'success';
  /** Mensaje general. RF-14 exige mostrar el motivo del rechazo. */
  message: string | null;
  /** Motivo por campo, para pintarlo junto al control que lo produjo. */
  fieldErrors: Record<string, string>;
}

export const EMPTY_FORM_STATE: FormState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
};
