-- D1 Schema for Rhea Leverage Tracker

-- User trade history cache
CREATE TABLE IF NOT EXISTS trade_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  pos_id TEXT NOT NULL UNIQUE,
  token_c TEXT NOT NULL,
  token_d TEXT NOT NULL,
  token_p TEXT NOT NULL,
  trend TEXT NOT NULL,
  entry_price TEXT NOT NULL,
  exit_price TEXT NOT NULL,
  amount_c TEXT NOT NULL,
  amount_d TEXT NOT NULL,
  amount_p TEXT NOT NULL,
  pnl REAL NOT NULL,
  open_timestamp INTEGER NOT NULL,
  close_timestamp INTEGER NOT NULL,
  close_type TEXT NOT NULL,
  fee TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Index for fast lookups by account
CREATE INDEX IF NOT EXISTS idx_account_id ON trade_history(account_id);
CREATE INDEX IF NOT EXISTS idx_close_timestamp ON trade_history(close_timestamp);

-- Metadata table for tracking sync status
CREATE TABLE IF NOT EXISTS sync_status (
  account_id TEXT PRIMARY KEY,
  last_sync INTEGER NOT NULL,
  total_trades INTEGER NOT NULL
);
