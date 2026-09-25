import { describe, expect, it } from 'vitest';

import type { Program } from '../model/program';
import type { Session } from '../model/session';

import {
  ALL_PROGRAMS,
  ALL_PROGRAMS_CONTEXT,
  filterByProgramContext,
  filterSessionEvidenceByProgramContext,
  isSelectedProgram,
  plannedSessionsInContext,
  programContextParam,
  programsInContext,
  resolveProgramContext,
  selectedProgramId,
  type ProgramContext,
} from './program-context';
import { buildProgramStats } from './study-stats';

/**
 * R8 — el contexto de programa, sin base de datos.
 *
 * Lo que se prueba aquí es la propiedad que da sentido a la rebanada: **lo que
 * no es del programa elegido no se cuenta**. La comprobación no se hace solo
 * sobre el filtro, sino sobre el filtro compuesto con los totales de R3, que es
 * donde el usuario vería el error.
 */

const HARNESS = 'programa-harness';
const DIPLOMADO = 'programa-diplomado';

const PROGRAMS: Program[] = [
  {
    id: HARNESS,
    name: 'Harness Engineering',
    provider: null,
    kind: 'course',
    status: 'active',
    startedAt: '2026-09-01',
    targetAt: null,
    plannedSessions: 30,
    repoUrl: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
  },
  {
    id: DIPLOMADO,
    name: 'Diplomado',
    provider: null,
    kind: 'diploma',
    status: 'active',
    startedAt: '2026-08-01',
    targetAt: null,
    plannedSessions: null,
    repoUrl: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
  },
];

const HARNESS_CONTEXT: ProgramContext = { kind: 'program', programId: HARNESS };

