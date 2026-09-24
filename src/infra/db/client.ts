import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

/**
 * Cliente de base de datos. Solo se usa desde el servidor.
 *
 * La cadena de conexión vive en `DATABASE_URL` y nunca se expone al cliente
 * (RF-43): no se usa el prefijo `NEXT_PUBLIC_` ni se devuelve en ninguna
 * respuesta. El cliente se construye de forma perezosa para que `next build`
 * no dependa de que la variable exista en el entorno de construcción.
 */
let cached: ReturnType<typeof createDb> | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'Falta DATABASE_URL. En local va en .env (ver .env.example); en Vercel, en las variables de entorno del proyecto.',
    );
  }

  return drizzle(neon(url), { schema });
}

export function getDb() {
  cached ??= createDb();
  return cached;
}
