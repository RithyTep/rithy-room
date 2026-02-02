import type { RTCSignalData } from '@rithy-room/shared';
import type { TypedSocket } from './socket';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
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

  async getUserMedia(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    return this.localStream;
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
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

    if (signal.type === 'offer') {
      // Someone is calling us
      let pc = this.peerConnections.get(from);
      if (!pc) {
        pc = this.createPeerConnection(from);
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
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: signal.sdp,
        });
      }
    } else if (signal.type === 'candidate' && signal.candidate) {
      const pc = this.peerConnections.get(from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
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
