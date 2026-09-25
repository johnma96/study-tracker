import { describe, expect, it } from 'vitest';

import {
  METRIC_NAME_MAX_LENGTH,
  METRIC_UNIT_MAX_LENGTH,
  parseDecimal,
  parseNewMetric,
  parseNewReading,
} from './metric-input';
import { checkReadingSession } from './reading-session';

const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROGRAM_ID = '22222222-2222-4222-8222-222222222222';
const METRIC_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '44444444-4444-4444-8444-444444444444';

const validMetric = {
  programId: PROGRAM_ID,
  name: 'Harness score',
  unit: 'puntos',
  direction: 'up',
  target: '80',
};

const validReading = {
  metricId: METRIC_ID,
  sessionId: '',
  value: '72',
  recordedOn: '2026-09-24',
  recordedAtTime: '20:30',
};

describe('parseDecimal', () => {
  it('acepta enteros, decimales con punto y con coma, y signo', () => {
    expect(parseDecimal('80')).toBe(80);
    expect(parseDecimal('80.5')).toBe(80.5);
    expect(parseDecimal('80,5')).toBe(80.5);
    expect(parseDecimal('-3')).toBe(-3);
    expect(parseDecimal('  7 ')).toBe(7);
  });

  it('rechaza lo que no es un número decimal sin ambigüedad', () => {
    for (const raw of ['', 'abc', '1e3', '1.000,5', '1 000', '80.', ',5', 'Infinity', 'NaN']) {
      expect(parseDecimal(raw)).toBeNull();
    }
  });

  it('rechaza más cifras de las que un number conserva sin pérdida', () => {
    expect(parseDecimal('1234567890')).toBeNull();
    expect(parseDecimal('1.1234567')).toBeNull();
    expect(parseDecimal('123456789.123456')).toBe(123456789.123456);
  });
});

/** RF-60 — métricas propias de cada programa, validadas en el servidor (RF-44). */
describe('parseNewMetric', () => {
  it('acepta la métrica del curso de harness engineering', () => {
    expect(parseNewMetric(validMetric)).toEqual({
      ok: true,
      value: {
        programId: PROGRAM_ID,
        name: 'Harness score',
        unit: 'puntos',
        direction: 'up',
        target: 80,
      },
    });
  });

  it('acepta métricas de otros programas sin tocar el código: nombre y unidad son datos', () => {
    const result = parseNewMetric({
      programId: PROGRAM_ID,
      name: 'Tiempo medio de respuesta',
      unit: 'ms',
      direction: 'down',
      target: '250,5',
    });

    expect(result.ok && result.value).toMatchObject({ direction: 'down', unit: 'ms', target: 250.5 });
  });

  it('unidad y objetivo son opcionales: en blanco quedan nulos, no vacíos ni cero', () => {
    const result = parseNewMetric({ ...validMetric, unit: '   ', target: '' });

    expect(result.ok && result.value).toMatchObject({ unit: null, target: null });
  });

  it('un objetivo de cero es un objetivo, no la ausencia de objetivo', () => {
    const result = parseNewMetric({ ...validMetric, direction: 'down', target: '0' });

    expect(result.ok && result.value.target).toBe(0);
  });

  it('recorta el nombre y la unidad', () => {
    const result = parseNewMetric({ ...validMetric, name: '  Harness score  ', unit: ' puntos ' });

    expect(result.ok && result.value).toMatchObject({ name: 'Harness score', unit: 'puntos' });
  });

  it('rechaza nombre vacío o demasiado largo, indicando el motivo', () => {
    const empty = parseNewMetric({ ...validMetric, name: '   ' });
    const long = parseNewMetric({ ...validMetric, name: 'x'.repeat(METRIC_NAME_MAX_LENGTH + 1) });

    expect(empty.ok).toBe(false);
    expect(!empty.ok && empty.fieldErrors.name).toMatch(/obligatorio/);
    expect(long.ok).toBe(false);
    expect(!long.ok && long.fieldErrors.name).toMatch(String(METRIC_NAME_MAX_LENGTH));
  });

  it('el límite del nombre cuenta caracteres como char_length(), no unidades UTF-16', () => {
    const result = parseNewMetric({ ...validMetric, name: '🎯'.repeat(METRIC_NAME_MAX_LENGTH) });

    expect(result.ok).toBe(true);
  });

  it('rechaza una unidad demasiado larga', () => {
    const result = parseNewMetric({ ...validMetric, unit: 'u'.repeat(METRIC_UNIT_MAX_LENGTH + 1) });

    expect(!result.ok && result.fieldErrors.unit).toBeDefined();
  });

  it("solo admite las direcciones 'up' y 'down'", () => {
    for (const direction of ['', 'UP', 'sube', 'sideways']) {
      const result = parseNewMetric({ ...validMetric, direction });
      expect(!result.ok && result.fieldErrors.direction).toBeDefined();
    }
  });

  it('rechaza un objetivo que no es número', () => {
    const result = parseNewMetric({ ...validMetric, target: 'ochenta' });

    expect(!result.ok && result.fieldErrors.target).toBeDefined();
  });

  it('rechaza un programa que no es un UUID', () => {
    const result = parseNewMetric({ ...validMetric, programId: "1' or '1'='1" });

    expect(!result.ok && result.fieldErrors.programId).toBeDefined();
  });

  it('un campo omitido por un cliente hostil se trata como vacío, sin excepción', () => {
    const result = parseNewMetric({ programId: PROGRAM_ID });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.name).toBeDefined();
    expect(!result.ok && result.fieldErrors.direction).toBeDefined();
  });
});

