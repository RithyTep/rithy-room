'use client';

import { use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@iconify/react';
import { GAMES_CATALOG } from '@/lib/games';

interface GamePageProps {
  params: Promise<{ gameId: string }>;
}

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params);
  const game = GAMES_CATALOG.find((g) => g.id === gameId);

  if (!game) {
    notFound();
  }

  return (
    <div className="h-screen w-screen bg-black flex flex-col">
      {/* Header */}
      <header className="h-12 bg-black/90 backdrop-blur-sm border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/games"
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          </Link>
          <Icon icon="solar:gamepad-bold" className="w-5 h-5 text-[var(--accent)]" />
          <span className="text-white font-medium">{game.name}</span>
          <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">
            {game.maxPlayers === 'Unlimited' ? 'Unlimited' : `Up to ${game.maxPlayers}`} players
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/games"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <Icon icon="solar:close-circle-linear" className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Exit Game</span>
          </Link>
        </div>
      </header>

      {/* Game iframe */}
      <iframe
        src={game.url}
        className="flex-1 w-full border-0"
        allow="fullscreen; autoplay; microphone; camera; gamepad; accelerometer; gyroscope"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
