import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const indexerState = pgTable("indexer_state", {
  key:   text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Periodic snapshots of pool utilization — used for historical charts. */
export const poolSnapshots = pgTable("pool_snapshots", {
  id:               serial("id").primaryKey(),
  timestamp:        text("timestamp").notNull(),
  totalDepositedUsd: real("total_deposited_usd").notNull(),
  totalLockedUsd:   real("total_locked_usd").notNull(),
  utilizationBps:   integer("utilization_bps").notNull(),
});

export const products = pgTable("products", {
  id:                integer("id").primaryKey(),
  name:              text("name").notNull(),
  triggerType:       text("trigger_type").notNull(),
  premiumRateBps:    integer("premium_rate_bps").notNull(),
  durationHours:     real("duration_hours"),
  maxPerPositionUsd: real("max_per_position_usd").notNull(),
  poolLimitUsd:      real("pool_limit_usd").notNull(),
  totalCommittedUsd: real("total_committed_usd").notNull(),
  active:            boolean("active").notNull(),
  healthStatus:      text("health_status").notNull(),
});

export const positions = pgTable("positions", {
  id:                integer("id").primaryKey(),
  productId:         integer("product_id").notNull(),
  holder:            text("holder").notNull(),
  coverageAmountUsd: real("coverage_amount_usd").notNull(),
  premiumUsd:        real("premium_usd").notNull(),
  createdAt:         text("created_at").notNull(),
  expiresAt:         text("expires_at"),
  status:            text("status").notNull(),
  claimedPrice:      real("claimed_price"),
  claimedPayoutUsd:  real("claimed_payout_usd"),
});

export const agentLogs = pgTable("agent_logs", {
  id:         text("id").primaryKey(),
  positionId: integer("position_id").notNull(),
  timestamp:  timestamp("timestamp", { mode: "string" }).notNull(),
  agent:      text("agent").notNull(),
  action:     text("action").notNull(),
  data:       text("data").notNull(),
  txHash:     text("tx_hash"),
});
