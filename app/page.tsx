export const runtime = 'edge';

import { getLeaderboard, getPositions } from './actions';
import PositionTable from './PositionTable';
import LeaderboardCard from './LeaderboardCard';
import UserStatsPanelClient from './UserStatsPanelClient';

export default async function Home() {
  const [leaderboard, positionsData] = await Promise.all([
    getLeaderboard(),
    getPositions(100, 'pnl', 'desc')
  ]);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Combine all positions
  const allPositions = [
    ...leaderboard.topPerformers,
    ...leaderboard.worstPerformers,
    ...positionsData.positions
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Rhea Logo" className="h-8 w-8 md:h-12 md:w-12" />
              <div>
                <h1 className="text-lg md:text-2xl">Rhea Leverage Tracker</h1>
                <p className="header-subtitle text-xs md:text-sm">Real-time margin position tracking on NEAR</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-cream/10 bg-[#16161b] self-start md:self-auto">
              <span className="text-xs md:text-sm text-taupe">Powered by</span>
              <span className="text-xs md:text-sm font-semibold text-lime">Rhea Finance</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">Total Positions</p>
            <p className="stat-value">{leaderboard.totalPositions}</p>
            <p className="text-xs text-taupe mt-2">Active margin trades</p>
          </div>
          
          <div className="stat-card">
            <p className="stat-label">Profit Rate</p>
            <p className="stat-value text-accent-green">{leaderboard.stats.profitRate}</p>
            <p className="text-xs text-taupe mt-2">
              {leaderboard.stats.profitable} profitable / {leaderboard.stats.unprofitable} loss
            </p>
          </div>
          
          <div className="stat-card">
            <p className="stat-label">Total Unrealized PnL</p>
            <p className={`stat-value ${leaderboard.stats.totalPnL >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(leaderboard.stats.totalPnL)}
            </p>
            <p className="text-xs text-taupe mt-2">Combined positions</p>
          </div>
          
          <div className="stat-card">
            <p className="stat-label">Position Types</p>
            <p className="stat-value">
              <span className="text-slate">{leaderboard.stats.shorts}</span>
              <span className="text-taupe mx-2">/</span>
              <span className="text-accent-green">{leaderboard.stats.longs}</span>
            </p>
            <p className="text-xs text-taupe mt-2">SHORT / LONG</p>
          </div>
        </div>

        {/* Leaderboard Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <LeaderboardCard
            title="Top Performers"
            icon="🏆"
            badge="Best PnL"
            badgeClass="section-badge"
            positions={leaderboard.topPerformers}
          />
          <LeaderboardCard
            title="Worst Performers"
            icon="💀"
            badge="Worst PnL"
            badgeClass="section-badge bg-deepred/20 text-[#ff6b6b]"
            positions={leaderboard.worstPerformers}
          />
        </div>

        {/* Full Table */}
        <PositionTable initialPositions={positionsData.positions} initialTimestamp={Date.now()} />

        {/* User Stats Panel */}
        <UserStatsPanelClient positions={allPositions} />

        {/* Footer */}
        <div className="refresh-info justify-center py-8">
          <span className="refresh-dot"></span>
          <span>Data cached for 1 minute • Powered by Burrow Protocol</span>
        </div>
      </main>
    </div>
  );
}
