'use client';

import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, MonitorOff, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  volume: number;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onVolumeChange: (volume: number) => void;
  onLeave: () => void;
}

export function CallControls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  volume,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onVolumeChange,
  onLeave,
}: CallControlsProps) {
  return (
    <div className="p-4 bg-[#1C1C1E] border-t border-[#242426]">
      <div className="flex justify-center gap-4">
        <button
          onClick={onToggleMute}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            isMuted
              ? 'bg-[#EF4444] text-white'
              : 'bg-[#2A2A2A] hover:bg-[#333] text-white'
          )}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={onToggleCamera}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            isCameraOff
              ? 'bg-[#EF4444] text-white'
              : 'bg-[#2A2A2A] hover:bg-[#333] text-white'
          )}
          title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isCameraOff ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={onToggleScreenShare}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            isScreenSharing
              ? 'bg-[#6E56CF] text-white'
              : 'bg-[#2A2A2A] hover:bg-[#333] text-white'
          )}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-5 h-5" />
          ) : (
            <MonitorUp className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={onLeave}
          className="w-10 h-10 rounded-full bg-[#EF4444] hover:opacity-90 text-white flex items-center justify-center transition-colors"
          title="Leave call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Volume slider */}
      <div className="mt-4 flex items-center gap-3">
        <Volume2 className="w-4 h-4 text-[#555]" />
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1 accent-[#6E56CF]"
        />
        <span className="text-[11px] text-[#555] w-8">{volume}%</span>
      </div>
    </div>
  );
}
