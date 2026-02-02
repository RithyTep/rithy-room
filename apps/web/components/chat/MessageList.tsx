'use client';

import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/stores/room';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { YouTubePlayer } from '../music/YouTubePlayer';
import { useSocket } from '@/hooks/useSocket';

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

export function MessageList() {
  const { messages, musicState } = useRoomStore();
  const { sendMessage, reactToMessage, removeReactionFromMessage, deleteMessage, syncMusic } = useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle message send with bot command detection
  const handleSendMessage = (text: string, imageUrl?: string, audioUrl?: string) => {
    // Check for bot command
    const { isBot, youtubeUrl } = extractBotCommand(text);

    if (isBot && youtubeUrl) {
      // Start playing the YouTube video
      syncMusic(youtubeUrl, true, 0);
    }

    // Send the message normally
    sendMessage(text, imageUrl, audioUrl);
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 relative z-0 bg-[#0d1117]" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231c2128' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    }}>
      {/* YouTube Player (shows when music is playing) */}
      {musicState?.url && (
        <div className="p-4 pb-0">
          <YouTubePlayer />
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 opacity-50">
            <div className="w-12 h-1 bg-[#242426] rounded-full mb-4" />
            <p className="text-[13px] text-[#555]">
              This is the start of the conversation.
            </p>
            <p className="text-[11px] text-[#444] mt-2">
              Tip: Type <span className="text-[#6E56CF]">@bot [youtube_url]</span> to play music
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onReact={reactToMessage}
              onRemoveReaction={removeReactionFromMessage}
              onDelete={deleteMessage}
            />
          ))
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={handleSendMessage} />
    </main>
  );
}
