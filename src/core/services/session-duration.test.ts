import { describe, expect, it } from 'vitest';

import type { SessionTiming } from '../model/session';

import {
  ABANDONED_AFTER_MINUTES,
  effectiveMinutes,
  effectiveSecondsSoFar,
  formatSeconds,
  isAbandoned,
  isSuspiciouslyLong,
  openPauseSeconds,
  sessionStatus,
  totalPausedSeconds,
} from './session-duration';

/**
 * RF-24 — duración efectiva.
 *
 * Cubre **los seis casos** de la tabla "Duración efectiva" de
 * docs/DATA-MODEL.md, sin tocar la base de datos. Es la lógica que decide qué
 * queda registrado como tiempo de estudio: si esta regla está mal, todo lo que
 * construya la rebanada R3 encima está mal.
 */

const START = new Date('2026-09-24T14:00:00.000Z');

/** Instante desplazado `minutes` minutos respecto al inicio. */
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

describe('effectiveMinutes — los seis casos de docs/DATA-MODEL.md', () => {
  it('caso 1: sesión de 60 minutos sin pausas devuelve 60', () => {
    expect(effectiveMinutes(session({ endedAt: at(60) }))).toBe(60);
  });

  it('caso 2: sesión de 60 minutos con una pausa de 10 devuelve 50', () => {
    expect(effectiveMinutes(session({ endedAt: at(60), pausedSeconds: 10 * 60 }))).toBe(50);
  });

  it('caso 3: sesión de 60 minutos con tres pausas de 5 devuelve 45', () => {
    const tresPausasDeCinco = 3 * 5 * 60;
    expect(effectiveMinutes(session({ endedAt: at(60), pausedSeconds: tresPausasDeCinco }))).toBe(
      45,
    );
  });

  it('caso 4 (RF-2D): con una pausa abierta, la pausa se cierra contra el instante de cierre', () => {
    // Sesión de 60 minutos que se pausó en el minuto 50 y se detuvo en el 60:
    // los últimos 10 minutos fueron descanso, no estudio.
    const conPausaAbierta = session({ endedAt: at(60), pausedAt: at(50) });

    expect(effectiveMinutes(conPausaAbierta)).toBe(50);
  });

  it('caso 5: minutesOverride gana sobre todo lo demás, incluso sobre las pausas', () => {
    // Es el caso que más se olvida. Las marcas dicen 60 menos 20 de pausa = 40,
    // y aun así el valor que vale es el que indicó el usuario (RF-24, RF-2H).
    const corregida = session({
      endedAt: at(60),
      pausedSeconds: 20 * 60,
      minutesOverride: 95,
    });

    expect(effectiveMinutes(corregida)).toBe(95);
  });

  it('caso 6: una sesión en curso devuelve null, nunca 0', () => {
    // Confundir "no se sabe todavía" con "cero minutos" arruinaría los
    // promedios de RF-31.
    expect(effectiveMinutes(session())).toBeNull();
    expect(effectiveMinutes(session())).not.toBe(0);
  });
});

describe('effectiveMinutes — redondeo al minuto más cercano (RF-24)', () => {
  it('redondea hacia arriba a partir de 30 segundos', () => {
    const treintaYUnSegundos = new Date(START.getTime() + 31_000);
    expect(effectiveMinutes(session({ endedAt: treintaYUnSegundos }))).toBe(1);
  });

  it('redondea hacia abajo por debajo de 30 segundos', () => {
    const veintinueveSegundos = new Date(START.getTime() + 29_000);
    expect(effectiveMinutes(session({ endedAt: veintinueveSegundos }))).toBe(0);
  });
});

describe('totalPausedSeconds y openPauseSeconds (RF-2B)', () => {
  it('suma la pausa abierta a las ya consolidadas', () => {
    const s = session({ pausedSeconds: 600, pausedAt: at(50) });

    expect(openPauseSeconds(s, at(55))).toBe(300);
    expect(totalPausedSeconds(s, at(55))).toBe(900);
  });

  it('sin pausa abierta solo cuenta lo consolidado', () => {
    const s = session({ pausedSeconds: 600 });

    expect(openPauseSeconds(s, at(55))).toBe(0);
    expect(totalPausedSeconds(s, at(55))).toBe(600);
  });

  it('nunca devuelve una pausa negativa aunque el reloj de referencia vaya por detrás', () => {
    const s = session({ pausedAt: at(50) });

    expect(openPauseSeconds(s, at(40))).toBe(0);
  });
});

describe('effectiveSecondsSoFar — el reloj que corre (RF-21, RF-2B)', () => {
  it('se deriva de startedAt: a los 30 minutos marca 1800 segundos', () => {
    expect(effectiveSecondsSoFar(session(), at(30))).toBe(1800);
  });

  it('mientras está pausada no avanza', () => {
    const pausada = session({ pausedAt: at(20) });

    // Pausó en el minuto 20; da igual que hayan pasado 25 o 40 minutos.
    expect(effectiveSecondsSoFar(pausada, at(25))).toBe(20 * 60);
    expect(effectiveSecondsSoFar(pausada, at(40))).toBe(20 * 60);
  });

  it('descuenta las pausas ya consolidadas', () => {
    const conPausas = session({ pausedSeconds: 10 * 60 });

    expect(effectiveSecondsSoFar(conPausas, at(60))).toBe(50 * 60);
  });
});

describe('sessionStatus — el estado se deriva, no se almacena', () => {
  it('corriendo, pausada y terminada', () => {
    expect(sessionStatus(session())).toBe('running');
    expect(sessionStatus(session({ pausedAt: at(10) }))).toBe('paused');
    expect(sessionStatus(session({ endedAt: at(60) }))).toBe('ended');
  });
});

describe('isSuspiciouslyLong — umbral de confirmación (RF-25)', () => {
  it('ocho horas exactas no piden confirmación; un minuto más sí', () => {
    expect(isSuspiciouslyLong(480)).toBe(false);
    expect(isSuspiciouslyLong(481)).toBe(true);
  });
});

describe('isAbandoned — sesión huérfana (RF-2G)', () => {
  it('detecta una sesión abierta hace más de ocho horas', () => {
    expect(isAbandoned(session(), at(ABANDONED_AFTER_MINUTES + 1))).toBe(true);
  });

  it('no marca como abandonada una sesión de ocho horas justas', () => {
    expect(isAbandoned(session(), at(ABANDONED_AFTER_MINUTES))).toBe(false);
  });

  it('se mide sobre el inicio, así que una sesión pausada hace diez horas también lo está', () => {
    const pausadaHaceMucho = session({ pausedAt: at(30) });

    expect(isAbandoned(pausadaHaceMucho, at(10 * 60))).toBe(true);
  });

  it('una sesión ya cerrada nunca está abandonada', () => {
    expect(isAbandoned(session({ endedAt: at(60) }), at(100 * 60))).toBe(false);
  });
});

describe('formatSeconds', () => {
  it('presenta horas, minutos y segundos', () => {
    expect(formatSeconds(0)).toBe('0:00:00');
    expect(formatSeconds(59)).toBe('0:00:59');
    expect(formatSeconds(3661)).toBe('1:01:01');
    expect(formatSeconds(-5)).toBe('0:00:00');
  });
});
