import { describe, expect, it } from 'vitest';

import {
  PROGRAM_NAME_MAX_LENGTH,
  PROGRAM_NAME_MIN_LENGTH,
  programNameLength,
  validateProgramName,
} from './program-name';

/**
 * RF-14 — «Si el nombre del programa está vacío o supera 120 caracteres,
 * entonces el sistema debe rechazar la operación y mostrar el motivo.»
 *
 * Esta regla vive en `core/` precisamente para poder probarla sin base de
 * datos. Los CHECK de Postgres son la última línea de defensa, no la primera:
 * una violación de restricción que llega al usuario como excepción del motor es
 * un defecto de la aplicación.
 */

/** Cadena de `n` caracteres, para fijar los límites exactos. */
const chars = (n: number) => 'a'.repeat(n);

describe('validateProgramName — límites de RF-14', () => {
  it('acepta el mínimo exacto: 1 carácter', () => {
    const result = validateProgramName(chars(PROGRAM_NAME_MIN_LENGTH));

    expect(result.ok).toBe(true);
    expect(result.ok && result.name).toBe('a');
  });

  it('acepta el máximo exacto: 120 caracteres', () => {
    const result = validateProgramName(chars(PROGRAM_NAME_MAX_LENGTH));

    expect(result.ok).toBe(true);
  });

  it('rechaza 121 caracteres, uno por encima del máximo', () => {
    const result = validateProgramName(chars(PROGRAM_NAME_MAX_LENGTH + 1));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('too_long');
  });

  it('rechaza la cadena vacía', () => {
    const result = validateProgramName('');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('empty');
  });

  it('rechaza un nombre de solo espacios: en blanco no es un nombre', () => {
    const result = validateProgramName('   \t\n  ');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('empty');
  });

  it('da un motivo legible en cada rechazo (RF-14 exige mostrarlo)', () => {
    const empty = validateProgramName('');
    const long = validateProgramName(chars(PROGRAM_NAME_MAX_LENGTH + 1));

    expect(empty.ok === false && empty.message.length).toBeGreaterThan(0);
    expect(long.ok === false && long.message).toContain('120');
  });
});

describe('validateProgramName — normalización', () => {
  it('recorta los espacios de los extremos y devuelve el nombre ya normalizado', () => {
    const result = validateProgramName('  Harness Engineering  ');

    expect(result.ok && result.name).toBe('Harness Engineering');
  });

  it('recorta antes de medir: 120 caracteres entre espacios siguen siendo válidos', () => {
    const result = validateProgramName(`  ${chars(PROGRAM_NAME_MAX_LENGTH)}  `);

    expect(result.ok).toBe(true);
    expect(result.ok && programNameLength(result.name)).toBe(PROGRAM_NAME_MAX_LENGTH);
  });
});

describe('programNameLength — mide como char_length de Postgres', () => {
  it('cuenta puntos de código, no unidades UTF-16', () => {
    // '👍' ocupa dos unidades UTF-16 en JavaScript pero es UN carácter para
    // char_length() de Postgres. Contar con `.length` dejaría pasar nombres que
    // el CHECK de la base rechaza, o al revés.
    expect('👍'.length).toBe(2);
    expect(programNameLength('👍')).toBe(1);
  });

  it('acepta 120 caracteres fuera del plano básico', () => {
    const result = validateProgramName('👍'.repeat(PROGRAM_NAME_MAX_LENGTH));

    expect(result.ok).toBe(true);
  });

  it('rechaza 121 caracteres fuera del plano básico', () => {
    const result = validateProgramName('👍'.repeat(PROGRAM_NAME_MAX_LENGTH + 1));

    expect(result.ok).toBe(false);
  });
});
