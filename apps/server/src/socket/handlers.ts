import { Server, Socket } from 'socket.io';
import { prisma } from '../db/prisma.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  CallParticipant,
  MusicState,
} from '@rithy-room/shared';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// Track active call participants per room
const roomCalls = new Map<string, Set<CallParticipant>>();

// Track socket to member mapping
const socketToMember = new Map<
  string,
  { memberId: string; roomId: string; roomSlug: string }
>();

// Track music state per room
const roomMusic = new Map<string, MusicState>();

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Create room
    socket.on('create-room', async ({ slug }, callback) => {
      try {
        const existingRoom = await prisma.room.findUnique({
          where: { slug },
        });

        if (existingRoom) {
          callback({ success: false, error: 'Room already exists' });
          return;
        }

        await prisma.room.create({
          data: { slug },
        });

        callback({ success: true });
      } catch (error) {
        console.error('Error creating room:', error);
        callback({ success: false, error: 'Failed to create room' });
      }
    });

    // Join room
    socket.on('join-room', async ({ slug, name }, callback) => {
      try {
        // Find or create room
        let room = await prisma.room.findUnique({
          where: { slug },
        });

        if (!room) {
          room = await prisma.room.create({
            data: { slug },
          });
        }

        // Find existing member or create new one
        let member = await prisma.member.findFirst({
          where: {
            roomId: room.id,
            name: name,
          },
        });

        if (member) {
          // Update existing member
          member = await prisma.member.update({
            where: { id: member.id },
            data: {
              online: true,
              socketId: socket.id,
            },
          });
        } else {
          // Create new member
          member = await prisma.member.create({
            data: {
              roomId: room.id,
              name,
              online: true,
              socketId: socket.id,
            },
          });
        }

        // Track socket to member mapping
        socketToMember.set(socket.id, {
          memberId: member.id,
          roomId: room.id,
          roomSlug: slug,
        });

        // Join socket room
        socket.join(slug);

        // Get all members and messages
        const members = await prisma.member.findMany({
          where: { roomId: room.id },
        });

        const messages = await prisma.message.findMany({
          where: { roomId: room.id },
          include: {
            member: true,
            reactions: true,
          },
          orderBy: { createdAt: 'asc' },
          take: 100,
        });

        // Send room data to joining user
        socket.emit('room-joined', {
          room,
          members,
          messages,
          memberId: member.id,
        });

        // Notify others in room
        socket.to(slug).emit('member-joined', { member });

        // If there's music playing, send current state
        const musicState = roomMusic.get(slug);
        if (musicState) {
          socket.emit('music-update', musicState);
        }

        callback({ success: true });
      } catch (error) {
        console.error('Error joining room:', error);
        callback({ success: false, error: 'Failed to join room' });
      }
    });

    // Send message
    socket.on('send-message', async ({ text, imageUrl, audioUrl }) => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      try {
        const message = await prisma.message.create({
          data: {
            roomId: memberInfo.roomId,
            memberId: memberInfo.memberId,
            text,
            imageUrl: imageUrl || null,
            audioUrl: audioUrl || null,
          },
          include: {
            member: true,
            reactions: true,
          },
        });

        io.to(memberInfo.roomSlug).emit('new-message', { message });
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // React to message
    socket.on('react-message', async ({ messageId, emoji }) => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      try {
        const reaction = await prisma.reaction.upsert({
          where: {
            messageId_memberId_emoji: {
              messageId,
              memberId: memberInfo.memberId,
              emoji,
            },
          },
          create: {
            messageId,
            memberId: memberInfo.memberId,
            emoji,
          },
          update: {},
        });

        io.to(memberInfo.roomSlug).emit('reaction-added', {
          messageId,
          reaction,
        });
      } catch (error) {
        console.error('Error adding reaction:', error);
      }
    });

    // Remove reaction
    socket.on('remove-reaction', async ({ messageId, emoji }) => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      try {
        await prisma.reaction.delete({
          where: {
            messageId_memberId_emoji: {
              messageId,
              memberId: memberInfo.memberId,
              emoji,
            },
          },
        });

        io.to(memberInfo.roomSlug).emit('reaction-removed', {
          messageId,
          memberId: memberInfo.memberId,
          emoji,
        });
      } catch (error) {
        console.error('Error removing reaction:', error);
      }
    });

    // Join call
    socket.on('join-call', () => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      let participants = roomCalls.get(memberInfo.roomSlug);
      if (!participants) {
        participants = new Set();
        roomCalls.set(memberInfo.roomSlug, participants);
      }

      participants.add({
        memberId: memberInfo.memberId,
        socketId: socket.id,
      });

      // Notify others in room
      socket.to(memberInfo.roomSlug).emit('user-joined-call', {
        memberId: memberInfo.memberId,
      });
    });

    // Leave call
    socket.on('leave-call', () => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      const participants = roomCalls.get(memberInfo.roomSlug);
      if (participants) {
        for (const p of participants) {
          if (p.socketId === socket.id) {
            participants.delete(p);
            break;
          }
        }
      }

      socket.to(memberInfo.roomSlug).emit('user-left-call', {
        memberId: memberInfo.memberId,
      });
    });

    // WebRTC signaling
    socket.on('webrtc-signal', ({ to, signal }) => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      // Find target socket by member ID
      const participants = roomCalls.get(memberInfo.roomSlug);
      if (participants) {
        for (const p of participants) {
          if (p.memberId === to) {
            io.to(p.socketId).emit('webrtc-signal', {
              from: memberInfo.memberId,
              signal,
            });
            break;
          }
        }
      }
    });

    // Music sync
    socket.on('music-sync', (musicState) => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      roomMusic.set(memberInfo.roomSlug, musicState);
      socket.to(memberInfo.roomSlug).emit('music-update', musicState);
    });

    // Update profile
    socket.on('update-profile', async ({ name, avatarUrl }, callback) => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }

      try {
        const updateData: { name?: string; avatarUrl?: string } = {};
        if (name) updateData.name = name;
        if (avatarUrl) updateData.avatarUrl = avatarUrl;

        const updatedMember = await prisma.member.update({
          where: { id: memberInfo.memberId },
          data: updateData,
        });

        // Notify everyone in the room about the update
        io.to(memberInfo.roomSlug).emit('member-updated', { member: updatedMember });

        callback({ success: true });
      } catch (error) {
        console.error('Error updating profile:', error);
        callback({ success: false, error: 'Failed to update profile' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);

      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      // Update member status
      try {
        await prisma.member.update({
          where: { id: memberInfo.memberId },
          data: { online: false, socketId: null },
        });

        // Notify others
        socket.to(memberInfo.roomSlug).emit('presence-update', {
          memberId: memberInfo.memberId,
          online: false,
        });

        // Remove from call if in call
        const participants = roomCalls.get(memberInfo.roomSlug);
        if (participants) {
          for (const p of participants) {
            if (p.socketId === socket.id) {
              participants.delete(p);
              socket.to(memberInfo.roomSlug).emit('user-left-call', {
                memberId: memberInfo.memberId,
              });
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }

      socketToMember.delete(socket.id);
    });
  });
}
