import type { Artifact } from '../model/artifact';

import { charLength } from './text';

/**
 * RF-50, RF-52, RF-53 — el destino de un artefacto: qué se acepta al guardarlo
 * y cómo se presenta al leerlo.
 *
 * RF-50 admite dos formas de destino: una **URL** o una **ruta relativa de
 * repositorio**. Esta es la única definición de las dos; el esquema de entrada
 * (`artifact-input.ts`) y la interfaz la consumen, no la repiten.
 *
 * **Seguridad (OWASP, XSS por atributo `href`).** Un destino termina dentro de
 * un `<a href>` y, si es imagen, de un `<img src>`. Un `javascript:` o un
 * `data:` ahí es ejecución de código en la página, y React **no** lo bloquea:
 * solo emite una advertencia en desarrollo. Por eso la regla es una lista
 * blanca —solo `http` y `https`—, no una lista negra de esquemas peligrosos,
 * que siempre se queda corta (`vbscript:`, `JaVaScRiPt:`, `java\tscript:`…).
 *
 * La regla se aplica **dos veces**, a propósito: al guardar
 * (`validateArtifactTarget`) y al presentar (`safeExternalHref`). La segunda no
 * sobra: una fila escrita saltándose la Server Action —a mano, con un script,
 * con una versión anterior del código— no debe convertirse en un enlace
 * ejecutable solo porque ya está en la base.
 */

/** Tope de longitud del destino. Lo fija esta implementación, no el DDL. */
export const ARTIFACT_TARGET_MAX_LENGTH = 2048;

/** Esquemas que pueden llegar a un `href` o a un `src`. Lista blanca. */
const SAFE_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Caracteres de control, incluidos tabulador y saltos de línea.
 *
 * Los navegadores los **eliminan** del interior de una URL antes de
 * interpretarla, así que `java\tscript:alert(1)` llega al motor como
 * `javascript:`. Rechazarlos cierra ese atajo antes de que nadie tenga que
 * pensar en él.
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** Un esquema al principio: `https:`, `javascript:`, `c:`… */
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:/i;

/** Una URL web explícita. `https:github.com` no cuenta: falta el `//`. */
const WEB_URL_PREFIX = /^https?:\/\//i;

/** Unidad de Windows: `C:\…` o `C:/…`. Es una ruta absoluta, no un esquema. */
const WINDOWS_DRIVE = /^[a-z]:[\\/]/i;

export type ArtifactTargetForm = 'url' | 'path';

export type ArtifactTargetRejection =
  | 'empty'
  | 'too_long'
  | 'control_chars'
  | 'unsafe_scheme'
  | 'invalid_url'
  | 'url_credentials'
  | 'absolute_path'
  | 'path_traversal';

export type ArtifactTargetCheck =
  | {
      readonly ok: true;
      /** Destino normalizado: es exactamente lo que se guarda y lo que se presenta. */
      readonly target: string;
      readonly form: ArtifactTargetForm;
    }
  | {
      readonly ok: false;
      readonly reason: ArtifactTargetRejection;
      readonly message: string;
    };

function reject(reason: ArtifactTargetRejection, message: string): ArtifactTargetCheck {
  return { ok: false, reason, message };
}

/**
 * Interpreta una URL web y la devuelve normalizada, o `null` si no es una URL
 * `http`/`https` bien formada y sin credenciales.
 *
 * Se apoya en `URL`, el mismo analizador que usa el navegador, en lugar de una
 * expresión regular: lo que importa es cómo lo va a interpretar quien haga
 * clic, no cómo lo lee una regex.
 */
function parseWebUrl(value: string): URL | null {
  if (CONTROL_CHARS.test(value) || !WEB_URL_PREFIX.test(value)) return null;

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (!SAFE_PROTOCOLS.has(url.protocol) || url.hostname === '') return null;

  return url;
}

