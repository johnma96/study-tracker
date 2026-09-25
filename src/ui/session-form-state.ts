/**
 * Estado compartido entre las Server Actions del cronómetro y sus formularios.
 *
 * Vive fuera del módulo `'use server'` a propósito: Next exige que **todo** lo
 * que ese módulo exporta sea una función asíncrona.
 *
 * Es un tipo propio y no el `FormState` de R1 porque el cronómetro tiene dos
 * resultados que los formularios de programas no conocen:
 *
 * - `notice`: la operación no se pudo hacer y **no es un error** (RF-29: pedir
 *   detener cuando no hay nada corriendo se informa, no se convierte en fallo).
 * - `confirm`: la sesión pasa de ocho horas y hay que confirmar o corregir
 *   antes de guardar (RF-25).
 */
export type SessionActionStatus = 'idle' | 'success' | 'error' | 'notice' | 'confirm';

export interface SessionActionState {
  status: SessionActionStatus;
  message: string | null;
  /** Motivo por campo, para pintarlo junto al control que lo produjo. */
  fieldErrors: Record<string, string>;
  /** RF-25 — minutos calculados que el usuario debe confirmar o corregir. */
  pendingMinutes: number | null;
}

export const EMPTY_SESSION_ACTION_STATE: SessionActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
  pendingMinutes: null,
};
