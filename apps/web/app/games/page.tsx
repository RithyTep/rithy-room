'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { GAMES_CATALOG, GAME_CATEGORIES, filterGames, type GameCategory } from '@/lib/games';

export default function GamesPage() {
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGames = useMemo(
    () => filterGames(GAMES_CATALOG, selectedCategory, searchQuery),
    [selectedCategory, searchQuery]
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
              </Link>
              <Icon icon="solar:gamepad-bold" className="w-6 h-6 text-[var(--accent)]" />
              <h1 className="text-lg font-semibold text-white">Games</h1>
              <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">
                {filteredGames.length} games
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Search & Categories */}
      <div className="sticky top-[65px] z-10 bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
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
      </div>

      {/* Games Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Icon icon="solar:gamepad-broken" className="w-16 h-16 mb-4 opacity-50" />
            <p>No games found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredGames.map((game) => {
              const isPopular = game.tags.includes('popular');
              return (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
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
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-slate-500">
            Play retro games directly in your browser. Powered by RetroGames.cc emulators.
          </p>
        </div>
      </footer>
    </div>
  );
}
