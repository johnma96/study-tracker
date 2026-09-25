import { describe, expect, it } from 'vitest';

import {
  MINUTES_MAX,
  NOTE_MAX_LENGTH,
  parseManualSession,
  parseSessionId,
  parseStartSession,
  parseStopSession,
} from './session-input';

/**
 * RF-44 — validación de entrada del servidor.
 *
 * La del formulario es conveniencia: se salta con `curl`, con JavaScript
 * desactivado o desde el inspector. Estas pruebas atacan la entrada como lo
 * haría un cliente hostil —campos ausentes, valores fuera de rango, texto donde
 * se espera un número— sin levantar Next ni base de datos.
 */

const PROGRAM_ID = '11111111-2222-4333-8444-555555555555';
const SESSION_ID = '99999999-8888-4777-8666-555555555555';
const TYPE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('parseStartSession (RF-20)', () => {
  it('acepta un programa con tipo de sesión', () => {
    const result = parseStartSession({ programId: PROGRAM_ID, sessionTypeId: TYPE_ID });

    expect(result).toEqual({ ok: true, value: { programId: PROGRAM_ID, sessionTypeId: TYPE_ID } });
  });

  it('el tipo de sesión en blanco equivale a "sin tipo"', () => {
    const result = parseStartSession({ programId: PROGRAM_ID, sessionTypeId: '' });

    expect(result).toEqual({ ok: true, value: { programId: PROGRAM_ID, sessionTypeId: null } });
  });

  it('rechaza un programa que no es un identificador', () => {
    const result = parseStartSession({ programId: 'o-esto-o-lo-otro', sessionTypeId: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.programId).toBeDefined();
  });

  it('un campo ausente da el mismo motivo que uno en blanco, no una excepción', () => {
    const result = parseStartSession({});

    expect(result.ok).toBe(false);
  });
});

describe('parseStopSession (RF-23, RF-25, RF-28)', () => {
  const base = {
    sessionId: SESSION_ID,
    minutesOverride: '',
    note: '',
    stuckMinutes: '',
    sessionTypeId: '',
    confirmed: '',
  };

  it('en blanco significa "calcula tú", no cero', () => {
    const result = parseStopSession(base);

    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: SESSION_ID,
        minutesOverride: null,
        note: null,
        stuckMinutes: 0,
        sessionTypeId: null,
        confirmed: false,
      },
    });
  });

  it('acepta una corrección de duración y una nota (RF-2H, RF-28)', () => {
    const result = parseStopSession({
      ...base,
      minutesOverride: '120',
      note: '  Sesión 0 del curso  ',
      stuckMinutes: '15',
      confirmed: '1',
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        minutesOverride: 120,
        note: 'Sesión 0 del curso',
        stuckMinutes: 15,
        confirmed: true,
      },
    });
  });

  it('rechaza un minutesOverride de cero (invariante 3)', () => {
    const result = parseStopSession({ ...base, minutesOverride: '0' });

    expect(result.ok).toBe(false);
  });

  it('rechaza un minutesOverride que no es un entero', () => {
    expect(parseStopSession({ ...base, minutesOverride: '90 minutos' }).ok).toBe(false);
    expect(parseStopSession({ ...base, minutesOverride: '-30' }).ok).toBe(false);
    expect(parseStopSession({ ...base, minutesOverride: '12.5' }).ok).toBe(false);
  });

  it('rechaza una duración mayor que un día', () => {
    expect(parseStopSession({ ...base, minutesOverride: String(MINUTES_MAX) }).ok).toBe(true);
    expect(parseStopSession({ ...base, minutesOverride: String(MINUTES_MAX + 1) }).ok).toBe(false);
  });

  it('rechaza minutos de atasco negativos o no numéricos', () => {
    expect(parseStopSession({ ...base, stuckMinutes: '-1' }).ok).toBe(false);
    expect(parseStopSession({ ...base, stuckMinutes: 'mucho' }).ok).toBe(false);
  });

  it('rechaza una nota más larga que el tope', () => {
    const larga = 'a'.repeat(NOTE_MAX_LENGTH + 1);

    expect(parseStopSession({ ...base, note: larga }).ok).toBe(false);
  });
});

describe('parseManualSession (RF-26, RF-00)', () => {
  const base = {
    programId: PROGRAM_ID,
    sessionTypeId: '',
    startedOn: '2026-09-24',
    startedAtTime: '20:00',
    minutes: '90',
    note: '',
    stuckMinutes: '0',
  };

  it('interpreta fecha y hora como hora de Colombia y las guarda en UTC', () => {
    const result = parseManualSession(base);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startedAt.toISOString()).toBe('2026-09-25T01:00:00.000Z');
      expect(result.value.minutes).toBe(90);
    }
  });

  it('exige una duración de al menos un minuto', () => {
    expect(parseManualSession({ ...base, minutes: '0' }).ok).toBe(false);
    expect(parseManualSession({ ...base, minutes: '' }).ok).toBe(false);
  });

  it('rechaza una fecha que no existe en el calendario', () => {
    expect(parseManualSession({ ...base, startedOn: '2026-02-30' }).ok).toBe(false);
  });

  it('rechaza una hora imposible', () => {
    expect(parseManualSession({ ...base, startedAtTime: '25:00' }).ok).toBe(false);
  });
});

describe('parseSessionId (RF-27, RF-2A, RF-2C)', () => {
  it('acepta un identificador válido', () => {
    expect(parseSessionId({ sessionId: SESSION_ID })).toEqual({
      ok: true,
      value: { sessionId: SESSION_ID },
    });
  });

  it('rechaza cualquier otra cosa', () => {
    expect(parseSessionId({ sessionId: '1' }).ok).toBe(false);
    expect(parseSessionId({}).ok).toBe(false);
  });
});
