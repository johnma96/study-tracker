import { describe, expect, it } from 'vitest';

import { ARTIFACT_KINDS } from '../model/artifact';

import { ARTIFACT_LABEL_MAX_LENGTH, parseNewArtifact } from './artifact-input';

/**
 * RF-44, RF-50, RF-51 — validación de entrada del servidor para adjuntar un
 * artefacto.
 *
 * La del formulario es conveniencia: se salta con `curl`, con JavaScript
 * desactivado o desde el inspector. Estas pruebas atacan la entrada como lo
 * haría un cliente hostil, sin levantar Next ni base de datos.
 */

const SESSION_ID = '99999999-8888-4777-8666-555555555555';

const base = {
  sessionId: SESSION_ID,
  kind: 'doc',
  label: 'Roadmap del proyecto',
  target: 'https://github.com/usuario/study-tracker/blob/main/docs/ROADMAP.md',
};

describe('parseNewArtifact — tipos de RF-51', () => {
  it.each(ARTIFACT_KINDS.map((kind) => [kind]))('acepta el tipo %s', (kind) => {
    const result = parseNewArtifact({ ...base, kind });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.kind).toBe(kind);
  });

  it('la lista de tipos es exactamente la de RF-51', () => {
    expect([...ARTIFACT_KINDS]).toEqual(['doc', 'image', 'repo', 'link', 'commit']);
  });

  it.each([['video'], ['DOC'], [''], ['file']])('rechaza el tipo %j', (kind) => {
    const result = parseNewArtifact({ ...base, kind });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.kind).toBeDefined();
  });
});

describe('parseNewArtifact — destino obligatorio y seguro (RF-50)', () => {
  it('acepta una URL y la devuelve normalizada', () => {
    const result = parseNewArtifact({ ...base, target: '  HTTPS://GitHub.com/u/r  ' });

    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: SESSION_ID,
        kind: 'doc',
        label: 'Roadmap del proyecto',
        target: 'https://github.com/u/r',
      },
    });
  });

  it('acepta una ruta relativa de repositorio', () => {
    const result = parseNewArtifact({ ...base, target: 'docs\\ROADMAP.md' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.target).toBe('docs/ROADMAP.md');
  });

  it('rechaza el destino en blanco', () => {
    const result = parseNewArtifact({ ...base, target: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.target).toMatch(/obligatorio/);
  });

  it('rechaza javascript: en el servidor aunque el formulario lo dejara pasar', () => {
    const result = parseNewArtifact({ ...base, target: 'javascript:alert(document.cookie)' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.target).toBeDefined();
  });
});

describe('parseNewArtifact — etiqueta y sesión (RF-50)', () => {
  it('recorta la etiqueta', () => {
    const result = parseNewArtifact({ ...base, label: '  Captura  ' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.label).toBe('Captura');
  });

  it('rechaza la etiqueta en blanco', () => {
    const result = parseNewArtifact({ ...base, label: '  ' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.label).toBeDefined();
  });

  it(`acepta ${ARTIFACT_LABEL_MAX_LENGTH} caracteres de etiqueta y rechaza uno más`, () => {
    expect(parseNewArtifact({ ...base, label: 'a'.repeat(ARTIFACT_LABEL_MAX_LENGTH) }).ok).toBe(
      true,
    );

    const result = parseNewArtifact({ ...base, label: 'a'.repeat(ARTIFACT_LABEL_MAX_LENGTH + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.label).toBeDefined();
  });

  it('cuenta la etiqueta en puntos de código, como char_length() de Postgres', () => {
    // 120 emojis miden 240 unidades UTF-16 y aun así caben.
    const result = parseNewArtifact({ ...base, label: '📎'.repeat(ARTIFACT_LABEL_MAX_LENGTH) });

    expect(result.ok).toBe(true);
  });

  it('rechaza una sesión que no es un identificador', () => {
    const result = parseNewArtifact({ ...base, sessionId: "1' or '1'='1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.sessionId).toBeDefined();
  });

  it('un formulario vacío da un motivo por campo, no una excepción', () => {
    const result = parseNewArtifact({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(
        ['kind', 'label', 'sessionId', 'target'].sort(),
      );
    }
  });
});
