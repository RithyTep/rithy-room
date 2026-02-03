'use client';

import { Icon } from '@iconify/react';
import type { GameItem } from '@rithy-room/shared';

interface GamePlayerProps {
  game: GameItem;
  onClose: () => void;
}

export function GamePlayer({ game, onClose }: GamePlayerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <header className="h-12 bg-black/90 backdrop-blur-sm border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Icon icon="solar:gamepad-bold" className="w-5 h-5 text-[var(--accent)]" />
          <span className="text-white font-medium">{game.name}</span>
          <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">
            {game.maxPlayers === 'Unlimited' ? 'Unlimited' : `Up to ${game.maxPlayers}`} players
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <Icon icon="solar:close-circle-linear" className="w-4 h-4" />
          <span className="text-sm">Exit Game</span>
        </button>
      </header>

      {/* Game iframe */}
      <iframe
        src={game.url}
        className="flex-1 w-full border-0"
        allow="fullscreen; autoplay; microphone; camera; gamepad"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-pointer-lock"
      />
    </div>
  );
}
