import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { compareLatestReadings } from '@/core/services/metric-trend';
import { getDb } from '@/infra/db/client';
import { metrics, programs, readings } from '@/infra/db/schema';
import { drizzleMetricRepository } from '@/infra/repos/drizzle-metric-repository';
import { drizzleSessionRepository } from '@/infra/repos/drizzle-session-repository';

/**
 * Pruebas de integración de R5 contra el branch de Neon del `.env`.
 *
 * Comprueban lo que **solo tiene sentido contra la base real**:
 *
 * 1. Una métrica con tres lecturas se recupera con las lecturas en orden
 *    cronológico, aunque se hayan registrado desordenadas (RF-61, RF-62).
 * 2. `numeric` vuelve como número y sin perder decimales: si volviera como
 *    cadena, la comparación de RF-63 compararía texto.
 * 3. Las restricciones del motor —nombre único por programa, dirección válida,
 *    cascadas— hacen lo que dice docs/DATA-MODEL.md.
 *
 * Todo lo que crean cuelga de un programa de prueba y se borra al final, con la
 * cascada de `programs`. Las sesiones de prueba nacen cerradas: no compiten por
 * el índice `one_running_session`.
 */

const TEST_PROGRAM_NAME = 'ZZ prueba de integración R5';
const OTHER_PROGRAM_NAME = 'ZZ prueba de integración R5 (otro)';

let programId = '';
let otherProgramId = '';

async function cleanUp(): Promise<void> {
  const db = getDb();

  for (const name of [TEST_PROGRAM_NAME, OTHER_PROGRAM_NAME]) {
    // `ON DELETE CASCADE` se lleva sesiones, métricas y lecturas (invariante 6).
    await db.delete(programs).where(eq(programs.name, name));
  }
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Falta DATABASE_URL. Las pruebas de integración corren contra el branch de Neon del .env; ' +
        'ejecútalas con `npm run test:integration`, que lo carga.',
    );
  }

  await cleanUp();

  const [program, other] = await getDb()
    .insert(programs)
    .values([
      { name: TEST_PROGRAM_NAME, kind: 'selfstudy', status: 'planned' },
      { name: OTHER_PROGRAM_NAME, kind: 'diploma', status: 'planned' },
    ])
    .returning();

  programId = program.id;
  otherProgramId = other.id;
});

afterAll(async () => {
  await cleanUp();
});

describe('RF-60, RF-61, RF-62 — una métrica y sus lecturas, en orden', () => {
  it('crea una métrica, registra tres lecturas desordenadas y las recupera en orden', async () => {
    const metric = await drizzleMetricRepository.createMetric({
      programId,
      name: 'Score de prueba',
      unit: 'puntos',
      direction: 'up',
      target: 80,
    });

    expect(metric).not.toBeNull();
    if (!metric) return;

    expect(metric).toMatchObject({ direction: 'up', target: 80, unit: 'puntos' });

    // Se registran en un orden distinto al cronológico, a propósito.
    const tercera = new Date('2026-09-24T21:00:00Z');
    const primera = new Date('2026-09-20T21:00:00Z');
    const segunda = new Date('2026-09-22T21:00:00Z');

    await drizzleMetricRepository.createReading({ metricId: metric.id, sessionId: null, value: 72.25, recordedAt: tercera });
    await drizzleMetricRepository.createReading({ metricId: metric.id, sessionId: null, value: 41, recordedAt: primera });
    await drizzleMetricRepository.createReading({ metricId: metric.id, sessionId: null, value: 65.5, recordedAt: segunda });

    const series = await drizzleMetricRepository.listReadingsByMetric(metric.id);

    expect(series.map((reading) => reading.recordedAt.toISOString())).toEqual([
      primera.toISOString(),
      segunda.toISOString(),
      tercera.toISOString(),
    ]);

    // `numeric` vuelve como número exacto, no como cadena.
    expect(series.map((reading) => reading.value)).toEqual([41, 65.5, 72.25]);
    expect(typeof series[0].value).toBe('number');

    // RF-63 sobre los datos releídos: 72,25 frente a 65,5 con dirección `up`.
    expect(compareLatestReadings(metric.direction, series)).toMatchObject({
      kind: 'improved',
      latest: 72.25,
      previous: 65.5,
    });

    // La relectura por el listado general devuelve la misma serie.
    const all = await drizzleMetricRepository.listReadings();
    expect(all.filter((reading) => reading.metricId === metric.id).map((r) => r.value)).toEqual([
      41, 65.5, 72.25,
    ]);
  });

  it('dos lecturas con el mismo recorded_at: la registrada después es la última (RF-63)', async () => {
    const metric = await drizzleMetricRepository.createMetric({
      programId,
      name: 'Empate de minuto',
      unit: null,
      direction: 'down',
      target: null,
    });

    expect(metric).not.toBeNull();
    if (!metric) return;

    const mismoInstante = new Date('2026-09-24T21:00:00Z');

    await drizzleMetricRepository.createReading({ metricId: metric.id, sessionId: null, value: 9, recordedAt: mismoInstante });
    await drizzleMetricRepository.createReading({ metricId: metric.id, sessionId: null, value: 7, recordedAt: mismoInstante });

    const series = await drizzleMetricRepository.listReadingsByMetric(metric.id);

    // `created_at` lo pone el motor en cada inserción: es el desempate.
    expect(series.map((reading) => reading.value)).toEqual([9, 7]);
    expect(compareLatestReadings(metric.direction, series).kind).toBe('improved');
  });
});

