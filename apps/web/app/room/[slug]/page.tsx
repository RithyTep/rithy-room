'use client';

import { useEffect, useState, useRef, use } from 'react';
import { Loader2 } from 'lucide-react';
import { Icon } from '@iconify/react';
import { useSocket } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/room';
import { useMediaStore } from '@/stores/media';
import { JoinScreen } from '@/components/layout/JoinScreen';
import { NavRail } from '@/components/layout/NavRail';
import { ChatPanel } from '@/components/layout/ChatPanel';
import { UsersPanel } from '@/components/layout/UsersPanel';
import { CallView } from '@/components/video/CallView';
import { SettingsModal } from '@/components/ui/SettingsModal';
import { getSession, saveSession } from '@/lib/session';
import { generateAvatarUrl } from '@/lib/utils';

interface RoomPageProps {
  params: Promise<{ slug: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { slug } = use(params);
  const { joinRoom, updateProfile } = useSocket();
  const { room, isConnected, isJoining, error, members, currentMemberId, reset } = useRoomStore();
  const { viewMode } = useMediaStore();

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const joinAttempted = useRef(false);

  const currentMember = members.find((m) => m.id === currentMemberId);

  // Check for saved session on mount
  useEffect(() => {
    const savedName = getSession();
    setHasSession(!!savedName);
  }, []);

  // Auto-join when connected and have a saved name
  useEffect(() => {
    const savedName = getSession();
    if (isConnected && savedName && !room && !joinAttempted.current && !isJoining) {
      joinAttempted.current = true;
      joinRoom(slug, savedName);
    }
  }, [isConnected, room, slug, joinRoom, isJoining]);

  const handleJoin = (name: string) => {
    if (name.trim() && isConnected && !isJoining) {
      joinAttempted.current = true;
      saveSession(name.trim());
      joinRoom(slug, name.trim());
    }
  };

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

  // Show minimal loading when auto-rejoining
  if (!room && hasSession && !error) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          <span className="text-[13px] text-slate-500">Rejoining {slug}...</span>
        </div>
      </div>
    );
  }

  // Show join screen for new users
  if (!room) {
    // Still checking for session
    if (hasSession === null) {
      return (
        <div className="h-screen w-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
        </div>
      );
    }

    return (
      <JoinScreen
        roomSlug={slug}
        isConnected={isConnected}
        isJoining={isJoining}
        error={error}
        onJoin={handleJoin}
      />
    );
  }

  // Show call view if in call mode
  if (viewMode === 'call') {
    return <CallView />;
  }

  // Main chat view
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

      <div className="h-screen w-full overflow-hidden flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden h-14 border-b border-white/5 flex items-center justify-between px-4 bg-black/20 backdrop-blur-md shrink-0 z-30">
          <button onClick={() => setShowSettings(true)} className="text-slate-400">
            <Icon icon="solar:settings-linear" width={24} />
          </button>
          <span className="font-medium text-white">#{slug}</span>
          <button className="text-slate-400" onClick={() => setShowUserPanel(true)}>
            <Icon icon="solar:users-group-rounded-linear" width={24} />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Layout */}
          <div className="hidden md:flex h-full w-full max-w-[1600px] mx-auto p-6 gap-5">
            {/* Nav Rail */}
            <NavRail
              userAvatarUrl={currentMember?.avatarUrl || generateAvatarUrl(currentMember?.name || '')}
              userName={currentMember?.name}
              onUserClick={() => setShowSettings(true)}
            />

            {/* Chat Panel */}
            <ChatPanel
              roomSlug={slug}
              onToggleUsers={() => setShowUserPanel(true)}
            />

            {/* Users Panel - Desktop */}
            <UsersPanel />
          </div>

          {/* Mobile Chat */}
          <div className="md:hidden flex-1 flex flex-col overflow-hidden pb-14">
            <ChatPanel
              roomSlug={slug}
              onToggleUsers={() => setShowUserPanel(true)}
              isMobile
            />
          </div>
        </div>

        {/* Users Panel - Mobile Overlay */}
        <UsersPanel
          isMobile
          isOpen={showUserPanel}
          onClose={() => setShowUserPanel(false)}
        />

        {/* Mobile Bottom Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-black/40 backdrop-blur-md border-t border-white/5 flex items-center justify-around px-6 safe-area-bottom z-20">
          <button className="flex flex-col items-center gap-1 text-[var(--accent)]">
            <Icon icon="solar:chat-round-line-linear" width={22} />
            <span className="text-[10px]">Chat</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors">
            <Icon icon="solar:phone-linear" width={22} />
            <span className="text-[10px]">Call</span>
          </button>
          <button
            onClick={() => setShowUserPanel(true)}
            className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Icon icon="solar:users-group-rounded-linear" width={22} />
            <span className="text-[10px]">Members</span>
          </button>
        </div>
      </div>
    </>
  );
}
