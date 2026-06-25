import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  jsonb,
  varchar,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// =======================
// ENUMS
// =======================

export const onchainStatusEnum = pgEnum('onchain_status', ['PENDING', 'CONFIRMED', 'FAILED']);

// =======================
// CONTRACTS — entità notarizzate (mirror minimo locale degli accordi)
// =======================

export const contracts = pgTable(
  'contracts',
  {
    contractId:   varchar('contract_id', { length: 128 }).primaryKey(),
    contentHash:  varchar('content_hash', { length: 66 }).notNull(), // 0x-prefixed bytes32
    status:       onchainStatusEnum('status').default('PENDING').notNull(),
    txHash:       varchar('tx_hash', { length: 66 }),
    blockNumber:  bigint('block_number', { mode: 'number' }),
    notarizedAt:  timestamp('notarized_at').defaultNow().notNull(),
    confirmedAt:  timestamp('confirmed_at'),
  },
  (table) => [
    index('contracts_status_idx').on(table.status),
  ]
);

export type ContractRow = typeof contracts.$inferSelect;
export type NewContractRow = typeof contracts.$inferInsert;

// =======================
// ASSETS — entità notarizzate + contatori cumulativi
// =======================

export const assets = pgTable(
  'assets',
  {
    assetId:           varchar('asset_id', { length: 128 }).primaryKey(),
    contentHash:       varchar('content_hash', { length: 66 }).notNull(),
    status:            onchainStatusEnum('status').default('PENDING').notNull(),
    txHash:            varchar('tx_hash', { length: 66 }),
    blockNumber:       bigint('block_number', { mode: 'number' }),
    notarizedAt:       timestamp('notarized_at').defaultNow().notNull(),
    confirmedAt:       timestamp('confirmed_at'),
    // Mirror locale del contatore on-chain (ricostruibile via riconciliazione eventi).
    totalViewsMirror:  bigint('total_views_mirror', { mode: 'number' }).default(0).notNull(),
  },
  (table) => [
    index('assets_status_idx').on(table.status),
  ]
);

export type AssetRow = typeof assets.$inferSelect;
export type NewAssetRow = typeof assets.$inferInsert;

// =======================
// VIEWS — eventi di lettura ricevuti dal core
// =======================

export const views = pgTable(
  'views',
  {
    id:             varchar('id', { length: 64 }).primaryKey(),   // ULID/UUID generato lato modulo
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    assetId:        varchar('asset_id', { length: 128 }).notNull(),
    readerHash:     varchar('reader_hash', { length: 128 }).notNull(),
    sessionId:      varchar('session_id', { length: 128 }),
    occurredAt:     timestamp('occurred_at').notNull(),
    receivedAt:     timestamp('received_at').defaultNow().notNull(),
    periodId:       bigint('period_id', { mode: 'number' }).notNull(), // unix ts mezzanotte UTC
    evidence:       jsonb('evidence'),
    // Stato di anchoring: false finché il batch del periodo non è on-chain.
    anchored:       integer('anchored').default(0).notNull(),
    batchPeriodId:  bigint('batch_period_id', { mode: 'number' }),
  },
  (table) => [
    uniqueIndex('views_idempotency_unique').on(table.idempotencyKey),
    index('views_period_idx').on(table.periodId),
    index('views_asset_idx').on(table.assetId),
  ]
);

export type ViewRow = typeof views.$inferSelect;
export type NewViewRow = typeof views.$inferInsert;

// =======================
// BATCHES — un record per batch giornaliero
// =======================

export const batches = pgTable(
  'batches',
  {
    periodId:    bigint('period_id', { mode: 'number' }).primaryKey(),
    assetCount:  integer('asset_count').notNull(),
    viewsTotal:  bigint('views_total', { mode: 'number' }).notNull(),
    status:      onchainStatusEnum('status').default('PENDING').notNull(),
    txHash:      varchar('tx_hash', { length: 66 }),
    blockNumber: bigint('block_number', { mode: 'number' }),
    createdAt:   timestamp('created_at').defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at'),
    payload:     jsonb('payload'),  // snapshot degli update [{ assetId, viewsInPeriod }]
  }
);

export type BatchRow = typeof batches.$inferSelect;
export type NewBatchRow = typeof batches.$inferInsert;
