import { describe, expect, it } from 'vitest';

import type { Session } from '../model/session';

import { listProgramSessions } from './session-listing';

/** RF-30 — listado de sesiones de un programa, sin base de datos. */

const PROGRAM = 'programa-a';
const OTHER = 'programa-b';

function session(overrides: Partial<Session> & Pick<Session, 'id' | 'startedAt'>): Session {
  return {
    programId: PROGRAM,
    sessionTypeId: null,
    endedAt: new Date(overrides.startedAt.getTime() + 30 * 60_000),
    pausedAt: null,
    pausedSeconds: 0,
    minutesOverride: null,
    stuckMinutes: 0,
    note: null,
    source: 'timer',
    createdAt: overrides.startedAt,
    ...overrides,
  };
}

describe('RF-30 — listado de sesiones', () => {
  const sesiones: Session[] = [
    session({ id: 'b', startedAt: new Date('2026-09-20T10:00:00-05:00'), note: 'lectura' }),
    session({
      id: 'c',
      startedAt: new Date('2026-09-24T23:40:00-05:00'),
      endedAt: new Date('2026-09-25T00:20:00-05:00'),
      sessionTypeId: 'tipo-e',
    }),
    session({ id: 'a', startedAt: new Date('2026-09-22T08:00:00-05:00'), minutesOverride: 75 }),
    session({ id: 'x', programId: OTHER, startedAt: new Date('2026-09-23T08:00:00-05:00') }),
    session({ id: 'r', startedAt: new Date('2026-09-25T09:00:00-05:00'), endedAt: null }),
  ];

  it('solo trae las del programa, ordenadas por inicio descendente', () => {
    expect(listProgramSessions(sesiones, PROGRAM).map((item) => item.id)).toEqual([
      'r',
      'c',
      'a',
      'b',
    ]);
  });

  it('muestra fecha y hora de Colombia, tipo, duración efectiva y nota', () => {
    const [enCurso, nocturna, conOverride, conNota] = listProgramSessions(sesiones, PROGRAM);

    // 23:40 del 24 en Colombia; en UTC ya es el 25.
    expect(nocturna).toEqual({
      id: 'c',
      date: '2026-09-24',
      startTime: '23:40',
      sessionTypeId: 'tipo-e',
      minutes: 40,
      note: null,
    });
    expect(conOverride.minutes).toBe(75);
    expect(conNota).toMatchObject({ date: '2026-09-20', startTime: '10:00', note: 'lectura' });

    // La sesión en curso no tiene duración todavía: null, nunca 0.
    expect(enCurso.minutes).toBeNull();
  });

  it('los empates de inicio se resuelven por identificador, de forma estable', () => {
    const mismoInicio = new Date('2026-09-24T08:00:00-05:00');
    const lista = listProgramSessions(
      [session({ id: 'z', startedAt: mismoInicio }), session({ id: 'm', startedAt: mismoInicio })],
      PROGRAM,
    );

    expect(lista.map((item) => item.id)).toEqual(['m', 'z']);
  });
});
