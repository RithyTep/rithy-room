'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Monitor } from 'lucide-react';
import { cn, generateAvatarUrl } from '@/lib/utils';

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  avatarUrl?: string | null;
  isMuted?: boolean;
  isActiveSpeaker?: boolean;
  isSelf?: boolean;
  isScreenShare?: boolean;
  isCameraOff?: boolean;
  volume?: number;
}

export function VideoTile({
  stream,
  name,
  avatarUrl,
  isMuted,
  isActiveSpeaker,
  isSelf,
  isScreenShare,
  isCameraOff,
  volume = 100,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [videoTrackCount, setVideoTrackCount] = useState(0);

  // Track when video tracks are added/removed to force re-render
  useEffect(() => {
    if (!stream) {
      setVideoTrackCount(0);
      return;
    }

    const updateTrackCount = () => {
      const count = stream.getVideoTracks().length;
      setVideoTrackCount(count);
    };

    updateTrackCount();
    stream.addEventListener('addtrack', updateTrackCount);
    stream.addEventListener('removetrack', updateTrackCount);

    // Poll for track changes as fallback (WebRTC remote streams may not fire addtrack)
    const pollInterval = setInterval(updateTrackCount, 500);

    return () => {
      stream.removeEventListener('addtrack', updateTrackCount);
      stream.removeEventListener('removetrack', updateTrackCount);
      clearInterval(pollInterval);
    };
  }, [stream]);

  // Handle video element - re-run when camera state or track count changes
  useEffect(() => {
    if (videoRef.current && stream) {
      // Force video element to reload by clearing first
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      } else if (videoTrackCount > 0) {
        // Same stream but tracks changed - force reload
        videoRef.current.srcObject = null;
        videoRef.current.srcObject = stream;
      }
      // Apply volume for remote streams
      if (!isSelf) {
        videoRef.current.volume = volume / 100;
      }
    }
  }, [stream, volume, isSelf, isCameraOff, videoTrackCount]);

  // Handle separate audio element for remote streams
  useEffect(() => {
    if (audioRef.current && stream && !isSelf) {
      audioRef.current.srcObject = stream;
      audioRef.current.volume = volume / 100;
    }
  }, [stream, volume, isSelf]);

  const hasVideo = stream?.getVideoTracks().some((t) => t.enabled) && !isCameraOff;
  const displayAvatar = avatarUrl || generateAvatarUrl(name);

  return (
    <div
      className={cn(
        'aspect-video bg-[#1C1C1E] rounded-xl overflow-hidden relative',
        isActiveSpeaker
          ? 'ring-2 ring-[#6E56CF] shadow-[0_0_0_1px_rgba(110,86,207,0.2)]'
          : isScreenShare
            ? 'ring-2 ring-[#4ADE80]'
            : 'border border-[#242426]'
      )}
    >
      {/* Hidden audio element for remote streams - always render to ensure audio plays */}
      {stream && !isSelf && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}

      {stream && hasVideo ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isSelf}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1C1C1E] to-[#121212]">
          {isScreenShare ? (
            <div className="w-16 h-16 rounded-full bg-[#4ADE80]/20 flex items-center justify-center">
              <Monitor className="w-8 h-8 text-[#4ADE80]" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <img
                src={displayAvatar}
                alt={name}
                className="w-16 h-16 rounded-full bg-[#2A2A2A] object-cover ring-2 ring-[#242426]"
              />
              <span className="text-[12px] text-[#888] font-medium">Camera off</span>
            </div>
          )}
        </div>
      )}

      {/* Name and mic status */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1">
          {!isScreenShare && (
            <div
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center',
                isMuted ? 'bg-[#EF4444]' : 'bg-white/20'
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
          <span className="text-[11px] font-medium text-white">
            {name}
            {isSelf && !isScreenShare && ' (You)'}
          </span>
        </div>
      </div>
    </div>
  );
}
