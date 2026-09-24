import { defineConfig } from 'drizzle-kit';

/**
 * Configuración de drizzle-kit.
 *
 * `DATABASE_URL` se lee del entorno; nunca se escribe aquí. Los scripts de
 * `package.json` la cargan desde `.env` con `node --env-file`, de modo que no
 * hace falta ninguna dependencia extra para leer el archivo.
 */
export default defineConfig({
  schema: './src/infra/db/schema.ts',
  out: './src/infra/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
