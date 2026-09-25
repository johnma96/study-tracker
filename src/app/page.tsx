import { loadSessionSnapshot } from '@/app/current-session';
import { loadRecentEvidence } from '@/app/evidence';
import { loadMetricsSnapshot } from '@/app/metrics-snapshot';
import { StatsSection } from '@/app/stats-section';
import type { Program } from '@/core/model/program';
import type { SessionType } from '@/core/model/session-type';
import { toCivilDateInAppZone, toCivilTimeInAppZone } from '@/core/services/timezone';
import { drizzleProgramRepository } from '@/infra/repos/drizzle-program-repository';
import { ManualSessionForm } from '@/ui/manual-session-form';
import { MetricsSection } from '@/ui/metrics-section';
import { ProgramCard } from '@/ui/program-card';
import { ProgramForm } from '@/ui/program-form';
import { SessionEvidence } from '@/ui/session-evidence';
import { StartSessionForm } from '@/ui/start-session-form';
import { StopSessionForm } from '@/ui/stop-session-form';

/**
 * R1 — Programas. R2 — Cronómetro.
 *
 * Server Component que lee de Postgres a través de los repositorios: crear
 * (RF-10) y listar (RF-13) programas con sus tipos de sesión (RF-15), e iniciar
 * y cerrar sesiones de estudio (RF-20 a RF-29).
 *
 * `force-dynamic` obliga a leer en cada solicitud. Sin esto, Next prerenderiza
 * la página en tiempo de construcción y la URL desplegada mostraría una foto
 * vieja de la base, no un dato leído de verdad.
 */
export const dynamic = 'force-dynamic';

/** Agrupa los tipos de sesión por programa para no consultar dentro del bucle. */
function groupByProgram(sessionTypes: readonly SessionType[]): Map<string, SessionType[]> {
  const grouped = new Map<string, SessionType[]>();

  for (const sessionType of sessionTypes) {
    const current = grouped.get(sessionType.programId);
    if (current) current.push(sessionType);
    else grouped.set(sessionType.programId, [sessionType]);
  }

  return grouped;
}

export default async function Home() {
  let programs: Program[] = [];
  let sessionTypes: SessionType[] = [];
  let error: string | null = null;

  try {
    [programs, sessionTypes] = await Promise.all([
      drizzleProgramRepository.list(),
      drizzleProgramRepository.listSessionTypes(),
    ]);
  } catch {
    // El detalle del fallo se queda en el servidor: la cadena de conexión no
    // puede llegar al cliente (RF-43).
    error = 'No se pudo leer de la base de datos.';
  }

  // Lecturas independientes entre sí: sesión en curso, evidencia de las sesiones
  // recientes (R4, RF-50 a RF-53) y métricas de progreso (R5, RF-60 a RF-63).
  const [snapshot, evidence, metricsSnapshot] = await Promise.all([
    loadSessionSnapshot(),
    loadRecentEvidence(),
    loadMetricsSnapshot(),
  ]);
  const running = snapshot.running;
  const sessionTypesByProgram = groupByProgram(sessionTypes);

  // RF-00 — la fecha por defecto del registro manual es hoy **en Colombia**,
  // no el día que sea en el servidor.
  const today = toCivilDateInAppZone(new Date(snapshot.nowIso));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-16">
      <header>
        {/*
          R7 — el encabezado **no** nombra la rebanada en curso. Decía
          "study-tracker · R2 / Cronómetro" cuando la página ya contenía R1 a
          R5: un rótulo que declara estado y se queda viejo, el mismo defecto
          que tuvieron CLAUDE.md y README.md. El título dice qué hace la
          aplicación, que no cambia con cada rebanada.
        */}
        <p className="font-mono text-xs uppercase tracking-widest opacity-60">study-tracker</p>
        <h1 className="mt-2 text-3xl font-bold">Sesiones de estudio</h1>
        <p className="mt-2 text-sm opacity-70">
          Cronometra, registra la evidencia y mide el avance de cada programa. El tiempo se
          calcula desde la marca de inicio guardada en la base: puedes cerrar la pestaña y al
          volver la sesión sigue corriendo con el tiempo correcto.
        </p>
      </header>

      {error ? (
        <section className="rounded-lg border border-red-500/40 bg-red-500/5 p-6">
          <h2 className="font-semibold">{error}</h2>
          <p className="mt-2 text-sm opacity-80">
            Revisa que <code className="font-mono">DATABASE_URL</code> esté definida en este
            entorno: en local va en <code className="font-mono">.env</code>; en Vercel, en las
            variables de entorno del proyecto.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-black/10 p-6 dark:border-white/15">
            {running ? (
              <>
                <h2 className="text-xl font-semibold">Sesión en curso</h2>
                <p className="mb-5 mt-1 text-sm opacity-70">
                  Pausar y reanudar están en la barra de arriba, disponible desde cualquier
                  vista.
                </p>
                <StopSessionForm
                  session={running}
                  sessionTypes={sessionTypesByProgram.get(running.programId) ?? []}
                  variant="full"
                />
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold">Iniciar una sesión</h2>
                <p className="mb-5 mt-1 text-sm opacity-70">
                  Solo puede haber una sesión en curso a la vez. Lo impone la base de datos, no
                  este formulario.
                </p>
                <StartSessionForm
                  programs={programs}
                  sessionTypes={sessionTypes}
                  hasRunningSession={false}
                />
              </>
            )}
          </section>

          <section className="rounded-lg border border-black/10 p-6 dark:border-white/15">
            <h2 className="text-xl font-semibold">Registrar una sesión a mano</h2>
            <p className="mb-5 mt-1 text-sm opacity-70">
              Para lo que ya ocurrió y no se cronometró. La hora es de Colombia.
            </p>
            <ManualSessionForm
              programs={programs}
              sessionTypes={sessionTypes}
              todayInAppZone={today}
            />
          </section>

          <StatsSection programs={programs} sessionTypes={sessionTypes} nowIso={snapshot.nowIso} />

          <SessionEvidence
            items={evidence.items}
            unavailable={evidence.unavailable}
            programs={programs}
            sessionTypes={sessionTypes}
          />

          <section className="rounded-lg border border-black/10 p-6 dark:border-white/15">
            <h2 className="text-xl font-semibold">Nuevo programa</h2>
            <p className="mb-5 mt-1 text-sm opacity-70">
              El nombre es obligatorio; el resto puede completarse después.
            </p>
            <ProgramForm />
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">
              {programs.length} programa{programs.length === 1 ? '' : 's'}
            </h2>

            {programs.length === 0 ? (
              <p className="rounded-lg border border-black/10 p-6 text-sm opacity-80 dark:border-white/15">
                Todavía no hay programas. Crea el primero con el formulario de arriba, o
                siembra el del curso con <code className="font-mono">npm run db:seed</code>.
              </p>
            ) : (
              programs.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  sessionTypes={sessionTypesByProgram.get(program.id) ?? []}
                />
              ))
            )}
          </section>

          {/* R5 — métricas de progreso (RF-60 a RF-63). */}
          <MetricsSection
            programs={programs}
            metrics={metricsSnapshot.metrics}
            sessionOptions={metricsSnapshot.sessionOptions}
            unavailable={metricsSnapshot.unavailable}
            todayInAppZone={today}
            nowTimeInAppZone={toCivilTimeInAppZone(new Date(snapshot.nowIso))}
          />
        </>
      )}
    </main>
  );
}
