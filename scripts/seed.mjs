/**
 * Siembra del programa semilla definido al final de docs/DATA-MODEL.md.
 *
 * Es idempotente: si el programa ya existe, no lo duplica ni falla. Se ejecuta
 * con `npm run db:seed`, que carga `DATABASE_URL` desde `.env` con
 * `node --env-file`. La cadena de conexión nunca se imprime.
 *
 * R0 solo siembra la fila de `programs`. Los tipos de sesión y las métricas del
 * programa pertenecen a R1 y R5.
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('Falta DATABASE_URL. Copia .env.example a .env y complétala.');
  process.exit(1);
}

const sql = neon(url);

const rows = await sql`
  insert into programs (name, provider, kind, status, planned_sessions)
  select ${'Harness Engineering'}, ${'walkinglabs'}, ${'course'}, ${'active'}, ${41}
  where not exists (select 1 from programs where name = ${'Harness Engineering'})
  returning id, name
`;

if (rows.length === 0) {
  console.log('Semilla ya presente: "Harness Engineering". Sin cambios.');
} else {
  console.log(`Semilla insertada: "${rows[0].name}" (${rows[0].id}).`);
}
