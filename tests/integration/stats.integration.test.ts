import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Session } from '@/core/model/session';
import type { ProgramContext } from '@/core/services/program-context';
import { listSessionsInContext } from '@/core/services/session-listing';
import { buildProgramStats } from '@/core/services/study-stats';
import { getDb } from '@/infra/db/client';
import { programs, sessions } from '@/infra/db/schema';
import { drizzleSessionHistoryRepository } from '@/infra/repos/drizzle-session-history-repository';
import { drizzleSessionRepository } from '@/infra/repos/drizzle-session-repository';

/**
 * Pruebas de integración de R3 contra Neon.
 *
 * Lo que **solo** se puede comprobar contra la base real:
 *
 * 1. `listAll()` devuelve las sesiones con sus marcas `timestamptz` intactas
 *    —el día de Colombia se calcula sobre lo que el driver entrega, no sobre
 *    lo que la prueba fabricó en memoria—, con `minutes_override` y
 *    `paused_seconds` tal como quedaron guardados.
 * 2. La agrupación por día que hace `core/` coincide con la consulta de
 *    referencia de docs/DATA-MODEL.md (`AT TIME ZONE 'America/Bogota'`), y
 *    difiere de la fecha UTC justo en las sesiones que la trampa de RF-32
 *    predice.
 *
 * No crea sesiones en curso: no compite por el índice `one_running_session`
 * con las pruebas de R2. Todo lo que crea se borra al final.
 */

const TEST_PROGRAM_NAME = 'ZZ prueba de integración R3';

/** Viernes 25/09/2026. */
const TODAY = '2026-09-25';

let programId = '';

async function cleanUp(): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.name, TEST_PROGRAM_NAME));

  for (const row of rows) {
    await db.delete(sessions).where(eq(sessions.programId, row.id));
    await db.delete(programs).where(eq(programs.id, row.id));
  }
}

/** Registra una sesión cerrada que empezó a esa hora **de Colombia**. */
async function closedAt(date: string, time: string, minutes: number): Promise<Session> {
  const startedAt = new Date(`${date}T${time}:00-05:00`);

  return drizzleSessionRepository.createClosed({
    programId,
    sessionTypeId: null,
    startedAt,
    endedAt: new Date(startedAt.getTime() + minutes * 60_000),
    note: `${date} ${time}`,
    stuckMinutes: 0,
  });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Falta DATABASE_URL. Las pruebas de integración corren contra un branch de desarrollo de ' +
        'Neon; ejecútalas con `npm run test:integration`, que carga .env.',
    );
  }

  await cleanUp();

  const [program] = await getDb()
    .insert(programs)
    .values({ name: TEST_PROGRAM_NAME, kind: 'selfstudy', status: 'active', plannedSessions: 10 })
    .returning();

  programId = program.id;

  // A mano, en hora de Colombia:
  //   A 24/09 23:40, 40 min                         -> día 24, 40 min
  //   B 24/09 19:30, 60 min brutos, 10 de pausa     -> día 24, 50 min
  //   C 23/09 08:00, 30 min brutos, override de 90  -> día 23, 90 min
  await closedAt('2026-09-24', '23:40', 40);

  const b = await closedAt('2026-09-24', '19:30', 60);
  await getDb().update(sessions).set({ pausedSeconds: 600 }).where(eq(sessions.id, b.id));

  const c = await closedAt('2026-09-23', '08:00', 30);
  await getDb().update(sessions).set({ minutesOverride: 90 }).where(eq(sessions.id, c.id));
});

afterAll(async () => {
  await cleanUp();
});

describe('R3 — historial leído de la base', () => {
  it('listAll devuelve las sesiones del programa con override y pausas tal como se guardaron', async () => {
    const all = await drizzleSessionHistoryRepository.listAll();
    const mine = all.filter((session) => session.programId === programId);

    expect(mine).toHaveLength(3);
    expect(mine.some((session) => session.minutesOverride === 90)).toBe(true);
    expect(mine.some((session) => session.pausedSeconds === 600)).toBe(true);

    // RF-30 — orden descendente por inicio, fechas y duraciones de Colombia.
    const contexto: ProgramContext = { kind: 'program', programId };
    const listado = listSessionsInContext(all, contexto);

    expect(listado.map((item) => [item.date, item.startTime, item.minutes])).toEqual([
      ['2026-09-24', '23:40', 40],
      ['2026-09-24', '19:30', 50],
      ['2026-09-23', '08:00', 90],
    ]);
  });

  it('las estadísticas sobre lo leído coinciden con el cálculo a mano', async () => {
    const all = await drizzleSessionHistoryRepository.listAll();
    const mine = all.filter((session) => session.programId === programId);

    const stats = buildProgramStats(mine, { today: TODAY, plannedSessions: 10 });

    expect(stats.kind).toBe('ready');
    if (stats.kind !== 'ready') return;

    // 3 sesiones, 2 días (23 y 24), 40 + 50 + 90 = 180 minutos, media 60.
    expect(stats.summary).toEqual({
      sessionCount: 3,
      daysWorked: 2,
      totalMinutes: 180,
      averageMinutes: 60,
    });

    // Hoy (25) todavía sin sesión: la racha va hasta ayer, 23 y 24.
    expect(stats.streak).toEqual({ days: 2, includesToday: false });

    // 10 planeadas − 3 hechas = 7; ritmo 3 / 4 = 0,75 por semana;
    // ceil(7 / 0,75 × 7) = ceil(65,33) = 66 días -> 30/11/2026.
    expect(stats.projection).toEqual({
      kind: 'projected',
      remainingSessions: 7,
      sessionsPerWeek: 0.75,
      estimatedDate: '2026-11-30',
    });
  });

  it('la agrupación de core coincide con AT TIME ZONE America/Bogota y no con la fecha UTC', async () => {
    const result = await getDb().execute<{ bogota: string; utc: string; n: string }>(sql`
      select to_char((started_at at time zone 'America/Bogota')::date, 'YYYY-MM-DD') as bogota,
             to_char((started_at at time zone 'UTC')::date, 'YYYY-MM-DD') as utc,
             count(*) as n
      from sessions
      where program_id = ${programId}
      group by 1, 2
      order by 1, 2
    `);

    // La consulta de referencia de docs/DATA-MODEL.md da los mismos días que core.
    expect(result.rows.map((row) => [row.bogota, row.utc, Number(row.n)])).toEqual([
      ['2026-09-23', '2026-09-23', 1],
      // Las dos sesiones posteriores a las 19:00 de Colombia: en UTC ya son del 25.
      ['2026-09-24', '2026-09-25', 2],
    ]);
  });
});
