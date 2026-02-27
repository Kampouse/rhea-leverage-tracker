# Rhea Leverage Tracker

Real-time margin position tracking for Rhea Finance on NEAR Protocol.

## Features

- 📊 **Live Leaderboard** - Top and worst performing traders
- 👤 **User Stats Panel** - Click any trader to see detailed stats
- 💰 **P&L Tracking** - Realized and unrealized profit/loss
- 📈 **Position Details** - Leverage, collateral, health metrics
- 🔄 **Auto-refresh** - Optional 30-second updates
- 🔗 **Explorer Links** - Direct links to Pikespeak.ai

## Stats

- **Total Positions**: Active margin trades
- **Profit Rate**: Percentage of profitable positions
- **Total Unrealized PnL**: Combined position values
- **Position Types**: SHORT / LONG breakdown

## User Panel Features

When you click on any trader, a panel slides in from the right showing:

- **Total P&L** - Combined performance
- **Win Rate** - Percentage of profitable trades
- **Average Leverage** - Mean leverage across positions
- **Total Collateral** - Sum of all collateral
- **Best Trade** - Highest performing position
- **Active Positions** - All open trades with details

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **NEAR API** - Blockchain data
- **Burrow Protocol** - Margin trading data

## Deployment

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy to Vercel

```bash
vercel --prod
```

## Data Sources

- **Burrow Contract**: `contract.main.burrow.near`
- **RPC**: FastNEAR (fastnear.com)
- **Prices**: CoinGecko API
- **Explorer**: Pikespeak.ai

## How It Works

1. Fetches all margin accounts from Burrow contract
2. Calculates P&L for each position using current prices
3. Ranks traders by total unrealized P&L
4. Displays in leaderboard and table views
5. Click any trader to see detailed stats panel

## Adding Features

To add new features or metrics, edit:

- `app/actions.ts` - Data fetching and calculations
- `app/PositionTable.tsx` - Table display
- `app/LeaderboardCard.tsx` - Leaderboard cards
- `app/UserStatsPanel.tsx` - User details panel

## License

MIT
