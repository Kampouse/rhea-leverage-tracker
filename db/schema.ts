import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// User trade history cache
export const tradeHistory = sqliteTable('trade_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: text('account_id').notNull(),
  posId: text('pos_id').notNull().unique(),
  tokenC: text('token_c').notNull(),
  tokenD: text('token_d').notNull(),
  tokenP: text('token_p').notNull(),
  trend: text('trend').notNull(),
  entryPrice: text('entry_price').notNull(),
  exitPrice: text('exit_price').notNull(),
  amountC: text('amount_c').notNull(),
  amountD: text('amount_d').notNull(),
  amountP: text('amount_p').notNull(),
  pnl: real('pnl').notNull(),
  openTimestamp: integer('open_timestamp').notNull(),
  closeTimestamp: integer('close_timestamp').notNull(),
  closeType: text('close_type').notNull(),
  fee: text('fee').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  accountIdIdx: index('idx_account_id').on(table.accountId),
  closeTimestampIdx: index('idx_close_timestamp').on(table.closeTimestamp),
}));

// Sync status tracking
export const syncStatus = sqliteTable('sync_status', {
  accountId: text('account_id').primaryKey(),
  lastSync: integer('last_sync').notNull(),
  totalTrades: integer('total_trades').notNull(),
});

// Type exports
export type TradeHistory = typeof tradeHistory.$inferSelect;
export type NewTradeHistory = typeof tradeHistory.$inferInsert;
export type SyncStatus = typeof syncStatus.$inferSelect;
export type NewSyncStatus = typeof syncStatus.$inferInsert;