function session(
  overrides: Partial<Session> & Pick<Session, 'id' | 'startedAt' | 'programId'>,
): Session {
  return {
    sessionTypeId: null,
    endedAt: new Date(overrides.startedAt.getTime() + 60 * 60_000),
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

describe('R8 — resolución del contexto desde la URL', () => {
  it('sin parámetro, el contexto es «todos»', () => {
    expect(resolveProgramContext(undefined, PROGRAMS)).toEqual(ALL_PROGRAMS_CONTEXT);
    expect(resolveProgramContext(null, PROGRAMS)).toEqual(ALL_PROGRAMS_CONTEXT);
  });

  it('el valor «todos» es el contexto por defecto, escrito de forma explícita', () => {
    expect(resolveProgramContext(ALL_PROGRAMS, PROGRAMS)).toEqual(ALL_PROGRAMS_CONTEXT);
  });

  it('un identificador que existe selecciona ese programa', () => {
    expect(resolveProgramContext(HARNESS, PROGRAMS)).toEqual(HARNESS_CONTEXT);
  });

  it('tolera espacios alrededor del identificador', () => {
    expect(resolveProgramContext(`  ${HARNESS}  `, PROGRAMS)).toEqual(HARNESS_CONTEXT);
  });

  /**
   * El parámetro lo escribe cualquiera. Ninguno de estos valores puede romper la
   * página ni llegar a una consulta: todos caen en «todos».
   */
  it('un valor hostil, mal formado o inexistente se trata como «todos»', () => {
    const hostiles = [
      '',
      '   ',
      'programa-que-no-existe',
      "' OR 1=1 --",
      '<script>alert(1)</script>',
      '../../etc/passwd',
      '00000000-0000-0000-0000-000000000000',
      'null',
      'undefined',
    ];

    for (const valor of hostiles) {
      expect(resolveProgramContext(valor, PROGRAMS)).toEqual(ALL_PROGRAMS_CONTEXT);
    }
  });

  it('un parámetro repetido llega como arreglo y se toma el primero', () => {
    expect(resolveProgramContext([HARNESS, DIPLOMADO], PROGRAMS)).toEqual(HARNESS_CONTEXT);
    expect(resolveProgramContext(['basura', HARNESS], PROGRAMS)).toEqual(ALL_PROGRAMS_CONTEXT);
    expect(resolveProgramContext([], PROGRAMS)).toEqual(ALL_PROGRAMS_CONTEXT);
  });

  it('sin programas —la base no respondió— cualquier valor cae en «todos»', () => {
    expect(resolveProgramContext(HARNESS, [])).toEqual(ALL_PROGRAMS_CONTEXT);
  });

  it('el contexto vuelve a la URL con el mismo valor con que se leyó', () => {
    expect(programContextParam(ALL_PROGRAMS_CONTEXT)).toBe(ALL_PROGRAMS);
    expect(programContextParam(HARNESS_CONTEXT)).toBe(HARNESS);

    // Ida y vuelta: leer lo que se escribió devuelve el mismo contexto.
    const ida = programContextParam(HARNESS_CONTEXT);
    expect(resolveProgramContext(ida, PROGRAMS)).toEqual(HARNESS_CONTEXT);
  });

  it('«todos» no marca ningún programa como seleccionado', () => {
    expect(isSelectedProgram(ALL_PROGRAMS_CONTEXT, HARNESS)).toBe(false);
    expect(isSelectedProgram(HARNESS_CONTEXT, HARNESS)).toBe(true);
    expect(isSelectedProgram(HARNESS_CONTEXT, DIPLOMADO)).toBe(false);
  });

  it('el programa preseleccionado en los formularios es null con «todos»', () => {
    expect(selectedProgramId(ALL_PROGRAMS_CONTEXT)).toBeNull();
    expect(selectedProgramId(HARNESS_CONTEXT)).toBe(HARNESS);
  });
});

describe('R8 — filtrado por contexto', () => {
  const sesiones: Session[] = [
    session({ id: 'h1', programId: HARNESS, startedAt: new Date('2026-09-20T10:00:00-05:00') }),
    session({ id: 'd1', programId: DIPLOMADO, startedAt: new Date('2026-09-21T10:00:00-05:00') }),
    session({ id: 'h2', programId: HARNESS, startedAt: new Date('2026-09-22T10:00:00-05:00') }),
  ];

  it('con «todos» entran las sesiones de todos los programas', () => {
    expect(filterByProgramContext(sesiones, ALL_PROGRAMS_CONTEXT).map((s) => s.id)).toEqual([
      'h1',
      'd1',
      'h2',
    ]);
  });

  it('con un programa entran solo las suyas', () => {
    expect(filterByProgramContext(sesiones, HARNESS_CONTEXT).map((s) => s.id)).toEqual([
      'h1',
      'h2',
    ]);
  });

  it('no muta la lista recibida, ni siquiera con «todos»', () => {
    const copia = [...sesiones];
    const resultado = filterByProgramContext(sesiones, ALL_PROGRAMS_CONTEXT);

    resultado.sort((a, b) => a.id.localeCompare(b.id));

    expect(sesiones).toEqual(copia);
    expect(resultado).not.toBe(sesiones);
  });

  it('sirve igual para métricas y para cualquier cosa que pertenezca a un programa', () => {
    const metricas = [
      { id: 'm1', programId: HARNESS },
      { id: 'm2', programId: DIPLOMADO },
    ];

    expect(filterByProgramContext(metricas, HARNESS_CONTEXT)).toEqual([
      { id: 'm1', programId: HARNESS },
    ]);
    expect(filterByProgramContext(metricas, ALL_PROGRAMS_CONTEXT)).toHaveLength(2);
  });

  it('la evidencia se filtra por el programa de su sesión', () => {
    const evidencia = [
      { session: { id: 'h1', programId: HARNESS }, artifacts: [] },
      { session: { id: 'd1', programId: DIPLOMADO }, artifacts: [] },
    ];

    expect(
      filterSessionEvidenceByProgramContext(evidencia, HARNESS_CONTEXT).map(
        (item) => item.session.id,
      ),
    ).toEqual(['h1']);
    expect(filterSessionEvidenceByProgramContext(evidencia, ALL_PROGRAMS_CONTEXT)).toHaveLength(2);
  });

  it('los programas visibles son todos, o solo el elegido, conservando el orden', () => {
    expect(programsInContext(PROGRAMS, ALL_PROGRAMS_CONTEXT).map((p) => p.id)).toEqual([
      HARNESS,
      DIPLOMADO,
    ]);
    expect(programsInContext(PROGRAMS, HARNESS_CONTEXT).map((p) => p.id)).toEqual([HARNESS]);
  });
});

describe('R8 — sesiones planeadas del contexto (RF-36)', () => {
  it('con un programa es su propio plan', () => {
    expect(plannedSessionsInContext(PROGRAMS, HARNESS_CONTEXT)).toBe(30);
  });

  it('un programa sin plan no proyecta', () => {
    expect(
      plannedSessionsInContext(PROGRAMS, { kind: 'program', programId: DIPLOMADO }),
    ).toBeNull();
  });

  it('con «todos» suma las de los programas que declaran plan', () => {
    const conDos = [...PROGRAMS, { id: 'otro', plannedSessions: 20 }];
    expect(plannedSessionsInContext(conDos, ALL_PROGRAMS_CONTEXT)).toBe(50);
  });

  it('si ninguno declara plan el resultado es null, no cero', () => {
    const sinPlan = [{ id: 'a', plannedSessions: null }, { id: 'b', plannedSessions: null }];
    expect(plannedSessionsInContext(sinPlan, ALL_PROGRAMS_CONTEXT)).toBeNull();
  });
});

/**
 * **La propiedad que exige `docs/ROADMAP.md` para R8.** No basta con que el
 * filtro devuelva menos elementos: lo que importa es que una sesión de otro
 * programa **no se cuente** en los totales del seleccionado. Por eso la prueba
 * compone el filtro con `buildProgramStats`, que es lo que se pinta en
 * pantalla.
 */
describe('R8 — una sesión de otro programa no cuenta en los totales del seleccionado', () => {
  const HOY = '2026-09-22';

  // Dos sesiones de Harness (60 + 60 min) y una del diplomado (120 min) en un
  // día que los otros dos no tocan.
  const sesiones: Session[] = [
    session({ id: 'h1', programId: HARNESS, startedAt: new Date('2026-09-20T10:00:00-05:00') }),
    session({ id: 'h2', programId: HARNESS, startedAt: new Date('2026-09-22T10:00:00-05:00') }),
    session({
      id: 'd1',
      programId: DIPLOMADO,
      startedAt: new Date('2026-09-21T10:00:00-05:00'),
      endedAt: new Date('2026-09-21T12:00:00-05:00'),
    }),
  ];

  const opciones = { today: HOY, plannedSessions: null };

  it('con el programa elegido, los totales ignoran la sesión ajena', () => {
    const stats = buildProgramStats(
      filterByProgramContext(sesiones, HARNESS_CONTEXT),
      opciones,
    );

    if (stats.kind !== 'ready') throw new Error('se esperaban totales calculados');

    expect(stats.summary.sessionCount).toBe(2);
    expect(stats.summary.totalMinutes).toBe(120);
    expect(stats.summary.daysWorked).toBe(2);

    // Los 120 minutos del diplomado, el 21, no aparecen en ninguna celda.
    const celdas = stats.heatmap.weeks.flat();
    expect(celdas.find((celda) => celda.date === '2026-09-21')?.minutes).toBe(0);

    // Y la racha se rompe el 21 justo porque ese día no es suyo.
    expect(stats.streak.days).toBe(1);
  });

  it('con «todos», la misma sesión ajena sí entra', () => {
    const stats = buildProgramStats(
      filterByProgramContext(sesiones, ALL_PROGRAMS_CONTEXT),
      opciones,
    );

    if (stats.kind !== 'ready') throw new Error('se esperaban totales calculados');

    expect(stats.summary.sessionCount).toBe(3);
    expect(stats.summary.totalMinutes).toBe(240);
    expect(stats.summary.daysWorked).toBe(3);

    const celdas = stats.heatmap.weeks.flat();
    expect(celdas.find((celda) => celda.date === '2026-09-21')?.minutes).toBe(120);

    // Tres días seguidos, porque el mapa de «todos» suma los tres programas.
    expect(stats.streak.days).toBe(3);
  });
});
