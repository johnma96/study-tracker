import { describe, expect, it } from 'vitest';

import {
  ARTIFACT_TARGET_MAX_LENGTH,
  safeExternalHref,
  thumbnailSrc,
  validateArtifactTarget,
  artifactHref,
} from './artifact-target';

/**
 * RF-50, RF-52, RF-53 — destino de un artefacto.
 *
 * Los casos de rechazo están escritos como los escribiría un atacante, no como
 * los escribiría el usuario: el destino termina dentro de un `href` y un `src`,
 * y ahí un esquema equivocado es XSS (OWASP A03).
 */

describe('validateArtifactTarget — URL (RF-50)', () => {
  it('acepta una URL https de GitHub y la guarda tal cual', () => {
    const result = validateArtifactTarget(
      'https://github.com/usuario/study-tracker/blob/main/docs/ROADMAP.md',
    );

    expect(result).toEqual({
      ok: true,
      form: 'url',
      target: 'https://github.com/usuario/study-tracker/blob/main/docs/ROADMAP.md',
    });
  });

  it('acepta http y recorta espacios alrededor', () => {
    const result = validateArtifactTarget('  http://ejemplo.org/a  ');

    expect(result).toEqual({ ok: true, form: 'url', target: 'http://ejemplo.org/a' });
  });

  it('normaliza esquema y host a minúsculas: lo guardado es lo que se presenta', () => {
    const result = validateArtifactTarget('HTTPS://GitHub.com/Usuario/Repo');

    expect(result).toEqual({ ok: true, form: 'url', target: 'https://github.com/Usuario/Repo' });
  });

  it.each([
    ['javascript:alert(1)'],
    ['JaVaScRiPt:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:msgbox(1)'],
    ['file:///etc/passwd'],
    ['ftp://ejemplo.org/archivo'],
    ['mailto:alguien@ejemplo.org'],
  ])('rechaza el esquema no web %s', (value) => {
    const result = validateArtifactTarget(value);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsafe_scheme');
  });

  it('rechaza el atajo del tabulador dentro del esquema (java\\tscript:)', () => {
    // El navegador elimina el tabulador y ejecutaría `javascript:`.
    const result = validateArtifactTarget('java\tscript:alert(1)');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('control_chars');
  });

  it('rechaza saltos de línea en cualquier parte', () => {
    const result = validateArtifactTarget('https://ejemplo.org/a\nb');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('control_chars');
  });

  it.each([['https://'], ['https:github.com/x'], ['https://servidor con espacio.org/']])(
    'rechaza la URL mal formada %s',
    (value) => {
      const result = validateArtifactTarget(value);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('invalid_url');
    },
  );

  it('rechaza usuario y clave embebidos en la URL', () => {
    const result = validateArtifactTarget('https://usuario:clave@ejemplo.org/privado');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('url_credentials');
  });
});

describe('validateArtifactTarget — ruta relativa de repositorio (RF-50)', () => {
  it('acepta una ruta relativa', () => {
    expect(validateArtifactTarget('docs/ROADMAP.md')).toEqual({
      ok: true,
      form: 'path',
      target: 'docs/ROADMAP.md',
    });
  });

  it('convierte barras invertidas de Windows y quita el ./ inicial', () => {
    expect(validateArtifactTarget('.\\docs\\ROADMAP.md')).toEqual({
      ok: true,
      form: 'path',
      target: 'docs/ROADMAP.md',
    });
  });

  it('colapsa barras repetidas y segmentos "."', () => {
    expect(validateArtifactTarget('src//core/./model/artifact.ts')).toEqual({
      ok: true,
      form: 'path',
      target: 'src/core/model/artifact.ts',
    });
  });

  it.each([['/etc/passwd'], ['//evil.example/x'], ['\\\\servidor\\share'], ['~/notas.md']])(
    'rechaza la ruta absoluta %s',
    (value) => {
      const result = validateArtifactTarget(value);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('absolute_path');
    },
  );

  it.each([['C:\\Users\\yo\\notas.md'], ['c:/Users/yo/notas.md']])(
    'rechaza la unidad de Windows %s como ruta absoluta, no como esquema',
    (value) => {
      const result = validateArtifactTarget(value);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('absolute_path');
    },
  );

  it.each([['../otro-repo/secreto.md'], ['docs/../../fuera.md']])(
    'rechaza la ruta que sale del repositorio %s',
    (value) => {
      const result = validateArtifactTarget(value);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('path_traversal');
    },
  );
});

describe('validateArtifactTarget — destino obligatorio (RF-50)', () => {
  it.each([[''], ['   '], ['./'], ['.']])('rechaza el destino vacío %j', (value) => {
    const result = validateArtifactTarget(value);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('empty');
  });

  it(`acepta ${ARTIFACT_TARGET_MAX_LENGTH} caracteres y rechaza uno más`, () => {
    const prefix = 'https://ejemplo.org/';
    const fits = prefix + 'a'.repeat(ARTIFACT_TARGET_MAX_LENGTH - prefix.length);

    expect(validateArtifactTarget(fits).ok).toBe(true);

    const result = validateArtifactTarget(fits + 'a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too_long');
  });
});

