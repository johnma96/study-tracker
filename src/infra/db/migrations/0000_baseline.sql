-- 0000_baseline — esquema completo de R0, R1 y R2 (programs, session_types, sessions).
--
-- ESTA MIGRACION ES IDEMPOTENTE A PROPOSITO, y esa decision no es cosmetica.
--
-- El historial de migraciones se introdujo cuando `dev` y produccion YA tenian el esquema
-- completo aplicado con `drizzle-kit push`, es decir sin ninguna fila en la tabla de control
-- de Drizzle. Un `CREATE TABLE` pelado habria fallado contra las dos, y el arreglo alternativo
-- --insertar a mano el registro de "ya aplicada" en `drizzle.__drizzle_migrations`-- exige
-- ejecutar SQL manual contra produccion, que es precisamente el procedimiento manual que este
-- cambio existe para eliminar.
--
-- Escrita asi, la primera corrida de `drizzle-kit migrate` contra una base que ya tiene el
-- esquema no toca nada y se auto-marca como aplicada. Contra una base vacia --un branch nuevo
-- de Neon, un clon limpio-- crea todo. Mismo archivo, los dos casos, sin paso manual.
--
-- Limite conocido y deliberado: sobre una base a MEDIO aplicar, los CHECK y UNIQUE declarados
-- dentro de `CREATE TABLE IF NOT EXISTS` se saltan en silencio (la tabla ya existe). Las claves
-- foraneas y los indices si se reparan, porque van en sentencias propias con guarda. Reparar
-- una base a medias no es trabajo de una migracion base: para eso esta `npm run db:push:emergency`.
--
-- Las migraciones siguientes NO se escriben a mano: las genera `npm run db:generate` a partir
-- de `src/infra/db/schema.ts` y del snapshot de `meta/`, y se aplican tal cual salen.

CREATE TABLE IF NOT EXISTS "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text,
	"kind" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"started_at" date,
	"target_at" date,
	"planned_sessions" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_name_length" CHECK (char_length("programs"."name") between 1 and 120),
	CONSTRAINT "programs_kind_valid" CHECK ("programs"."kind" in ('course','certification','diploma','bootcamp','selfstudy')),
	CONSTRAINT "programs_status_valid" CHECK ("programs"."status" in ('planned','active','paused','done','abandoned'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "session_types_program_code" UNIQUE("program_id","code"),
	CONSTRAINT "session_types_code_length" CHECK (char_length("session_types"."code") between 1 and 8),
	CONSTRAINT "session_types_label_length" CHECK (char_length("session_types"."label") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"session_type_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"paused_seconds" integer DEFAULT 0 NOT NULL,
	"minutes_override" integer,
	"stuck_minutes" integer DEFAULT 0 NOT NULL,
	"note" text,
	"source" text DEFAULT 'timer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_paused_seconds_non_negative" CHECK ("sessions"."paused_seconds" >= 0),
	CONSTRAINT "sessions_minutes_override_positive" CHECK ("sessions"."minutes_override" is null or "sessions"."minutes_override" > 0),
	CONSTRAINT "sessions_stuck_minutes_non_negative" CHECK ("sessions"."stuck_minutes" >= 0),
	CONSTRAINT "sessions_source_valid" CHECK ("sessions"."source" in ('timer','manual')),
	CONSTRAINT "ended_after_started" CHECK ("sessions"."ended_at" is null or "sessions"."ended_at" > "sessions"."started_at"),
	CONSTRAINT "no_open_pause_when_ended" CHECK ("sessions"."ended_at" is null or "sessions"."paused_at" is null)
);
--> statement-breakpoint
-- PostgreSQL no admite `ADD CONSTRAINT IF NOT EXISTS`. La guarda es capturar el
-- `duplicate_object` (SQLSTATE 42710) que lanza cuando el nombre ya existe: sobre una base que
-- ya tiene la clave foranea no pasa nada, y sobre una que no la tiene, se crea.
DO $$ BEGIN
	ALTER TABLE "session_types" ADD CONSTRAINT "session_types_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "sessions" ADD CONSTRAINT "sessions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "sessions" ADD CONSTRAINT "sessions_session_type_id_session_types_id_fk" FOREIGN KEY ("session_type_id") REFERENCES "public"."session_types"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Invariante 1 (RF-22): como maximo una sesion en curso. El indice unico parcial sobre la
-- expresion constante `(true)` es la restriccion; sin el, la aplicacion parece sana y admite
-- dos sesiones a la vez. `tests/integration/session.integration.test.ts` consulta `pg_indexes`
-- y falla si falta, precisamente para que no se pierda en un cambio de version de drizzle-kit.
CREATE UNIQUE INDEX IF NOT EXISTS "one_running_session" ON "sessions" USING btree ((true)) WHERE "sessions"."ended_at" is null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_by_program_date" ON "sessions" USING btree ("program_id","started_at" DESC NULLS LAST);
