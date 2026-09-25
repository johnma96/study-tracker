import { describe, expect, it } from 'vitest';

import type { ProgramStatus } from '../model/program';

import { type ProgramOrderFields, sortPrograms } from './program-order';

/**
 * RF-13 — «El sistema debe listar los programas ordenados por estado (`active`
 * primero) y luego por fecha de inicio descendente.»
 *
 * El orden vive en `core/` y no en la cláusula ORDER BY de una consulta: así se
 * prueba sin base de datos, que es la justificación explícita de la separación
 * por capas en docs/ARCHITECTURE.md.
 */

function program(
  name: string,
  status: ProgramStatus,
  startedAt: string | null,
): ProgramOrderFields {
  return { name, status, startedAt };
}

/** Nombres en el orden resultante: lo que se afirma en cada caso. */
const names = (list: readonly ProgramOrderFields[]) => sortPrograms(list).map((p) => p.name);

describe('sortPrograms — estado: active primero (RF-13)', () => {
  it('pone active por delante de todos los demás estados', () => {
    const list = [
      program('planned', 'planned', '2026-01-01'),
      program('paused', 'paused', '2026-01-01'),
      program('done', 'done', '2026-01-01'),
      program('abandoned', 'abandoned', '2026-01-01'),
      program('active', 'active', '2026-01-01'),
    ];

    expect(names(list)[0]).toBe('active');
  });

  it('el estado manda sobre la fecha: un active viejo va antes que un pausado reciente', () => {
    const list = [
      program('pausado reciente', 'paused', '2026-09-01'),
      program('activo viejo', 'active', '2020-01-01'),
    ];

    expect(names(list)).toEqual(['activo viejo', 'pausado reciente']);
  });

  it('un active sin fecha de inicio sigue yendo antes que un no-active con fecha', () => {
    const list = [
      program('pausado con fecha', 'paused', '2026-09-01'),
      program('activo sin fecha', 'active', null),
    ];

    expect(names(list)).toEqual(['activo sin fecha', 'pausado con fecha']);
  });
});

describe('sortPrograms — fecha de inicio descendente (RF-13)', () => {
  it('dentro del mismo estado, la fecha más reciente va primero', () => {
    const list = [
      program('antiguo', 'active', '2024-03-15'),
      program('nuevo', 'active', '2026-09-24'),
      program('intermedio', 'active', '2025-07-01'),
    ];

    expect(names(list)).toEqual(['nuevo', 'intermedio', 'antiguo']);
  });

  it('ordena por fecha también entre los estados distintos de active', () => {
    const list = [
      program('plan viejo', 'planned', '2024-01-01'),
      program('terminado nuevo', 'done', '2026-05-05'),
    ];

    expect(names(list)).toEqual(['terminado nuevo', 'plan viejo']);
  });
});

describe('sortPrograms — fecha nula (RF-13 no la define)', () => {
  it('sin fecha de inicio va al final de su grupo, nunca al principio', () => {
    // Postgres ordena NULLS FIRST en DESC por defecto. Aplicado tal cual, un
    // programa sin fecha encabezaría el listado por encima del más reciente,
    // que es justo lo contrario de lo que RF-13 busca mostrar.
    const list = [
      program('sin fecha', 'active', null),
      program('con fecha vieja', 'active', '2020-01-01'),
      program('con fecha nueva', 'active', '2026-09-24'),
    ];

    expect(names(list)).toEqual(['con fecha nueva', 'con fecha vieja', 'sin fecha']);
  });

  it('entre dos sin fecha del mismo estado, desempata el nombre', () => {
    const list = [
      program('Zeta', 'planned', null),
      program('Alfa', 'planned', null),
    ];

    expect(names(list)).toEqual(['Alfa', 'Zeta']);
  });

  it('una fecha nula no adelanta a otro estado: active sin fecha antes que planned sin fecha', () => {
    const list = [program('planeado', 'planned', null), program('activo', 'active', null)];

    expect(names(list)).toEqual(['activo', 'planeado']);
  });
});

describe('sortPrograms — contrato de la función', () => {
  it('no muta el arreglo recibido', () => {
    const list = [
      program('segundo', 'planned', '2020-01-01'),
      program('primero', 'active', '2019-01-01'),
    ];
    const original = [...list];

    sortPrograms(list);

    expect(list).toEqual(original);
  });

  it('da el mismo resultado sin importar el orden de entrada', () => {
    const a = program('A', 'active', '2026-01-01');
    const b = program('B', 'planned', '2026-05-01');
    const c = program('C', 'done', null);

    expect(names([a, b, c])).toEqual(names([c, b, a]));
    expect(names([b, c, a])).toEqual(['A', 'B', 'C']);
  });

  it('con la lista vacía devuelve la lista vacía', () => {
    expect(sortPrograms([])).toEqual([]);
  });
});
