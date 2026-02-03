'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { generateAvatarUrl, cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import { useMediaStore } from '@/stores/media';
import { useSocket } from '@/hooks/useSocket';
import { SettingsModal } from '@/components/ui/SettingsModal';
import type { Member } from '@rithy-room/shared';

interface UsersPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

function UserItem({
  member,
  isCurrentUser,
  isInCall,
}: {
  member: Member;
  isCurrentUser?: boolean;
  isInCall?: boolean;
}) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-xl transition-all group text-left',
        isCurrentUser
          ? 'bg-white/[0.02] border border-white/5'
          : 'hover:bg-white/5',
        !member.online && 'opacity-50 grayscale hover:grayscale-0'
      )}
    >
      <div className="relative">
        <img
          src={member.avatarUrl || generateAvatarUrl(member.name)}
          alt={member.name}
          className="w-8 h-8 rounded-lg object-cover"
        />
        {member.online && (
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-black rounded-full flex items-center justify-center">
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isCurrentUser ? 'bg-[var(--accent)] animate-pulse' : 'bg-emerald-500'
              )}
            />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-xs font-medium truncate transition-colors',
            isCurrentUser
              ? 'text-[var(--accent)]'
              : member.online
                ? 'text-slate-300 group-hover:text-white'
                : 'text-slate-400'
          )}
        >
          {member.name}
        </div>
        <div className="text-[10px] text-slate-600">
          {isCurrentUser ? 'You' : isInCall ? 'In voice' : ''}
        </div>
      </div>
    </button>
  );
}

export function UsersPanel({ isOpen = true, onClose, isMobile }: UsersPanelProps) {
  const { room, members, currentMemberId, reset } = useRoomStore();
  const { isInCall, callParticipants, setViewMode } = useMediaStore();
  const { updateProfile } = useSocket();
  const [showSettings, setShowSettings] = useState(false);

  const onlineMembers = members.filter((m) => m.online);
  const offlineMembers = members.filter((m) => !m.online);
  const currentMember = members.find((m) => m.id === currentMemberId);

  const handleProfileUpdate = async (name?: string, avatarUrl?: string): Promise<boolean> => {
    const success = await updateProfile(name, avatarUrl);
    if (success && name) {
      window.location.reload();
    }
    return success;
  };

  const handleLeaveRoom = () => {
    reset();
    window.location.href = '/';
  };

  const handleJoinVoice = () => {
    setViewMode('call');
  };

  const panelClasses = isMobile
    ? cn(
        'fixed inset-y-0 right-0 w-[260px] glass-panel border-l border-white/5 z-40 flex flex-col transition-transform duration-300',
        isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'
      )
    : 'hidden md:flex w-[260px] glass-panel rounded-2xl flex-col';

  return (
    <>
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentName={currentMember?.name || ''}
        currentAvatarUrl={currentMember?.avatarUrl}
        onProfileUpdate={handleProfileUpdate}
        onLeaveRoom={handleLeaveRoom}
      />

      <aside className={panelClasses}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/5">
          <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
            Online — {onlineMembers.length}
          </span>
          {isMobile && onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <Icon icon="solar:close-circle-linear" width={20} />
            </button>
          )}
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Online Members */}
          {onlineMembers.map((member) => (
            <UserItem
              key={member.id}
              member={member}
              isCurrentUser={member.id === currentMemberId}
              isInCall={callParticipants.includes(member.id)}
            />
          ))}

          {/* Offline Section */}
          {offlineMembers.length > 0 && (
            <>
              <div className="pt-6 px-2 pb-2">
                <span className="text-[10px] font-medium text-slate-600 tracking-wide uppercase">
                  Offline — {offlineMembers.length}
                </span>
              </div>
              {offlineMembers.map((member) => (
                <UserItem key={member.id} member={member} />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 space-y-3">
          {/* Join Voice Button */}
          <button
            onClick={handleJoinVoice}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors text-sm font-medium"
          >
            <Icon icon="solar:phone-linear" width={18} />
            <span>{isInCall ? 'Return to Call' : 'Join Voice'}</span>
          </button>

          {/* Voice Active Indicator */}
          <div className="flex items-center justify-between text-[10px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  callParticipants.length > 0 ? 'bg-emerald-500/50' : 'bg-slate-600'
                )}
              />
              <span>
                {callParticipants.length > 0
                  ? `${callParticipants.length} in voice`
                  : 'No one in voice'}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <Icon icon="solar:settings-linear" width={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
