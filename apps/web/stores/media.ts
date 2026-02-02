import { create } from 'zustand';

interface MediaState {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isInCall: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  volume: number;
  callParticipants: string[];

  // Actions
  setLocalStream: (stream: MediaStream | null) => void;
  setScreenStream: (stream: MediaStream | null) => void;
  addRemoteStream: (memberId: string, stream: MediaStream) => void;
  removeRemoteStream: (memberId: string) => void;
  setInCall: (inCall: boolean) => void;
  setMuted: (muted: boolean) => void;
  setCameraOff: (cameraOff: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setScreenSharing: (sharing: boolean) => void;
  setVolume: (volume: number) => void;
  addCallParticipant: (memberId: string) => void;
  removeCallParticipant: (memberId: string) => void;
  reset: () => void;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  localStream: null,
  screenStream: null,
  remoteStreams: new Map(),
  isInCall: false,
  isMuted: false,
  isCameraOff: false,
  isDeafened: false,
  isScreenSharing: false,
  volume: 100,
  callParticipants: [],

  setLocalStream: (stream) => set({ localStream: stream }),

  setScreenStream: (stream) => set({ screenStream: stream }),

  addRemoteStream: (memberId, stream) =>
    set((state) => {
      const newStreams = new Map(state.remoteStreams);
      newStreams.set(memberId, stream);
      return { remoteStreams: newStreams };
    }),

  removeRemoteStream: (memberId) =>
    set((state) => {
      const newStreams = new Map(state.remoteStreams);
      newStreams.delete(memberId);
      return { remoteStreams: newStreams };
    }),

  setInCall: (isInCall) => set({ isInCall }),

  setMuted: (isMuted) => {
    const { localStream } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
    set({ isMuted });
  },

  setCameraOff: (isCameraOff) => {
    const { localStream } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isCameraOff;
      });
    }
    set({ isCameraOff });
  },

  setDeafened: (isDeafened) => {
    const { remoteStreams, volume } = get();
    // Mute/unmute all remote audio
    remoteStreams.forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isDeafened;
      });
    });
    set({ isDeafened });
  },

  setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),

  setVolume: (volume) => set({ volume }),

  addCallParticipant: (memberId) =>
    set((state) => ({
      callParticipants: state.callParticipants.includes(memberId)
        ? state.callParticipants
        : [...state.callParticipants, memberId],
    })),

  removeCallParticipant: (memberId) =>
    set((state) => ({
      callParticipants: state.callParticipants.filter((id) => id !== memberId),
    })),

  reset: () =>
    set({
      localStream: null,
      screenStream: null,
      remoteStreams: new Map(),
      isInCall: false,
      isMuted: false,
      isCameraOff: false,
      isDeafened: false,
      isScreenSharing: false,
      volume: 100,
      callParticipants: [],
    }),
}));
