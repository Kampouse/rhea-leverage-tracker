'use client';

import { useState, useEffect, useCallback } from 'react';
import { Position, forceRefresh } from './actions';

interface PositionTableProps {
  initialPositions: Position[];
  initialTimestamp: number;
}

export default function PositionTable({ initialPositions, initialTimestamp }: PositionTableProps) {
  const [positions, setPositions] = useState(initialPositions);
  const [lastUpdate, setLastUpdate] = useState(new Date(initialTimestamp));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await forceRefresh();
      window.location.reload();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, handleRefresh]);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const filteredPositions = positions.filter(pos => 
    pos.accountId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pos.positionToken.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pos.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section className="section">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">All Positions</h2>
        
        <div className="flex items-center gap-2 md:gap-3">
          {/* Search Toggle Button */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-md transition-colors ${
              showSearch || searchTerm
                ? 'bg-lime/20 text-lime' 
                : 'bg-cream/5 text-taupe hover:bg-cream/10'
            }`}
            title="Search"
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Search Input (collapsible) */}
          {showSearch && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="pl-3 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400/50 w-32 md:w-48"
              />
            </div>
          )}
          
          {/* Results count */}
          {searchTerm && (
            <span className="text-xs text-taupe min-w-[50px] md:min-w-[60px]">
              {filteredPositions.length}/{positions.length}
            </span>
          )}
          
          {/* Timestamp */}
          <span className="text-xs text-taupe hidden md:inline min-w-[90px]">
            {formatTime(lastUpdate)}
          </span>
          
          {/* Auto toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              autoRefresh 
                ? 'bg-forest/30 text-accent-green' 
                : 'bg-cream/5 text-taupe'
            }`}
          >
            {autoRefresh ? 'Auto ✓' : 'Auto'}
          </button>
          
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-2 md:px-3 py-1 rounded-md bg-lime/15 text-lime text-xs font-medium hover:bg-lime/25 transition-colors disabled:opacity-50"
          >
            {isRefreshing ? '...' : '↻'}
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="text-left">Rank</th>
              <th className="text-left">Account</th>
              <th className="text-left">Type</th>
              <th className="text-left">Collateral</th>
              <th className="text-left">Token</th>
              <th className="text-left">Entry</th>
              <th className="text-right">Current</th>
              <th className="text-right">PnL ($)</th>
              <th className="text-right">Leverage</th>
            </tr>
          </thead>
          <tbody>
            {filteredPositions.slice(0, 100).map((pos, i) => (
              <tr key={pos.posId} data-account-id={pos.accountId} className="cursor-pointer hover:bg-cream/[0.02] transition-colors">
                <td>
                  <span className="text-taupe text-sm">{i + 1}</span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span 
                      className="font-medium text-cream account-id hover:text-lime transition-colors"
                      title={`${pos.accountId} (click for details)`}
                    >
                      {pos.accountId.length > 24 
                        ? `${pos.accountId.slice(0, 12)}...${pos.accountId.slice(-9)}`
                        : pos.accountId
                      }
                    </span>
                    <a
                      href={`https://pikespeak.ai/wallet-explorer/${pos.accountId}?tab=global`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-taupe/50 hover:text-lime transition-colors"
                      title="View on Pikespeak"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </td>
                <td>
                  <span className={`token-badge ${pos.type.toLowerCase()}`}>
                    {pos.type}
                  </span>
                </td>
                <td>
                  <span className="amount">{formatCurrency(pos.collateralValue)}</span>
                </td>
                <td>
                  <span className="text-cream/70">{pos.positionToken}</span>
                </td>
                <td className="text-left">
                  <span className="text-xs text-taupe">
                    {pos.entryPrice ? `$${pos.entryPrice.toFixed(2)}` : '-'}
                  </span>
                </td>
                <td className="text-right">
                  <span className="text-xs text-cream">
                    ${pos.currentPrice.toFixed(2)}
                  </span>
                </td>
                <td className="text-right">
                  <span className={`pnl ${pos.pnl >= 0 ? 'positive' : 'negative'}`}>
                    {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                  </span>
                </td>
                <td className="text-right">
                  <span className="leverage">{pos.leverage.toFixed(1)}x</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredPositions.length > 100 && (
        <div className="text-center text-taupe text-sm mt-4">
          Showing top 100 of {filteredPositions.length} positions
        </div>
      )}
    </section>
  );
}
