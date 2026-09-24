import type { Program } from '@/core/model/program';
import { drizzleProgramRepository } from '@/infra/repos/drizzle-program-repository';
import { ProgramCard } from '@/ui/program-card';

/**
 * R0 — esqueleto caminante.
 *
 * Server Component que lee de Postgres a través del repositorio y pinta una
 * fila. No hay features: el objetivo de la rebanada es probar la cadena
 * completa —repositorio, build, despliegue, base de datos, render— antes de que
 * exista código que perder (docs/ROADMAP.md, R0).
 *
 * `force-dynamic` obliga a leer en cada solicitud. Sin esto, Next prerenderiza
 * la página en tiempo de construcción y la URL desplegada mostraría una foto
 * vieja de la base, no un dato leído de verdad.
 */
export const dynamic = 'force-dynamic';

export default async function Home() {
  let programs: Program[] = [];
  let error: string | null = null;

  try {
    programs = await drizzleProgramRepository.list();
  } catch {
    // El detalle del fallo se queda en el servidor: la cadena de conexión no
    // puede llegar al cliente (RF-43).
    error = 'No se pudo leer de la base de datos.';
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest opacity-60">
          study-tracker · R0
        </p>
        <h1 className="mt-2 text-3xl font-bold">Esqueleto caminante</h1>
        <p className="mt-2 text-sm opacity-70">
          Next.js y Drizzle leyendo una fila de Neon Postgres.
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
      ) : programs.length === 0 ? (
        <section className="rounded-lg border border-black/10 p-6 dark:border-white/15">
          <h2 className="font-semibold">La tabla está vacía.</h2>
          <p className="mt-2 text-sm opacity-80">
            Siembra el programa inicial con <code className="font-mono">npm run db:seed</code>.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
      )}

      <footer className="text-xs opacity-60">
        {programs.length} fila{programs.length === 1 ? '' : 's'} leída
        {programs.length === 1 ? '' : 's'} de <code className="font-mono">programs</code>.
      </footer>
    </main>
  );
}
