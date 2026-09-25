import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * RF-54 — el sistema **no** almacena archivos. Solo guarda referencias.
 *
 * RF-54 es un requerimiento negativo: no hay una función que probar, hay algo
 * que **no** debe existir en ninguna parte del repositorio. Por eso esta prueba
 * no ejercita código: lo lee. Recorre el código fuente y falla si encuentra
 * cualquiera de las tres puertas por las que un archivo podría terminar
 * guardado:
 *
 * 1. **Escritura en disco.** Las API de escritura de Node (`writeFile`,
 *    `appendFile`, `createWriteStream`, `copyFile`…) en `src/`, `scripts/` y los
 *    archivos de configuración de la raíz. Además, en `src/` —el código que
 *    corre en Vercel— está prohibido **importar** `fs`: la aplicación no tiene
 *    ningún motivo para tocar el sistema de archivos, y prohibir el import es
 *    más robusto que enumerar funciones (no se escapa `fs.promises.open(…,'w')`).
 * 2. **Subida desde el navegador.** Un `<input type="file">`, o una Server Action
 *    que trate lo recibido como `File`. Sin puerta de entrada no hay nada que
 *    guardar.
 * 3. **Almacenamiento en otra parte.** Una columna binaria en el esquema o las
 *    migraciones, o una dependencia de almacenamiento de objetos o de subida en
 *    `package.json`.
 *
 * **Única exclusión: este mismo archivo**, que necesita `fs` para leer el
 * código y contiene los patrones que busca. No hay más lista de permitidos: si
 * algún día una rebanada necesitara escribir un archivo, tendría que editar
 * esta prueba, y ese cambio sería visible en la revisión.
 *
 * La prueba se protege de pasar en vacío: exige haber leído un número mínimo de
 * archivos, entre ellos el esquema, y comprueba que el detector sí marca un
 * ejemplo que viola la regla.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Ruta de este archivo relativa a la raíz, con `/`. */
const SELF = 'src/core/no-file-storage.test.ts';

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx'];
const SCANNED_EXTENSIONS = [...CODE_EXTENSIONS, '.sql'];
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', '.git', 'out', 'build']);

interface Rule {
  readonly name: string;
  readonly pattern: RegExp;
  /** A qué archivos se aplica, por ruta relativa con `/`. */
  readonly appliesTo: (path: string) => boolean;
}

const isCode = (path: string) => CODE_EXTENSIONS.some((extension) => path.endsWith(extension));
const isRuntimeCode = (path: string) => path.startsWith('src/') && isCode(path);
const isAnyScanned = () => true;

const RULES: readonly Rule[] = [
  {
    name: 'API de escritura en disco de Node',
    pattern:
      /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|copyFile|copyFileSync|cp|cpSync|writev|writevSync)\s*\(/,
    appliesTo: isCode,
  },
  {
    name: 'import de fs en el código que corre en el servidor',
    pattern: /(?:from\s+|require\s*\(\s*|import\s*\(\s*)['"](?:node:)?fs(?:\/promises)?['"]/,
    appliesTo: isRuntimeCode,
  },
  {
    name: 'campo de subida de archivos en un formulario',
    pattern: /type\s*=\s*\{?\s*['"]file['"]/,
    appliesTo: isCode,
  },
  {
    name: 'contenido de un formulario tratado como archivo',
    pattern: /\binstanceof\s+(?:File|Blob)\b|\.arrayBuffer\s*\(/,
    appliesTo: isRuntimeCode,
  },
  {
    name: 'columna binaria en el esquema o en una migración',
    pattern: /\bbytea\b/i,
    appliesTo: isAnyScanned,
  },
];

/**
 * Dependencias que solo tienen sentido para subir o almacenar archivos. No es
 * exhaustiva —no puede serlo—: es la lista de las que un agente instalaría
 * primero si alguien le pidiera "adjuntar la captura".
 */
const STORAGE_PACKAGES = [
  '@vercel/blob',
  '@aws-sdk/client-s3',
  '@google-cloud/storage',
  '@azure/storage-blob',
  'multer',
  'formidable',
  'busboy',
  'uploadthing',
  '@uploadthing/react',
];

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function listFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) continue;

    const absolute = join(directory, entry);

    if (statSync(absolute).isDirectory()) {
      found.push(...listFiles(absolute));
    } else if (SCANNED_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      found.push(toPosix(relative(ROOT, absolute)));
    }
  }

  return found;
}

/** `src/`, `scripts/` y los archivos sueltos de la raíz (configuración). */
function scannedFiles(): string[] {
  const rootFiles = readdirSync(ROOT).filter(
    (entry) =>
      !statSync(join(ROOT, entry)).isDirectory() &&
      SCANNED_EXTENSIONS.some((extension) => entry.endsWith(extension)),
  );

  return [...listFiles(join(ROOT, 'src')), ...listFiles(join(ROOT, 'scripts')), ...rootFiles]
    .filter((path) => path !== SELF)
    .sort();
}

/** Violaciones de `content` según las reglas que aplican a `path`. */
function findViolations(path: string, content: string): string[] {
  const violations: string[] = [];
  const lines = content.split(/\r?\n/);

  for (const rule of RULES) {
    if (!rule.appliesTo(path)) continue;

    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        violations.push(`${path}:${index + 1} — ${rule.name}: ${line.trim()}`);
      }
    });
  }

  return violations;
}

describe('RF-54 — ninguna ruta del repositorio almacena archivos', () => {
  const files = scannedFiles();

  it('recorre el repositorio de verdad: no pasa en vacío', () => {
    expect(files.length).toBeGreaterThan(30);
    expect(files).toContain('src/infra/db/schema.ts');
    expect(files).toContain('src/app/artifact-actions.ts');
    expect(files.some((path) => path.startsWith('src/infra/db/migrations/'))).toBe(true);
  });

  it('el detector marca cada puerta prohibida (control de la propia prueba)', () => {
    expect(findViolations('src/app/x.ts', "await fs.writeFile('a.png', data);")).toHaveLength(1);
    expect(findViolations('scripts/x.mjs', 'fs.createWriteStream(p)')).toHaveLength(1);
    expect(findViolations('src/app/x.ts', "import { readFile } from 'node:fs/promises';")).toHaveLength(1);
    expect(findViolations('src/ui/x.tsx', '<input type="file" name="evidencia" />')).toHaveLength(1);
    expect(findViolations('src/app/x.ts', 'if (value instanceof File) save(value);')).toHaveLength(1);
    expect(findViolations('src/infra/db/schema.ts', "content: customType({ dataType: () => 'bytea' })")).toHaveLength(1);
    expect(findViolations('src/infra/db/migrations/0009_x.sql', 'ALTER TABLE a ADD b BYTEA;')).toHaveLength(1);
  });

  it('ningún archivo escribe en disco, acepta subidas ni guarda binarios', () => {
    const violations = files.flatMap((path) =>
      findViolations(path, readFileSync(join(ROOT, path), 'utf8')),
    );

    expect(violations).toEqual([]);
  });

  it('package.json no trae dependencias de subida ni de almacenamiento de archivos', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const installed = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });

    expect(installed.filter((name) => STORAGE_PACKAGES.includes(name))).toEqual([]);
  });
});
