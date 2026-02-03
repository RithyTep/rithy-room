'use client';

import { useState } from 'react';
import { Settings, Mic, MicOff, Headphones, HeadphoneOff } from 'lucide-react';
import { useRoomStore } from '@/stores/room';
import { useMediaStore } from '@/stores/media';
import { useSocket } from '@/hooks/useSocket';
import { MemberItem } from './MemberItem';
import { SettingsModal } from '@/components/ui/SettingsModal';
import { generateAvatarUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface MemberListProps {
  isMobile?: boolean;
}

export function MemberList({ isMobile }: MemberListProps) {
  const { room, members, currentMemberId, reset } = useRoomStore();
  const { isMuted, isDeafened, setMuted, setDeafened, localStream } = useMediaStore();
  const { updateProfile } = useSocket();
  const [showSettings, setShowSettings] = useState(false);

  const onlineMembers = members.filter((m) => m.online);
  const offlineMembers = members.filter((m) => !m.online);
  const currentMember = members.find((m) => m.id === currentMemberId);

  const handleProfileUpdate = async (name?: string, avatarUrl?: string): Promise<boolean> => {
    const success = await updateProfile(name, avatarUrl);
    if (success && name) {
      // Reload the page to rejoin with new name
      window.location.reload();
    }
    return success;
  };

  const handleLeaveRoom = () => {
    reset();
    window.location.href = '/';
  };

  const handleToggleMute = () => {
    if (localStream) {
      setMuted(!isMuted);
    }
  };

  const handleToggleDeafen = () => {
    setDeafened(!isDeafened);
    // When deafening, also mute
    if (!isDeafened) {
      setMuted(true);
    }
  };

  const getAvatarUrl = (member: typeof currentMember) => {
    return member?.avatarUrl || generateAvatarUrl(member?.name || '');
  };

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
      <aside
        className={
          isMobile
            ? 'flex flex-col h-full bg-[#161618]'
            : 'hidden md:flex w-64 bg-[#161618] border-r border-[#242426] flex-col shrink-0'
        }
      >
        {/* Room Header */}
        <div className="h-14 flex items-center px-5 border-b border-[#242426]">
          <div className="w-2 h-2 rounded-full bg-[#6E56CF] mr-3" />
          <h1 className="font-medium text-[15px] tracking-tight text-white truncate">
            {room?.slug || 'Room'}
          </h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setShowSettings(true)} title="Settings">
              <Settings className="w-[18px] h-[18px] text-[#555] hover:text-[#EDEDED] cursor-pointer transition-colors" />
            </button>
          </div>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {onlineMembers.length > 0 && (
            <>
              <div className="px-2 py-2 text-[11px] font-medium text-[#555] uppercase tracking-wider">
                Active — {onlineMembers.length}
              </div>
              {onlineMembers.map((member) => (
                <MemberItem
                  key={member.id}
                  member={member}
                  isCurrentUser={member.id === currentMemberId}
                />
              ))}
            </>
          )}

          {offlineMembers.length > 0 && (
            <>
              <div className="px-2 py-2 text-[11px] font-medium text-[#555] uppercase tracking-wider mt-4">
                Offline — {offlineMembers.length}
              </div>
              {offlineMembers.map((member) => (
                <MemberItem key={member.id} member={member} />
              ))}
            </>
          )}
        </div>

        {/* Current User Profile */}
        {currentMember && (
          <div className="p-3 border-t border-[#242426]">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-[#1C1C1E]">
              <img
                src={getAvatarUrl(currentMember)}
                alt={currentMember.name}
                className="w-8 h-8 rounded-full bg-[#333] object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-white truncate">
                  {currentMember.name}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleToggleMute}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    isMuted
                      ? 'text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20'
                      : 'text-[#888] hover:text-white hover:bg-[#2A2A2A]'
                  )}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleToggleDeafen}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    isDeafened
                      ? 'text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20'
                      : 'text-[#888] hover:text-white hover:bg-[#2A2A2A]'
                  )}
                  title={isDeafened ? 'Undeafen' : 'Deafen'}
                >
                  {isDeafened ? (
                    <HeadphoneOff className="w-4 h-4" />
                  ) : (
                    <Headphones className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
