'use client';

import { useState, useEffect } from 'react';
import { Position, UserStats } from './actions';

interface UserStatsPanelProps {
  position: Position;
  onClose: () => void;
  allPositions: Position[];
}

export default function UserStatsPanel({ position, onClose, allPositions }: UserStatsPanelProps) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/user-stats?address=${position.accountId}`);
        const data = await res.json();
        setUserStats(data);
      } catch (error) {
        console.error('Failed to fetch user stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [position.accountId]);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 24) return address;
    return `${address.slice(0, 12)}...${address.slice(-9)}`;
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-full md:w-96 bg-[#0a0a0c] border-l border-cream/10 overflow-y-auto z-50">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-taupe hover:text-cream text-2xl transition-colors z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream/10"
        >
          ×
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-taupe text-sm">Loading trader history...</div>
          </div>
        ) : userStats ? (
          <div className="pb-20 md:pb-0">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-cream/10 bg-gradient-to-b from-cream/[0.02] to-transparent">
              <div className="text-xs text-taupe mb-2 uppercase tracking-wide">Trader Profile</div>
              <div className="text-lg md:text-xl font-bold text-cream break-all pr-8">{truncateAddress(userStats.accountId)}</div>
              <a
                href={`https://pikespeak.ai/wallet-explorer/${userStats.accountId}?tab=global`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs md:text-sm text-lime hover:text-lime/80 mt-2 transition-colors"
              >
                View on Pikespeak
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            {/* Total P&L */}
            <div className="p-4 md:p-6 border-b border-cream/10">
              <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Total P&L (Realized + Unrealized)</div>
              <div className={`text-3xl md:text-4xl font-bold ${userStats.totalPnL >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'}`}>
                {userStats.totalPnL >= 0 ? '+' : ''}{formatCurrency(userStats.totalPnL)}
              </div>
              <div className="mt-3 space-y-1 text-xs md:text-sm">
                <div className="flex justify-between">
                  <span className="text-taupe">Realized:</span>
                  <span className={userStats.realizedPnL >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'}>
                    {userStats.realizedPnL >= 0 ? '+' : ''}{formatCurrency(userStats.realizedPnL)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-taupe">Unrealized:</span>
                  <span className={userStats.unrealizedPnL >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'}>
                    {userStats.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(userStats.unrealizedPnL)}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-px bg-cream/10 border-b border-cream/10">
              <div className="bg-[#0a0a0c] p-3 md:p-4">
                <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Win Rate</div>
                <div className="text-xl md:text-2xl font-bold text-lime">{userStats.winRate.toFixed(1)}%</div>
                <div className="text-xs text-taupe mt-1">{userStats.winningTrades}W / {userStats.losingTrades}L</div>
              </div>
              <div className="bg-[#0a0a0c] p-3 md:p-4">
                <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Total Trades</div>
                <div className="text-xl md:text-2xl font-bold text-cream">{userStats.totalTrades}</div>
                <div className="text-xs text-taupe mt-1">{userStats.activePositions.length} active</div>
              </div>
              <div className="bg-[#0a0a0c] p-3 md:p-4">
                <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Avg Leverage</div>
                <div className="text-xl md:text-2xl font-bold text-cream">{userStats.avgLeverage.toFixed(1)}x</div>
              </div>
              <div className="bg-[#0a0a0c] p-3 md:p-4">
                <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Total Volume</div>
                <div className="text-xl md:text-2xl font-bold text-cream">{formatCurrency(userStats.totalVolume)}</div>
              </div>
            </div>

            {/* Active Positions */}
            {userStats.activePositions.length > 0 && (
              <div className="p-4 md:p-6 border-b border-cream/10">
                <h3 className="text-xs md:text-sm font-semibold text-cream mb-3 md:mb-4 uppercase tracking-wide">
                  Active Positions ({userStats.activePositions.length})
                </h3>
                <div className="space-y-2 md:space-y-3">
                  {userStats.activePositions.map((pos) => (
                    <div key={pos.posId} className="bg-cream/[0.02] rounded-lg p-3 md:p-4 border border-cream/5">
                      {/* Position Header */}
                      <div className="flex justify-between items-center mb-2 md:mb-3">
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          pos.type === 'Long' ? 'bg-accent-green/20 text-accent-green' : 'bg-slate/20 text-slate'
                        }`}>
                          {pos.type.toUpperCase()}
                        </span>
                        <span className={`text-xs md:text-sm font-semibold ${
                          pos.pnl >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'
                        }`}>
                          {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                        </span>
                      </div>

                      {/* Position Details */}
                      <div className="text-xs md:text-sm font-medium text-cream mb-2">
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
                          <span>Entry:</span>
                          <span className="text-cream text-left">
                            {pos.entryPrice ? `$${pos.entryPrice.toFixed(2)}` : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Current:</span>
                          <span className="text-cream">${pos.currentPrice.toFixed(2)}</span>
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
            )}

            {/* Recent Closed Trades */}
            {userStats.closedPositions.length > 0 && (
              <div className="p-4 md:p-6">
                <h3 className="text-xs md:text-sm font-semibold text-cream mb-3 md:mb-4 uppercase tracking-wide">
                  Recent Closed Trades ({userStats.closedPositions.length})
                </h3>
                <div className="space-y-2">
                  {userStats.closedPositions.slice(0, 10).map((pos, i) => {
                    const pnl = parseFloat(pos.pnl || '0');
                    const tokenSymbol = pos.token_p?.split('.')[0].toUpperCase() || '???';
                    
                    return (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-cream/[0.02] rounded border border-cream/5">
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            pos.trend === 'LONG' ? 'bg-accent-green/20 text-accent-green' : 'bg-slate/20 text-slate'
                          }`}>
                            {pos.trend}
                          </span>
                          <span className="text-xs md:text-sm text-cream">{tokenSymbol}</span>
                        </div>
                        <span className={`text-xs md:text-sm font-semibold ${pnl >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'}`}>
                          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-taupe">Failed to load stats</div>
          </div>
        )}
      </div>
    </>
  );
}
