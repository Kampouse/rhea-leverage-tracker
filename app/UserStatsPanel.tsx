'use client';

import { Position } from './actions';

interface UserStatsPanelProps {
  position: Position;
  onClose: () => void;
  allPositions: Position[];
}

export default function UserStatsPanel({ position, onClose, allPositions }: UserStatsPanelProps) {
  // Get all positions for this user
  const userPositions = allPositions.filter(p => p.accountId === position.accountId);
  const totalPnL = userPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalCollateral = userPositions.reduce((sum, p) => sum + p.collateralValue, 0);
  const avgLeverage = userPositions.reduce((sum, p) => sum + p.leverage, 0) / userPositions.length;
  const winRate = (userPositions.filter(p => p.pnl > 0).length / userPositions.length) * 100;

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-[#0a0a0c] border-l border-cream/10 overflow-y-auto z-50">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-taupe hover:text-cream text-2xl transition-colors"
      >
        ×
      </button>

      {/* Header */}
      <div className="p-6 border-b border-cream/10">
        <div className="text-sm text-taupe mb-2">Trader Profile</div>
        <div className="text-xl font-bold text-cream break-all pr-8">{position.accountId}</div>
        <a
          href={`https://pikespeak.ai/wallet-explorer/${position.accountId}?tab=global`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-lime hover:text-lime/80 mt-2 transition-colors"
        >
          View on Pikespeak
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Total P&L */}
      <div className="p-6 border-b border-cream/10">
        <div className="text-sm text-taupe mb-1">Total P&L</div>
        <div className={`text-4xl font-bold ${totalPnL >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'}`}>
          {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
        </div>
        <div className="text-sm text-taupe mt-2">
          {userPositions.length} position{userPositions.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-px bg-cream/10 border-b border-cream/10">
        <div className="bg-[#0a0a0c] p-4">
          <div className="text-xs text-taupe mb-1">Win Rate</div>
          <div className="text-2xl font-bold text-lime">{winRate.toFixed(0)}%</div>
        </div>
        <div className="bg-[#0a0a0c] p-4">
          <div className="text-xs text-taupe mb-1">Avg Leverage</div>
          <div className="text-2xl font-bold text-cream">{avgLeverage.toFixed(1)}x</div>
        </div>
        <div className="bg-[#0a0a0c] p-4">
          <div className="text-xs text-taupe mb-1">Total Collateral</div>
          <div className="text-2xl font-bold text-cream">{formatCurrency(totalCollateral)}</div>
        </div>
        <div className="bg-[#0a0a0c] p-4">
          <div className="text-xs text-taupe mb-1">Best Trade</div>
          <div className={`text-2xl font-bold ${Math.max(...userPositions.map(p => p.pnl)) >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'}`}>
            {formatCurrency(Math.max(...userPositions.map(p => p.pnl)))}
          </div>
        </div>
      </div>

      {/* Active Positions */}
      <div className="p-6">
        <h3 className="text-sm font-semibold text-cream mb-4">Active Positions</h3>
        <div className="space-y-3">
          {userPositions.map((pos) => (
            <div key={pos.posId} className="bg-cream/[0.02] rounded-lg p-4 border border-cream/5">
              {/* Position Header */}
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs px-2 py-1 rounded font-semibold ${
                  pos.type === 'Long' ? 'bg-accent-green/20 text-accent-green' : 'bg-slate/20 text-slate'
                }`}>
                  {pos.type.toUpperCase()}
                </span>
                <span className={`text-sm font-semibold ${
                  pos.pnl >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'
                }`}>
                  {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                </span>
              </div>

              {/* Position Details */}
              <div className="text-sm font-medium text-cream mb-2">
                {pos.positionToken}/{pos.collateralToken}
              </div>

              <div className="space-y-1 text-xs text-taupe">
                <div className="flex justify-between">
                  <span>Leverage:</span>
                  <span className="text-cream">{pos.leverage.toFixed(1)}x</span>
                </div>
                <div className="flex justify-between">
                  <span>Collateral:</span>
                  <span className="text-cream">{formatCurrency(pos.collateralValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Borrowed:</span>
                  <span className="text-cream">{formatCurrency(pos.borrowedValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Health:</span>
                  <span className={pos.health > 2 ? 'text-accent-green' : pos.health > 1.2 ? 'text-cream' : 'text-[#ff6b6b]'}>
                    {pos.health.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
