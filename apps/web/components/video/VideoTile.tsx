'use client';

import { useEffect, useRef } from 'react';
import { Mic, MicOff, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  isMuted?: boolean;
  isActiveSpeaker?: boolean;
  isSelf?: boolean;
  isScreenShare?: boolean;
  volume?: number;
}

export function VideoTile({
  stream,
  name,
  isMuted,
  isActiveSpeaker,
  isSelf,
  isScreenShare,
  volume = 100,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Apply volume for remote streams
      if (!isSelf && videoRef.current) {
        videoRef.current.volume = volume / 100;
      }
    }
  }, [stream, volume, isSelf]);

  const hasVideo = stream?.getVideoTracks().some((t) => t.enabled);

  return (
    <div
      className={cn(
        'aspect-video bg-[#1C1C1E] rounded-lg overflow-hidden relative',
        isActiveSpeaker
          ? 'ring-1 ring-[#6E56CF] shadow-[0_0_0_1px_rgba(110,86,207,0.1)]'
          : isScreenShare
            ? 'ring-1 ring-[#4ADE80]'
            : 'border border-[#242426]'
      )}
    >
      {stream && hasVideo ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isSelf}
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-50" />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#6E56CF] flex items-center justify-center text-white text-lg font-medium">
            {isScreenShare ? (
              <Monitor className="w-6 h-6" />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
        </div>
      )}

      {/* Name and mic status */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        {!isScreenShare && (
          <div
            className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center',
              isMuted ? 'bg-[#EF4444]' : 'bg-white/10 backdrop-blur-md'
            )}
          >
            {isMuted ? (
              <MicOff className="w-3 h-3 text-white" />
            ) : (
              <Mic className="w-3 h-3 text-white" />
            )}
          </div>
        )}
        {isScreenShare && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center bg-[#4ADE80]">
            <Monitor className="w-3 h-3 text-white" />
          </div>
        )}
        <span
          className={cn(
            'text-[12px] font-medium drop-shadow-md',
            hasVideo ? 'text-white' : 'text-[#888]'
          )}
        >
          {name}
          {isSelf && !isScreenShare && ' (You)'}
        </span>
      </div>
    </div>
  );
}
