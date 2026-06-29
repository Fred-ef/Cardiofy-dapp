CREATE TYPE "public"."onchain_status" AS ENUM('PENDING', 'CONFIRMED', 'FAILED');--> statement-breakpoint
CREATE TABLE "assets" (
	"asset_id" varchar(128) PRIMARY KEY NOT NULL,
	"content_hash" varchar(66) NOT NULL,
	"status" "onchain_status" DEFAULT 'PENDING' NOT NULL,
	"tx_hash" varchar(66),
	"block_number" bigint,
	"notarized_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"total_views_mirror" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_chunks" (
	"period_id" bigint NOT NULL,
	"chunk_index" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "onchain_status" DEFAULT 'PENDING' NOT NULL,
	"tx_hash" varchar(66),
	"block_number" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	CONSTRAINT "batch_chunks_period_id_chunk_index_pk" PRIMARY KEY("period_id","chunk_index")
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"period_id" bigint PRIMARY KEY NOT NULL,
	"asset_count" integer NOT NULL,
	"views_total" bigint NOT NULL,
	"status" "onchain_status" DEFAULT 'PENDING' NOT NULL,
	"tx_hash" varchar(66),
	"block_number" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"payload" jsonb,
	"mirror_applied" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"contract_id" varchar(128) PRIMARY KEY NOT NULL,
	"content_hash" varchar(66) NOT NULL,
	"status" "onchain_status" DEFAULT 'PENDING' NOT NULL,
	"tx_hash" varchar(66),
	"block_number" bigint,
	"notarized_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "views" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"asset_id" varchar(128) NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"period_id" bigint NOT NULL,
	"anchored" integer DEFAULT 0 NOT NULL,
	"batch_period_id" bigint
);
--> statement-breakpoint
CREATE INDEX "assets_status_idx" ON "assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "batch_chunks_status_idx" ON "batch_chunks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contracts_status_idx" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "views_idempotency_unique" ON "views" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "views_period_idx" ON "views" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "views_asset_idx" ON "views" USING btree ("asset_id");