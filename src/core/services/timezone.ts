/**
 * RF-00 — zona horaria de la aplicación.
 *
 * `America/Bogota` es una **regla de dominio**, no configuración: no cambia
 * entre entornos. Por eso vive aquí como constante y no en una variable de
 * entorno (decisión 9 de docs/ARCHITECTURE.md). Si faltara o se escribiera mal
 * en producción, la agrupación por día se rompería en silencio.
 *
 * El almacenamiento es siempre UTC (invariante 5 de docs/DATA-MODEL.md). Este
 * módulo es el único punto donde se cruza la frontera entre un instante
 * absoluto y una fecha/hora civil colombiana: al **presentar** y al **leer** lo
 * que el usuario escribe en un formulario.
 */

export const APP_TIME_ZONE = 'America/Bogota';

/** Partes civiles de un instante, ya en la zona de la aplicación. */
export interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Descompone un instante UTC en sus partes civiles de `America/Bogota`. */
export function toZonedParts(instant: Date): ZonedParts {
  const parts = PARTS_FORMATTER.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    return found ? Number(found.value) : 0;
  };

  // `hour: '2-digit'` con `hour12: false` puede devolver 24 en la medianoche de
  // algunos motores. Normalizar a 0 evita un desfase de un día entero.
  const hour = read('hour');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: hour === 24 ? 0 : hour,
    minute: read('minute'),
    second: read('second'),
  };
}

/** Desplazamiento de la zona respecto a UTC, en milisegundos, para ese instante. */
function zoneOffsetMs(instant: Date): number {
  const parts = toZonedParts(instant);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  // El instante se compara al segundo: `Date.UTC` no lleva milisegundos.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Fecha civil `AAAA-MM-DD` del instante, en hora de Colombia (RF-00).
 *
 * Es la función que impide el error silencioso más probable del modelo: una
 * sesión iniciada a las 19:00 de Colombia cae en el día siguiente si se lee la
 * fecha UTC sin convertir.
 */
export function toCivilDateInAppZone(instant: Date): string {
  const { year, month, day } = toZonedParts(instant);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Hora civil `HH:MM` del instante, en hora de Colombia. */
export function toCivilTimeInAppZone(instant: Date): string {
  const { hour, minute } = toZonedParts(instant);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hour)}:${pad(minute)}`;
}

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** ¿La cadena tiene forma `HH:MM` y representa una hora real del reloj? */
export function isCivilTime(value: string): boolean {
  const match = TIME_PATTERN.exec(value);
  if (!match) return false;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * RF-00, RF-26 — convierte una fecha y hora civiles de Colombia al instante UTC
 * que se almacena.
 *
 * El usuario que registra una sesión a mano escribe "24/09/2026 a las 20:00" y
 * quiere decir las 20:00 **de Colombia**, no las del servidor —que en Vercel
 * corre en UTC—. Guardar `new Date('2026-09-24T20:00')` usaría la zona del
 * proceso y movería la sesión cinco horas.
 *
 * El desplazamiento se resuelve en dos pasos porque depende del propio instante
 * que se está calculando. Colombia no aplica horario de verano desde 1993, así
 * que hoy una sola iteración bastaría; la segunda existe para que la función
 * siga siendo correcta si algún día la zona la define el usuario y apunta a una
 * que sí lo aplique.
 */
export function appZoneDateTimeToInstant(civilDate: string, civilTime: string): Date {
  const [year, month, day] = civilDate.split('-').map(Number);
  const [hour, minute] = civilTime.split(':').map(Number);

  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);

  const firstGuess = naive - zoneOffsetMs(new Date(naive));
  const refined = naive - zoneOffsetMs(new Date(firstGuess));

  return new Date(refined);
}
