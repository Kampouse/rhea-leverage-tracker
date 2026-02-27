'use client';

import { useState } from 'react';
import { Position } from './actions';
import UserStatsPanel from './UserStatsPanel';

interface UserStatsPanelClientProps {
  positions: Position[];
}

export default function UserStatsPanelClient({ positions }: UserStatsPanelClientProps) {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  // Inject click handler into position rows
  if (typeof window !== 'undefined') {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const row = target.closest('[data-account-id]');
      if (row) {
        const accountId = row.getAttribute('data-account-id');
        if (accountId) {
          const position = positions.find(p => p.accountId === accountId);
          if (position) {
            setSelectedPosition(position);
          }
        }
      }
    });
  }

  return (
    <>
      {selectedPosition && (
        <UserStatsPanel
          position={selectedPosition}
          onClose={() => setSelectedPosition(null)}
          allPositions={positions}
        />
      )}
    </>
  );
}
