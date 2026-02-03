import type { RTCSignalData } from '@rithy-room/shared';
import type { TypedSocket } from './socket';

// Keep ICE servers to max 4 to avoid "Using five or more STUN/TURN servers" warning
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // OpenRelay TURN server for NAT traversal
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private socket: TypedSocket;
  private localStream: MediaStream | null = null;
  private onRemoteStream: (memberId: string, stream: MediaStream) => void;
  private onRemoteDisconnect: (memberId: string) => void;

  constructor(
    socket: TypedSocket,
    onRemoteStream: (memberId: string, stream: MediaStream) => void,
    onRemoteDisconnect: (memberId: string) => void
  ) {
    this.socket = socket;
    this.onRemoteStream = onRemoteStream;
    this.onRemoteDisconnect = onRemoteDisconnect;

    // Listen for incoming signals
    this.socket.on('webrtc-signal', this.handleSignal.bind(this));
  }

  // Start with audio only (no camera by default)
  async getUserMedia(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    return this.localStream;
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Enable camera - adds video track and renegotiates with peers
  async enableCamera(): Promise<MediaStream | null> {
    if (!this.localStream) return null;

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      const videoTrack = videoStream.getVideoTracks()[0];
      this.localStream.addTrack(videoTrack);

      // Add video track to all peer connections and renegotiate
      for (const [memberId, pc] of this.peerConnections) {
        pc.addTrack(videoTrack, this.localStream!);
        await this.renegotiate(memberId, pc);
      }

      return this.localStream;
    } catch (error) {
      console.error('Failed to enable camera:', error);
      return null;
    }
  }

  // Disable camera - removes and stops video track
  async disableCamera(): Promise<void> {
    if (!this.localStream) return;

    const videoTracks = this.localStream.getVideoTracks();
    for (const track of videoTracks) {
      // Stop the track (turns off camera light)
      track.stop();
      // Remove from local stream
      this.localStream!.removeTrack(track);

      // Remove from all peer connections
      for (const [memberId, pc] of this.peerConnections) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track === track);
        if (videoSender) {
          pc.removeTrack(videoSender);
          await this.renegotiate(memberId, pc);
        }
      }
    }
  }

  // Renegotiate connection after adding/removing tracks
  private async renegotiate(memberId: string, pc: RTCPeerConnection): Promise<void> {
    // Only renegotiate if connection is in stable state to avoid glare
    if (pc.signalingState !== 'stable') {
      console.log('Skipping renegotiation, signaling state:', pc.signalingState);
      return;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.socket.emit('webrtc-signal', {
        to: memberId,
        signal: {
          type: 'offer',
          sdp: offer.sdp,
        },
      });
    } catch (error) {
      console.error('Renegotiation failed:', error);
    }
  }

  // Add screen share tracks to all peers
  async addScreenShare(screenStream: MediaStream): Promise<void> {
    const videoTrack = screenStream.getVideoTracks()[0];
    if (!videoTrack) return;

    for (const [memberId, pc] of this.peerConnections) {
      pc.addTrack(videoTrack, screenStream);
      await this.renegotiate(memberId, pc);
    }
  }

  // Remove screen share tracks from all peers
  async removeScreenShare(screenStream: MediaStream): Promise<void> {
    const videoTrack = screenStream.getVideoTracks()[0];
    if (!videoTrack) return;

    for (const [memberId, pc] of this.peerConnections) {
      const senders = pc.getSenders();
      const screenSender = senders.find((s) => s.track === videoTrack);
      if (screenSender) {
        pc.removeTrack(screenSender);
        await this.renegotiate(memberId, pc);
      }
    }
  }

  // Toggle mute - enables/disables audio track without stopping it
  toggleMute(mute: boolean): void {
    if (!this.localStream) return;

    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !mute;
    });
  }

  private createPeerConnection(memberId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc-signal', {
          to: memberId,
          signal: {
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    pc.ontrack = (event) => {
      this.onRemoteStream(memberId, event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed'
      ) {
        this.onRemoteDisconnect(memberId);
        this.closePeerConnection(memberId);
      }
    };

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    this.peerConnections.set(memberId, pc);
    return pc;
  }

  async initiateCall(memberId: string): Promise<void> {
    const pc = this.createPeerConnection(memberId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.socket.emit('webrtc-signal', {
      to: memberId,
      signal: {
        type: 'offer',
        sdp: offer.sdp,
      },
    });
  }

  private async handleSignal(data: {
    from: string;
    signal: RTCSignalData;
  }): Promise<void> {
    const { from, signal } = data;

    try {
      if (signal.type === 'offer') {
        // Someone is calling us or renegotiating
        let pc = this.peerConnections.get(from);
        if (!pc) {
          pc = this.createPeerConnection(from);
        }

        // Handle glare: if we're also in the middle of sending an offer
        // The peer with the "lower" ID should rollback (simple tiebreaker)
        if (pc.signalingState === 'have-local-offer') {
          // Glare detected - rollback our offer and accept theirs
          console.log('Glare detected, rolling back local offer');
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription({
          type: 'offer',
          sdp: signal.sdp,
        });

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.emit('webrtc-signal', {
          to: from,
          signal: {
            type: 'answer',
            sdp: answer.sdp,
          },
        });
      } else if (signal.type === 'answer') {
        const pc = this.peerConnections.get(from);
        if (pc) {
          // Only set remote answer if we're expecting one
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription({
              type: 'answer',
              sdp: signal.sdp,
            });
          } else {
            console.log('Ignoring answer, not in have-local-offer state:', pc.signalingState);
          }
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        const pc = this.peerConnections.get(from);
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }

  closePeerConnection(memberId: string): void {
    const pc = this.peerConnections.get(memberId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(memberId);
    }
  }

  closeAll(): void {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  getPeerConnection(memberId: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(memberId);
  }
}
