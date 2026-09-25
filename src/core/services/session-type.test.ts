import { describe, expect, it } from 'vitest';

import {
  SESSION_TYPE_CODE_MAX_LENGTH,
  SESSION_TYPE_LABEL_MAX_LENGTH,
  validateSessionType,
} from './session-type';

/** RF-15 — código corto y etiqueta, validados en el servidor (RF-44). */
describe('validateSessionType', () => {
  it('acepta los cuatro tipos del curso de harness engineering', () => {
    for (const [code, label] of [
      ['E', 'Estudio'],
      ['C', 'Construcción'],
      ['K', 'Consolidación'],
      ['V', 'Checkpoint'],
    ]) {
      expect(validateSessionType(code, label).ok).toBe(true);
    }
  });

  it('acepta códigos que no son de una sola letra: el enum global no existe', () => {
    // Un diplomado tiene "clase" y "taller"; un bootcamp tiene "lab".
    expect(validateSessionType('lab', 'Laboratorio').ok).toBe(true);
  });

  it('recorta espacios de código y etiqueta', () => {
    const result = validateSessionType('  E  ', '  Estudio  ');

    expect(result.ok && result.value).toEqual({ code: 'E', label: 'Estudio' });
  });

  it('no cambia la caja del código', () => {
    const result = validateSessionType('lab', 'Laboratorio');

    expect(result.ok && result.value.code).toBe('lab');
  });

  it('rechaza código vacío indicando el motivo', () => {
    const result = validateSessionType('   ', 'Estudio');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('code_empty');
  });

  it('rechaza etiqueta vacía indicando el motivo', () => {
    const result = validateSessionType('E', '');

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('label_empty');
  });

  it('fija el límite exacto del código corto', () => {
    expect(validateSessionType('a'.repeat(SESSION_TYPE_CODE_MAX_LENGTH), 'ok').ok).toBe(true);
    expect(validateSessionType('a'.repeat(SESSION_TYPE_CODE_MAX_LENGTH + 1), 'ok').ok).toBe(false);
  });

  it('fija el límite exacto de la etiqueta', () => {
    expect(validateSessionType('E', 'a'.repeat(SESSION_TYPE_LABEL_MAX_LENGTH)).ok).toBe(true);
    expect(validateSessionType('E', 'a'.repeat(SESSION_TYPE_LABEL_MAX_LENGTH + 1)).ok).toBe(false);
  });
});
