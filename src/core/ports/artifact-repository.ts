import type { Artifact, NewArtifactInput } from '../model/artifact';
import type { SessionTiming } from '../model/session';

/**
 * Puerto de persistencia de artefactos (R4).
 *
 * `core/` define la interfaz; `infra/repos` la implementa con Drizzle. Las
 * reglas —qué tipos existen, qué destino es aceptable, qué se puede mostrar
 * como enlace— viven en `core/services` y se prueban sin base de datos. Este
 * puerto solo guarda lo ya validado y lo devuelve.
 *
 * No hay método para guardar contenido: solo referencias (RF-54).
 */

/** RF-50 — resultado de adjuntar un artefacto. */
export type AttachArtifactResult =
  | { readonly ok: true; readonly artifact: Artifact }
  /**
   * La sesión no existe: se descartó (RF-27) en otra pestaña entre que se
   * pintó el formulario y se envió. Es un caso de negocio con mensaje propio,
   * no una excepción de Postgres en la cara del usuario.
   */
  | { readonly ok: false; readonly reason: 'session_not_found' };

/**
 * Lo mínimo de una sesión que necesita la vista de evidencia: identificarla,
 * nombrar su programa y su tipo, y calcular su duración con `core/services`.
 *
 * Es una proyección y no `Session` completa a propósito: la lista de sesiones
 * como tal es de R3 (RF-30). Aquí solo se lee lo que hace falta para colgarle
 * la evidencia.
 */
export interface EvidenceSession extends SessionTiming {
  readonly id: string;
  readonly programId: string;
  readonly sessionTypeId: string | null;
}

/** Una sesión con sus artefactos, en el orden en que se adjuntaron. */
export interface SessionEvidence {
  readonly session: EvidenceSession;
  readonly artifacts: readonly Artifact[];
}

export interface ArtifactRepository {
  /** RF-50 — adjunta un artefacto ya validado a una sesión. */
  attach(input: NewArtifactInput): Promise<AttachArtifactResult>;

  /** RF-52 — artefactos de una sesión, del más antiguo al más reciente. */
  listBySession(sessionId: string): Promise<Artifact[]>;

  /**
   * RF-52 — artefactos de varias sesiones en **una** consulta, en el mismo
   * orden que `listBySession`. Para colgar la evidencia de cualquier listado de
   * sesiones sin consultar una vez por fila; se reparte con
   * `groupArtifactsBySession` de `core/services`.
   */
  listBySessionIds(sessionIds: readonly string[]): Promise<Artifact[]>;

  /**
   * RF-50, RF-52 — las `limit` sesiones más recientes, cerradas o en curso,
   * con sus artefactos. Una sesión sin evidencia aparece con la lista vacía:
   * es justo a la que más falta le hace adjuntar algo.
   */
  listRecentEvidence(limit: number): Promise<SessionEvidence[]>;
}