/**
 * RF-50 — valida y normaliza el destino de un artefacto.
 *
 * - **URL**: solo `http://` o `https://`, con host y sin usuario ni clave
 *   embebidos. Se guarda la forma normalizada por `URL` (esquema y host en
 *   minúsculas), para que lo guardado sea exactamente lo que se presenta.
 * - **Ruta relativa de repositorio**: sin esquema, sin barra inicial, sin
 *   unidad de Windows, sin `~` y sin segmentos `..`. Las barras invertidas se
 *   convierten a `/` —un usuario de Windows pega `docs\ROADMAP.md`— y el `./`
 *   inicial se quita.
 *
 * La ruta rechaza `..` aunque nunca se abra en el servidor (RF-54: aquí no se
 * lee ni se escribe ningún archivo). El motivo es de significado: "relativa de
 * repositorio" es una ruta **dentro** del repositorio, y `../otra-cosa` ya no lo
 * es.
 */
export function validateArtifactTarget(raw: string): ArtifactTargetCheck {
  const value = raw.trim();

  if (value === '') {
    return reject('empty', 'El destino es obligatorio: una URL o una ruta del repositorio.');
  }

  if (charLength(value) > ARTIFACT_TARGET_MAX_LENGTH) {
    return reject(
      'too_long',
      `El destino no puede superar ${ARTIFACT_TARGET_MAX_LENGTH} caracteres.`,
    );
  }

  if (CONTROL_CHARS.test(value)) {
    return reject('control_chars', 'El destino no puede contener tabuladores ni saltos de línea.');
  }

  if (WINDOWS_DRIVE.test(value)) {
    return reject(
      'absolute_path',
      'Usa una ruta relativa al repositorio (docs/archivo.md), no una ruta de tu disco.',
    );
  }

  if (SCHEME_PREFIX.test(value)) {
    const scheme = value.slice(0, value.indexOf(':') + 1).toLowerCase();

    if (!SAFE_PROTOCOLS.has(scheme)) {
      return reject('unsafe_scheme', 'Solo se aceptan URLs que empiecen por http:// o https://.');
    }

    const url = parseWebUrl(value);

    if (url === null) {
      return reject('invalid_url', 'La URL no es válida. Debe tener la forma https://servidor/ruta.');
    }

    if (url.username !== '' || url.password !== '') {
      return reject(
        'url_credentials',
        'La URL no puede llevar usuario ni clave: quedarían guardados y visibles en la página.',
      );
    }

    return { ok: true, target: url.href, form: 'url' };
  }

  const slashed = value.replace(/\\/g, '/');

  if (slashed.startsWith('/') || slashed.startsWith('~')) {
    return reject(
      'absolute_path',
      'Usa una ruta relativa al repositorio (docs/archivo.md), sin barra inicial.',
    );
  }

  const segments = slashed.split('/').filter((segment) => segment !== '' && segment !== '.');

  if (segments.includes('..')) {
    return reject('path_traversal', 'La ruta no puede salir del repositorio con "..".');
  }

  if (segments.length === 0) {
    return reject('empty', 'El destino es obligatorio: una URL o una ruta del repositorio.');
  }

  return { ok: true, target: segments.join('/'), form: 'path' };
}

/**
 * RF-52 — `href` seguro para un destino ya guardado, o `null` si no debe ser
 * un enlace.
 *
 * Es la segunda aplicación de la lista blanca (ver el encabezado): no confía
 * en que la fila haya pasado por `validateArtifactTarget`. Una ruta relativa
 * también devuelve `null`, porque no tiene base contra la que resolverse: como
 * `href` relativo apuntaría a esta misma aplicación, no al repositorio.
 */
export function safeExternalHref(target: string): string | null {
  const url = parseWebUrl(target.trim());

  if (url === null || url.username !== '' || url.password !== '') return null;

  return url.href;
}

/**
 * RF-53 — origen de la miniatura, o `null` si no corresponde mostrarla.
 *
 * Solo un artefacto de tipo `image` cuyo destino sea una URL web. "Accesible"
 * no se comprueba en el servidor: pedir la URL desde aquí sería abrir la puerta
 * a SSRF (el servidor haciendo peticiones a donde diga el usuario). Lo decide el
 * navegador al cargarla, y la interfaz se degrada a un enlace si falla.
 */
export function thumbnailSrc(artifact: Pick<Artifact, 'kind' | 'target'>): string | null {
  return artifact.kind === 'image' ? safeExternalHref(artifact.target) : null;
}
