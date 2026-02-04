import { Server, Socket } from 'socket.io';
import { prisma } from '../db/prisma.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  CallParticipant,
  MusicState,
  GameItem,
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

// Track active games per room
interface ActiveGame {
  game: GameItem;
  startedBy: string;
  startedByName: string;
  startedAt: Date;
}
const roomGames = new Map<string, ActiveGame>();

// Games catalog (duplicated from web for server-side validation)
// Images are served from /images/games/{category}/{game-id}.jpg
const GAMES_CATALOG: GameItem[] = [
  // ==================== WEB GAMES ====================
  { id: 'smash-karts', name: 'Smash Karts', description: 'Multiplayer kart battle arena with power-ups and weapons', thumbnail: '/images/games/web/smash-karts.jpg', url: 'https://smashkarts.io', maxPlayers: '8', category: 'racing', tags: ['action', 'karts', 'multiplayer', 'popular'] },
  { id: 'bloxd-io', name: 'Bloxd.io', description: 'Minecraft-like multiplayer building and survival game', thumbnail: '/images/games/web/bloxd-io.jpg', url: 'https://bloxd.io', maxPlayers: '20', category: 'io', tags: ['building', 'survival', 'minecraft', 'popular'] },
  { id: 'shell-shockers', name: 'Shell Shockers', description: 'First-person shooter where everyone is an egg', thumbnail: '/images/games/web/shell-shockers.jpg', url: 'https://shellshock.io', maxPlayers: '8', category: 'action', tags: ['fps', 'shooter', 'eggs', 'popular'] },
  { id: 'krunker', name: 'Krunker.io', description: 'Fast-paced pixelated first-person shooter', thumbnail: '/images/games/web/krunker.jpg', url: 'https://krunker.io', maxPlayers: '10', category: 'action', tags: ['fps', 'shooter', 'fast-paced', 'popular'] },
  { id: 'agar-io', name: 'Agar.io', description: 'Classic cell-eating multiplayer game', thumbnail: '/images/games/web/agar-io.jpg', url: 'https://agar.io', maxPlayers: 'Unlimited', category: 'io', tags: ['casual', 'classic', 'cells'] },
  { id: 'slither-io', name: 'Slither.io', description: 'Snake-like multiplayer game - grow longer and survive', thumbnail: '/images/games/web/slither-io.jpg', url: 'https://slither.io', maxPlayers: 'Unlimited', category: 'io', tags: ['snake', 'casual', 'classic'] },
  { id: '1v1-lol', name: '1v1.LOL', description: 'Build and shoot battle royale style combat', thumbnail: '/images/games/web/1v1-lol.jpg', url: 'https://1v1.lol', maxPlayers: '2', category: 'action', tags: ['building', 'shooter', 'battle-royale'] },
  { id: 'paper-io-2', name: 'Paper.io 2', description: 'Claim territory by drawing shapes - dont get cut!', thumbnail: '/images/games/web/paper-io-2.jpg', url: 'https://paper-io.com', maxPlayers: 'Unlimited', category: 'io', tags: ['casual', 'territory', 'strategy'] },
  { id: 'basketball-stars', name: 'Basketball Stars', description: '1v1 basketball with tricks and moves', thumbnail: '/images/games/web/basketball-stars.jpg', url: 'https://www.crazygames.com/game/basketball-stars', maxPlayers: '2', category: 'sports', tags: ['basketball', 'sports', '1v1'] },
  { id: 'narrow-one', name: 'Narrow One', description: 'Medieval castle siege with bows and arrows', thumbnail: '/images/games/web/narrow-one.jpg', url: 'https://www.crazygames.com/game/narrow-one', maxPlayers: '8', category: 'action', tags: ['medieval', 'archery', 'team', 'popular'] },
  { id: 'hole-io', name: 'Hole.io', description: 'Control a black hole and swallow everything', thumbnail: '/images/games/web/hole-io.jpg', url: 'https://hole-io.com', maxPlayers: 'Unlimited', category: 'io', tags: ['casual', 'destruction', 'fun'] },
  { id: 'zombs-royale', name: 'ZombsRoyale.io', description: '2D battle royale with 100 players', thumbnail: '/images/games/web/zombs-royale.jpg', url: 'https://zombsroyale.io', maxPlayers: '100', category: 'action', tags: ['battle-royale', 'shooter', '2d'] },
  // ==================== PS1 GAMES ====================
  { id: 'crash-bandicoot', name: 'Crash Bandicoot', description: 'Classic platform adventure with Crash', thumbnail: '/images/games/ps1/crash-bandicoot.jpg', url: 'https://www.retrogames.cc/psx-games/crash-bandicoot.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'crash', 'playstation', 'popular'] },
  { id: 'spyro-dragon', name: 'Spyro the Dragon', description: '3D platformer adventure with the purple dragon', thumbnail: '/images/games/ps1/spyro-the-dragon.jpg', url: 'https://www.retrogames.cc/psx-games/spyro-the-dragon-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'spyro', 'playstation', 'popular'] },
  { id: 'tekken-3', name: 'Tekken 3', description: 'Legendary fighting game', thumbnail: '/images/games/ps1/tekken-3.jpg', url: 'https://www.retrogames.cc/psx-games/tekken-3.html', maxPlayers: '2', category: 'ps1', tags: ['fighting', 'arcade', 'popular'] },
  { id: 'final-fantasy-7', name: 'Final Fantasy VII', description: 'Epic RPG - Follow Cloud and AVALANCHE', thumbnail: '/images/games/ps1/final-fantasy-7.jpg', url: 'https://www.retrogames.cc/psx-games/final-fantasy-vii-usa-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['rpg', 'jrpg', 'squaresoft', 'popular'] },
  { id: 'metal-gear-solid', name: 'Metal Gear Solid', description: 'Stealth action - Solid Snake infiltrates', thumbnail: '/images/games/ps1/metal-gear-solid.jpg', url: 'https://www.retrogames.cc/psx-games/metal-gear-solid-usa-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['stealth', 'action', 'konami', 'popular'] },
  { id: 'resident-evil', name: 'Resident Evil', description: 'Survival horror classic - Escape the mansion', thumbnail: '/images/games/ps1/resident-evil.jpg', url: 'https://www.retrogames.cc/psx-games/resident-evil-usa.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'capcom'] },
  { id: 'gran-turismo', name: 'Gran Turismo', description: 'The real driving simulator', thumbnail: '/images/games/ps1/gran-turismo.jpg', url: 'https://www.retrogames.cc/psx-games/gran-turismo-usa.html', maxPlayers: '2', category: 'ps1', tags: ['racing', 'simulator', 'cars'] },
  { id: 'tony-hawk-2', name: "Tony Hawk's Pro Skater 2", description: 'Skateboarding classic - nail those combos', thumbnail: '/images/games/ps1/tony-hawk-2.jpg', url: 'https://www.retrogames.cc/psx-games/tony-hawks-pro-skater-2-usa.html', maxPlayers: '2', category: 'ps1', tags: ['sports', 'skateboard', 'popular'] },
  { id: 'castlevania-sotn', name: 'Castlevania: SOTN', description: 'Symphony of the Night - Explore Draculas castle', thumbnail: '/images/games/ps1/castlevania-sotn.jpg', url: 'https://www.retrogames.cc/psx-games/castlevania-symphony-of-the-night-usa.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'metroidvania', 'konami', 'popular'] },
  { id: 'crash-team-racing', name: 'Crash Team Racing', description: 'Kart racing with Crash characters', thumbnail: '/images/games/ps1/crash-team-racing.jpg', url: 'https://www.retrogames.cc/psx-games/crash-team-racing-usa.html', maxPlayers: '4', category: 'ps1', tags: ['racing', 'crash', 'multiplayer'] },
  { id: 'crash-bandicoot-2', name: 'Crash Bandicoot 2', description: 'Cortex Strikes Back - more platforming fun', thumbnail: '/images/games/ps1/crash-bandicoot-2.jpg', url: 'https://www.retrogames.cc/psx-games/crash-bandicoot-2-cortex-strikes-back-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'crash', 'popular'] },
  { id: 'crash-bandicoot-3', name: 'Crash Bandicoot 3: Warped', description: 'Time-traveling platformer adventure', thumbnail: '/images/games/ps1/crash-bandicoot-3.jpg', url: 'https://www.retrogames.cc/psx-games/crash-bandicoot-warped-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'crash', 'popular'] },
  { id: 'spyro-2', name: 'Spyro 2: Riptos Rage', description: 'Dragon adventure continues', thumbnail: '/images/games/ps1/spyro-2.jpg', url: 'https://www.retrogames.cc/psx-games/spyro-2-riptos-rage-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'spyro', 'popular'] },
  { id: 'resident-evil-2', name: 'Resident Evil 2', description: 'Survival horror in Raccoon City', thumbnail: '/images/games/ps1/resident-evil-2.jpg', url: 'https://www.retrogames.cc/psx-games/resident-evil-2-usa-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'capcom', 'popular'] },
  { id: 'twisted-metal-2', name: 'Twisted Metal 2', description: 'Vehicular combat destruction', thumbnail: '/images/games/ps1/twisted-metal-2.jpg', url: 'https://www.retrogames.cc/psx-games/twisted-metal-2-usa.html', maxPlayers: '2', category: 'ps1', tags: ['action', 'vehicles', 'multiplayer'] },
  { id: 'ape-escape', name: 'Ape Escape', description: 'Catch monkeys with gadgets', thumbnail: '/images/games/ps1/ape-escape.jpg', url: 'https://www.retrogames.cc/psx-games/ape-escape-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'action', 'sony'] },
  { id: 'medievil', name: 'MediEvil', description: 'Undead knight adventure', thumbnail: '/images/games/ps1/medievil.jpg', url: 'https://www.retrogames.cc/psx-games/medievil-usa.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'adventure', 'horror'] },
  { id: 'silent-hill', name: 'Silent Hill', description: 'Psychological horror classic', thumbnail: '/images/games/ps1/silent-hill.jpg', url: 'https://www.retrogames.cc/psx-games/silent-hill-usa.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'konami', 'popular'] },
  { id: 'tomb-raider', name: 'Tomb Raider', description: 'Lara Croft adventure begins', thumbnail: '/images/games/ps1/tomb-raider.jpg', url: 'https://www.retrogames.cc/psx-games/tomb-raider-usa.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'adventure', 'popular'] },
  { id: 'wipeout-xl', name: 'Wipeout XL', description: 'Futuristic anti-gravity racing', thumbnail: '/images/games/ps1/wipeout-xl.jpg', url: 'https://www.retrogames.cc/psx-games/wipeout-xl-usa.html', maxPlayers: '2', category: 'ps1', tags: ['racing', 'futuristic', 'fast'] },
  { id: 'parappa-rapper', name: 'PaRappa the Rapper', description: 'Kick punch its all in the mind', thumbnail: '/images/games/ps1/parappa-rapper.jpg', url: 'https://www.retrogames.cc/psx-games/parappa-the-rapper-usa.html', maxPlayers: '1', category: 'ps1', tags: ['rhythm', 'music', 'unique'] },
  { id: 'syphon-filter', name: 'Syphon Filter', description: 'Third-person stealth action', thumbnail: '/images/games/ps1/syphon-filter.jpg', url: 'https://www.retrogames.cc/psx-games/syphon-filter-usa.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'stealth', 'shooter'] },
  { id: 'dino-crisis', name: 'Dino Crisis', description: 'Resident Evil with dinosaurs', thumbnail: '/images/games/ps1/dino-crisis.jpg', url: 'https://www.retrogames.cc/psx-games/dino-crisis-usa.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'capcom'] },
  { id: 'vagrant-story', name: 'Vagrant Story', description: 'Dark action RPG', thumbnail: '/images/games/ps1/vagrant-story.jpg', url: 'https://www.retrogames.cc/psx-games/vagrant-story-usa.html', maxPlayers: '1', category: 'ps1', tags: ['rpg', 'action', 'squaresoft'] },
];

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

        // If there's an active game, send current state
        const gameState = roomGames.get(slug);
        if (gameState) {
          socket.emit('game-state', {
            game: gameState.game,
            startedBy: gameState.startedBy,
            startedByName: gameState.startedByName,
          });
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

    // Delete message (soft delete - marks as deleted)
    socket.on('delete-message', async ({ messageId }) => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      try {
        // Verify the message belongs to the user
        const message = await prisma.message.findUnique({
          where: { id: messageId },
        });

        if (!message || message.memberId !== memberInfo.memberId) {
          socket.emit('error', { message: 'Cannot delete this message' });
          return;
        }

        // Soft delete - mark as deleted
        await prisma.message.update({
          where: { id: messageId },
          data: { isDeleted: true },
        });

        io.to(memberInfo.roomSlug).emit('message-deleted', { messageId });
      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
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

      // Get existing participants before adding the new one
      const existingParticipants = Array.from(participants)
        .filter((p) => p.socketId !== socket.id)
        .map((p) => p.memberId);

      // Send existing participants to the joining user
      console.log(`[join-call] ${memberInfo.memberId} joining, existing participants:`, existingParticipants);
      if (existingParticipants.length > 0) {
        socket.emit('call-participants', { participants: existingParticipants });
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

    // Start game
    socket.on('start-game', async ({ gameId }) => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      const game = GAMES_CATALOG.find((g) => g.id === gameId);
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      try {
        // Get member name for notification
        const member = await prisma.member.findUnique({
          where: { id: memberInfo.memberId },
        });

        const activeGame: ActiveGame = {
          game,
          startedBy: memberInfo.memberId,
          startedByName: member?.name || 'Unknown',
          startedAt: new Date(),
        };

        roomGames.set(memberInfo.roomSlug, activeGame);

        // Notify all room members
        io.to(memberInfo.roomSlug).emit('game-started', {
          game,
          startedBy: memberInfo.memberId,
          startedByName: member?.name || 'Unknown',
        });

        console.log(`[start-game] ${member?.name} started ${game.name} in room ${memberInfo.roomSlug}`);
      } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('error', { message: 'Failed to start game' });
      }
    });

    // End game
    socket.on('end-game', () => {
      const memberInfo = socketToMember.get(socket.id);
      if (!memberInfo) return;

      const activeGame = roomGames.get(memberInfo.roomSlug);
      if (!activeGame) return;

      roomGames.delete(memberInfo.roomSlug);

      // Notify all room members
      io.to(memberInfo.roomSlug).emit('game-ended');

      console.log(`[end-game] Game ended in room ${memberInfo.roomSlug}`);
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
