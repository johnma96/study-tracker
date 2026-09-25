import { describe, expect, it } from 'vitest';

import type { SessionTiming } from '../model/session';

import {
  buildHeatmap,
  buildProgramStats,
  CADENCE_WEEKS,
  currentStreak,
  dailyTotals,
  type DayTotal,
  heatLevel,
  HEATMAP_WEEKS,
  projectCompletion,
  summarize,
  weeklyCadence,
} from './study-stats';

/**
 * R3 — estadísticas por programa (RF-31 a RF-37), sin base de datos.
 *
 * Cada valor esperado está calculado a mano en el propio caso, no copiado de lo
 * que devuelve la función: una prueba que se escribe mirando la salida solo
 * comprueba que la función hace lo que ya hacía.
 *
 * Las horas de Colombia se escriben con su desplazamiento explícito (`-05:00`)
 * para que el instante no dependa de la zona del proceso que corre la prueba.
 */

/** Instante a partir de una fecha y hora **de Colombia**. */
const bogota = (date: string, time: string) => new Date(`${date}T${time}:00-05:00`);

/** Sesión cerrada que empezó a esa hora de Colombia y duró `minutes` minutos brutos. */
function closed(
  date: string,
  time: string,
  minutes: number,
  extra: Partial<SessionTiming> = {},
): SessionTiming {
  const startedAt = bogota(date, time);
  return {
    startedAt,
    endedAt: new Date(startedAt.getTime() + minutes * 60_000),
    pausedAt: null,
    pausedSeconds: 0,
    minutesOverride: null,
    ...extra,
  };
}

/** Sesión en curso: sin marca de fin, sin duración todavía. */
function running(date: string, time: string): SessionTiming {
  return {
    startedAt: bogota(date, time),
    endedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
    minutesOverride: null,
  };
}

const day = (date: string, sessions: number, minutes: number): DayTotal => ({
  date,
  sessions,
  minutes,
});

/** Viernes 25/09/2026. Su semana empieza el lunes 21/09/2026. */
const TODAY = '2026-09-25';

describe('RF-00, RF-32 — el día de una sesión es la fecha de Colombia de su inicio', () => {
  it('caso obligatorio: una sesión de 23:40 a 00:20 cuenta en el día de inicio y no en el siguiente', () => {
    // 23:40 del 24/09 en Colombia son las 04:40 UTC del 25/09.
    const sesion = closed('2026-09-24', '23:40', 40);

    expect(sesion.startedAt.toISOString()).toBe('2026-09-25T04:40:00.000Z');
    expect(dailyTotals([sesion])).toEqual([day('2026-09-24', 1, 40)]);
    expect(summarize([sesion])?.daysWorked).toBe(1);
  });

  it('trampa de UTC: una sesión iniciada después de las 19:00 de Colombia no salta al día siguiente', () => {
    // 19:30 en Colombia son las 00:30 UTC del día siguiente: la fecha UTC ya es 25.
    const sesion = closed('2026-09-24', '19:30', 60);

    expect(sesion.startedAt.toISOString().slice(0, 10)).toBe('2026-09-25');
    expect(dailyTotals([sesion])).toEqual([day('2026-09-24', 1, 60)]);
  });

  it('en el borde exacto de las 19:00 de Colombia (medianoche UTC) sigue siendo el mismo día', () => {
    expect(dailyTotals([closed('2026-09-24', '19:00', 30)])).toEqual([day('2026-09-24', 1, 30)]);
  });

  it('dos sesiones del mismo día civil, una antes y otra después de las 19:00, suman un solo día', () => {
    const totals = dailyTotals([closed('2026-09-24', '08:00', 30), closed('2026-09-24', '21:00', 45)]);

    expect(totals).toEqual([day('2026-09-24', 2, 75)]);
  });
});

