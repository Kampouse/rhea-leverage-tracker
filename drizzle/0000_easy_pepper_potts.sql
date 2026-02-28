CREATE TABLE `sync_status` (
	`account_id` text PRIMARY KEY NOT NULL,
	`last_sync` integer NOT NULL,
	`total_trades` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`pos_id` text NOT NULL,
	`token_c` text NOT NULL,
	`token_d` text NOT NULL,
	`token_p` text NOT NULL,
	`trend` text NOT NULL,
	`entry_price` text NOT NULL,
	`exit_price` text NOT NULL,
	`amount_c` text NOT NULL,
	`amount_d` text NOT NULL,
	`amount_p` text NOT NULL,
	`pnl` real NOT NULL,
	`open_timestamp` integer NOT NULL,
	`close_timestamp` integer NOT NULL,
	`close_type` text NOT NULL,
	`fee` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_history_pos_id_unique` ON `trade_history` (`pos_id`);--> statement-breakpoint
CREATE INDEX `idx_account_id` ON `trade_history` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_close_timestamp` ON `trade_history` (`close_timestamp`);