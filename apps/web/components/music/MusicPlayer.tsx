'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Music } from 'lucide-react';
import { useRoomStore } from '@/stores/room';
import { useSocket } from '@/hooks/useSocket';

export function MusicPlayer() {
  const { musicState, currentMemberId } = useRoomStore();
  const { syncMusic } = useSocket();
  const [url, setUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sync with incoming music state
  useEffect(() => {
    if (!musicState || !audioRef.current) return;

    // Don't sync if we're the one who made the change
    if (musicState.updatedBy === currentMemberId) return;

    if (musicState.url !== url) {
      setUrl(musicState.url);
      audioRef.current.src = musicState.url;
    }

    audioRef.current.currentTime = musicState.currentTime;

    if (musicState.playing && audioRef.current.paused) {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    } else if (!musicState.playing && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [musicState, currentMemberId]);

  const handlePlayPause = () => {
    if (!audioRef.current || !url) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      syncMusic(url, false, audioRef.current.currentTime);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      syncMusic(url, true, audioRef.current.currentTime);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !audioRef.current) return;

    audioRef.current.src = url;
    audioRef.current.play().catch(console.error);
    setIsPlaying(true);
    syncMusic(url, true, 0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="border-t border-[--color-border] p-4">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {!url ? (
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[--color-panel] border border-[--color-border] rounded-lg px-3 py-2">
            <Music className="w-4 h-4 text-[--color-text-dim]" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste audio URL..."
              className="flex-1 bg-transparent text-[12px] text-[--color-text-primary] placeholder-[--color-text-dim] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!url}
            className="px-3 py-2 bg-[--color-accent] text-white text-[12px] font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Play
          </button>
        </form>
      ) : (
        <div className="bg-[--color-panel] border border-[--color-border] rounded-xl p-3 flex items-center gap-4">
          <button
            onClick={handlePlayPause}
            className="w-8 h-8 rounded-full bg-[--color-text-primary] text-black flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 ml-0.5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[12px] font-medium text-[--color-text-secondary] truncate">
                {url.split('/').pop()?.split('?')[0] || 'Audio'}
              </span>
            </div>
            <div className="h-1 bg-[--color-border-light] rounded-full overflow-hidden">
              <div
                className="h-full bg-[--color-accent] rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <span className="text-[10px] text-[--color-text-dim] font-mono">
            {formatDuration(currentTime)}
          </span>
        </div>
      )}
    </div>
  );
}