/** RF-61 — lecturas con valor, fecha y sesión opcional. */
describe('parseNewReading', () => {
  it('convierte fecha y hora de Colombia al instante UTC (RF-00)', () => {
    const result = parseNewReading(validReading);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 20:30 en Bogotá (UTC−5) son las 01:30 UTC del día siguiente.
    expect(result.value.recordedAt.toISOString()).toBe('2026-09-25T01:30:00.000Z');
    expect(result.value).toMatchObject({ metricId: METRIC_ID, sessionId: null, value: 72 });
  });

  it('acepta una sesión asociada', () => {
    const result = parseNewReading({ ...validReading, sessionId: SESSION_ID });

    expect(result.ok && result.value.sessionId).toBe(SESSION_ID);
  });

  it('acepta cero y valores decimales con coma', () => {
    expect(parseNewReading({ ...validReading, value: '0' }).ok).toBe(true);

    const decimal = parseNewReading({ ...validReading, value: '72,25' });
    expect(decimal.ok && decimal.value.value).toBe(72.25);
  });

  it('el valor es obligatorio: en blanco no es cero', () => {
    const result = parseNewReading({ ...validReading, value: '  ' });

    expect(!result.ok && result.fieldErrors.value).toMatch(/obligatorio/);
  });

  it('rechaza fecha u hora inexistentes', () => {
    const fecha = parseNewReading({ ...validReading, recordedOn: '2026-02-30' });
    const hora = parseNewReading({ ...validReading, recordedAtTime: '24:00' });

    expect(!fecha.ok && fecha.fieldErrors.recordedOn).toBeDefined();
    expect(!hora.ok && hora.fieldErrors.recordedAtTime).toBeDefined();
  });

  it('rechaza identificadores que no son UUID', () => {
    const result = parseNewReading({ ...validReading, metricId: 'x', sessionId: 'y' });

    expect(!result.ok && result.fieldErrors.metricId).toBeDefined();
    expect(!result.ok && result.fieldErrors.sessionId).toBeDefined();
  });
});

/** RF-61 — la sesión asociada, si existe, es del programa de la métrica. */
describe('checkReadingSession', () => {
  it('sin sesión pedida no hay nada que comprobar', () => {
    expect(checkReadingSession(PROGRAM_ID, null, null)).toEqual({ ok: true });
  });

  it('acepta una sesión del mismo programa', () => {
    expect(checkReadingSession(PROGRAM_ID, SESSION_ID, { programId: PROGRAM_ID })).toEqual({
      ok: true,
    });
  });

  it('rechaza una sesión de otro programa', () => {
    const result = checkReadingSession(PROGRAM_ID, SESSION_ID, { programId: OTHER_PROGRAM_ID });

    expect(!result.ok && result.reason).toBe('session_other_program');
  });

  it('rechaza una sesión que ya no existe', () => {
    const result = checkReadingSession(PROGRAM_ID, SESSION_ID, null);

    expect(!result.ok && result.reason).toBe('session_not_found');
  });
});
