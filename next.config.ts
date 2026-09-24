import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `next dev` reescribe AGENTS.md por su cuenta: le inyecta un bloque
   * `nextjs-agent-rules` y lo vuelve a agregar en cada arranque.
   *
   * En este repositorio AGENTS.md es el harness canónico y su contenido es
   * decisión del autor, no de una herramienta. Se desactiva la inyección para
   * que el archivo no cambie solo. La advertencia que traía ese bloque sigue
   * siendo válida y queda registrada en progress.md: Next.js 16 difiere de lo
   * que un modelo tiene memorizado, y la referencia buena está en
   * `node_modules/next/dist/docs/`.
   */
  agentRules: false,
};

export default nextConfig;
