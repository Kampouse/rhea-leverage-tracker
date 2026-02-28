# Database Setup (Drizzle ORM + Cloudflare D1)

## Setup Instructions

### 1. Create D1 Database

```bash
# Create the database
wrangler d1 create rhea-tracker

# Copy the database_id from output and update wrangler.toml
```

### 2. Run Migration

```bash
# Push schema to D1
npm run db:d1:migrate
```

### 3. Update wrangler.toml

Replace `database_id = "placeholder-update-after-creation"` with your actual database ID.

## Local Development

For local testing with SQLite:

```bash
# Generate migrations
npm run db:generate

# Push to local SQLite
npm run db:push

# Open Drizzle Studio (GUI)
npm run db:studio
```

## Schema

### trade_history
Stores cached trade history for each user.

**Fields:**
- `account_id`: NEAR account ID
- `pos_id`: Unique position ID (primary key)
- `token_c/d/p`: Collateral/borrowed/position tokens
- `trend`: LONG or SHORT
- `entry_price/exit_price`: Trade prices
- `pnl`: Profit/loss
- `timestamps`: Open/close times

### sync_status
Tracks when each account was last synced.

**Fields:**
- `account_id`: NEAR account ID (primary key)
- `last_sync`: Unix timestamp
- `total_trades`: Number of trades cached

## API Endpoints

### POST /api/sync-history?address=ACCOUNT_ID
Fetches all trade history from Rhea API and caches it in D1.

### GET /api/sync-history?address=ACCOUNT_ID
Returns cached trade history from D1.

## Drizzle ORM Benefits

✅ Type-safe queries
✅ Auto-generated migrations
✅ Works with D1 (Cloudflare) and SQLite (local)
✅ Better DX than raw SQL
✅ Studio GUI for data inspection

## Example Query

```typescript
import { createDb } from '@/db';
import { tradeHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';

const db = createDb(env.DB);

// Get all trades for an account
const trades = await db.select()
  .from(tradeHistory)
  .where(eq(tradeHistory.accountId, 'kampouse.near'));
```
