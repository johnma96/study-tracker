import { asc } from 'drizzle-orm';

import type { Program } from '@/core/model/program';
import type { ProgramRepository } from '@/core/ports/program-repository';
import { getDb } from '@/infra/db/client';
import { programs, type ProgramRow } from '@/infra/db/schema';

/**
 * Implementación del puerto `ProgramRepository` con Drizzle sobre Neon.
 *
 * Toda consulta va parametrizada por el constructor de Drizzle: no se arma SQL
 * por concatenación de cadenas (docs/ARCHITECTURE.md, sección Seguridad).
 */
function toDomain(row: ProgramRow): Program {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    // El motor garantiza estos dominios con las restricciones CHECK del esquema;
    // aquí solo se estrecha el tipo `text` a los valores de RF-11 y RF-12.
    kind: row.kind as Program['kind'],
    status: row.status as Program['status'],
    startedAt: row.startedAt,
    targetAt: row.targetAt,
    plannedSessions: row.plannedSessions,
    createdAt: row.createdAt,
  };
}

export const drizzleProgramRepository: ProgramRepository = {
  async list(): Promise<Program[]> {
    const rows = await getDb().select().from(programs).orderBy(asc(programs.createdAt));
    return rows.map(toDomain);
  },
};
