import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseNewArtifact } from '@/core/services/artifact-input';
import { getDb } from '@/infra/db/client';
import { artifacts, programs, sessions } from '@/infra/db/schema';
import { drizzleArtifactRepository } from '@/infra/repos/drizzle-artifact-repository';
import { drizzleSessionRepository } from '@/infra/repos/drizzle-session-repository';

/**
 * Pruebas de integración de R4 contra el branch de desarrollo de Neon.
 *
 * Comprueban lo que **solo tiene sentido contra la base real**:
 *
 * 1. Dos artefactos adjuntados a una sesión se recuperan, con sus campos y en
 *    el orden en que se adjuntaron (RF-50, criterio de docs/ROADMAP.md).
 * 2. Los CHECK del motor son la última línea: un tipo fuera de RF-51 o un
 *    destino vacío escritos **saltándose** la validación se rechazan.
 * 3. Adjuntar a una sesión que ya no existe es un caso de negocio, no una
 *    excepción; y descartar la sesión se lleva su evidencia en cascada.
 *
 * **Solo usa sesiones cerradas** (`createClosed`). Quedan fuera del índice
 * `one_running_session`, así que estas pruebas no chocan con una sesión en
 * curso real ni con la suite de R2, y no necesitan abortar si hay una.
 *
 * Todo lo que crean se borra al final: el programa de prueba se lleva sus
 * sesiones y, por la cascada, sus artefactos.
 */

const TEST_PROGRAM_NAME = 'ZZ prueba de integración R4';

let programId = '';

/** Borra cualquier resto de una corrida anterior interrumpida. */
async function cleanUp(): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.name, TEST_PROGRAM_NAME));

  for (const row of rows) {
    // La cascada se llevaría todo; el borrado explícito deja el rastro claro
    // si alguna vez se quita.
    const owned = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.programId, row.id));

    for (const session of owned) {
      await db.delete(artifacts).where(eq(artifacts.sessionId, session.id));
    }

    await db.delete(sessions).where(eq(sessions.programId, row.id));
    await db.delete(programs).where(eq(programs.id, row.id));
  }
}

/** Una sesión cerrada de una hora, que empezó hace `hoursAgo` horas. */
async function closedSession(hoursAgo: number) {
  const startedAt = new Date(Date.now() - hoursAgo * 3_600_000);

  return drizzleSessionRepository.createClosed({
    programId,
    sessionTypeId: null,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 3_600_000),
    note: null,
    stuckMinutes: 0,
  });
}

/** Valida como lo haría la Server Action y adjunta. */
async function attachValid(raw: Record<string, string>) {
  const parsed = parseNewArtifact(raw);

  if (!parsed.ok) throw new Error(`Entrada de prueba inválida: ${JSON.stringify(parsed.fieldErrors)}`);

  return drizzleArtifactRepository.attach(parsed.value);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Falta DATABASE_URL. Las pruebas de integración corren contra el branch de desarrollo ' +
        'de Neon; ejecútalas con `npm run test:integration`, que carga .env.',
    );
  }

  await cleanUp();

  const [program] = await getDb()
    .insert(programs)
    .values({ name: TEST_PROGRAM_NAME, kind: 'selfstudy', status: 'planned' })
    .returning();

  programId = program.id;
});

afterAll(async () => {
  await cleanUp();
});

