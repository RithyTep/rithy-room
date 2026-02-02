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
  'webrtc-signal': (data: {
    from: string;
    signal: RTCSignalData;
  }) => void;
  'user-joined-call': (data: { memberId: string }) => void;
  'user-left-call': (data: { memberId: string }) => void;
  'music-update': (data: MusicState) => void;
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
  'react-message': (data: { messageId: string; emoji: string }) => void;
  'remove-reaction': (data: { messageId: string; emoji: string }) => void;
  'join-call': () => void;
  'leave-call': () => void;
  'webrtc-signal': (data: { to: string; signal: RTCSignalData }) => void;
  'music-sync': (data: MusicState) => void;
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