describe('RF-31 — totales por programa con la duración efectiva de RF-24', () => {
  // A mano:
  //   s1 24/09 09:00, 60 min brutos con 10 de pausa  -> 50
  //   s2 24/09 15:00, 45 min sin pausa               -> 45
  //   s3 23/09 20:00, 30 min brutos, override de 90  -> 90 (el override gana)
  //   s4 25/09 10:00, en curso                        -> no cuenta
  //   sesiones = 3, días = 2 (23 y 24), total = 185, media = 185 / 3
  const sesiones = [
    closed('2026-09-24', '09:00', 60, { pausedSeconds: 10 * 60 }),
    closed('2026-09-24', '15:00', 45),
    closed('2026-09-23', '20:00', 30, { minutesOverride: 90 }),
    running('2026-09-25', '10:00'),
  ];

  it('cuenta sesiones, días distintos, minutos totales y media por sesión', () => {
    const resumen = summarize(sesiones);

    expect(resumen).not.toBeNull();
    expect(resumen?.sessionCount).toBe(3);
    expect(resumen?.daysWorked).toBe(2);
    expect(resumen?.totalMinutes).toBe(185);
    expect(resumen?.averageMinutes).toBeCloseTo(61.667, 3);
  });

  it('agrupa por día con los minutos efectivos, no los brutos', () => {
    expect(dailyTotals(sesiones)).toEqual([day('2026-09-23', 1, 90), day('2026-09-24', 2, 95)]);
  });

  it('una sesión en curso no suma cero minutos ni un día: se omite hasta que se cierre', () => {
    expect(dailyTotals([running('2026-09-25', '10:00')])).toEqual([]);
    expect(summarize([running('2026-09-25', '10:00')])).toBeNull();
  });
});

describe('RF-37 — sin sesiones hay estado vacío, no tableros en cero', () => {
  it('un programa sin sesiones devuelve el caso vacío', () => {
    expect(summarize([])).toBeNull();
    expect(buildProgramStats([], { today: TODAY, plannedSessions: 41 })).toEqual({ kind: 'empty' });
  });

  it('un programa con solo la sesión en curso también está vacío', () => {
    expect(
      buildProgramStats([running(TODAY, '10:00')], { today: TODAY, plannedSessions: null }),
    ).toEqual({ kind: 'empty' });
  });
});

describe('RF-34 — racha actual', () => {
  it('cuenta los días consecutivos que terminan hoy', () => {
    const dias = [day('2026-09-23', 1, 30), day('2026-09-24', 2, 60), day('2026-09-25', 1, 20)];

    expect(currentStreak(dias, TODAY)).toEqual({ days: 3, includesToday: true });
  });

  it('si hoy todavía no hay sesión, la racha se cuenta hasta ayer y no cae a cero', () => {
    const dias = [day('2026-09-23', 1, 30), day('2026-09-24', 1, 30)];

    expect(currentStreak(dias, TODAY)).toEqual({ days: 2, includesToday: false });
  });

  it('se rompe cuando pasa un día entero sin sesión', () => {
    const dias = [day('2026-09-22', 1, 30), day('2026-09-23', 1, 30)];

    // Hoy 25 y ayer 24 están vacíos: la racha del 22-23 ya no es actual.
    expect(currentStreak(dias, TODAY)).toEqual({ days: 0, includesToday: false });
  });

  it('un hueco en medio corta la cuenta', () => {
    const dias = [
      day('2026-09-20', 1, 30),
      // 21 vacío
      day('2026-09-22', 1, 30),
      day('2026-09-23', 1, 30),
      day('2026-09-24', 1, 30),
      day('2026-09-25', 1, 30),
    ];

    expect(currentStreak(dias, TODAY)).toEqual({ days: 4, includesToday: true });
  });

  it('la racha cruza el cambio de mes', () => {
    const dias = [day('2026-09-30', 1, 30), day('2026-10-01', 1, 30)];

    expect(currentStreak(dias, '2026-10-01')).toEqual({ days: 2, includesToday: true });
  });

  it('extremo a extremo: una sesión de las 23:40 de ayer mantiene la racha de hoy', () => {
    // Si la sesión de las 23:40 del 24 se agrupara por fecha UTC caería el 25 y
    // la racha diría "hoy sí, ayer no": 1 en vez de 2.
    const sesiones = [closed('2026-09-24', '23:40', 40), closed('2026-09-25', '08:00', 30)];

    expect(currentStreak(dailyTotals(sesiones), TODAY)).toEqual({ days: 2, includesToday: true });
  });
});

