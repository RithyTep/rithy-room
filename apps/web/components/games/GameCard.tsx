'use client';

import { Icon } from '@iconify/react';
import type { GameItem } from '@rithy-room/shared';

interface GameCardProps {
  game: GameItem;
  onSelect: (game: GameItem) => void;
}

export function GameCard({ game, onSelect }: GameCardProps) {
  const isPopular = game.tags.includes('popular');

  return (
    <button
      onClick={() => onSelect(game)}
      className="glass-panel rounded-xl overflow-hidden group cursor-pointer text-left transition-all hover:border-[var(--accent)]/30 hover:shadow-[0_0_30px_rgba(110,168,255,0.1)]"
    >
      <div className="relative aspect-video bg-slate-800/50">
        <img
          src={game.thumbnail}
          alt={game.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://placehold.co/400x225/1e293b/64748b?text=${encodeURIComponent(game.name)}`;
          }}
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Icon
            icon="solar:play-circle-bold"
            className="w-14 h-14 text-white drop-shadow-lg"
          />
        </div>
        {isPopular && (
          <span className="absolute top-2 left-2 bg-amber-500 text-black text-xs font-medium px-2 py-0.5 rounded">
            Top
          </span>
        )}
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded backdrop-blur-sm">
          {game.maxPlayers === 'Unlimited' ? '∞' : game.maxPlayers} players
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-white truncate">{game.name}</h3>
        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
          {game.description}
        </p>
      </div>
    </button>
  );
}
