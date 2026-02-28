'use client';

import { useState, useEffect } from 'react';

interface TraderSearchProps {
  onTraderFound: (trader: any) => void;
}

export default function TraderSearch({ onTraderFound }: TraderSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!query || query.length < 10) {
      setError(null);
      return;
    }

    const debounce = setTimeout(async () => {
      setIsSearching(true);
      setError(null);

      try {
        const res = await fetch(`/api/trader?address=${encodeURIComponent(query)}`);
        
        if (!res.ok) {
          throw new Error('Trader not found');
        }

        const data = await res.json();

        if (data.totalTrades === 0 && !data.isCached) {
          setError('No trading history found for this address');
          setIsSearching(false);
          return;
        }

        onTraderFound(data);
        setQuery('');
        setShowSearch(false);
      } catch (e) {
        setError('Address not found or invalid');
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(debounce);
  }, [query, onTraderFound]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="relative">
      {/* Search Toggle */}
      <button
        onClick={() => setShowSearch(!showSearch)}
        className={`p-2 rounded-lg transition-colors ${
          showSearch 
            ? 'bg-lime/20 text-lime' 
            : 'bg-cream/5 text-taupe hover:bg-cream/10'
        }`}
        title="Search trader by address"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Search Dropdown */}
      {showSearch && (
        <div className="absolute right-0 top-12 w-80 md:w-96 bg-[#16161b] border border-cream/10 rounded-lg shadow-xl z-50 p-4">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter NEAR address..."
                autoFocus
                className="w-full px-4 py-2 pr-10 bg-slate-800 border border-slate-600 rounded-lg text-cream text-sm placeholder:text-slate-400 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400/50"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-lime/30 border-t-lime rounded-full animate-spin" />
                </div>
              )}
            </div>
          </form>

          {error && (
            <p className="mt-2 text-xs text-[#ff6b6b]">{error}</p>
          )}

          <div className="mt-3 pt-3 border-t border-cream/10">
            <p className="text-xs text-taupe">
              Search any NEAR address to view their trading history, even if they have no active positions.
            </p>
          </div>

          {/* Recent searches (from localStorage) */}
          <RecentSearches onSelect={(addr) => setQuery(addr)} />
        </div>
      )}
    </div>
  );
}

function RecentSearches({ onSelect }: { onSelect: (addr: string) => void }) {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('recentTraders');
    if (saved) {
      setRecent(JSON.parse(saved).slice(0, 5));
    }
  }, []);

  if (recent.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-cream/10">
      <p className="text-xs text-taupe mb-2">Recent:</p>
      <div className="space-y-1">
        {recent.map((addr) => (
          <button
            key={addr}
            onClick={() => onSelect(addr)}
            className="w-full text-left px-2 py-1 text-xs text-cream/70 hover:text-lime hover:bg-cream/5 rounded transition-colors truncate"
          >
            {addr.length > 32 ? `${addr.slice(0, 12)}...${addr.slice(-8)}` : addr}
          </button>
        ))}
      </div>
    </div>
  );
}