describe('RF-35 — cadencia de las últimas 8 semanas', () => {
  // Hoy es viernes 25/09; la semana actual empieza el lunes 21/09. Ocho semanas
  // hacia atrás, la primera empieza el lunes 03/08 (21/09 − 7 × 7 días).
  const dias = [
    day('2026-08-02', 1, 30), // domingo anterior a la ventana: fuera
    day('2026-08-03', 1, 60), // lunes de la primera semana: dentro, semana 0
    day('2026-09-20', 2, 100), // domingo: semana del 14/09, índice 6
    day('2026-09-21', 1, 40), // lunes de la semana actual, índice 7
    day('2026-09-25', 1, 20), // hoy, índice 7
    day('2026-09-26', 1, 999), // mañana: no puede contar
  ];

  const cadencia = weeklyCadence(dias, TODAY);

  it('devuelve ocho semanas, de la más antigua a la actual, empezando en lunes', () => {
    expect(cadencia.weeks).toHaveLength(CADENCE_WEEKS);
    expect(cadencia.weeks.map((week) => week.weekStart)).toEqual([
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ]);
  });

  it('suma cada día en su semana de lunes a domingo, con las semanas vacías en cero', () => {
    expect(cadencia.weeks[0]).toEqual({ weekStart: '2026-08-03', sessions: 1, minutes: 60 });
    expect(cadencia.weeks[6]).toEqual({ weekStart: '2026-09-14', sessions: 2, minutes: 100 });
    expect(cadencia.weeks[7]).toEqual({ weekStart: '2026-09-21', sessions: 2, minutes: 60 });

    for (const index of [1, 2, 3, 4, 5]) {
      expect(cadencia.weeks[index].sessions).toBe(0);
      expect(cadencia.weeks[index].minutes).toBe(0);
    }
  });

  it('promedia sobre las ocho semanas: 5 sesiones y 220 minutos', () => {
    expect(cadencia.sessionsPerWeek).toBe(5 / 8);
    expect(cadencia.minutesPerWeek).toBe(220 / 8);
  });
});

describe('RF-36 — proyección a partir de las últimas 4 semanas', () => {
  // Ventana: los 28 días que terminan hoy, del 29/08 al 25/09 inclusive.
  // Fuera de ella, 2 sesiones el 28/08. Dentro, 8 sesiones.
  //   hechas = 10, restantes = 41 − 10 = 31
  //   ritmo = 8 / 4 = 2 sesiones por semana
  //   días = ceil(31 / 2 × 7) = ceil(108,5) = 109
  //   25/09/2026 + 109 días = 12/01/2027
  //     (5 hasta el 30/09, +31 octubre = 36, +30 noviembre = 66, +31 diciembre = 97, +12)
  const dias = [
    day('2026-08-28', 2, 120),
    day('2026-08-29', 1, 60),
    day('2026-09-05', 2, 90),
    day('2026-09-12', 2, 90),
    day('2026-09-19', 1, 45),
    day('2026-09-25', 2, 80),
  ];

  it('proyecta la fecha con el ritmo de la ventana y las sesiones restantes', () => {
    expect(projectCompletion(dias, 41, TODAY)).toEqual({
      kind: 'projected',
      remainingSessions: 31,
      sessionsPerWeek: 2,
      estimatedDate: '2027-01-12',
    });
  });

  it('si ya se cumplieron las sesiones planeadas, no proyecta: está completado', () => {
    expect(projectCompletion(dias, 10, TODAY)).toEqual({ kind: 'completed', completedSessions: 10 });
  });

  it('sin sesiones en las últimas cuatro semanas no hay ritmo del que proyectar', () => {
    expect(projectCompletion([day('2026-08-01', 3, 90)], 41, TODAY)).toEqual({
      kind: 'no_pace',
      remainingSessions: 38,
    });
  });

  it('sin sesiones planeadas en el programa, la proyección no aplica', () => {
    const stats = buildProgramStats([closed(TODAY, '08:00', 30)], {
      today: TODAY,
      plannedSessions: null,
    });

    expect(stats.kind).toBe('ready');
    if (stats.kind === 'ready') expect(stats.projection).toBeNull();
  });
});

