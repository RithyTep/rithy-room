'use client';

import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { GameItem } from '@rithy-room/shared';
import { GAMES_CATALOG, GAME_CATEGORIES, filterGames, type GameCategory } from '@/lib/games';
import { GameCard } from './GameCard';

interface GameBrowserProps {
  onSelectGame: (game: GameItem) => void;
  onClose: () => void;
}

export function GameBrowser({ onSelectGame, onClose }: GameBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGames = useMemo(
    () => filterGames(GAMES_CATALOG, selectedCategory, searchQuery),
    [selectedCategory, searchQuery]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-5xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Icon icon="solar:gamepad-bold" className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold text-white">Games</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <Icon icon="solar:close-circle-linear" className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="px-6 py-4 border-b border-white/5 space-y-4">
          {/* Search */}
          <div className="relative">
            <Icon
              icon="solar:magnifer-linear"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 flex-wrap">
            {GAME_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === category.id
                    ? 'bg-[var(--accent)] text-black'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Games Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Icon icon="solar:gamepad-broken" className="w-16 h-16 mb-4 opacity-50" />
              <p>No games found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredGames.map((game) => (
                <GameCard key={game.id} game={game} onSelect={onSelectGame} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5 text-center">
          <p className="text-xs text-slate-500">
            Play together with room members - find each other in the game lobby!
          </p>
        </div>
      </div>
    </div>
  );
}
