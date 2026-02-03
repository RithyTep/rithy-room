'use client';

import { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Play, Pause, Youtube, Ban } from 'lucide-react';
import { cn, formatTime, generateAvatarUrl } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import type { Message, Reaction } from '@rithy-room/shared';

// Check if message is a bot command
function parseBotCommand(text: string): { isBot: boolean; youtubeUrl?: string; videoId?: string } {
  const botPattern = /^@bot\s+(.+)/i;
  const match = text.match(botPattern);

  if (!match) return { isBot: false };

  const url = match[1].trim();
  const youtubePattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/;
  const videoMatch = url.match(youtubePattern);

  if (videoMatch) {
    return { isBot: true, youtubeUrl: url, videoId: videoMatch[1] };
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return { isBot: true, youtubeUrl: url, videoId: url };
  }

  return { isBot: true };
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '👀', '🔥'];

interface MessageBubbleProps {
  message: Message;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
  onDelete: (messageId: string) => void;
}

// Group reactions by emoji
function groupReactions(reactions: Reaction[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  reactions.forEach((r) => {
    const existing = groups.get(r.emoji) || [];
    existing.push(r.memberId);
    groups.set(r.emoji, existing);
  });
  return groups;
}

export function MessageBubble({
  message,
  onReact,
  onRemoveReaction,
  onDelete,
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentMemberId } = useRoomStore();
  const reactionGroups = groupReactions(message.reactions);

  const isOwn = message.memberId === currentMemberId;

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioProgress(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      const audio = audioRef.current;
      if (!isFinite(audio.duration)) {
        audio.currentTime = 1e10;
        audio.addEventListener('timeupdate', function getDuration() {
          if (isFinite(audio.duration)) {
            setAudioDuration(audio.duration);
            audio.currentTime = 0;
            audio.removeEventListener('timeupdate', getDuration);
          }
        });
      } else {
        setAudioDuration(audio.duration);
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const formatAudioTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds) || isNaN(seconds)) {
      return '0:00';
    }
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleReactionClick = (emoji: string, memberIds: string[]) => {
    if (currentMemberId && memberIds.includes(currentMemberId)) {
      onRemoveReaction(message.id, emoji);
    } else {
      onReact(message.id, emoji);
    }
  };

  // Handle deleted messages
  if (message.isDeleted) {
    return (
      <div className="group flex gap-3 px-2 py-2 rounded-xl">
        <div className="shrink-0 pt-1">
          <img
            src={message.member.avatarUrl || generateAvatarUrl(message.member.name)}
            alt={message.member.name}
            className="w-8 h-8 rounded-lg object-cover bg-slate-800 opacity-50"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-slate-500">
              {isOwn ? 'You' : message.member.name}
            </span>
            <span className="text-[10px] text-slate-600">{formatTime(message.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 italic text-[13px]">
            <Ban className="w-4 h-4" />
            <span>This message was deleted</span>
          </div>
        </div>
      </div>
    );
  }

  const handleDelete = () => {
    if (confirm('Delete this message?')) {
      onDelete(message.id);
    }
  };

  return (
    <div
      className={cn(
        'group flex gap-3 px-2 py-2 rounded-xl transition-colors',
        isOwn
          ? 'bg-[var(--accent)]/[0.04] border border-[var(--accent)]/[0.05]'
          : 'hover:bg-white/[0.02]'
      )}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-1">
        <img
          src={message.member.avatarUrl || generateAvatarUrl(message.member.name)}
          alt={message.member.name}
          className={cn(
            'w-8 h-8 rounded-lg object-cover bg-slate-800',
            isOwn && 'ring-1 ring-[var(--accent)]/30'
          )}
        />
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {/* Name and time */}
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={cn('text-xs font-medium', isOwn ? 'text-[var(--accent)]' : 'text-slate-200')}
          >
            {isOwn ? 'You' : message.member.name}
          </span>
          <span className="text-[10px] text-slate-600">{formatTime(message.createdAt)}</span>
        </div>

        {/* Message text/content */}
        <div className="text-[13px] leading-relaxed text-slate-300">
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Shared image"
              className="max-w-xs rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.imageUrl!, '_blank')}
            />
          )}

          {message.audioUrl && (
            <div className="flex items-center gap-3 min-w-[200px] bg-black/20 rounded-lg p-2 mb-2">
              <audio
                ref={audioRef}
                src={message.audioUrl}
                preload="metadata"
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={handleAudioLoadedMetadata}
                onDurationChange={() => {
                  if (audioRef.current && isFinite(audioRef.current.duration)) {
                    setAudioDuration(audioRef.current.duration);
                  }
                }}
                onEnded={handleAudioEnded}
                className="hidden"
              />
              <button
                onClick={toggleAudio}
                className="w-8 h-8 rounded-full bg-[var(--accent)] text-black flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-[100px]">
                <div className="h-1 rounded-full overflow-hidden bg-white/10">
                  <div
                    className="h-full bg-[var(--accent)] transition-all"
                    style={{
                      width: audioDuration > 0 ? `${(audioProgress / audioDuration) * 100}%` : '0%',
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-500">{formatAudioTime(audioProgress)}</span>
                  <span className="text-[10px] text-slate-500">
                    {audioDuration > 0 ? formatAudioTime(audioDuration) : '--:--'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {message.text &&
            !message.text.startsWith('🎤') &&
            (() => {
              const botCmd = parseBotCommand(message.text);
              if (botCmd.isBot && botCmd.videoId) {
                return (
                  <div className="flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-[#FF0000] shrink-0" />
                    <div>
                      <div className="text-[12px] opacity-70">Now Playing</div>
                      <div className="text-[13px]">YouTube Video</div>
                    </div>
                  </div>
                );
              }
              return <p>{message.text}</p>;
            })()}
        </div>

        {/* Reactions */}
        {reactionGroups.size > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Array.from(reactionGroups.entries()).map(([emoji, memberIds]) => (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji, memberIds)}
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 bg-white/5 border rounded text-[10px] hover:bg-white/10 transition-colors',
                  currentMemberId && memberIds.includes(currentMemberId)
                    ? 'border-[var(--accent)]/30 bg-[var(--accent)]/10'
                    : 'border-white/5'
                )}
              >
                <span>{emoji}</span>
                <span className="text-slate-400">{memberIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start pt-1">
        <div className="bg-[#1a1c23] border border-white/10 rounded-lg flex p-1 shadow-xl">
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className="p-1 hover:text-[var(--accent)] transition-colors text-slate-500"
            title="Add reaction"
          >
            <Icon icon="solar:emoji-funny-circle-linear" width={16} />
          </button>
          {isOwn && (
            <button
              onClick={handleDelete}
              className="p-1 hover:text-[var(--error)] transition-colors text-slate-500"
              title="Delete"
            >
              <Icon icon="solar:trash-bin-2-linear" width={16} />
            </button>
          )}
        </div>
      </div>

      {/* Quick reaction picker */}
      {showReactionPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowReactionPicker(false)} />
          <div className="absolute top-full mt-1 right-0 z-50 bg-[#161618] border border-white/10 rounded-full px-2 py-1 shadow-xl flex flex-row flex-nowrap gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(message.id, emoji);
                  setShowReactionPicker(false);
                }}
                className="w-7 h-7 flex items-center justify-center text-sm hover:bg-white/10 rounded-full transition-colors shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
