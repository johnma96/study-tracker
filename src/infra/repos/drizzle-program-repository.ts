import { asc } from 'drizzle-orm';

import type { NewProgram, Program } from '@/core/model/program';
import type { NewSessionType, SessionType } from '@/core/model/session-type';
import type { ProgramRepository } from '@/core/ports/program-repository';
import { sortPrograms } from '@/core/services/program-order';
import { getDb } from '@/infra/db/client';
import {
  programs,
  sessionTypes,
  type ProgramRow,
  type SessionTypeRow,
} from '@/infra/db/schema';
import { isUniqueViolation } from '@/infra/db/unique-violation';

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
    repoUrl: row.repoUrl,
    createdAt: row.createdAt,
  };
}

function toSessionTypeDomain(row: SessionTypeRow): SessionType {
  return { id: row.id, programId: row.programId, code: row.code, label: row.label };
}

/**
 * El choque de `UNIQUE (program_id, code)` se detecta con
 * `isUniqueViolation` de `@/infra/db/unique-violation`.
 *
 * La función estaba definida aquí en R1. R2 necesita exactamente la misma
 * comprobación para el índice `one_running_session` (RF-22), así que se movió a
 * un módulo propio en vez de copiarse: era una corrección que costó encontrar
 * —Drizzle envuelve el error del driver y deja el `NeonDbError` en `cause`— y
 * dos copias significan que solo una se mantendría. El comportamiento no
 * cambió; el archivo de destino conserva la explicación completa.
 */
export const drizzleProgramRepository: ProgramRepository = {
  /**
   * RF-13 — el orden lo decide `core/services/program-order`, no un ORDER BY.
   *
   * La consulta trae las filas con un orden estable cualquiera y el dominio las
   * ordena. Así la regla que se ejecuta en producción es exactamente la misma
   * que cubren las pruebas, sin base de datos. Duplicarla en SQL dejaría dos
   * definiciones y solo una probada; con un puñado de programas, ordenar en
   * memoria no tiene costo apreciable. Si algún día la tabla crece hasta que
   * importe, el orden se baja al ORDER BY y las pruebas siguen siendo el
   * contrato que debe respetar.
   */
  async list(): Promise<Program[]> {
    const rows = await getDb().select().from(programs).orderBy(asc(programs.createdAt));
    return sortPrograms(rows.map(toDomain));
  },

  /** RF-10 — inserta el programa ya validado y normalizado por el dominio. */
  async create(input: NewProgram): Promise<Program> {
    const [row] = await getDb()
      .insert(programs)
      .values({
        name: input.name,
        provider: input.provider,
        kind: input.kind,
        status: input.status,
        startedAt: input.startedAt,
        targetAt: input.targetAt,
        repoUrl: input.repoUrl,
      })
      .returning();

    return toDomain(row);
  },

  /** RF-15 — tipos de sesión de todos los programas, agrupables por `programId`. */
  async listSessionTypes(): Promise<SessionType[]> {
    const rows = await getDb()
      .select()
      .from(sessionTypes)
      .orderBy(asc(sessionTypes.programId), asc(sessionTypes.code));

    return rows.map(toSessionTypeDomain);
  },

  /**
   * RF-15 — crea un tipo de sesión.
   *
   * El choque de código se detecta por el error del motor y no por una consulta
   * previa: comprobar antes e insertar después deja una ventana en la que dos
   * peticiones pasan las dos comprobaciones. El índice único es la autoridad; lo
   * que hace el repositorio es traducirlo a un valor que la interfaz sabe
   * explicar.
   */
  async createSessionType(input: NewSessionType): Promise<SessionType | null> {
    try {
      const [row] = await getDb()
        .insert(sessionTypes)
        .values({ programId: input.programId, code: input.code, label: input.label })
        .returning();

      return toSessionTypeDomain(row);
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  },
};
