import { describe, expect, it } from 'vitest';

import { compareLatestReadings, sortReadings, type ComparableReading } from './metric-trend';

/**
 * RF-62 y RF-63 — orden de la serie y veredicto de la última lectura.
 *
 * Las fechas se escriben en UTC explícito: el orden es entre instantes, y no
 * debe depender de la zona del proceso que corre las pruebas.
 */

let sequence = 0;

/** Lectura mínima. `createdAt` por defecto coincide con `recordedAt`. */
function reading(
  value: number,
  recordedAtIso: string,
  options: { createdAtIso?: string; id?: string } = {},
): ComparableReading {
  sequence += 1;

  return {
    id: options.id ?? `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    value,
    recordedAt: new Date(recordedAtIso),
    createdAt: new Date(options.createdAtIso ?? recordedAtIso),
  };
}

describe('sortReadings — orden cronológico de la serie (RF-62)', () => {
  it('ordena por recordedAt ascendente aunque lleguen desordenadas', () => {
    const tercera = reading(70, '2026-09-24T15:00:00Z');
    const primera = reading(40, '2026-09-20T15:00:00Z');
    const segunda = reading(55, '2026-09-22T15:00:00Z');

    expect(sortReadings([tercera, primera, segunda]).map((r) => r.value)).toEqual([40, 55, 70]);
  });

  it('con el mismo recordedAt, la registrada después va al final', () => {
    const registradaDespues = reading(60, '2026-09-24T15:00:00Z', {
      createdAtIso: '2026-09-24T15:05:00Z',
    });
    const registradaAntes = reading(50, '2026-09-24T15:00:00Z', {
      createdAtIso: '2026-09-24T15:01:00Z',
    });

    expect(sortReadings([registradaDespues, registradaAntes]).map((r) => r.value)).toEqual([
      50, 60,
    ]);
  });

  it('con recordedAt y createdAt iguales, el orden es estable por id', () => {
    const b = reading(2, '2026-09-24T15:00:00Z', { id: 'bbbbbbbb-0000-4000-8000-000000000000' });
    const a = reading(1, '2026-09-24T15:00:00Z', { id: 'aaaaaaaa-0000-4000-8000-000000000000' });

    expect(sortReadings([b, a]).map((r) => r.value)).toEqual([1, 2]);
    expect(sortReadings([a, b]).map((r) => r.value)).toEqual([1, 2]);
  });

  it('no modifica la lista recibida', () => {
    const lista = [reading(2, '2026-09-24T15:00:00Z'), reading(1, '2026-09-20T15:00:00Z')];

    sortReadings(lista);

    expect(lista.map((r) => r.value)).toEqual([2, 1]);
  });
});

describe('compareLatestReadings — ¿mejoró o empeoró? (RF-63)', () => {
  describe('sin lecturas previas', () => {
    it('sin ninguna lectura no hay veredicto', () => {
      expect(compareLatestReadings('up', [])).toEqual({ kind: 'no_readings' });
      expect(compareLatestReadings('down', [])).toEqual({ kind: 'no_readings' });
    });

    it('con una sola lectura no hay anterior: es la primera, ni mejora ni empeora', () => {
      const unica = [reading(42, '2026-09-24T15:00:00Z')];

      expect(compareLatestReadings('up', unica)).toEqual({ kind: 'first', latest: 42 });
      expect(compareLatestReadings('down', unica)).toEqual({ kind: 'first', latest: 42 });
    });
  });

  describe("dirección 'up' — más es mejor", () => {
    it('subir es mejorar', () => {
      const trend = compareLatestReadings('up', [
        reading(50, '2026-09-20T15:00:00Z'),
        reading(65, '2026-09-24T15:00:00Z'),
      ]);

      expect(trend).toEqual({ kind: 'improved', latest: 65, previous: 50, delta: 15 });
    });

    it('bajar es empeorar', () => {
      const trend = compareLatestReadings('up', [
        reading(65, '2026-09-20T15:00:00Z'),
        reading(50, '2026-09-24T15:00:00Z'),
      ]);

      expect(trend).toEqual({ kind: 'worsened', latest: 50, previous: 65, delta: -15 });
    });

    it('el empate no es mejora ni empeoramiento', () => {
      const trend = compareLatestReadings('up', [
        reading(70, '2026-09-20T15:00:00Z'),
        reading(70, '2026-09-24T15:00:00Z'),
      ]);

      expect(trend).toEqual({ kind: 'unchanged', latest: 70, previous: 70, delta: 0 });
    });
  });

  describe("dirección 'down' — menos es mejor", () => {
    it('bajar es mejorar', () => {
      const trend = compareLatestReadings('down', [
        reading(12, '2026-09-20T15:00:00Z'),
        reading(9, '2026-09-24T15:00:00Z'),
      ]);

      expect(trend).toEqual({ kind: 'improved', latest: 9, previous: 12, delta: -3 });
    });

    it('subir es empeorar', () => {
      const trend = compareLatestReadings('down', [
        reading(9, '2026-09-20T15:00:00Z'),
        reading(12, '2026-09-24T15:00:00Z'),
      ]);

      expect(trend).toEqual({ kind: 'worsened', latest: 12, previous: 9, delta: 3 });
    });

    it('el empate no es mejora ni empeoramiento', () => {
      const trend = compareLatestReadings('down', [
        reading(9, '2026-09-20T15:00:00Z'),
        reading(9, '2026-09-24T15:00:00Z'),
      ]);

      expect(trend).toEqual({ kind: 'unchanged', latest: 9, previous: 9, delta: 0 });
    });
  });

  it('el mismo par de valores da veredictos opuestos según la dirección', () => {
    // Es la prueba de que el veredicto sale de la métrica y no del número.
    const par = [reading(10, '2026-09-20T15:00:00Z'), reading(20, '2026-09-24T15:00:00Z')];

    expect(compareLatestReadings('up', par).kind).toBe('improved');
    expect(compareLatestReadings('down', par).kind).toBe('worsened');
  });

  it('compara la última con la anterior en el tiempo, no en el orden recibido', () => {
    // Llegan desordenadas: la última por fecha es 30, la anterior es 80.
    const trend = compareLatestReadings('up', [
      reading(30, '2026-09-24T15:00:00Z'),
      reading(10, '2026-09-10T15:00:00Z'),
      reading(80, '2026-09-20T15:00:00Z'),
    ]);

    expect(trend).toEqual({ kind: 'worsened', latest: 30, previous: 80, delta: -50 });
  });

  it('solo cuenta la anterior inmediata, no la primera de la serie', () => {
    const trend = compareLatestReadings('up', [
      reading(10, '2026-09-10T15:00:00Z'),
      reading(90, '2026-09-20T15:00:00Z'),
      reading(50, '2026-09-24T15:00:00Z'),
    ]);

    // 50 es más que 10, pero menos que 90: empeoró.
    expect(trend.kind).toBe('worsened');
  });

  it('dos lecturas del mismo minuto: la última es la registrada después', () => {
    const trend = compareLatestReadings('up', [
      reading(60, '2026-09-24T15:00:00Z', { createdAtIso: '2026-09-24T15:09:00Z' }),
      reading(75, '2026-09-24T15:00:00Z', { createdAtIso: '2026-09-24T15:02:00Z' }),
    ]);

    expect(trend).toEqual({ kind: 'worsened', latest: 60, previous: 75, delta: -15 });
  });

  it('el empate se decide por los valores, no por el residuo de una resta decimal', () => {
    // 0.3 y 0.1 + 0.2 no son el mismo número en coma flotante; aquí los dos
    // valores sí lo son, porque llegan tal cual de la base.
    const trend = compareLatestReadings('up', [
      reading(0.3, '2026-09-20T15:00:00Z'),
      reading(0.3, '2026-09-24T15:00:00Z'),
    ]);

    expect(trend.kind).toBe('unchanged');
  });

  it('funciona con valores negativos y decimales', () => {
    const trend = compareLatestReadings('up', [
      reading(-2.5, '2026-09-20T15:00:00Z'),
      reading(-1.25, '2026-09-24T15:00:00Z'),
    ]);

    expect(trend).toEqual({ kind: 'improved', latest: -1.25, previous: -2.5, delta: 1.25 });
  });
});
