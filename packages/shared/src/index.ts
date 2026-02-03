// Room types
export interface Room {
  id: string;
  slug: string;
  createdAt: Date;
}

export interface Member {
  id: string;
  roomId: string;
  name: string;
  avatarUrl?: string | null;
  online: boolean;
  socketId: string | null;
  createdAt: Date;
}

export interface Message {
  id: string;
  roomId: string;
  memberId: string;
  member: Member;
  text: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  isDeleted?: boolean;
  createdAt: Date;
  reactions: Reaction[];
}

export interface Reaction {
  id: string;
  messageId: string;
  memberId: string;
  emoji: string;
}

// Socket event types
export interface ServerToClientEvents {
  'room-joined': (data: {
    room: Room;
    members: Member[];
    messages: Message[];
    memberId: string;
  }) => void;
  'member-joined': (data: { member: Member }) => void;
  'member-left': (data: { memberId: string }) => void;
  'new-message': (data: { message: Message }) => void;
  'message-deleted': (data: { messageId: string }) => void;
  'reaction-added': (data: {
    messageId: string;
    reaction: Reaction;
  }) => void;
  'reaction-removed': (data: {
    messageId: string;
    memberId: string;
    emoji: string;
  }) => void;
  'presence-update': (data: { memberId: string; online: boolean }) => void;
  'member-updated': (data: { member: Member }) => void;
  'webrtc-signal': (data: {
    from: string;
    signal: RTCSignalData;
  }) => void;
  'user-joined-call': (data: { memberId: string }) => void;
  'user-left-call': (data: { memberId: string }) => void;
  'call-participants': (data: { participants: string[] }) => void;
  'music-update': (data: MusicState) => void;
  'game-started': (data: { game: GameItem; startedBy: string; startedByName: string }) => void;
  'game-ended': () => void;
  'game-state': (data: { game: GameItem; startedBy: string; startedByName: string } | null) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'create-room': (
    data: { slug: string },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void;
  'join-room': (
    data: { slug: string; name: string },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void;
  'send-message': (data: { text: string; imageUrl?: string; audioUrl?: string }) => void;
  'delete-message': (data: { messageId: string }) => void;
  'react-message': (data: { messageId: string; emoji: string }) => void;
  'remove-reaction': (data: { messageId: string; emoji: string }) => void;
  'update-profile': (
    data: { name?: string; avatarUrl?: string },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void;
  'join-call': () => void;
  'leave-call': () => void;
  'webrtc-signal': (data: { to: string; signal: RTCSignalData }) => void;
  'music-sync': (data: MusicState) => void;
  'start-game': (data: { gameId: string }) => void;
  'end-game': () => void;
}

export interface RTCSignalData {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

export interface MusicState {
  url: string;
  playing: boolean;
  currentTime: number;
  updatedBy: string;
}

// Call participant tracking
export interface CallParticipant {
  memberId: string;
  socketId: string;
}

// Game types
export interface GameItem {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  url: string;
  maxPlayers: string;
  category: 'action' | 'racing' | 'puzzle' | 'sports' | 'io';
  tags: string[];
}

export interface GameSession {
  gameId: string;
  game: GameItem;
  startedBy: string;
  startedAt: Date;
}
