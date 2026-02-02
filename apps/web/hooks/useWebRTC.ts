'use client';

import { useEffect, useRef, useCallback } from 'react';
import { WebRTCManager } from '@/lib/webrtc';
import { useMediaStore } from '@/stores/media';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';
import type { TypedSocket } from '@/lib/socket';

export function useWebRTC(socket: TypedSocket) {
  const managerRef = useRef<WebRTCManager | null>(null);
  const {
    setLocalStream,
    setScreenStream,
    addRemoteStream,
    removeRemoteStream,
    setInCall,
    setMuted,
    setCameraOff,
    setScreenSharing,
    setVolume,
    callParticipants,
    localStream,
    isScreenSharing,
    reset: resetMedia,
  } = useMediaStore();
  const { currentMemberId } = useRoomStore();

  useEffect(() => {
    if (!socket.connected) return;

    if (!managerRef.current) {
      managerRef.current = new WebRTCManager(
        socket,
        (memberId, stream) => {
          addRemoteStream(memberId, stream);
        },
        (memberId) => {
          removeRemoteStream(memberId);
        }
      );
    }

    return () => {
      // Don't cleanup on every render, only when truly unmounting
    };
  }, [socket.connected, addRemoteStream, removeRemoteStream]);

  const startCall = useCallback(async () => {
    if (!managerRef.current) {
      managerRef.current = new WebRTCManager(
        getSocket(),
        (memberId, stream) => addRemoteStream(memberId, stream),
        (memberId) => removeRemoteStream(memberId)
      );
    }

    try {
      const stream = await managerRef.current.getUserMedia();
      setLocalStream(stream);
      setInCall(true);
      getSocket().emit('join-call');
    } catch (error) {
      console.error('Failed to get user media:', error);
    }
  }, [setLocalStream, setInCall, addRemoteStream, removeRemoteStream]);

  const endCall = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.closeAll();
    }
    // Stop screen sharing if active
    const { screenStream } = useMediaStore.getState();
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    setScreenStream(null);
    setInCall(false);
    setScreenSharing(false);
    getSocket().emit('leave-call');
    resetMedia();
  }, [setLocalStream, setScreenStream, setInCall, setScreenSharing, resetMedia]);

  // Connect to new participants
  useEffect(() => {
    if (!managerRef.current || !localStream || !currentMemberId) return;

    managerRef.current.setLocalStream(localStream);

    callParticipants.forEach((memberId) => {
      if (memberId !== currentMemberId && !managerRef.current!.getPeerConnection(memberId)) {
        managerRef.current!.initiateCall(memberId);
      }
    });
  }, [callParticipants, localStream, currentMemberId]);

  const toggleMute = useCallback(() => {
    const { isMuted } = useMediaStore.getState();
    setMuted(!isMuted);
  }, [setMuted]);

  const toggleCamera = useCallback(() => {
    const { isCameraOff } = useMediaStore.getState();
    setCameraOff(!isCameraOff);
  }, [setCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    const { isScreenSharing, screenStream } = useMediaStore.getState();

    if (isScreenSharing && screenStream) {
      // Stop screen sharing
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      setScreenSharing(false);
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        // Handle when user clicks "Stop sharing" in browser UI
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          setScreenSharing(false);
        };

        setScreenStream(stream);
        setScreenSharing(true);
      } catch (error) {
        console.error('Failed to share screen:', error);
      }
    }
  }, [setScreenStream, setScreenSharing]);

  const changeVolume = useCallback((volume: number) => {
    setVolume(volume);
    // Apply volume to all remote streams
    const { remoteStreams } = useMediaStore.getState();
    remoteStreams.forEach((stream) => {
      // Volume is applied via audio elements in VideoTile
    });
  }, [setVolume]);

  return {
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    changeVolume,
  };
}
