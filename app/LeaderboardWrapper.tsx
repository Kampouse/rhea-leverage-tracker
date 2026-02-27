'use client';

import { useState } from 'react';
import { Position } from './actions';
import UserStatsPanel from './UserStatsPanel';

interface LeaderboardWrapperProps {
  children: React.ReactNode;
  allPositions: Position[];
}

export default function LeaderboardWrapper({ children, allPositions }: LeaderboardWrapperProps) {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  return (
    <>
      {/* Pass click handler to children via context or clone element */}
      <div onClick={(e) => {
        const target = e.target as HTMLElement;
        const accountId = target.getAttribute('data-account-id');
        if (accountId) {
          const position = allPositions.find(p => p.accountId === accountId);
          if (position) setSelectedPosition(position);
        }
      }}>
        {children}
      </div>

      {/* User Stats Panel */}
      {selectedPosition && (
        <UserStatsPanel
          position={selectedPosition}
          onClose={() => setSelectedPosition(null)}
          allPositions={allPositions}
        />
      )}
    </>
  );
}
