/**
 * Fechas civiles `YYYY-MM-DD` (columnas `date` de docs/DATA-MODEL.md).
 *
 * `started_at` y `target_at` de `programs` son fechas sin hora: el día en que
 * empieza un curso no depende de la zona horaria de nadie. Por eso se tratan
 * como cadenas y **no** como `Date`: construir un `Date` a partir de
 * `'2026-09-24'` lo interpreta como medianoche UTC y, al presentarlo en
 * `America/Bogota`, muestra el día anterior. Es el mismo error silencioso que
 * advierte RF-00 para las marcas de tiempo.
 */

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** ¿La cadena tiene forma `AAAA-MM-DD` y además existe en el calendario? */
export function isCivilDate(value: string): boolean {
  if (!CIVIL_DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  // Descarta 2026-02-30 y 2026-13-01: Date los desborda al mes siguiente en
  // vez de fallar, así que la única comprobación fiable es el viaje de ida y
  // vuelta.
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
