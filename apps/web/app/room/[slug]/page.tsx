'use client';

import { useEffect, useState, useRef, use } from 'react';
import { Users, Mic, MicOff, Video, VideoOff, Loader2 } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/room';
import { MemberList } from '@/components/members/MemberList';
import { MessageList } from '@/components/chat/MessageList';
import { VideoGrid } from '@/components/video/VideoGrid';
import { MobileNav, type MobileView } from '@/components/mobile/MobileNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSession, saveSession } from '@/lib/session';

interface RoomPageProps {
  params: Promise<{ slug: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { slug } = use(params);
  const { joinRoom } = useSocket();
  const { room, isConnected, isJoining, error, members } = useRoomStore();

  const [name, setName] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const joinAttempted = useRef(false);

  // Check for saved session on mount
  useEffect(() => {
    const savedName = getSession();
    setHasSession(!!savedName);
    if (savedName) {
      setName(savedName);
    }
  }, []);

  // Auto-join when connected and have a saved name
  useEffect(() => {
    const savedName = getSession();
    if (isConnected && savedName && !room && !joinAttempted.current && !isJoining) {
      joinAttempted.current = true;
      joinRoom(slug, savedName);
    }
  }, [isConnected, room, slug, joinRoom, isJoining]);

  const handleJoin = () => {
    if (name.trim() && isConnected && !isJoining) {
      joinAttempted.current = true;
      saveSession(name.trim());
      joinRoom(slug, name.trim());
    }
  };

  // Show minimal loading when auto-rejoining (has saved session)
  if (!room && hasSession && !error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#121212]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#6E56CF] animate-spin" />
          <span className="text-[13px] text-[#888]">Rejoining {slug}...</span>
        </div>
      </div>
    );
  }

  // Show join modal for new users (no saved session)
  if (!room) {
    // Still checking for session
    if (hasSession === null) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-[#121212]">
          <Loader2 className="w-8 h-8 text-[#6E56CF] animate-spin" />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#121212]">
        <div className="bg-[#1C1C1E] border border-[#2A2A2A] rounded-xl p-8 w-full max-w-sm shadow-2xl">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[#6E56CF]">
              <Users className="w-8 h-8" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-medium tracking-tight text-white">
                {slug}
              </h2>
              <p className="text-[11px] mt-1">
                {!isConnected && <span className="text-[#555]">Connecting...</span>}
                {isConnected && !isJoining && <span className="text-[#4ADE80]">Connected</span>}
                {isJoining && <span className="text-[#6E56CF]">Joining...</span>}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-[#EF4444] text-[13px]">
              {error}
            </div>
          )}

          <Input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoin();
            }}
            className="mb-4"
            autoFocus
          />

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setMicEnabled(!micEnabled)}
              className={`flex-1 py-3 rounded-lg border transition-colors flex items-center justify-center ${
                micEnabled
                  ? 'border-[#2A2A2A] hover:bg-[#2A2A2A] text-[#888]'
                  : 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]'
              }`}
            >
              {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setCamEnabled(!camEnabled)}
              className={`flex-1 py-3 rounded-lg border transition-colors flex items-center justify-center ${
                camEnabled
                  ? 'border-[#2A2A2A] hover:bg-[#2A2A2A] text-[#888]'
                  : 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]'
              }`}
            >
              {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          </div>

          <Button
            onClick={handleJoin}
            disabled={!name.trim() || !isConnected || isJoining}
            className="w-full"
          >
            Join Room
          </Button>
        </div>
      </div>
    );
  }

  // Main room view
  return (
    <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-[#121212]">
      {/* Mobile Header */}
      <div className="md:hidden h-12 flex items-center px-4 border-b border-[#242426] bg-[#161618]">
        <span className="font-medium text-[15px] text-white">{room.slug}</span>
        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#242426] text-[#888]">
          {members.filter((m) => m.online).length} Online
        </span>
      </div>

      {/* Desktop Layout - always show all panels */}
      <div className="hidden md:contents">
        <MemberList />
        <MessageList />
        <VideoGrid />
      </div>

      {/* Mobile Layout - show based on active tab */}
      <div className="md:hidden flex-1 flex flex-col min-h-0 pb-14">
        {mobileView === 'chat' && <MessageList isMobile />}
        {mobileView === 'members' && <MemberList isMobile />}
        {mobileView === 'call' && <VideoGrid isMobile />}
      </div>

      {/* Mobile Navigation */}
      <MobileNav activeView={mobileView} onViewChange={setMobileView} />
    </div>
  );
}
