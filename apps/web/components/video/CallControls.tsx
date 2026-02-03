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
  isMobile?: boolean;
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
  isMobile,
}: CallControlsProps) {
  // Larger button size for mobile touch targets
  const buttonSize = isMobile ? 'w-12 h-12' : 'w-10 h-10';
  const iconSize = isMobile ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <div className="p-4 bg-[#1C1C1E] border-t border-[#242426]">
      <div className={cn('flex justify-center', isMobile ? 'gap-3' : 'gap-4')}>
        <button
          onClick={onToggleMute}
          className={cn(
            buttonSize,
            'rounded-full flex items-center justify-center transition-colors',
            isMuted
              ? 'bg-[#EF4444] text-white'
              : 'bg-[#2A2A2A] hover:bg-[#333] active:bg-[#404040] text-white'
          )}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <MicOff className={iconSize} />
          ) : (
            <Mic className={iconSize} />
          )}
        </button>

        <button
          onClick={onToggleCamera}
          className={cn(
            buttonSize,
            'rounded-full flex items-center justify-center transition-colors',
            isCameraOff
              ? 'bg-[#EF4444] text-white'
              : 'bg-[#2A2A2A] hover:bg-[#333] active:bg-[#404040] text-white'
          )}
          title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isCameraOff ? (
            <VideoOff className={iconSize} />
          ) : (
            <Video className={iconSize} />
          )}
        </button>

        {/* Hide screen share on mobile (not supported) */}
        {!isMobile && (
          <button
            onClick={onToggleScreenShare}
            className={cn(
              buttonSize,
              'rounded-full flex items-center justify-center transition-colors',
              isScreenSharing
                ? 'bg-[#6E56CF] text-white'
                : 'bg-[#2A2A2A] hover:bg-[#333] active:bg-[#404040] text-white'
            )}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenSharing ? (
              <MonitorOff className={iconSize} />
            ) : (
              <MonitorUp className={iconSize} />
            )}
          </button>
        )}

        <button
          onClick={onLeave}
          className={cn(
            buttonSize,
            'rounded-full bg-[#EF4444] hover:opacity-90 active:opacity-80 text-white flex items-center justify-center transition-colors'
          )}
          title="Leave call"
        >
          <PhoneOff className={iconSize} />
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
          className={cn('flex-1 accent-[#6E56CF]', isMobile && 'h-2')}
        />
        <span className="text-[11px] text-[#555] w-8">{volume}%</span>
      </div>
    </div>
  );
}
