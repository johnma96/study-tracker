import { asc, desc, eq, inArray } from 'drizzle-orm';

import type { Artifact, ArtifactKind, NewArtifactInput } from '@/core/model/artifact';
import type {
  ArtifactRepository,
  AttachArtifactResult,
  EvidenceSession,
  SessionEvidence,
} from '@/core/ports/artifact-repository';
import { groupArtifactsBySession } from '@/core/services/artifact-grouping';
import { getDb } from '@/infra/db/client';
import { artifacts, sessions, type ArtifactRow } from '@/infra/db/schema';

/**
 * Implementación del puerto `ArtifactRepository` con Drizzle sobre Neon (R4).
 *
 * Toda consulta va parametrizada por el constructor de Drizzle: no se arma SQL
 * por concatenación de cadenas (docs/ARCHITECTURE.md, sección Seguridad). Eso
 * importa aquí más que en ninguna otra tabla, porque `label` y `target` son
 * texto libre del usuario.
 */

function toDomain(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    sessionId: row.sessionId,
    // El motor garantiza el dominio con el CHECK `artifacts_kind_valid`; aquí
    // solo se estrecha el tipo `text`.
    kind: row.kind as ArtifactKind,
    label: row.label,
    target: row.target,
    createdAt: row.createdAt,
  };
}

/** Columnas de `sessions` que necesita la vista de evidencia. */
const evidenceSessionColumns = {
  id: sessions.id,
  programId: sessions.programId,
  sessionTypeId: sessions.sessionTypeId,
  startedAt: sessions.startedAt,
  endedAt: sessions.endedAt,
  pausedAt: sessions.pausedAt,
  pausedSeconds: sessions.pausedSeconds,
  minutesOverride: sessions.minutesOverride,
};

async function sessionExists(sessionId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return rows.length > 0;
}

export const drizzleArtifactRepository: ArtifactRepository = {
  /**
   * RF-50 — adjunta el artefacto.
   *
   * Que la sesión exista lo decide la clave foránea, no una consulta previa:
   * comprobar antes e insertar después deja una ventana en la que otra pestaña
   * descarta la sesión. Si la inserción falla, se mira **entonces** si la sesión
   * sigue ahí: si no, es el caso de negocio `session_not_found`; si sí, es un
   * defecto y se propaga. Así no hace falta interpretar el código de error de
   * Postgres a través del envoltorio de Drizzle (ver `unique-violation.ts`).
   */
  async attach(input: NewArtifactInput): Promise<AttachArtifactResult> {
    try {
      const [row] = await getDb()
        .insert(artifacts)
        .values({
          sessionId: input.sessionId,
          kind: input.kind,
          label: input.label,
          target: input.target,
        })
        .returning();

      return { ok: true, artifact: toDomain(row) };
    } catch (error) {
      if (!(await sessionExists(input.sessionId))) {
        return { ok: false, reason: 'session_not_found' };
      }

      throw error;
    }
  },

  /**
   * RF-52 — artefactos de una sesión en el orden en que se adjuntaron. El `id`
   * desempata dos artefactos con el mismo `created_at`, para que el orden no
   * cambie entre dos lecturas.
   */
  async listBySession(sessionId: string): Promise<Artifact[]> {
    const rows = await getDb()
      .select()
      .from(artifacts)
      .where(eq(artifacts.sessionId, sessionId))
      .orderBy(asc(artifacts.createdAt), asc(artifacts.id));

    return rows.map(toDomain);
  },

  /** RF-52 — artefactos de varias sesiones en una sola consulta. */
  async listBySessionIds(sessionIds: readonly string[]): Promise<Artifact[]> {
    if (sessionIds.length === 0) return [];

    const rows = await getDb()
      .select()
      .from(artifacts)
      .where(inArray(artifacts.sessionId, [...sessionIds]))
      .orderBy(asc(artifacts.createdAt), asc(artifacts.id));

    return rows.map(toDomain);
  },

  /**
   * RF-50, RF-52 — sesiones recientes con su evidencia, en dos consultas y no
   * en una por sesión.
   */
  async listRecentEvidence(limit: number): Promise<SessionEvidence[]> {
    const recent: EvidenceSession[] = await getDb()
      .select(evidenceSessionColumns)
      .from(sessions)
      .orderBy(desc(sessions.startedAt), desc(sessions.id))
      .limit(limit);

    const bySession = groupArtifactsBySession(
      await drizzleArtifactRepository.listBySessionIds(recent.map((session) => session.id)),
    );

    return recent.map((session) => ({ session, artifacts: bySession.get(session.id) ?? [] }));
  },
};