describe('RF-33 — mapa de calor', () => {
  it('los umbrales de intensidad son fijos en minutos', () => {
    expect(heatLevel(0, 0)).toBe(0);
    // Un día con sesión nunca se pinta vacío, aunque durara menos de un minuto.
    expect(heatLevel(0, 1)).toBe(1);
    expect(heatLevel(29, 1)).toBe(1);
    expect(heatLevel(30, 1)).toBe(2);
    expect(heatLevel(59, 2)).toBe(2);
    expect(heatLevel(60, 1)).toBe(3);
    expect(heatLevel(119, 3)).toBe(3);
    expect(heatLevel(120, 1)).toBe(4);
    expect(heatLevel(600, 5)).toBe(4);
  });

  it('arma columnas de lunes a domingo que terminan en la semana de hoy', () => {
    const mapa = buildHeatmap([day('2026-09-15', 1, 90)], TODAY, 2);

    expect(mapa.firstDate).toBe('2026-09-14');
    expect(mapa.lastDate).toBe('2026-09-27');
    expect(mapa.weeks).toHaveLength(2);
    expect(mapa.weeks[0].map((cell) => cell.date)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);

    // Martes 15/09, 90 minutos: nivel 3.
    expect(mapa.weeks[0][1]).toEqual({
      date: '2026-09-15',
      minutes: 90,
      sessions: 1,
      level: 3,
      future: false,
    });
  });

  it('marca como futuros los días de la semana actual que todavía no llegan', () => {
    const mapa = buildHeatmap([], TODAY, 1);

    // Lunes 21 a viernes 25 ya pasaron o son hoy; sábado 26 y domingo 27, no.
    expect(mapa.weeks[0].map((cell) => cell.future)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it('por defecto muestra 26 semanas completas', () => {
    const mapa = buildHeatmap([], TODAY);

    expect(mapa.weeks).toHaveLength(HEATMAP_WEEKS);
    expect(mapa.weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('extremo a extremo: la sesión de las 23:40 se pinta en su día, no en el siguiente', () => {
    const stats = buildProgramStats([closed('2026-09-24', '23:40', 40)], {
      today: TODAY,
      plannedSessions: null,
    });

    expect(stats.kind).toBe('ready');
    if (stats.kind !== 'ready') return;

    const semanaActual = stats.heatmap.weeks[stats.heatmap.weeks.length - 1];
    const jueves = semanaActual[3];
    const viernes = semanaActual[4];

    expect(jueves).toMatchObject({ date: '2026-09-24', minutes: 40, level: 2 });
    expect(viernes).toMatchObject({ date: '2026-09-25', minutes: 0, level: 0 });
  });
});

describe('buildProgramStats — el tablero completo de un programa', () => {
  it('reúne resumen, racha, cadencia, mapa y proyección con las mismas sesiones', () => {
    // A mano, con hoy = 25/09:
    //   24/09 23:40, 40 min  -> día 24
    //   25/09 07:00, 60 min brutos con 15 de pausa -> 45, día 25
    //   sesiones 2, días 2, total 85, racha 2 incluyendo hoy
    //   proyección: 41 − 2 = 39 restantes, ritmo 2 / 4 = 0,5 por semana,
    //   días = ceil(39 / 0,5 × 7) = 546 -> 25/09/2026 + 546 = 24/03/2028
    //   (2027 tiene 365 días: 25/09/2027 es +365; faltan 181; hasta el
    //    31/12/2027 van 97 -> quedan 84; enero 31 + febrero 29 (2028 bisiesto)
    //    = 60 -> quedan 24 -> 24/03/2028)
    const stats = buildProgramStats(
      [
        closed('2026-09-24', '23:40', 40),
        closed('2026-09-25', '07:00', 60, { pausedSeconds: 15 * 60 }),
      ],
      { today: TODAY, plannedSessions: 41 },
    );

    expect(stats.kind).toBe('ready');
    if (stats.kind !== 'ready') return;

    expect(stats.summary).toEqual({
      sessionCount: 2,
      daysWorked: 2,
      totalMinutes: 85,
      averageMinutes: 42.5,
    });
    expect(stats.streak).toEqual({ days: 2, includesToday: true });
    expect(stats.cadence.weeks[CADENCE_WEEKS - 1]).toEqual({
      weekStart: '2026-09-21',
      sessions: 2,
      minutes: 85,
    });
    expect(stats.projection).toEqual({
      kind: 'projected',
      remainingSessions: 39,
      sessionsPerWeek: 0.5,
      estimatedDate: '2028-03-24',
    });
  });
});
