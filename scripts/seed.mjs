/**
 * Siembra del programa semilla definido al final de docs/DATA-MODEL.md.
 *
 * Es idempotente: se puede ejecutar cuantas veces se quiera sin duplicar nada
 * ni fallar. Se ejecuta con `npm run db:seed`, que carga `DATABASE_URL` desde
 * `.env` con `node --env-file`. La cadena de conexión nunca se imprime.
 *
 * R1 siembra `programs` y `session_types` (RF-15). La sección de datos semilla
 * de docs/DATA-MODEL.md menciona además la métrica "Harness score", pero
 * `metrics` y `readings` son tablas de R5 y su siembra va con esa rebanada:
 * crear una tabla cuya feature no existe deja código sin prueba que lo cubra.
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('Falta DATABASE_URL. Copia .env.example a .env y complétala.');
  process.exit(1);
}

const sql = neon(url);

const PROGRAM_NAME = 'Harness Engineering';

/** RF-15 — tipos de sesión del curso. Son datos del programa, no un enum. */
const SESSION_TYPES = [
  ['E', 'Estudio'],
  ['C', 'Construcción'],
  ['K', 'Consolidación'],
  ['V', 'Checkpoint'],
];

// --- programs -----------------------------------------------------------------
const inserted = await sql`
  insert into programs (name, provider, kind, status, planned_sessions)
  select ${PROGRAM_NAME}, ${'walkinglabs'}, ${'course'}, ${'active'}, ${41}
  where not exists (select 1 from programs where name = ${PROGRAM_NAME})
  returning id, name
`;

if (inserted.length === 0) {
  console.log(`Semilla ya presente: "${PROGRAM_NAME}". Sin cambios en programs.`);
} else {
  console.log(`Semilla insertada: "${inserted[0].name}" (${inserted[0].id}).`);
}

// El id se vuelve a consultar en vez de reutilizar el del insert: en la segunda
// ejecución no hay fila devuelta, y la semilla debe seguir sirviendo para
// completar los tipos de sesión que falten.
const [program] = await sql`
  select id from programs where name = ${PROGRAM_NAME} limit 1
`;

if (!program) {
  console.error(`No se encontró el programa "${PROGRAM_NAME}" después de sembrarlo.`);
  process.exit(1);
}

// --- session_types ------------------------------------------------------------
// `on conflict do nothing` sobre UNIQUE (program_id, code) es lo que hace
// idempotente este paso: la base decide, no una consulta previa que dejaría una
// ventana de carrera entre la comprobación y la inserción.
let added = 0;

for (const [code, label] of SESSION_TYPES) {
  const rows = await sql`
    insert into session_types (program_id, code, label)
    values (${program.id}, ${code}, ${label})
    on conflict (program_id, code) do nothing
    returning code
  `;

  if (rows.length > 0) added += 1;
}

console.log(
  added === 0
    ? `Tipos de sesión ya presentes (${SESSION_TYPES.length}). Sin cambios en session_types.`
    : `Tipos de sesión insertados: ${added} de ${SESSION_TYPES.length}.`,
);
