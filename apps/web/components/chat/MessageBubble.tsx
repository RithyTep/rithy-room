'use client';

import { useState, useRef } from 'react';
import { Smile, Play, Pause, Youtube, Trash2, Ban } from 'lucide-react';
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
  const [showActions, setShowActions] = useState(false);
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
      <div className={cn('flex gap-3 group', isOwn ? 'flex-row-reverse' : 'flex-row')}>
        <img
          src={message.member.avatarUrl || generateAvatarUrl(message.member.name)}
          alt={message.member.name}
          className="w-8 h-8 rounded-full bg-[#2A2A2A] shrink-0 mt-1 object-cover opacity-50"
        />
        <div className={cn('max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
          <div className={cn('flex items-baseline gap-2 mb-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
            <span className="text-[13px] font-medium text-[#555]">
              {isOwn ? 'You' : message.member.name}
            </span>
            <span className="text-[11px] text-[#444]">
              {formatTime(message.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1C1C1E]/50 border border-[#242426] rounded-2xl text-[#555] italic text-[13px]">
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
    setShowActions(false);
  };

  return (
    <div className={cn('flex gap-3 group', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <img
        src={message.member.avatarUrl || generateAvatarUrl(message.member.name)}
        alt={message.member.name}
        className="w-8 h-8 rounded-full bg-[#2A2A2A] shrink-0 mt-1 object-cover"
      />

      {/* Message content */}
      <div className={cn('max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Name and time */}
        <div className={cn('flex items-baseline gap-2 mb-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
          <span className={cn('text-[13px] font-medium', isOwn ? 'text-[#6E56CF]' : 'text-white')}>
            {isOwn ? 'You' : message.member.name}
          </span>
          <span className="text-[11px] text-[#555]">
            {formatTime(message.createdAt)}
          </span>
        </div>

        {/* Bubble */}
        <div className="relative">
          <div
            className={cn(
              'text-[14px] leading-relaxed px-4 py-2.5 inline-block border',
              isOwn
                ? 'bg-[#6E56CF] text-white border-[#7C66D9] rounded-2xl rounded-tr-none'
                : 'bg-[#1C1C1E] text-[#DDD] border-[#242426] rounded-2xl rounded-tl-none'
            )}
          >
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Shared image"
                className="max-w-xs rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.imageUrl!, '_blank')}
              />
            )}
            {message.audioUrl && (
              <div className="flex items-center gap-3 min-w-[200px]">
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
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity shrink-0',
                    isOwn ? 'bg-white/20 text-white' : 'bg-[#6E56CF] text-white'
                  )}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-[120px]">
                  <div className={cn('h-1 rounded-full overflow-hidden', isOwn ? 'bg-white/20' : 'bg-[#2A2A2A]')}>
                    <div
                      className={cn('h-full transition-all', isOwn ? 'bg-white' : 'bg-[#6E56CF]')}
                      style={{ width: audioDuration > 0 ? `${(audioProgress / audioDuration) * 100}%` : '0%' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className={cn('text-[10px]', isOwn ? 'text-white/60' : 'text-[#555]')}>
                      {formatAudioTime(audioProgress)}
                    </span>
                    <span className={cn('text-[10px]', isOwn ? 'text-white/60' : 'text-[#555]')}>
                      {audioDuration > 0 ? formatAudioTime(audioDuration) : '--:--'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {message.text && !message.text.startsWith('🎤') && (() => {
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
              return <div>{message.text}</div>;
            })()}
          </div>

          {/* Action buttons */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity',
              isOwn ? '-left-16' : '-right-16'
            )}
          >
            {isOwn && (
              <button
                onClick={handleDelete}
                className="p-1 text-[#555] hover:text-[#EF4444] transition-colors"
                title="Delete message"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="p-1 text-[#555] hover:text-[#DDD] transition-colors"
              title="Add reaction"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          {/* Quick reaction picker */}
          {showReactionPicker && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowReactionPicker(false)}
              />
              <div
                className={cn(
                  'absolute top-full mt-1 z-50 bg-[#161618] border border-[#242426] rounded-full px-2 py-1 shadow-xl flex flex-row flex-nowrap gap-1',
                  isOwn ? 'right-0' : 'left-0'
                )}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact(message.id, emoji);
                      setShowReactionPicker(false);
                    }}
                    className="w-7 h-7 flex items-center justify-center text-sm hover:bg-[#1C1C1E] rounded-full transition-colors shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Reactions display */}
        {reactionGroups.size > 0 && (
          <div className={cn('flex flex-wrap gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
            {Array.from(reactionGroups.entries()).map(([emoji, memberIds]) => (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji, memberIds)}
                className={cn(
                  'flex items-center gap-1 bg-[#1C1C1E] border rounded-full px-2 py-0.5 transition-colors',
                  currentMemberId && memberIds.includes(currentMemberId)
                    ? 'border-[#6E56CF] bg-[#6E56CF]/10'
                    : 'border-[#2A2A2A] hover:border-[#444]'
                )}
              >
                <span className="text-[12px]">{emoji}</span>
                <span className="text-[10px] font-medium text-[#888]">
                  {memberIds.length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
