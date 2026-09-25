import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  effectiveMinutes,
  effectiveSecondsSoFar,
  isAbandoned,
} from '@/core/services/session-duration';
import { decideStop } from '@/core/services/session-transitions';
import { getDb } from '@/infra/db/client';
import { programs, sessions } from '@/infra/db/schema';
import { isUniqueViolationOf } from '@/infra/db/unique-violation';
import { drizzleSessionRepository } from '@/infra/repos/drizzle-session-repository';

/**
 * Pruebas de integración de R2 contra el branch `dev` de Neon.
 *
 * Comprueban las tres cosas que **solo tienen sentido contra la base real**:
 *
 * 1. El tiempo transcurrido se deriva de `started_at` almacenado (RF-21). Se
 *    verifica **releyendo la fila**, no mirando la pantalla: lo que se prueba es
 *    que el tiempo no vive en el navegador.
 * 2. La segunda sesión en curso la rechaza el **índice único** (RF-22), no una
 *    validación de interfaz. Se comprueba incluso saltándose el repositorio.
 * 3. Una sesión huérfana la detecta la consulta de recuperación y, al cerrarla,
 *    **el índice queda libre** (RF-2F a RF-2H).
 *
 * Todo lo que crean se borra al final. Aun así, corren contra `dev`: la cadena
 * de producción no existe en el entorno local (docs/ARCHITECTURE.md).
 */

const TEST_PROGRAM_NAME = 'ZZ prueba de integración R2';

let programId = '';

/** Borra cualquier resto de una corrida anterior interrumpida. */
async function cleanUp(): Promise<void> {
  const db = getDb();
  const rows = await db.select({ id: programs.id }).from(programs).where(eq(programs.name, TEST_PROGRAM_NAME));

  for (const row of rows) {
    // `ON DELETE CASCADE` se lleva las sesiones; el borrado explícito deja el
    // rastro claro si alguna vez se quita la cascada.
    await db.delete(sessions).where(eq(sessions.programId, row.id));
    await db.delete(programs).where(eq(programs.id, row.id));
  }
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Falta DATABASE_URL. Las pruebas de integración corren contra el branch dev de Neon; ' +
        'ejecútalas con `npm run test:integration`, que carga .env.',
    );
  }

  await cleanUp();

  // Si ya hay una sesión en curso que no es de estas pruebas, se aborta en vez
  // de borrarla: podría ser una sesión real a medio registrar.
  const running = await drizzleSessionRepository.findRunning();

  if (running !== null) {
    throw new Error(
      `Hay una sesión en curso (${running.id}) ajena a estas pruebas. Ciérrala o descártala ` +
        'antes de ejecutarlas: el índice one_running_session solo permite una.',
    );
  }

  const [program] = await getDb()
    .insert(programs)
    .values({ name: TEST_PROGRAM_NAME, kind: 'selfstudy', status: 'planned' })
    .returning();

  programId = program.id;
});

afterAll(async () => {
  await cleanUp();
});

