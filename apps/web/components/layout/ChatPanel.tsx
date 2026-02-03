'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useRoomStore } from '@/stores/room';
import { useSocket } from '@/hooks/useSocket';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { YouTubePlayer } from '@/components/music/YouTubePlayer';
import { generateAvatarUrl } from '@/lib/utils';

// Extract YouTube URL from bot command
function extractBotCommand(text: string): { isBot: boolean; youtubeUrl?: string } {
  const botPattern = /^@bot\s+(.+)/i;
  const match = text.match(botPattern);

  if (!match) return { isBot: false };

  const url = match[1].trim();
  const youtubePattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/;

  if (youtubePattern.test(url) || /^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return { isBot: true, youtubeUrl: url };
  }

  return { isBot: true };
}

interface ChatPanelProps {
  roomSlug: string;
  onToggleUsers?: () => void;
  isMobile?: boolean;
}

export function ChatPanel({ roomSlug, onToggleUsers, isMobile }: ChatPanelProps) {
  const { messages, members, musicState } = useRoomStore();
  const { sendMessage, reactToMessage, removeReactionFromMessage, deleteMessage, syncMusic } =
    useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);

  const onlineMembers = members.filter((m) => m.online);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle message send with bot command detection
  const handleSendMessage = (text: string, imageUrl?: string, audioUrl?: string) => {
    const { isBot, youtubeUrl } = extractBotCommand(text);

    if (isBot && youtubeUrl) {
      syncMusic(youtubeUrl, true, 0);
    }

    sendMessage(text, imageUrl, audioUrl);
  };

  return (
    <main className="flex-1 glass-panel rounded-none md:rounded-2xl flex flex-col relative overflow-hidden">
      {/* Mobile Header */}
      {isMobile && (
        <div className="md:hidden h-14 border-b border-white/5 flex items-center justify-between px-4 bg-black/20 backdrop-blur-md sticky top-0 z-30">
          <button className="text-slate-400">
            <Icon icon="solar:hamburger-menu-linear" width={24} />
          </button>
          <span className="font-medium text-white">#{roomSlug}</span>
          <button className="text-slate-400" onClick={onToggleUsers}>
            <Icon icon="solar:users-group-rounded-linear" width={24} />
          </button>
        </div>
      )}

      {/* Desktop Header */}
      <header className="hidden md:flex h-16 border-b border-white/5 items-center justify-between px-6 bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <div className="text-slate-500">
            <Icon icon="solar:hashtag-linear" width={18} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-medium text-white tracking-tight">{roomSlug}</h2>
            <span className="text-[10px] text-slate-500">Chat & voice room</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          {/* Member avatars */}
          {onlineMembers.length > 0 && (
            <div className="flex -space-x-2">
              {onlineMembers.length > 3 && (
                <div className="w-6 h-6 rounded-full border border-black/50 bg-slate-800 flex items-center justify-center text-[9px] text-white z-10 relative">
                  +{onlineMembers.length - 3}
                </div>
              )}
              {onlineMembers.slice(0, 3).map((member, i) => (
                <img
                  key={member.id}
                  src={member.avatarUrl || generateAvatarUrl(member.name)}
                  alt={member.name}
                  className="w-6 h-6 rounded-full border border-black/50 grayscale opacity-60"
                  style={{ zIndex: 3 - i }}
                />
              ))}
            </div>
          )}
          <div className="h-4 w-px bg-white/10" />
          <button className="hover:text-white transition-colors">
            <Icon icon="solar:magnifer-linear" width={18} />
          </button>
          <button className="hover:text-white transition-colors">
            <Icon icon="solar:pin-linear" width={18} />
          </button>
        </div>
      </header>

      {/* YouTube Player */}
      {musicState?.url && (
        <div className="p-4 pb-0">
          <YouTubePlayer />
        </div>
      )}

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            {/* Date Divider */}
            <div className="flex items-center justify-center py-6">
              <span className="text-[10px] font-medium text-slate-600 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                Today
              </span>
            </div>
            <p className="text-[13px] text-slate-500">
              This is the start of the conversation.
            </p>
            <p className="text-[11px] text-slate-600 mt-2">
              Tip: Type <span className="text-[var(--accent)]">@bot [youtube_url]</span> to play
              music
            </p>
          </div>
        ) : (
          <>
            {/* Date Divider */}
            <div className="flex items-center justify-center py-6">
              <span className="text-[10px] font-medium text-slate-600 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                Today
              </span>
            </div>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onReact={reactToMessage}
                onRemoveReaction={removeReactionFromMessage}
                onDelete={deleteMessage}
              />
            ))}
          </>
        )}

        {/* Spacer for floating input */}
        <div className="h-20" />
      </div>

      {/* Floating Input */}
      <div className="absolute bottom-6 left-0 right-0 px-4 md:px-8 z-10">
        <MessageInput onSend={handleSendMessage} roomSlug={roomSlug} />
      </div>
    </main>
  );
}
