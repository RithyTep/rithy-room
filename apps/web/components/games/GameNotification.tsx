'use client';

import { Icon } from '@iconify/react';
import type { GameItem } from '@rithy-room/shared';

interface GameNotificationProps {
  game: GameItem;
  startedByName: string;
  onJoin: () => void;
  onDismiss: () => void;
}

export function GameNotification({
  game,
  startedByName,
  onJoin,
  onDismiss,
}: GameNotificationProps) {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="glass-panel rounded-xl p-4 flex items-center gap-4 shadow-2xl border border-[var(--accent)]/20">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 shrink-0">
          <img
            src={game.thumbnail}
            alt={game.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = `https://placehold.co/56x56/1e293b/64748b?text=${encodeURIComponent(game.name[0])}`;
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">
            <span className="font-medium">{startedByName}</span> started playing
          </p>
          <p className="text-xs text-[var(--accent)] font-medium truncate">
            {game.name}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onJoin}
            className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Join
          </button>
          <button
            onClick={onDismiss}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <Icon icon="solar:close-circle-linear" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