describe('RF-50 — adjuntar dos artefactos a una sesión y recuperarlos', () => {
  it('los dos se recuperan con sus campos y en el orden en que se adjuntaron', async () => {
    const session = await closedSession(3);

    const doc = await attachValid({
      sessionId: session.id,
      kind: 'doc',
      label: 'Roadmap del proyecto',
      target: 'https://github.com/usuario/study-tracker/blob/main/docs/ROADMAP.md',
    });
    const path = await attachValid({
      sessionId: session.id,
      kind: 'commit',
      label: 'Esquema de artifacts',
      target: '.\\src\\infra\\db\\schema.ts',
    });

    expect(doc.ok).toBe(true);
    expect(path.ok).toBe(true);

    // Relectura independiente: nada viene del objeto que devolvió la inserción.
    const reread = await drizzleArtifactRepository.listBySession(session.id);

    expect(reread.map(({ kind, label, target, sessionId }) => ({ kind, label, target, sessionId })))
      .toEqual([
        {
          kind: 'doc',
          label: 'Roadmap del proyecto',
          target: 'https://github.com/usuario/study-tracker/blob/main/docs/ROADMAP.md',
          sessionId: session.id,
        },
        {
          kind: 'commit',
          label: 'Esquema de artifacts',
          // Lo guardado es la forma normalizada por core/services.
          target: 'src/infra/db/schema.ts',
          sessionId: session.id,
        },
      ]);

    for (const artifact of reread) expect(artifact.createdAt).toBeInstanceOf(Date);
  });

  it('listRecentEvidence cuelga cada artefacto de su sesión y deja vacías las que no tienen', async () => {
    const withEvidence = await closedSession(2);
    const withoutEvidence = await closedSession(1);

    await attachValid({
      sessionId: withEvidence.id,
      kind: 'image',
      label: 'Captura del tablero',
      target: 'https://ejemplo.org/captura.png',
    });

    const evidence = await drizzleArtifactRepository.listRecentEvidence(50);
    const find = (id: string) => evidence.find((item) => item.session.id === id);

    expect(find(withEvidence.id)?.artifacts.map((artifact) => artifact.label)).toEqual([
      'Captura del tablero',
    ]);
    expect(find(withoutEvidence.id)?.artifacts).toEqual([]);

    // Más reciente primero.
    const ours = evidence
      .filter((item) => item.session.programId === programId)
      .map((item) => item.session.id);
    expect(ours.indexOf(withoutEvidence.id)).toBeLessThan(ours.indexOf(withEvidence.id));
  });
});

describe('Los CHECK del motor son la última línea (RF-50, RF-51)', () => {
  it('rechaza un tipo fuera de RF-51 escrito saltándose la validación', async () => {
    const session = await closedSession(5);

    await expect(
      getDb()
        .insert(artifacts)
        .values({ sessionId: session.id, kind: 'video', label: 'x', target: 'https://ejemplo.org' }),
    ).rejects.toThrow();
  });

  it('rechaza etiqueta o destino vacíos escritos saltándose la validación', async () => {
    const session = await closedSession(6);

    await expect(
      getDb()
        .insert(artifacts)
        .values({ sessionId: session.id, kind: 'link', label: 'x', target: '' }),
    ).rejects.toThrow();

    await expect(
      getDb()
        .insert(artifacts)
        .values({ sessionId: session.id, kind: 'link', label: '', target: 'https://ejemplo.org' }),
    ).rejects.toThrow();
  });

  it('la tabla no tiene ninguna columna para guardar contenido (RF-54)', async () => {
    const result = await getDb().execute<{ column_name: string; data_type: string }>(
      sql`select column_name, data_type from information_schema.columns
          where table_schema = 'public' and table_name = 'artifacts' order by column_name`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'id',
      'kind',
      'label',
      'session_id',
      'target',
    ]);
    expect(result.rows.some((row) => row.data_type === 'bytea')).toBe(false);
  });
});

describe('Sesión que desaparece', () => {
  it('adjuntar a una sesión inexistente devuelve session_not_found, no una excepción', async () => {
    const result = await drizzleArtifactRepository.attach({
      sessionId: '00000000-0000-4000-8000-000000000000',
      kind: 'link',
      label: 'Huérfano',
      target: 'https://ejemplo.org',
    });

    expect(result).toEqual({ ok: false, reason: 'session_not_found' });
  });

  it('descartar la sesión se lleva su evidencia en cascada (RF-27)', async () => {
    const session = await closedSession(4);

    await attachValid({
      sessionId: session.id,
      kind: 'link',
      label: 'Se va con la sesión',
      target: 'https://ejemplo.org/a',
    });

    expect(await drizzleSessionRepository.remove(session.id)).toBe(true);
    expect(await drizzleArtifactRepository.listBySession(session.id)).toEqual([]);
  });
});
