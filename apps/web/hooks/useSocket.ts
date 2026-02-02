'use client';

import { useEffect, useCallback } from 'react';
import { getSocket, socketManager } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useMediaStore } from '@/stores/media';

export function useSocket() {
  const {
    setRoom,
    setMembers,
    setMessages,
    setCurrentMemberId,
    addMember,
    updateMember,
    updateMemberPresence,
    addMessage,
    addReaction,
    removeReaction,
    deleteMessage,
    setMusicState,
    setConnected,
    setJoining,
    setError,
  } = useRoomStore();
  const { addCallParticipant, removeCallParticipant } = useMediaStore();

  useEffect(() => {
    // Only initialize once
    if (socketManager.isInitialized()) {
      return;
    }
    socketManager.setInitialized(true);

    const socket = getSocket();

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    socket.on('room-joined', (data) => {
      console.log('Room joined:', data.room.slug);
      setRoom(data.room);
      setMembers(data.members);
      setMessages(data.messages);
      setCurrentMemberId(data.memberId);
      setJoining(false);
    });

    socket.on('member-joined', ({ member }) => {
      addMember(member);
    });

    socket.on('member-left', ({ memberId }) => {
      updateMemberPresence(memberId, false);
    });

    socket.on('presence-update', ({ memberId, online }) => {
      updateMemberPresence(memberId, online);
    });

    socket.on('member-updated', ({ member }) => {
      updateMember(member);
    });

    socket.on('new-message', ({ message }) => {
      addMessage(message);
    });

    socket.on('message-deleted', ({ messageId }) => {
      deleteMessage(messageId);
    });

    socket.on('reaction-added', ({ messageId, reaction }) => {
      addReaction(messageId, reaction);
    });

    socket.on('reaction-removed', ({ messageId, memberId, emoji }) => {
      removeReaction(messageId, memberId, emoji);
    });

    socket.on('user-joined-call', ({ memberId }) => {
      addCallParticipant(memberId);
    });

    socket.on('user-left-call', ({ memberId }) => {
      removeCallParticipant(memberId);
    });

    socket.on('music-update', (state) => {
      setMusicState(state);
    });

    socket.on('error', ({ message }) => {
      setError(message);
    });

    // Set initial connection state
    if (socket.connected) {
      setConnected(true);
    }
  }, []);

  const joinRoom = useCallback((slug: string, name: string) => {
    const socket = getSocket();
    setJoining(true);
    setError(null);

    socket.emit('join-room', { slug, name }, (response) => {
      if (!response.success) {
        setError(response.error || 'Failed to join room');
        setJoining(false);
      }
    });
  }, [setJoining, setError]);

  const sendMessage = useCallback((text: string, imageUrl?: string, audioUrl?: string) => {
    const socket = getSocket();
    socket.emit('send-message', { text, imageUrl, audioUrl });
  }, []);

  const reactToMessage = useCallback((messageId: string, emoji: string) => {
    const socket = getSocket();
    socket.emit('react-message', { messageId, emoji });
  }, []);

  const removeReactionFromMessage = useCallback((messageId: string, emoji: string) => {
    const socket = getSocket();
    socket.emit('remove-reaction', { messageId, emoji });
  }, []);

  const deleteMessageFromServer = useCallback((messageId: string) => {
    const socket = getSocket();
    socket.emit('delete-message', { messageId });
  }, []);

  const joinCall = useCallback(() => {
    const socket = getSocket();
    socket.emit('join-call');
  }, []);

  const leaveCall = useCallback(() => {
    const socket = getSocket();
    socket.emit('leave-call');
  }, []);

  const syncMusic = useCallback((url: string, playing: boolean, currentTime: number) => {
    const socket = getSocket();
    const { currentMemberId } = useRoomStore.getState();
    if (currentMemberId) {
      socket.emit('music-sync', {
        url,
        playing,
        currentTime,
        updatedBy: currentMemberId,
      });
    }
  }, []);

  const updateProfile = useCallback((name?: string, avatarUrl?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = getSocket();
      socket.emit('update-profile', { name, avatarUrl }, (response) => {
        resolve(response.success);
      });
    });
  }, []);

  return {
    socket: getSocket(),
    joinRoom,
    sendMessage,
    reactToMessage,
    removeReactionFromMessage,
    deleteMessage: deleteMessageFromServer,
    joinCall,
    leaveCall,
    syncMusic,
    updateProfile,
  };
}
