'use client';

import { Icon } from '@iconify/react';
import { generateAvatarUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';

type NavItem = 'chat' | 'notifications' | 'files';

interface NavRailProps {
  activeItem?: NavItem;
  onItemClick?: (item: NavItem) => void;
  userAvatarUrl?: string;
  userName?: string;
  onUserClick?: () => void;
}

export function NavRail({
  activeItem = 'chat',
  onItemClick,
  userAvatarUrl,
  userName,
  onUserClick,
}: NavRailProps) {
  const navItems: { id: NavItem; icon: string; label: string }[] = [
    { id: 'chat', icon: 'solar:chat-round-line-linear', label: 'Chat' },
    { id: 'notifications', icon: 'solar:bell-linear', label: 'Notifications' },
    { id: 'files', icon: 'solar:folder-open-linear', label: 'Files' },
  ];

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
        {navItems.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <div key={item.id} className="group relative">
              {isActive && (
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-[var(--accent)] rounded-r-full shadow-[0_0_10px_var(--accent)]" />
              )}
              <button
                onClick={() => onItemClick?.(item.id)}
                className={cn(
                  'w-full aspect-square rounded-xl flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                )}
                title={item.label}
              >
                <Icon icon={item.icon} width={22} />
              </button>
            </div>
          );
        })}
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
