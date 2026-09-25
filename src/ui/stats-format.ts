/**
 * Formatos de presentación de R3: horas, minutos y fechas en español de
 * Colombia.
 *
 * Viven en `ui/` porque son presentación pura: el dominio entrega minutos y
 * fechas civiles `AAAA-MM-DD`; cómo se leen en pantalla se decide aquí.
 */

const DECIMAL = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/** `12,5` — un decimal como máximo, con coma. */
export function formatDecimal(value: number): string {
  return DECIMAL.format(value);
}

/** Horas totales a partir de minutos: `12,5 h`. */
export function formatHours(minutes: number): string {
  return `${formatDecimal(minutes / 60)} h`;
}

/** Duración legible: `45 min`, `1 h`, `1 h 30 min`. */
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;

  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Fecha civil `AAAA-MM-DD` → `DD/MM/AAAA`. No construye `Date`: no hay zona que equivocar. */
export function formatCivilDate(civilDate: string): string {
  const [year, month, day] = civilDate.split('-');
  return `${day}/${month}/${year}`;
}

/** Fecha civil `AAAA-MM-DD` → `DD/MM`, para ejes y etiquetas cortas. */
export function formatShortCivilDate(civilDate: string): string {
  const [, month, day] = civilDate.split('-');
  return `${day}/${month}`;
}

/** Plural simple: `1 sesión`, `3 sesiones`. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatDecimal(count)} ${count === 1 ? singular : plural}`;
}
