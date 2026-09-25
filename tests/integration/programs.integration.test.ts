import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { artifactHref } from '@/core/services/artifact-target';
import { parseNewProgram } from '@/core/services/program-input';
import { getDb } from '@/infra/db/client';
import { programs } from '@/infra/db/schema';
import { drizzleProgramRepository } from '@/infra/repos/drizzle-program-repository';

/**
 * Pruebas de integración de R7 contra el branch de desarrollo de Neon.
 *
 * **Existen por un defecto real, encontrado usando la aplicación.** `repo_url`
 * llegaba validado desde `parseNewProgram` y se leía bien en `toDomain`, pero
 * el `insert` de `create()` no lo incluía: el campo se descartaba en silencio
 * entre dos capas que **sí** estaban probadas por separado. Ninguna prueba
 * unitaria podía verlo, porque cada extremo hacía lo suyo correctamente.
 *
 * Es el mismo patrón que el error de `cause` de Drizzle que apareció en R1: los
 * defectos de este proyecto no viven dentro de una capa, viven en las costuras.
 *
 * Todo lo que crean se borra al final.
 */

const TEST_PROGRAM_NAME = 'ZZ prueba de integración R7';
const REPO_URL = 'https://github.com/johnma96/study-tracker';

async function cleanUp(): Promise<void> {
  await getDb().delete(programs).where(eq(programs.name, TEST_PROGRAM_NAME));
}

beforeAll(cleanUp);
afterAll(cleanUp);

describe('repoUrl sobrevive el viaje completo (R7, RF-52)', () => {
  it('se guarda al crear y se lee de vuelta', async () => {
    const parsed = parseNewProgram({
      name: TEST_PROGRAM_NAME,
      provider: '',
      kind: 'course',
      status: 'active',
      startedAt: '',
      targetAt: '',
      repoUrl: REPO_URL,
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // El defecto estaba aquí: `create` descartaba el campo al insertar.
    const created = await drizzleProgramRepository.create(parsed.value);
    expect(created.repoUrl).toBe(REPO_URL);

    // Y releído desde la base, que es lo que ve la página.
    const listed = await drizzleProgramRepository.list();
    const found = listed.find((program) => program.name === TEST_PROGRAM_NAME);

    expect(found?.repoUrl).toBe(REPO_URL);
  });

  it('con el programa ya guardado, una ruta relativa se vuelve enlace', async () => {
    const listed = await drizzleProgramRepository.list();
    const found = listed.find((program) => program.name === TEST_PROGRAM_NAME);

    // La cadena completa: lo guardado alimenta lo que se presenta (RF-52).
    expect(artifactHref('docs/ROADMAP.md', found?.repoUrl)).toBe(
      'https://github.com/johnma96/study-tracker/docs/ROADMAP.md',
    );
  });

  it('el CHECK del motor rechaza una base que no sea http o https', async () => {
    await expect(
      getDb()
        .insert(programs)
        .values({
          name: TEST_PROGRAM_NAME,
          kind: 'course',
          status: 'planned',
          // Saltándose `parseNewProgram` a propósito: el motor es la última línea.
          repoUrl: 'javascript:alert(1)',
        })
        .returning(),
    ).rejects.toThrow();
  });
});
