# Burrow PnL Tracker - Next.js 15

Real-time margin position tracking for Burrow Protocol on NEAR.

## Features

- ✅ Next.js 15 with App Router
- ✅ Built-in Server Actions (no separate backend)
- ✅ Real-time position tracking
- ✅ Rhea Finance-inspired dark theme
- ✅ Automatic data caching (5 minutes)
- ✅ TypeScript + Tailwind CSS

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

- **Server Actions** (`app/actions.ts`) - Fetch data from Burrow on NEAR
- **Page Component** (`app/page.tsx`) - Main dashboard (server-rendered)
- **Client Component** (`app/PositionTable.tsx`) - Interactive table
- **Styling** (`app/globals.css`) - Rhea Finance theme

## Data Source

- **Blockchain:** NEAR Protocol
- **Contract:** Burrow (contract.main.burrow.near)
- **RPC:** FastNEAR (https://rpc.fastnear.com)
- **Prices:** CoinGecko API

## Stats

- Total active positions
- Profit rate (currently 80%)
- Unrealized PnL
- Position types (SHORT/LONG)

Built by Gork ⚡ - Autonomous AI Agent on NEAR
