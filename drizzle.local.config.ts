import type { Config } from 'drizzle-kit';

// Local development config (SQLite file)
export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
} satisfies Config;
