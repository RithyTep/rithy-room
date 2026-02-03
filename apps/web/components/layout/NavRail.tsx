'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { generateAvatarUrl } from '@/lib/utils';

interface NavRailProps {
  userAvatarUrl?: string;
  userName?: string;
  onUserClick?: () => void;
}

export function NavRail({
  userAvatarUrl,
  userName,
  onUserClick,
}: NavRailProps) {
  return (
    <nav className="hidden md:flex glass-panel w-[72px] rounded-2xl flex-col items-center py-6 gap-6 shrink-0 z-20">
      {/* Brand */}
      <button className="w-10 h-10 flex items-center justify-center text-white hover:text-[var(--accent)] transition-colors">
        <Icon icon="solar:infinity-bold" width={26} />
      </button>

      {/* Separator */}
      <div className="w-8 h-px bg-white/5" />

      {/* Navigation Items */}
      <div className="flex flex-col gap-4 w-full px-3">
        {/* Chat - Active */}
        <div className="group relative">
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-[var(--accent)] rounded-r-full shadow-[0_0_10px_var(--accent)]" />
          <button
            className="w-full aspect-square rounded-xl flex items-center justify-center transition-all bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
            title="Chat"
          >
            <Icon icon="solar:chat-round-line-linear" width={22} />
          </button>
        </div>

        {/* Games */}
        <Link
          href="/games"
          className="w-full aspect-square rounded-xl flex items-center justify-center transition-all bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
          title="Games"
        >
          <Icon icon="solar:gamepad-linear" width={22} />
        </Link>
      </div>

      {/* Bottom User Avatar */}
      <div className="mt-auto flex flex-col gap-4 items-center">
        <button
          onClick={onUserClick}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 p-[1px] group overflow-hidden"
          title="Settings"
        >
          <img
            src={userAvatarUrl || generateAvatarUrl(userName || '')}
            alt={userName || 'User'}
            className="w-full h-full rounded-full object-cover group-hover:opacity-80 transition-opacity"
          />
        </button>
      </div>
    </nav>
  );
}