describe('one_running_session — la restricción vive en la base (RF-22)', () => {
  it('el índice único parcial existe con la definición esperada', async () => {
    // Guardia de reproducibilidad: `npm run db:migrate` es lo que aplica el
    // índice en un entorno nuevo. Si se perdiera por el camino —una versión de
    // drizzle-kit que deje de emitirlo, una migración generada sin revisar— un
    // clon limpio quedaría sin la restricción y nadie se enteraría hasta que dos
    // sesiones convivieran. Esta prueba lo convierte en un fallo.
    const result = await getDb().execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes where schemaname = 'public' and indexname = 'one_running_session'`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].indexdef).toContain('CREATE UNIQUE INDEX');
    expect(result.rows[0].indexdef).toContain('(true)');
    expect(result.rows[0].indexdef).toContain('WHERE (ended_at IS NULL)');
  });
});

describe('RF-21 — el tiempo se deriva de started_at, releído desde la base', () => {
  it('la sesión se relee y su tiempo sale de la marca almacenada, no de un contador', async () => {
    const started = await drizzleSessionRepository.start({ programId, sessionTypeId: null });

    expect(started.ok).toBe(true);
    if (!started.ok) return;

    // Relectura independiente: es lo que haría otro dispositivo, u otra pestaña
    // después de cerrar el navegador. Nada de lo que devuelve viene del proceso
    // que creó la sesión.
    const reread = await drizzleSessionRepository.findById(started.session.id);

    expect(reread).not.toBeNull();
    if (!reread) return;

    expect(reread.startedAt.getTime()).toBe(started.session.startedAt.getTime());
    expect(reread.endedAt).toBeNull();
    expect(reread.pausedSeconds).toBe(0);

    // No existe ninguna columna con el tiempo transcurrido: se calcula.
    expect(Object.keys(reread)).not.toContain('elapsedSeconds');

    // El mismo dato leído de la base, con dos relojes distintos, da dos tiempos
    // distintos. Eso es lo que significa "derivado".
    const startedAt = reread.startedAt;
    const unaHoraDespues = new Date(startedAt.getTime() + 3_600_000);
    const dosHorasDespues = new Date(startedAt.getTime() + 7_200_000);

    expect(effectiveSecondsSoFar(reread, unaHoraDespues)).toBe(3600);
    expect(effectiveSecondsSoFar(reread, dosHorasDespues)).toBe(7200);

    // Y contra el reloj real del motor, el tiempo transcurrido es coherente con
    // la marca almacenada: la sesión acaba de empezar.
    const now = await drizzleSessionRepository.now();
    const elapsed = effectiveSecondsSoFar(reread, now);

    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(120);

    // Una sesión en curso no tiene duración todavía (RF-24).
    expect(effectiveMinutes(reread)).toBeNull();
  });

  it('el repositorio traduce el rechazo del índice a un valor de dominio (RF-22)', async () => {
    const segunda = await drizzleSessionRepository.start({ programId, sessionTypeId: null });

    expect(segunda).toEqual({ ok: false, reason: 'already_running' });
  });

  it('el rechazo lo impone el motor: una inserción directa también falla', async () => {
    // Se salta el repositorio a propósito. Si la restricción viviera en la
    // aplicación, esta inserción pasaría — que es exactamente lo que ocurre con
    // una validación de interfaz y dos pestañas abiertas.
    let error: unknown = null;

    try {
      await getDb()
        .insert(sessions)
        .values({ programId, startedAt: sql`now()`, source: 'timer' });
    } catch (caught) {
      error = caught;
    }

    expect(error).not.toBeNull();
    expect(isUniqueViolationOf(error, 'one_running_session')).toBe(true);
  });

  it('una sesión ya cerrada no ocupa el índice: el registro manual convive con el cronómetro (RF-26)', async () => {
    const inicio = new Date(Date.now() - 24 * 3_600_000);
    const manual = await drizzleSessionRepository.createClosed({
      programId,
      sessionTypeId: null,
      startedAt: inicio,
      endedAt: new Date(inicio.getTime() + 45 * 60_000),
      note: 'sesión de ayer',
      stuckMinutes: 5,
    });

    const reread = await drizzleSessionRepository.findById(manual.id);

    expect(reread?.source).toBe('manual');
    expect(reread ? effectiveMinutes(reread) : null).toBe(45);

    // La sesión en curso sigue siendo la del cronómetro, no la manual.
    const running = await drizzleSessionRepository.findRunning();
    expect(running?.source).toBe('timer');
  });
});

describe('RF-2F a RF-2H — recuperación de sesión abandonada', () => {
  it('detecta una sesión abierta hace nueve horas y cerrarla libera el índice', async () => {
    const running = await drizzleSessionRepository.findRunning();

    expect(running).not.toBeNull();
    if (!running) return;

    // Se fabrica la sesión huérfana moviendo `started_at` nueve horas atrás.
    // Es lo que queda cuando el navegador se cierra sin llamar al cierre.
    await getDb()
      .update(sessions)
      .set({ startedAt: sql`now() - interval '9 hours'` })
      .where(eq(sessions.id, running.id));

    const abandonada = await drizzleSessionRepository.findRunning();
    const now = await drizzleSessionRepository.now();

    expect(abandonada).not.toBeNull();
    if (!abandonada) return;

    // La consulta de recuperación la detecta (RF-2G).
    expect(abandonada.id).toBe(running.id);
    expect(isAbandoned(abandonada, now)).toBe(true);

    // El usuario indica la duración real: se guarda en minutes_override (RF-2H).
    const decision = decideStop(abandonada, { now, minutesOverride: 75, confirmed: true });

    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;

    const cerrada = await drizzleSessionRepository.close(abandonada.id, {
      endedAt: decision.endedAt,
      pausedSeconds: decision.pausedSeconds,
      minutesOverride: decision.minutesOverride,
      note: 'cerrada desde el diálogo de recuperación',
      stuckMinutes: 0,
      sessionTypeId: null,
    });

    expect(cerrada).not.toBeNull();
    expect(cerrada?.minutesOverride).toBe(75);
    expect(cerrada ? effectiveMinutes(cerrada) : null).toBe(75);

    // El índice quedó libre: ya no hay sesión en curso...
    expect(await drizzleSessionRepository.findRunning()).toBeNull();

    // ...y se puede iniciar otra, que es lo que la válvula de escape garantiza.
    const nueva = await drizzleSessionRepository.start({ programId, sessionTypeId: null });

    expect(nueva.ok).toBe(true);
  });

  it('descartar la sesión también libera el índice (RF-27, RF-2F)', async () => {
    const running = await drizzleSessionRepository.findRunning();

    expect(running).not.toBeNull();
    if (!running) return;

    expect(await drizzleSessionRepository.remove(running.id)).toBe(true);
    expect(await drizzleSessionRepository.findRunning()).toBeNull();

    const otra = await drizzleSessionRepository.start({ programId, sessionTypeId: null });
    expect(otra.ok).toBe(true);

    // Se deja el terreno limpio para la siguiente prueba.
    if (otra.ok) await drizzleSessionRepository.remove(otra.session.id);
  });
});

describe('RF-2A a RF-2E — pausas contra la base', () => {
  it('pausar, reanudar y detener descuenta el descanso de la duración efectiva', async () => {
    const started = await drizzleSessionRepository.start({ programId, sessionTypeId: null });

    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const sessionId = started.session.id;

    // La sesión empezó hace una hora y descansó diez minutos: se fabrican las
    // marcas para no esperar una hora dentro de la prueba.
    await getDb()
      .update(sessions)
      .set({
        startedAt: sql`now() - interval '60 minutes'`,
        pausedAt: sql`now() - interval '10 minutes'`,
      })
      .where(eq(sessions.id, sessionId));

    const pausada = await drizzleSessionRepository.findRunning();

    expect(pausada?.pausedAt).not.toBeNull();
    if (!pausada) return;

    // RF-2C — reanudar consolida los diez minutos.
    const now = await drizzleSessionRepository.now();
    const reanudada = await drizzleSessionRepository.markResumed(
      sessionId,
      Math.round(pausada.pausedSeconds + (now.getTime() - pausada.pausedAt!.getTime()) / 1000),
    );

    expect(reanudada).not.toBeNull();
    expect(reanudada?.pausedAt).toBeNull();
    expect(reanudada?.pausedSeconds).toBeGreaterThanOrEqual(595);
    expect(reanudada?.pausedSeconds).toBeLessThanOrEqual(605);

    // RF-23, RF-24 — al detener, la duración efectiva descuenta la pausa.
    const stopNow = await drizzleSessionRepository.now();
    const decision = decideStop(reanudada!, {
      now: stopNow,
      minutesOverride: null,
      confirmed: false,
    });

    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') return;

    const cerrada = await drizzleSessionRepository.close(sessionId, {
      endedAt: decision.endedAt,
      pausedSeconds: decision.pausedSeconds,
      minutesOverride: decision.minutesOverride,
      note: null,
      stuckMinutes: 0,
      sessionTypeId: null,
    });

    expect(cerrada).not.toBeNull();
    // Sesión de 60 minutos con 10 de pausa: 50 minutos efectivos.
    expect(cerrada ? effectiveMinutes(cerrada) : null).toBe(50);

    // Y el CHECK `no_open_pause_when_ended` se respeta.
    expect(cerrada?.pausedAt).toBeNull();
    expect(await drizzleSessionRepository.findRunning()).toBeNull();
  });
});
