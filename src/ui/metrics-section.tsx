import type { Program } from '@/core/model/program';
import { MetricCard } from '@/ui/metric-card';
import { MetricForm } from '@/ui/metric-form';
import type { MetricView, SessionOptionView } from '@/ui/metric-view';

/**
 * R5 — Métricas de progreso, por programa (RF-60 a RF-63).
 *
 * Cada programa define sus propias métricas y esta sección las pinta todas con
 * el mismo componente, sin saber qué significa ninguna. Es la prueba de que la
 * generalización funciona: el score de un curso y la nota de un diplomado son
 * la misma cosa para el código.
 *
 * Componente de presentación: la página le entrega los datos ya cargados.
 */

/** Sesiones ofrecidas por programa al registrar una lectura. */
const SESSION_OPTIONS_PER_PROGRAM = 5;

export function MetricsSection({
  programs,
  metrics,
  sessionOptions,
  unavailable,
  todayInAppZone,
  nowTimeInAppZone,
}: {
  programs: readonly Program[];
  metrics: readonly MetricView[];
  sessionOptions: readonly SessionOptionView[];
  unavailable: boolean;
  todayInAppZone: string;
  nowTimeInAppZone: string;
}) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="metrics-heading">
      <div>
        <h2 id="metrics-heading" className="text-xl font-semibold">
          Métricas de progreso
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Cada programa mide su avance a su manera. Define sus métricas y registra lecturas: la
          serie se grafica con su objetivo.
        </p>
      </div>

      {unavailable ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 p-6 text-sm">
          No se pudieron leer las métricas de la base de datos.
        </p>
      ) : programs.length === 0 ? null : (
        programs.map((program) => {
          const programMetrics = metrics.filter((metric) => metric.programId === program.id);
          const programSessions = sessionOptions
            .filter((option) => option.programId === program.id)
            .slice(0, SESSION_OPTIONS_PER_PROGRAM);

          return (
            <article
              key={program.id}
              className="rounded-lg border border-black/10 p-6 dark:border-white/15"
            >
              <h3 className="text-lg font-semibold">{program.name}</h3>

              {programMetrics.length === 0 ? (
                <p className="mt-2 text-sm opacity-70">
                  Este programa todavía no tiene métricas. Define la primera: un score, módulos
                  completados, una nota por corte…
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  {programMetrics.map((metric) => (
                    <MetricCard
                      key={metric.id}
                      metric={metric}
                      sessionOptions={programSessions}
                      todayInAppZone={todayInAppZone}
                      nowTimeInAppZone={nowTimeInAppZone}
                    />
                  ))}
                </div>
              )}

              <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/15">
                <h4 className="text-sm font-medium">Nueva métrica</h4>
                <MetricForm programId={program.id} />
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