describe('restricciones del motor', () => {
  it('UNIQUE (program_id, name): el repositorio devuelve null en vez de lanzar', async () => {
    const input = { programId, name: 'Nombre repetido', unit: null, direction: 'up' as const, target: null };

    expect(await drizzleMetricRepository.createMetric(input)).not.toBeNull();
    expect(await drizzleMetricRepository.createMetric(input)).toBeNull();

    // El mismo nombre en otro programa sí se admite: la unicidad es por programa.
    expect(
      await drizzleMetricRepository.createMetric({ ...input, programId: otherProgramId }),
    ).not.toBeNull();
  });

  it('el CHECK de dirección rechaza lo que no es up ni down, saltándose la aplicación', async () => {
    await expect(
      getDb().insert(metrics).values({ programId, name: 'Dirección inválida', direction: 'sideways' }),
    ).rejects.toThrow();
  });

  it('borrar la sesión asociada deja la lectura sin sesión; borrar la métrica se lleva sus lecturas', async () => {
    const metric = await drizzleMetricRepository.createMetric({
      programId,
      name: 'Con sesión',
      unit: 'módulos',
      direction: 'up',
      target: 12,
    });

    expect(metric).not.toBeNull();
    if (!metric) return;

    // Sesión cerrada desde el nacimiento: no ocupa el índice one_running_session.
    const session = await drizzleSessionRepository.createClosed({
      programId,
      sessionTypeId: null,
      startedAt: new Date('2026-09-24T14:00:00Z'),
      endedAt: new Date('2026-09-24T15:00:00Z'),
      note: null,
      stuckMinutes: 0,
    });

    const reading = await drizzleMetricRepository.createReading({
      metricId: metric.id,
      sessionId: session.id,
      value: 3,
      recordedAt: new Date('2026-09-24T15:00:00Z'),
    });

    expect(reading.sessionId).toBe(session.id);

    const options = await drizzleMetricRepository.listLinkableSessions(50);
    expect(options.find((option) => option.id === session.id)).toMatchObject({ programId });

    // ON DELETE SET NULL: la lectura sobrevive a su sesión.
    expect(await drizzleSessionRepository.remove(session.id)).toBe(true);
    const [afterSession] = await drizzleMetricRepository.listReadingsByMetric(metric.id);
    expect(afterSession).toMatchObject({ id: reading.id, sessionId: null, value: 3 });

    // ON DELETE CASCADE: la métrica se lleva sus lecturas.
    await getDb().delete(metrics).where(eq(metrics.id, metric.id));
    const left = await getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(readings)
      .where(eq(readings.metricId, metric.id));
    expect(left[0].n).toBe(0);
  });
});
