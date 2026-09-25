import { describe, expect, it } from 'vitest';

import { PROGRAM_NAME_MAX_LENGTH } from './program-name';
import { parseNewProgram, parseNewSessionType } from './program-input';

/**
 * RF-44 — «El sistema debe validar toda entrada en el servidor, sin confiar en
 * la validación del cliente.»
 *
 * Estas pruebas no pasan por el formulario a propósito: entran por donde entra
 * un `curl`. Si la única defensa fuera `required` y `maxLength` en el HTML,
 * todas fallarían.
 */

/** Entrada válida mínima, para alterar un solo campo en cada caso. */
const valid = {
  name: 'Harness Engineering',
  provider: 'walkinglabs',
  kind: 'course',
  status: 'active',
  startedAt: '2026-09-24',
  targetAt: '2026-12-31',
};

describe('parseNewProgram — camino feliz (RF-10)', () => {
  it('acepta y normaliza una entrada completa', () => {
    const result = parseNewProgram(valid);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual({
      name: 'Harness Engineering',
      provider: 'walkinglabs',
      kind: 'course',
      status: 'active',
      startedAt: '2026-09-24',
      targetAt: '2026-12-31',
      repoUrl: null,
    });
  });

  it('solo el nombre es obligatorio: el resto en blanco queda nulo', () => {
    const result = parseNewProgram({
      name: 'Autoestudio',
      provider: '',
      kind: 'selfstudy',
      status: 'planned',
      startedAt: '',
      targetAt: '',
    });

    expect(result.ok && result.value.provider).toBeNull();
    expect(result.ok && result.value.startedAt).toBeNull();
    expect(result.ok && result.value.targetAt).toBeNull();
  });

  it('no incluye plannedSessions: RF-10 no lo pide y su uso es de RF-36 (R3)', () => {
    const result = parseNewProgram({ ...valid, plannedSessions: '41' });

    expect(result.ok && Object.keys(result.value).sort()).toEqual([
      'kind',
      'name',
      'provider',
      'repoUrl',
      'startedAt',
      'status',
      'targetAt',
    ]);
  });
});

describe('parseNewProgram — RF-14 en el servidor', () => {
  it('rechaza el nombre vacío aunque el formulario lo diera por bueno', () => {
    const result = parseNewProgram({ ...valid, name: '' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors.name).toBeDefined();
  });

  it('rechaza un nombre de 121 caracteres', () => {
    const result = parseNewProgram({ ...valid, name: 'a'.repeat(PROGRAM_NAME_MAX_LENGTH + 1) });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors.name).toContain('120');
  });

  it('acepta exactamente 120 caracteres', () => {
    expect(parseNewProgram({ ...valid, name: 'a'.repeat(PROGRAM_NAME_MAX_LENGTH) }).ok).toBe(true);
  });

  it('trata un campo ausente igual que uno en blanco, no como excepción', () => {
    const result = parseNewProgram({});

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors.name).toBeDefined();
  });
});

describe('parseNewProgram — RF-11 y RF-12 en el servidor', () => {
  it('rechaza un tipo de programa inventado', () => {
    const result = parseNewProgram({ ...valid, kind: 'masterclass' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors.kind).toBeDefined();
  });

  it('rechaza un estado inventado', () => {
    const result = parseNewProgram({ ...valid, status: 'zombi' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors.status).toBeDefined();
  });

  it('acepta los cinco tipos de RF-11', () => {
    for (const kind of ['course', 'certification', 'diploma', 'bootcamp', 'selfstudy']) {
      expect(parseNewProgram({ ...valid, kind }).ok).toBe(true);
    }
  });

  it('acepta los cinco estados de RF-12', () => {
    for (const status of ['planned', 'active', 'paused', 'done', 'abandoned']) {
      expect(parseNewProgram({ ...valid, status }).ok).toBe(true);
    }
  });
});

describe('parseNewProgram — fechas', () => {
  it('rechaza una fecha que no existe en el calendario', () => {
    const result = parseNewProgram({ ...valid, startedAt: '2026-02-30' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors.startedAt).toBeDefined();
  });

  it('rechaza un formato de fecha distinto de AAAA-MM-DD', () => {
    const result = parseNewProgram({ ...valid, targetAt: '31/12/2026' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors.targetAt).toBeDefined();
  });
});

describe('parseNewSessionType — RF-15 en el servidor', () => {
  const programId = '11111111-2222-3333-4444-555555555555';

  it('acepta un tipo válido y lo normaliza', () => {
    const result = parseNewSessionType({ programId, code: ' E ', label: ' Estudio ' });

    expect(result.ok && result.value).toEqual({ programId, code: 'E', label: 'Estudio' });
  });

  it('rechaza un programId que no es UUID: el campo oculto es editable', () => {
    const result = parseNewSessionType({ programId: 'otro-programa', code: 'E', label: 'Estudio' });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors.programId).toBeDefined();
  });

  it('rechaza código vacío y etiqueta vacía indicando el campo', () => {
    expect(
      parseNewSessionType({ programId, code: '', label: 'Estudio' }),
    ).toMatchObject({ ok: false });
    expect(
      parseNewSessionType({ programId, code: 'E', label: '  ' }),
    ).toMatchObject({ ok: false });
  });
});

describe('parseNewProgram — repoUrl (R7, RF-52)', () => {
  it('acepta una URL http o https y la guarda normalizada', () => {
    const result = parseNewProgram({ ...valid, repoUrl: 'HTTPS://GitHub.com/johnma96/study-tracker' });

    expect(result.ok && result.value.repoUrl).toBe('https://github.com/johnma96/study-tracker');
  });

  it('en blanco queda nulo: el campo es opcional', () => {
    expect(parseNewProgram({ ...valid, repoUrl: '' }).ok).toBe(true);
    expect(parseNewProgram({ ...valid, repoUrl: '   ' }).ok).toBe(true);

    const result = parseNewProgram({ ...valid, repoUrl: '   ' });
    expect(result.ok && result.value.repoUrl).toBeNull();
  });

  it('ausente se trata como en blanco, no como error de forma', () => {
    const { repoUrl: _omitido, ...sinCampo } = { ...valid, repoUrl: '' };
    const result = parseNewProgram(sinCampo);

    expect(result.ok && result.value.repoUrl).toBeNull();
  });

  // La base termina dentro de un href: un esquema peligroso convertiria cada
  // ruta relativa del programa en un enlace ejecutable.
  it('rechaza un esquema fuera de la lista blanca', () => {
    for (const malo of ['javascript:alert(1)', 'ftp://servidor/x', 'no-es-una-url']) {
      const result = parseNewProgram({ ...valid, repoUrl: malo });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.fieldErrors.repoUrl).toBeDefined();
    }
  });

  it('rechaza una URL con credenciales embebidas', () => {
    const result = parseNewProgram({ ...valid, repoUrl: 'https://user:clave@github.com/x' });

    expect(result.ok).toBe(false);
  });
});
