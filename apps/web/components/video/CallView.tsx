'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, MonitorOff, Volume2 } from 'lucide-react';
import { useRoomStore } from '@/stores/room';
import { useMediaStore } from '@/stores/media';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSocket } from '@/hooks/useSocket';
import { VideoTile } from './VideoTile';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CallView() {
  const { members, currentMemberId } = useRoomStore();
  const {
    localStream,
    screenStream,
    remoteStreams,
    isInCall,
    isMuted,
    isCameraOff,
    isScreenSharing,
    volume,
    callParticipants,
    setViewMode,
  } = useMediaStore();
  const { socket } = useSocket();
  const { startCall, endCall, toggleMute, toggleCamera, toggleScreenShare, changeVolume } =
    useWebRTC(socket);

  const currentMember = members.find((m) => m.id === currentMemberId);

  // Call duration timer
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start call if not already in call
  useEffect(() => {
    if (!isInCall) {
      startCall();
    }
  }, [isInCall, startCall]);

  useEffect(() => {
    if (isInCall) {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCallDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isInCall]);

  const handleLeave = () => {
    endCall();
    setViewMode('chat');
  };

  const handleBackToChat = () => {
    setViewMode('chat');
  };

  // Calculate grid layout based on participant count
  const totalParticipants = 1 + remoteStreams.size + (screenStream ? 1 : 0);
  const gridCols =
    totalParticipants <= 1
      ? 'grid-cols-1'
      : totalParticipants <= 2
        ? 'grid-cols-2'
        : totalParticipants <= 4
          ? 'grid-cols-2'
          : totalParticipants <= 6
            ? 'grid-cols-3'
            : 'grid-cols-3';

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-gradient-to)]/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-white/5">
        <button
          onClick={handleBackToChat}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <Icon icon="solar:arrow-left-linear" width={20} />
          <span className="text-sm">Back to chat</span>
        </button>

        <div className="flex items-center gap-4">
          {isInCall && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="text-sm text-[var(--accent)]">{formatDuration(callDuration)}</span>
            </div>
          )}
          <span className="text-sm text-slate-400">
            {callParticipants.length > 0
              ? `${callParticipants.length + 1} in call`
              : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* Video Grid */}
      <div className="flex-1 p-6 flex items-center justify-center overflow-hidden">
        <div
          className={cn(
            'grid gap-4 w-full max-w-6xl',
            gridCols,
            'auto-rows-fr'
          )}
          style={{
            maxHeight: 'calc(100vh - 200px)',
          }}
        >
          {/* Screen share takes priority */}
          {screenStream && (
            <div className={totalParticipants > 1 ? 'col-span-full row-span-2' : ''}>
              <VideoTile
                stream={screenStream}
                name="Screen Share"
                isScreenShare
                isSelf
              />
            </div>
          )}

          {/* Local video */}
          {currentMember && (
            <VideoTile
              stream={localStream}
              name={currentMember.name}
              avatarUrl={currentMember.avatarUrl}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isActiveSpeaker
              isSelf
            />
          )}

          {/* Remote videos */}
          {Array.from(remoteStreams.entries()).map(([memberId, stream]) => {
            const member = members.find((m) => m.id === memberId);
            if (!member) return null;
            return (
              <VideoTile
                key={memberId}
                stream={stream}
                name={member.name}
                avatarUrl={member.avatarUrl}
                volume={volume}
              />
            );
          })}
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="glass-panel rounded-2xl px-6 py-4 flex items-center gap-6">
          {/* Mic */}
          <button
            onClick={toggleMute}
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-all',
              isMuted
                ? 'bg-[var(--error)] text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            )}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleCamera}
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-all',
              isCameraOff
                ? 'bg-[var(--error)] text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            )}
            title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Screen share (desktop only) */}
          <button
            onClick={toggleScreenShare}
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-all hidden md:flex',
              isScreenSharing
                ? 'bg-[var(--accent)] text-black'
                : 'bg-white/10 hover:bg-white/20 text-white'
            )}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenSharing ? (
              <MonitorOff className="w-5 h-5" />
            ) : (
              <MonitorUp className="w-5 h-5" />
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-3 px-4">
            <Volume2 className="w-4 h-4 text-slate-400" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-slate-400 w-8">{volume}%</span>
          </div>

          {/* Leave */}
          <button
            onClick={handleLeave}
            className="w-12 h-12 rounded-full bg-[var(--error)] hover:opacity-90 text-white flex items-center justify-center transition-all"
            title="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
