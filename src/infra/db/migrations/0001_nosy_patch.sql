CREATE TABLE "metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"direction" text DEFAULT 'up' NOT NULL,
	"target" numeric,
	CONSTRAINT "metrics_program_name" UNIQUE("program_id","name"),
	CONSTRAINT "metrics_direction_valid" CHECK ("metrics"."direction" in ('up','down')),
	CONSTRAINT "metrics_name_length" CHECK (char_length("metrics"."name") between 1 and 80),
	CONSTRAINT "metrics_unit_length" CHECK ("metrics"."unit" is null or char_length("metrics"."unit") between 1 and 24)
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_id" uuid NOT NULL,
	"session_id" uuid,
	"value" numeric NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_metric_id_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."metrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "readings_by_metric_time" ON "readings" USING btree ("metric_id","recorded_at");