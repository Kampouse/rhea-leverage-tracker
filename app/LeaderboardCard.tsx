'use client';

import { Position } from './actions';

interface LeaderboardCardProps {
  title: string;
  icon: string;
  badge: string;
  badgeClass: string;
  positions: Position[];
}

export default function LeaderboardCard({ title, icon, badge, badgeClass, positions }: LeaderboardCardProps) {
  const truncateAddress = (address: string) => {
    if (address.length <= 24) return address;
    return `${address.slice(0, 12)}...${address.slice(-9)}`;
  };

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="card">
      <div className="section-header">
        <h2 className="section-title flex items-center gap-2">
          <span>{icon}</span>
          {title}
        </h2>
        <span className={badgeClass}>{badge}</span>
      </div>
      <div className="space-y-3">
        {positions.slice(0, 5).map((pos, i) => (
          <div key={pos.posId} className="flex items-center justify-between p-3 rounded-lg bg-cream/[0.02] hover:bg-cream/[0.04] transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold text-sm ${badge.includes('Best') ? 'rank-top' : 'rank-worst'}`}>
                {i + 1}
              </div>
              <div>
                <p 
                  className="font-medium text-sm text-cream cursor-pointer hover:text-lime transition-colors" 
                  title={`${pos.accountId} (click to copy)`}
                  onClick={() => copyToClipboard(pos.accountId)}
                >
                  {truncateAddress(pos.accountId)}
                </p>
                <p className="text-xs text-taupe">{pos.type} • {pos.leverage.toFixed(1)}x</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-semibold ${badge.includes('Best') ? 'text-accent-green' : 'text-[#ff6b6b]'}`}>
                {formatCurrency(pos.pnl)}
              </p>
              <p className="text-xs text-taupe">{pos.positionToken}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
