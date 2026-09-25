import { describe, expect, it } from 'vitest';

import type { SessionTiming } from '../model/session';

import { decidePause, decideResume, decideStop, manualSessionEnd } from './session-transitions';

/**
 * RF-23, RF-25, RF-2A a RF-2E — transiciones del cronómetro.
 *
 * Son decisiones puras: reciben la sesión y devuelven qué debe quedar escrito.
 * Probarlas aquí es lo que permite verificar el comportamiento del cronómetro
 * sin navegador y sin base de datos.
 */

const START = new Date('2026-09-24T14:00:00.000Z');
const at = (minutes: number) => new Date(START.getTime() + minutes * 60_000);

function session(overrides: Partial<SessionTiming> = {}): SessionTiming {
  return {
    startedAt: START,
    endedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
    minutesOverride: null,
    ...overrides,
  };
}

describe('decidePause (RF-2A)', () => {
  it('registra el instante de la pausa', () => {
    const decision = decidePause(session(), at(20));

    expect(decision).toEqual({ ok: true, pausedAt: at(20) });
  });

  it('rechaza pausar una sesión ya pausada', () => {
    const decision = decidePause(session({ pausedAt: at(10) }), at(20));

    expect(decision).toEqual({ ok: false, reason: 'already_paused' });
  });

  it('rechaza pausar una sesión terminada', () => {
    const decision = decidePause(session({ endedAt: at(60) }), at(70));

    expect(decision).toEqual({ ok: false, reason: 'already_ended' });
  });
});

describe('decideResume (RF-2C, RF-2E)', () => {
  it('suma el intervalo de la pausa al acumulado', () => {
    const decision = decideResume(session({ pausedAt: at(20) }), at(30));

    expect(decision).toEqual({ ok: true, pausedSeconds: 600 });
  });

  it('acumula pausa tras pausa, no la reemplaza (RF-2E)', () => {
    // Ya llevaba 600 segundos de pausas anteriores y ahora descansó 5 minutos
    // más: el total tiene que ser 900, no 300.
    const decision = decideResume(session({ pausedSeconds: 600, pausedAt: at(40) }), at(45));

    expect(decision).toEqual({ ok: true, pausedSeconds: 900 });
  });

  it('rechaza reanudar una sesión que no está pausada', () => {
    expect(decideResume(session(), at(30))).toEqual({ ok: false, reason: 'not_paused' });
  });

  it('rechaza reanudar una sesión terminada', () => {
    const terminadaYPausada = session({ endedAt: at(60), pausedAt: at(50) });

    expect(decideResume(terminadaYPausada, at(70))).toEqual({
      ok: false,
      reason: 'already_ended',
    });
  });
});

describe('decideStop — cierre normal (RF-23, RF-24)', () => {
  it('devuelve la duración efectiva y el instante de cierre', () => {
    const decision = decideStop(session(), {
      now: at(60),
      minutesOverride: null,
      confirmed: false,
    });

    expect(decision).toEqual({
      kind: 'commit',
      endedAt: at(60),
      pausedSeconds: 0,
      minutesOverride: null,
      minutes: 60,
    });
  });

  it('descuenta las pausas ya consolidadas', () => {
    const decision = decideStop(session({ pausedSeconds: 600 }), {
      now: at(60),
      minutesOverride: null,
      confirmed: false,
    });

    expect(decision).toMatchObject({ kind: 'commit', minutes: 50, pausedSeconds: 600 });
  });

  it('RF-2D: consolida la pausa abierta antes de calcular', () => {
    // Pausó en el minuto 50 y detiene en el 60. Si el orden se invirtiera —
    // calcular y luego consolidar— el total incluiría 10 minutos de descanso.
    const decision = decideStop(session({ pausedAt: at(50) }), {
      now: at(60),
      minutesOverride: null,
      confirmed: false,
    });

    expect(decision).toMatchObject({ kind: 'commit', pausedSeconds: 600, minutes: 50 });
  });

  it('rechaza cerrar una sesión ya cerrada', () => {
    const decision = decideStop(session({ endedAt: at(60) }), {
      now: at(70),
      minutesOverride: null,
      confirmed: false,
    });

    expect(decision).toEqual({ kind: 'rejected', reason: 'already_ended' });
  });

  it('rechaza un cierre que no es posterior al inicio', () => {
    const decision = decideStop(session(), {
      now: START,
      minutesOverride: null,
      confirmed: false,
    });

    expect(decision).toEqual({ kind: 'rejected', reason: 'not_elapsed' });
  });
});

describe('decideStop — sesión sospechosamente larga (RF-25)', () => {
  it('pide confirmación cuando el cálculo pasa de ocho horas', () => {
    // El caso real: se olvidó detener el cronómetro y lo nota al día siguiente.
    const decision = decideStop(session(), {
      now: at(14 * 60),
      minutesOverride: null,
      confirmed: false,
    });

    expect(decision).toEqual({ kind: 'needs_confirmation', minutes: 840 });
  });

  it('guarda el valor calculado si el usuario confirma sin corregir', () => {
    const decision = decideStop(session(), {
      now: at(14 * 60),
      minutesOverride: null,
      confirmed: true,
    });

    expect(decision).toMatchObject({ kind: 'commit', minutes: 840, minutesOverride: null });
  });

  it('un minutesOverride explícito es ya la respuesta a la advertencia (RF-2H)', () => {
    const decision = decideStop(session(), {
      now: at(14 * 60),
      minutesOverride: 120,
      confirmed: false,
    });

    expect(decision).toMatchObject({ kind: 'commit', minutesOverride: 120, minutes: 120 });
  });

  it('no pide confirmación en el umbral exacto de ocho horas', () => {
    const decision = decideStop(session(), {
      now: at(8 * 60),
      minutesOverride: null,
      confirmed: false,
    });

    expect(decision).toMatchObject({ kind: 'commit', minutes: 480 });
  });
});

describe('manualSessionEnd (RF-26)', () => {
  it('el cierre es el inicio más los minutos informados', () => {
    expect(manualSessionEnd(START, 90)).toEqual(at(90));
  });
});
