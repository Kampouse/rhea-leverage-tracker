'use client';

import { useState, useEffect } from 'react';
import { Position } from './actions';
import UserStatsPanel from './UserStatsPanel';

interface UserStatsPanelClientProps {
  positions: Position[];
}

export default function UserStatsPanelClient({ positions }: UserStatsPanelClientProps) {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [searchResult, setSearchResult] = useState<any>(null);

  // Handle search result from TraderSearch
  const handleTraderFound = (trader: any) => {
    // Save to recent searches
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recentTraders');
      const recent = saved ? JSON.parse(saved) : [];
      const updated = [trader.accountId, ...recent.filter((a: string) => a !== trader.accountId)].slice(0, 5);
      localStorage.setItem('recentTraders', JSON.stringify(updated));
    }

    // Convert to Position-like object for panel
    setSearchResult(trader);
    setSelectedPosition(null);
  };

  // Handle click on position row
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const row = target.closest('[data-account-id]');
      if (row) {
        const accountId = row.getAttribute('data-account-id');
        if (accountId) {
          const position = positions.find(p => p.accountId === accountId);
          if (position) {
            setSelectedPosition(position);
            setSearchResult(null);
          }
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [positions]);

  const handleClose = () => {
    setSelectedPosition(null);
    setSearchResult(null);
  };

  // Export handler for TraderSearch
  useEffect(() => {
    (window as any).handleTraderFound = handleTraderFound;
    return () => {
      delete (window as any).handleTraderFound;
    };
  }, []);

  return (
    <>
      {selectedPosition && (
        <UserStatsPanel
          position={selectedPosition}
          onClose={handleClose}
          allPositions={positions}
        />
      )}
      {searchResult && (
        <SearchResultPanel
          trader={searchResult}
          onClose={handleClose}
        />
      )}
    </>
  );
}

// Separate panel for search results (no active positions)
function SearchResultPanel({ trader, onClose }: { trader: any; onClose: () => void }) {
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
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-taupe hover:text-cream text-2xl transition-colors z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream/10"
        >
          ×
        </button>

        {/* Header */}
        <div className="p-4 md:p-6 border-b border-cream/10 bg-gradient-to-b from-cream/[0.02] to-transparent">
          <div className="text-xs text-taupe mb-2 uppercase tracking-wide">Trader Profile</div>
          <div className="text-lg md:text-xl font-bold text-cream break-all pr-8">{truncateAddress(trader.accountId)}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded bg-cream/10 text-taupe">No active positions</span>
            {!trader.isCached && (
              <span className="text-xs text-taupe/50">Syncing...</span>
            )}
          </div>
          <a
            href={`https://pikespeak.ai/wallet-explorer/${trader.accountId}?tab=global`}
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
          <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Total Realized P&L</div>
          <div className={`text-3xl md:text-4xl font-bold ${trader.realizedPnL >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'}`}>
            {trader.realizedPnL >= 0 ? '+' : ''}{formatCurrency(trader.realizedPnL)}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-px bg-cream/10 border-b border-cream/10">
          <div className="bg-[#0a0a0c] p-3 md:p-4">
            <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Win Rate</div>
            <div className="text-xl md:text-2xl font-bold text-lime">{trader.winRate.toFixed(1)}%</div>
            <div className="text-xs text-taupe mt-1">{trader.winningTrades}W / {trader.losingTrades}L</div>
          </div>
          <div className="bg-[#0a0a0c] p-3 md:p-4">
            <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Total Trades</div>
            <div className="text-xl md:text-2xl font-bold text-cream">{trader.totalTrades}</div>
            <div className="text-xs text-taupe mt-1">All closed</div>
          </div>
          <div className="bg-[#0a0a0c] p-3 md:p-4">
            <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Total Volume</div>
            <div className="text-xl md:text-2xl font-bold text-cream">{formatCurrency(trader.totalVolume)}</div>
          </div>
          <div className="bg-[#0a0a0c] p-3 md:p-4">
            <div className="text-xs text-taupe mb-1 uppercase tracking-wide">Last Trade</div>
            <div className="text-sm font-bold text-cream">
              {trader.lastTradeDate 
                ? new Date(trader.lastTradeDate).toLocaleDateString()
                : 'N/A'
              }
            </div>
          </div>
        </div>

        {/* P&L Chart */}
        {trader.closedPositions && trader.closedPositions.length > 0 && (
          <div className="p-4 md:p-6 border-b border-cream/10">
            <div className="text-xs text-taupe mb-3 uppercase tracking-wide">P&L Progression</div>
            <PnLChartSimple closedPositions={trader.closedPositions} />
          </div>
        )}

        {/* Recent Trades */}
        {trader.closedPositions && trader.closedPositions.length > 0 && (
          <div className="p-4 md:p-6">
            <h3 className="text-xs md:text-sm font-semibold text-cream mb-3 uppercase tracking-wide">
              Recent Trades ({trader.closedPositions.length})
            </h3>
            <div className="space-y-2">
              {trader.closedPositions.slice(0, 10).map((pos: any, i: number) => {
                const pnl = parseFloat(pos.pnl || '0');
                return (
                  <div key={i} className="py-2 px-3 bg-cream/[0.02] rounded border border-cream/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          pos.trend === 'LONG' || pos.trend === 'long' ? 'bg-accent-green/20 text-accent-green' : 'bg-slate/20 text-slate'
                        }`}>
                          {pos.trend?.toUpperCase()}
                        </span>
                      </div>
                      <span className={`text-xs md:text-sm font-semibold ${pnl >= 0 ? 'text-accent-green' : 'text-[#ff6b6b]'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                      </span>
                    </div>
                    <div className="text-xs text-taupe">
                      {new Date(pos.close_timestamp).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Simple inline chart to avoid import issues
function PnLChartSimple({ closedPositions }: { closedPositions: any[] }) {
  // Calculate cumulative P&L
  let cumulative = 0;
  const data = closedPositions
    .filter(p => p.close_timestamp > 0)
    .sort((a, b) => a.close_timestamp - b.close_timestamp)
    .map(pos => {
      cumulative += parseFloat(pos.pnl || '0');
      return {
        date: new Date(pos.close_timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pnl: cumulative
      };
    });

  if (data.length === 0) return <div className="h-48 flex items-center justify-center text-taupe text-sm">No data</div>;

  const min = Math.min(...data.map(d => d.pnl), 0);
  const max = Math.max(...data.map(d => d.pnl), 0);
  const range = max - min || 1;

  const formatValue = (v: number) => {
    if (Math.abs(v) >= 1000) return `$${(v/1000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  const finalPnL = data[data.length - 1]?.pnl || 0;
  const color = finalPnL >= 0 ? '#4ade80' : '#ff6b6b';

  return (
    <div className="h-48 w-full relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-taupe">
        <span>{formatValue(max)}</span>
        <span>$0</span>
        <span>{formatValue(min)}</span>
      </div>

      {/* Chart area */}
      <div className="ml-10 h-full relative">
        <svg className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="0" x2="100%" y2="0" stroke="#333" strokeDasharray="2" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#444" strokeDasharray="3" />
          <line x1="0" y1="100%" x2="100%" y2="100%" stroke="#333" strokeDasharray="2" />

          {/* Line */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            points={data.map((d, i) => {
              const x = (i / (data.length - 1 || 1)) * 100;
              const y = ((max - d.pnl) / range) * 100;
              return `${x}%,${y}%`;
            }).join(' ')}
          />
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-taupe">
          <span>{data[0]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
}