describe('safeExternalHref — segunda línea al presentar (RF-52)', () => {
  it('devuelve el href de una URL web', () => {
    expect(safeExternalHref('https://github.com/x')).toBe('https://github.com/x');
  });

  it.each([
    ['javascript:alert(1)'],
    ['  javascript:alert(1)'],
    ['java\tscript:alert(1)'],
    ['data:image/svg+xml,<svg onload=alert(1)>'],
    ['https://usuario:clave@ejemplo.org/'],
    ['//evil.example/x'],
  ])('no convierte en enlace una fila hostil que se saltó la validación: %j', (value) => {
    expect(safeExternalHref(value)).toBeNull();
  });

  it('una ruta relativa no es un enlace: no tiene base contra la que resolverse', () => {
    expect(safeExternalHref('docs/ROADMAP.md')).toBeNull();
  });
});

describe('thumbnailSrc (RF-53)', () => {
  it('muestra miniatura para una imagen con URL web', () => {
    expect(thumbnailSrc({ kind: 'image', target: 'https://ejemplo.org/captura.png' })).toBe(
      'https://ejemplo.org/captura.png',
    );
  });

  it('no muestra miniatura para una imagen con ruta relativa', () => {
    expect(thumbnailSrc({ kind: 'image', target: 'docs/captura.png' })).toBeNull();
  });

  it('no muestra miniatura para otro tipo, aunque la URL sea una imagen', () => {
    expect(thumbnailSrc({ kind: 'link', target: 'https://ejemplo.org/captura.png' })).toBeNull();
  });

  it('no usa como src un esquema que no sea web', () => {
    expect(thumbnailSrc({ kind: 'image', target: 'javascript:alert(1)' })).toBeNull();
  });
});

describe('artifactHref — R7, RF-52: rutas relativas resueltas contra repoUrl', () => {
  const base = 'https://github.com/johnma96/study-tracker';

  it('una URL web gana siempre y no necesita base', () => {
    expect(artifactHref('https://ejemplo.com/a', null)).toBe('https://ejemplo.com/a');
    expect(artifactHref('https://ejemplo.com/a', base)).toBe('https://ejemplo.com/a');
  });

  it('une la ruta relativa a la base del repositorio', () => {
    expect(artifactHref('docs/ROADMAP.md', base)).toBe(
      'https://github.com/johnma96/study-tracker/docs/ROADMAP.md',
    );
  });

  it('no duplica la barra cuando la base termina en una', () => {
    expect(artifactHref('docs/a.md', `${base}/`)).toBe(
      'https://github.com/johnma96/study-tracker/docs/a.md',
    );
  });

  it('normaliza las barras invertidas de Windows', () => {
    expect(artifactHref(String.raw`docs\notas\a.md`, base)).toBe(
      'https://github.com/johnma96/study-tracker/docs/notas/a.md',
    );
  });

  it('sin base, una ruta relativa sigue sin ser enlace', () => {
    expect(artifactHref('docs/ROADMAP.md', null)).toBeNull();
    expect(artifactHref('docs/ROADMAP.md', undefined)).toBeNull();
    expect(artifactHref('docs/ROADMAP.md', '   ')).toBeNull();
  });

  it('rechaza una base que no sea http o https', () => {
    expect(artifactHref('docs/a.md', 'javascript:alert(1)')).toBeNull();
    expect(artifactHref('docs/a.md', 'ftp://servidor/x')).toBeNull();
    expect(artifactHref('docs/a.md', 'no-es-una-url')).toBeNull();
  });

  it('rechaza una base con credenciales embebidas', () => {
    expect(artifactHref('docs/a.md', 'https://user:clave@github.com/x')).toBeNull();
  });

  // El caso que motiva la implementacion manual en vez de `new URL(ruta, base)`.
  it('no deja que una ruta protocolo-relativa se lleve el enlace a otro host', () => {
    expect(artifactHref('//host-malicioso.com/x', base)).toBeNull();
    expect(new URL('//host-malicioso.com/x', base).host).toBe('host-malicioso.com');
  });

  it('rechaza rutas que salen del repositorio o son absolutas', () => {
    expect(artifactHref('../fuera.md', base)).toBeNull();
    expect(artifactHref('/etc/passwd', base)).toBeNull();
    expect(artifactHref(String.raw`C:\Users\x.md`, base)).toBeNull();
  });

  it('rechaza un destino con esquema peligroso aunque haya base', () => {
    expect(artifactHref('javascript:alert(1)', base)).toBeNull();
  });
});
