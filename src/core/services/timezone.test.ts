import { describe, expect, it } from 'vitest';

import {
  APP_TIME_ZONE,
  appZoneDateTimeToInstant,
  isCivilTime,
  toCivilDateInAppZone,
  toCivilTimeInAppZone,
} from './timezone';

/**
 * RF-00 — «El sistema debe interpretar y presentar todas las fechas en la zona
 * horaria `America/Bogota`, independientemente de la zona del servidor o del
 * navegador.»
 *
 * Colombia va en UTC−05:00 todo el año. Las pruebas usan esa diferencia
 * explícitamente en vez de recalcularla, para que un cambio de comportamiento
 * salte en vez de acomodarse solo.
 */

describe('APP_TIME_ZONE', () => {
  it('es una constante de dominio, no una variable de entorno', () => {
    expect(APP_TIME_ZONE).toBe('America/Bogota');
  });
});

describe('toCivilDateInAppZone — el error silencioso más probable del modelo', () => {
  it('una sesión de las 19:00 de Colombia sigue siendo de ese día, aunque en UTC sea el siguiente', () => {
    // 2026-09-24 19:00 en Bogotá es 2026-09-25 00:00 en UTC. Leer la fecha UTC
    // sin convertir la contaría en el día equivocado.
    const instante = new Date('2026-09-25T00:00:00.000Z');

    expect(toCivilDateInAppZone(instante)).toBe('2026-09-24');
  });

  it('una sesión de las 23:40 de Colombia cuenta en su propio día', () => {
    const instante = new Date('2026-09-25T04:40:00.000Z');

    expect(toCivilDateInAppZone(instante)).toBe('2026-09-24');
  });

  it('la medianoche de Colombia abre el día nuevo', () => {
    const instante = new Date('2026-09-25T05:00:00.000Z');

    expect(toCivilDateInAppZone(instante)).toBe('2026-09-25');
  });
});

describe('toCivilTimeInAppZone', () => {
  it('presenta la hora local, no la del servidor', () => {
    expect(toCivilTimeInAppZone(new Date('2026-09-25T00:00:00.000Z'))).toBe('19:00');
  });

  it('presenta la medianoche local como 00:00 y no como 24:00', () => {
    expect(toCivilTimeInAppZone(new Date('2026-09-25T05:00:00.000Z'))).toBe('00:00');
  });
});

describe('isCivilTime', () => {
  it('acepta horas reales del reloj', () => {
    expect(isCivilTime('00:00')).toBe(true);
    expect(isCivilTime('23:59')).toBe(true);
  });

  it('rechaza horas imposibles y formatos que no son HH:MM', () => {
    expect(isCivilTime('24:00')).toBe(false);
    expect(isCivilTime('12:60')).toBe(false);
    expect(isCivilTime('9:30')).toBe(false);
    expect(isCivilTime('09:30:00')).toBe(false);
    expect(isCivilTime('')).toBe(false);
  });
});

describe('appZoneDateTimeToInstant — RF-26 lee hora de Colombia, guarda UTC', () => {
  it('las 20:00 del 24/09/2026 en Bogotá son la 01:00 UTC del día siguiente', () => {
    const instante = appZoneDateTimeToInstant('2026-09-24', '20:00');

    expect(instante.toISOString()).toBe('2026-09-25T01:00:00.000Z');
  });

  it('la medianoche de Colombia son las 05:00 UTC del mismo día', () => {
    const instante = appZoneDateTimeToInstant('2026-09-24', '00:00');

    expect(instante.toISOString()).toBe('2026-09-24T05:00:00.000Z');
  });

  it('el viaje de ida y vuelta conserva fecha y hora civiles', () => {
    const instante = appZoneDateTimeToInstant('2026-09-24', '23:40');

    expect(toCivilDateInAppZone(instante)).toBe('2026-09-24');
    expect(toCivilTimeInAppZone(instante)).toBe('23:40');
  });

  it('no depende de la zona del proceso: el resultado es un instante absoluto', () => {
    // Si la conversión usara la zona del servidor —UTC en Vercel, UTC−05 en la
    // máquina local— este valor cambiaría según dónde corra la prueba.
    const instante = appZoneDateTimeToInstant('2026-01-15', '08:30');

    expect(instante.getTime()).toBe(Date.UTC(2026, 0, 15, 13, 30));
  });
});
