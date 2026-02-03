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
    participantsToCall,
    clearParticipantsToCall,
    localStream,
    isScreenSharing,
    isCameraOff,
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
    console.log('Starting call...');

    if (!managerRef.current) {
      managerRef.current = new WebRTCManager(
        getSocket(),
        (memberId, stream) => {
          console.log('Received remote stream from:', memberId);
          addRemoteStream(memberId, stream);
        },
        (memberId) => {
          console.log('Remote disconnected:', memberId);
          removeRemoteStream(memberId);
        }
      );
    }

    try {
      // Start with audio only (no camera)
      console.log('Requesting microphone access...');
      const stream = await managerRef.current.getUserMedia();
      console.log('Got local stream with tracks:', stream.getTracks().map(t => t.kind));

      setLocalStream(stream);
      setInCall(true);
      setCameraOff(true); // Camera is off by default
      setMuted(false);

      console.log('Emitting join-call...');
      getSocket().emit('join-call');
    } catch (error) {
      console.error('Failed to get user media:', error);
      // On mobile, show a more helpful error
      alert('Could not access microphone. Please allow microphone access and try again.');
    }
  }, [setLocalStream, setInCall, setCameraOff, setMuted, addRemoteStream, removeRemoteStream]);

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
    setCameraOff(true);
    getSocket().emit('leave-call');
    resetMedia();
  }, [setLocalStream, setScreenStream, setInCall, setScreenSharing, setCameraOff, resetMedia]);

  // Connect to participants we need to call (existing participants when we join)
  useEffect(() => {
    if (!managerRef.current || !localStream || !currentMemberId) return;
    if (participantsToCall.length === 0) return;

    managerRef.current.setLocalStream(localStream);

    // Initiate calls to participants we need to call
    participantsToCall.forEach((memberId) => {
      if (memberId !== currentMemberId && !managerRef.current!.getPeerConnection(memberId)) {
        console.log('Initiating call to:', memberId);
        managerRef.current!.initiateCall(memberId);
      }
    });

    // Clear the queue after initiating
    clearParticipantsToCall();
  }, [participantsToCall, localStream, currentMemberId, clearParticipantsToCall]);

  const toggleMute = useCallback(() => {
    const { isMuted } = useMediaStore.getState();
    const newMuted = !isMuted;
    setMuted(newMuted);

    // Actually mute/unmute the audio track
    if (managerRef.current) {
      managerRef.current.toggleMute(newMuted);
    }
  }, [setMuted]);

  const toggleCamera = useCallback(async () => {
    const { isCameraOff } = useMediaStore.getState();

    if (isCameraOff) {
      // Turn camera ON
      if (managerRef.current) {
        const updatedStream = await managerRef.current.enableCamera();
        if (updatedStream) {
          setLocalStream(updatedStream);
          setCameraOff(false);
        }
      }
    } else {
      // Turn camera OFF (stops the camera, turns off Mac camera light)
      if (managerRef.current) {
        await managerRef.current.disableCamera();
        setCameraOff(true);
        // Update local stream reference
        const stream = managerRef.current.getLocalStream();
        if (stream) {
          setLocalStream(stream);
        }
      }
    }
  }, [setLocalStream, setCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    const { isScreenSharing, screenStream } = useMediaStore.getState();

    if (isScreenSharing && screenStream) {
      // Stop screen sharing - remove from peers first
      if (managerRef.current) {
        await managerRef.current.removeScreenShare(screenStream);
      }
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
        stream.getVideoTracks()[0].onended = async () => {
          if (managerRef.current) {
            await managerRef.current.removeScreenShare(stream);
          }
          setScreenStream(null);
          setScreenSharing(false);
        };

        // Add screen share to all peers
        if (managerRef.current) {
          await managerRef.current.addScreenShare(stream);
        }

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
