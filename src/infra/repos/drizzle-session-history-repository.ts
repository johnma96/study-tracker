import { asc, desc } from 'drizzle-orm';

import type { Session } from '@/core/model/session';
import type { SessionHistoryRepository } from '@/core/ports/session-history-repository';
import { getDb } from '@/infra/db/client';
import { sessions } from '@/infra/db/schema';
import { toDomain } from '@/infra/repos/drizzle-session-repository';

/**
 * Implementación del puerto `SessionHistoryRepository` con Drizzle (R3).
 *
 * El `ORDER BY` solo da un orden estable a la lectura; el orden que ve el
 * usuario (RF-30) lo decide `core/services/session-listing.ts`, igual que
 * RF-13 lo decide `program-order.ts` (decisión 12 de docs/ARCHITECTURE.md).
 */
export const drizzleSessionHistoryRepository: SessionHistoryRepository = {
  async listAll(): Promise<Session[]> {
    const rows = await getDb()
      .select()
      .from(sessions)
      .orderBy(desc(sessions.startedAt), asc(sessions.id));

    return rows.map(toDomain);
  },
};
