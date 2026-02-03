'use client';

import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useRoomStore } from '@/stores/room';
import { useMediaStore } from '@/stores/media';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSocket } from '@/hooks/useSocket';
import { VideoTile } from './VideoTile';
import { CallControls } from './CallControls';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface VideoGridProps {
  isMobile?: boolean;
}

export function VideoGrid({ isMobile }: VideoGridProps) {
  const { members, currentMemberId } = useRoomStore();
  const { localStream, screenStream, remoteStreams, isInCall, isMuted, isCameraOff, isScreenSharing, volume } =
    useMediaStore();
  const { socket } = useSocket();
  const { startCall, endCall, toggleMute, toggleCamera, toggleScreenShare, changeVolume } = useWebRTC(socket);

  const currentMember = members.find((m) => m.id === currentMemberId);

  // Call duration timer
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  if (!isInCall) {
    return (
      <aside
        className={
          isMobile
            ? 'flex flex-col h-full bg-[#161618] items-center justify-center'
            : 'hidden md:flex w-80 bg-[#161618] border-l border-[#242426] flex-col shrink-0 items-center justify-center'
        }
      >
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full bg-[#1C1C1E] flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-[#555]" />
          </div>
          <h3 className="text-[15px] font-medium text-white mb-2">
            Start a Call
          </h3>
          <p className="text-[13px] text-[#555] mb-6">
            Video chat with everyone in the room
          </p>
          <button
            onClick={startCall}
            className="bg-[#6E56CF] hover:opacity-90 active:opacity-80 text-white font-medium px-6 py-2.5 rounded-lg transition-opacity min-h-[44px]"
          >
            Join Call
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={
        isMobile
          ? 'flex flex-col h-full bg-[#161618]'
          : 'hidden md:flex w-80 bg-[#161618] border-l border-[#242426] flex-col shrink-0'
      }
    >
      {/* Call Status */}
      <div className="p-4 border-b border-[#242426] flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-medium text-white">Active Call</h3>
          <p className="text-[11px] text-[#6E56CF]">{formatDuration(callDuration)}</p>
        </div>
        <button
          onClick={endCall}
          className="text-[#EF4444] hover:bg-[#EF4444]/10 active:bg-[#EF4444]/20 p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Video Grid */}
      <div
        className={
          isMobile
            ? 'flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 auto-rows-min'
            : 'flex-1 overflow-y-auto p-4 space-y-3'
        }
      >
        {/* Screen share preview */}
        {screenStream && (
          <div className={isMobile ? 'col-span-2' : ''}>
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

      {/* Call Controls */}
      <CallControls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        volume={volume}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onVolumeChange={changeVolume}
        onLeave={endCall}
        isMobile={isMobile}
      />
    </aside>
  );
}
