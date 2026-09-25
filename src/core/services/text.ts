/**
 * Medición de texto compartida por las reglas de dominio.
 *
 * Separado para que todas las validaciones cuenten igual que `char_length()` de
 * Postgres. `String.prototype.length` cuenta unidades UTF-16 —un emoji mide 2—
 * y esa diferencia produce validaciones que no coinciden con el CHECK del
 * motor: la aplicación acepta lo que la base rechaza.
 */

/** Longitud en puntos de código, como `char_length()` de Postgres. */
export function charLength(value: string): number {
  return Array.from(value).length;
}
