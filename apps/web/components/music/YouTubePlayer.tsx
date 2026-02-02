'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Youtube } from 'lucide-react';
import { useRoomStore } from '@/stores/room';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';

// YouTube IFrame API types
interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoData: () => { title: string };
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
  getPlayerState: () => number;
}

interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

interface YTPlayerOptions {
  height: string;
  width: string;
  videoId: string;
  playerVars?: Record<string, number>;
  events?: {
    onReady?: (event: YTPlayerEvent) => void;
    onStateChange?: (event: YTPlayerEvent) => void;
  };
}

interface YTNamespace {
  Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    PLAYING: number;
    PAUSED: number;
    ENDED: number;
    BUFFERING: number;
  };
}

declare global {
  interface Window {
    YT: YTNamespace;
    onYouTubeIframeAPIReady: () => void;
  }
}

// Extract YouTube video ID from various URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function YouTubePlayer() {
  const { musicState, currentMemberId, setMusicState } = useRoomStore();
  const { syncMusic } = useSocket();
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  const isUserActionRef = useRef(false);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsReady(true);
      return;
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      // Wait for it to load
      const checkReady = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setIsReady(true);
          clearInterval(checkReady);
        }
      }, 100);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setIsReady(true);
    };
  }, []);

  // Initialize player when musicState has a YouTube URL
  useEffect(() => {
    if (!isReady || !musicState?.url) return;

    const videoId = extractVideoId(musicState.url);
    if (!videoId) return;

    // Only recreate player if video ID changed
    if (currentVideoIdRef.current === videoId && playerRef.current) {
      return;
    }

    currentVideoIdRef.current = videoId;

    // Destroy existing player if any
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Create new player
    playerRef.current = new window.YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
        playsinline: 1,
      },
      events: {
        onReady: (event) => {
          const player = event.target;
          player.setVolume(volume);
          if (isMuted) player.mute();

          // Get title after a short delay (API needs time)
          setTimeout(() => {
            const data = player.getVideoData();
            setVideoTitle(data?.title || 'YouTube Video');
          }, 1000);

          setDuration(player.getDuration() || 0);

          // Sync to current time if joining late
          if (musicState.currentTime > 2) {
            player.seekTo(musicState.currentTime, true);
          }

          if (musicState.playing) {
            player.playVideo();
          }
        },
        onStateChange: (event) => {
          const state = event.data;
          if (state === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            const dur = event.target.getDuration();
            if (dur > 0) setDuration(dur);
          } else if (state === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (state === window.YT.PlayerState.ENDED) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        },
      },
    });

    // Update current time periodically
    intervalRef.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        try {
          const time = playerRef.current.getCurrentTime();
          if (typeof time === 'number' && !isNaN(time)) {
            setCurrentTime(time);
          }
        } catch (e) {
          // Player might be destroyed
        }
      }
    }, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isReady, musicState?.url]);

  // Sync with incoming music state from other users
  useEffect(() => {
    if (!musicState || !playerRef.current) return;
    if (musicState.updatedBy === currentMemberId) return;
    if (isUserActionRef.current) {
      isUserActionRef.current = false;
      return;
    }

    try {
      const player = playerRef.current;
      const playerState = player.getPlayerState?.();
      const currentPlayerTime = player.getCurrentTime?.() || 0;
      const timeDiff = Math.abs(currentPlayerTime - musicState.currentTime);

      // Only seek if difference is more than 3 seconds
      if (timeDiff > 3) {
        player.seekTo(musicState.currentTime, true);
      }

      // Sync play/pause state
      const isCurrentlyPlaying = playerState === window.YT?.PlayerState?.PLAYING;
      if (musicState.playing && !isCurrentlyPlaying) {
        player.playVideo();
      } else if (!musicState.playing && isCurrentlyPlaying) {
        player.pauseVideo();
      }
    } catch (e) {
      // Player might not be ready
    }
  }, [musicState?.playing, musicState?.currentTime, musicState?.updatedBy, currentMemberId]);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current || !musicState) return;

    isUserActionRef.current = true;
    const player = playerRef.current;
    const time = player.getCurrentTime() || 0;

    if (isPlaying) {
      player.pauseVideo();
      syncMusic(musicState.url, false, time);
    } else {
      player.playVideo();
      syncMusic(musicState.url, true, time);
    }
  }, [isPlaying, musicState, syncMusic]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || !musicState || duration === 0) return;

    isUserActionRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const seekTime = percent * duration;

    playerRef.current.seekTo(seekTime, true);
    setCurrentTime(seekTime);
    syncMusic(musicState.url, isPlaying, seekTime);
  }, [duration, isPlaying, musicState, syncMusic]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value, 10);
    setVolume(newVolume);
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume);
    } else {
      playerRef.current.mute();
    }
    setIsMuted(!isMuted);
  }, [isMuted, volume]);

  const handleSkip = useCallback((seconds: number) => {
    if (!playerRef.current || !musicState) return;

    isUserActionRef.current = true;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    playerRef.current.seekTo(newTime, true);
    setCurrentTime(newTime);
    syncMusic(musicState.url, isPlaying, newTime);
  }, [currentTime, duration, isPlaying, musicState, syncMusic]);

  const handleClose = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    currentVideoIdRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    // Clear music state locally and sync
    setMusicState(null);
    syncMusic('', false, 0);
  }, [syncMusic, setMusicState]);

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Don't render if no music or no YouTube URL
  if (!musicState?.url || !extractVideoId(musicState.url)) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-[#1C1C1E] border border-[#242426] rounded-xl overflow-hidden transition-all',
        isMinimized ? 'h-auto' : 'h-auto'
      )}
    >
      {/* Video container */}
      <div className={cn('relative bg-black', isMinimized ? 'hidden' : 'aspect-video')}>
        <div id="youtube-player" className="absolute inset-0" />
      </div>

      {/* Controls */}
      <div className="p-3">
        {/* Title and close */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Youtube className="w-4 h-4 text-[#FF0000] shrink-0" />
            <span className="text-[12px] font-medium text-white truncate">
              {videoTitle || 'Loading...'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 text-[#555] hover:text-white rounded transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              <div className={cn('w-3 h-0.5 bg-current transition-transform', isMinimized && 'rotate-180')} />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 text-[#555] hover:text-[#EF4444] rounded transition-colors"
              title="Close player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="h-1.5 bg-[#2A2A2A] rounded-full cursor-pointer mb-3 group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-[#6E56CF] rounded-full relative transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Time and controls */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#555] font-mono w-24">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSkip(-10)}
              className="p-1.5 text-[#888] hover:text-white rounded transition-colors"
              title="Back 10s"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={handlePlayPause}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            <button
              onClick={() => handleSkip(10)}
              className="p-1.5 text-[#888] hover:text-white rounded transition-colors"
              title="Forward 10s"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-24 justify-end">
            <button
              onClick={toggleMute}
              className="p-1 text-[#888] hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-[#2A2A2A] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
