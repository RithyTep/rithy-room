'use client';

import { MessageSquare, Users, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaStore } from '@/stores/media';

export type MobileView = 'chat' | 'members' | 'call';

interface MobileNavProps {
  activeView: MobileView;
  onViewChange: (view: MobileView) => void;
}

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  const { isInCall } = useMediaStore();

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { id: 'members' as const, label: 'Members', icon: Users },
    { id: 'call' as const, label: 'Call', icon: Phone },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#161618] border-t border-[#242426] safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full min-w-[44px] transition-colors',
              activeView === id
                ? 'text-[#6E56CF]'
                : 'text-[#666] active:text-[#888]'
            )}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {id === 'call' && isInCall && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#4ADE80] rounded-full border-2 border-[#161618]" />
              )}
            </div>
            <span className="text-[10px] mt-1 font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
