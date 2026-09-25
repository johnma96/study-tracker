import type { Program } from '@/core/model/program';
import type { Session } from '@/core/model/session';
import type { SessionType } from '@/core/model/session-type';
import { listProgramSessions } from '@/core/services/session-listing';
import { buildProgramStats } from '@/core/services/study-stats';
import { toCivilDateInAppZone } from '@/core/services/timezone';
import { drizzleSessionHistoryRepository } from '@/infra/repos/drizzle-session-history-repository';
import { StatsPanel } from '@/ui/stats-panel';

/**
 * R3 — sección de totales y mapa de calor (RF-30 a RF-37).
 *
 * Server Component de la capa `app/`: lee el historial por el repositorio,
 * calcula con `core/` y entrega a `ui/` valores ya listos. Vive en su propio
 * archivo para que la página solo tenga que montarlo, sin mezclar su carga con
 * la del cronómetro.
 *
 * Los programas y los tipos de sesión los pasa la página, que ya los leyó: no
 * se consultan dos veces. `nowIso` es el reloj del motor (decisión 16 de
 * docs/ARCHITECTURE.md); de él sale el "hoy" de Colombia contra el que se mide
 * la racha, la cadencia y la proyección (RF-00).
 */
export async function StatsSection({
  programs,
  sessionTypes,
  nowIso,
}: {
  programs: readonly Program[];
  sessionTypes: readonly SessionType[];
  nowIso: string;
}) {
  let sessions: Session[] = [];
  let failed = false;

  try {
    sessions = await drizzleSessionHistoryRepository.listAll();
  } catch (error) {
    // El detalle se queda en el servidor (RF-43).
    console.error('[StatsSection]', error);
    failed = true;
  }

  const today = toCivilDateInAppZone(new Date(nowIso));
  const typeLabels = new Map(
    sessionTypes.map((sessionType) => [sessionType.id, `${sessionType.code} · ${sessionType.label}`]),
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby="stats-heading">
      <header>
        <h2 id="stats-heading" className="text-xl font-semibold">
          Totales y mapa de calor
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Cada sesión cuenta en el día de Colombia en que empezó. Las que siguen en curso entran
          al cerrarse.
        </p>
      </header>

      {failed ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 p-6 text-sm">
          No se pudo leer el historial de sesiones.
        </p>
      ) : (
        programs.map((program) => {
          const own = sessions.filter((session) => session.programId === program.id);

          return (
            <StatsPanel
              key={program.id}
              programName={program.name}
              stats={buildProgramStats(own, { today, plannedSessions: program.plannedSessions })}
              sessions={listProgramSessions(own, program.id)}
              typeLabels={typeLabels}
            />
          );
        })
      )}
    </section>
  );
}
