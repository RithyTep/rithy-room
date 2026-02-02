'use client';

import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/stores/room';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useSocket } from '@/hooks/useSocket';

export function MessageList() {
  const { messages } = useRoomStore();
  const { sendMessage, reactToMessage, removeReactionFromMessage } =
    useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-[#121212] relative z-0">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 opacity-50">
            <div className="w-12 h-1 bg-[#242426] rounded-full mb-4" />
            <p className="text-[13px] text-[#555]">
              This is the start of the conversation.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onReact={reactToMessage}
              onRemoveReaction={removeReactionFromMessage}
            />
          ))
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} />
    </main>
  );
}
