import { create } from 'zustand';
import type { Room, Member, Message, MusicState, GameItem } from '@rithy-room/shared';

export interface ActiveGameState {
  game: GameItem;
  startedBy: string;
  startedByName: string;
}

interface RoomState {
  room: Room | null;
  members: Member[];
  messages: Message[];
  currentMemberId: string | null;
  musicState: MusicState | null;
  activeGame: ActiveGameState | null;
  gameNotification: ActiveGameState | null;
  isConnected: boolean;
  isJoining: boolean;
  error: string | null;

  setRoom: (room: Room) => void;
  setMembers: (members: Member[]) => void;
  addMember: (member: Member) => void;
  removeMember: (memberId: string) => void;
  updateMember: (member: Member) => void;
  updateMemberPresence: (memberId: string, online: boolean) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  addReaction: (messageId: string, reaction: { id: string; messageId: string; memberId: string; emoji: string }) => void;
  removeReaction: (messageId: string, memberId: string, emoji: string) => void;
  deleteMessage: (messageId: string) => void;
  setCurrentMemberId: (memberId: string) => void;
  setMusicState: (state: MusicState | null) => void;
  setActiveGame: (game: ActiveGameState | null) => void;
  setGameNotification: (game: ActiveGameState | null) => void;
  setConnected: (connected: boolean) => void;
  setJoining: (joining: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  members: [],
  messages: [],
  currentMemberId: null,
  musicState: null,
  activeGame: null,
  gameNotification: null,
  isConnected: false,
  isJoining: false,
  error: null,

  setRoom: (room) => set({ room }),

  setMembers: (members) => set({ members }),

  addMember: (member) => {
    const { members } = get();
    if (members.some((m) => m.id === member.id)) return;
    set({ members: [...members, member] });
  },

  removeMember: (memberId) => {
    const { members } = get();
    set({ members: members.filter((m) => m.id !== memberId) });
  },

  updateMember: (member) => {
    const { members, messages } = get();
    set({
      members: members.map((m) => (m.id === member.id ? member : m)),
      // Also update member info in messages
      messages: messages.map((msg) =>
        msg.memberId === member.id ? { ...msg, member } : msg
      ),
    });
  },

  updateMemberPresence: (memberId, online) => {
    const { members } = get();
    set({
      members: members.map((m) =>
        m.id === memberId ? { ...m, online } : m
      ),
    });
  },

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => {
    const { messages } = get();
    if (messages.some((m) => m.id === message.id)) return;
    set({ messages: [...messages, message] });
  },

  addReaction: (messageId, reaction) => {
    const { messages } = get();
    set({
      messages: messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              reactions: [
                ...m.reactions.filter(
                  (r) => !(r.memberId === reaction.memberId && r.emoji === reaction.emoji)
                ),
                reaction,
              ],
            }
          : m
      ),
    });
  },

  removeReaction: (messageId, memberId, emoji) => {
    const { messages } = get();
    set({
      messages: messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              reactions: m.reactions.filter(
                (r) => !(r.memberId === memberId && r.emoji === emoji)
              ),
            }
          : m
      ),
    });
  },

  deleteMessage: (messageId) => {
    const { messages } = get();
    set({
      messages: messages.map((m) =>
        m.id === messageId ? { ...m, isDeleted: true } : m
      ),
    });
  },

  setCurrentMemberId: (memberId) => set({ currentMemberId: memberId }),

  setMusicState: (musicState) => set({ musicState }),

  setActiveGame: (activeGame) => set({ activeGame }),

  setGameNotification: (gameNotification) => set({ gameNotification }),

  setConnected: (isConnected) => set({ isConnected }),

  setJoining: (isJoining) => set({ isJoining }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      room: null,
      members: [],
      messages: [],
      currentMemberId: null,
      musicState: null,
      activeGame: null,
      gameNotification: null,
      isConnected: false,
      isJoining: false,
      error: null,
    }),
}));
