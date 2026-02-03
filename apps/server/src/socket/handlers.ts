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
  // Web Games
  { id: 'smash-karts', name: 'Smash Karts', description: 'Multiplayer kart battle arena', thumbnail: '/images/games/web/smash-karts.jpg', url: 'https://smashkarts.io', maxPlayers: '8', category: 'racing', tags: ['action', 'karts', 'multiplayer', 'popular'] },
  { id: 'bloxd-io', name: 'Bloxd.io', description: 'Minecraft-like multiplayer building', thumbnail: '/images/games/web/bloxd-io.jpg', url: 'https://bloxd.io', maxPlayers: '20', category: 'io', tags: ['building', 'survival', 'minecraft', 'popular'] },
  { id: 'shell-shockers', name: 'Shell Shockers', description: 'FPS where everyone is an egg', thumbnail: '/images/games/web/shell-shockers.jpg', url: 'https://shellshock.io', maxPlayers: '8', category: 'action', tags: ['fps', 'shooter', 'popular'] },
  { id: 'krunker', name: 'Krunker.io', description: 'Fast-paced pixelated FPS', thumbnail: '/images/games/web/krunker.jpg', url: 'https://krunker.io', maxPlayers: '10', category: 'action', tags: ['fps', 'shooter', 'popular'] },
  { id: 'agar-io', name: 'Agar.io', description: 'Cell-eating multiplayer', thumbnail: '/images/games/web/agar-io.jpg', url: 'https://agar.io', maxPlayers: 'Unlimited', category: 'io', tags: ['casual', 'classic'] },
  { id: 'slither-io', name: 'Slither.io', description: 'Snake multiplayer game', thumbnail: '/images/games/web/slither-io.jpg', url: 'https://slither.io', maxPlayers: 'Unlimited', category: 'io', tags: ['snake', 'casual'] },
  { id: '1v1-lol', name: '1v1.LOL', description: 'Build and shoot battle royale', thumbnail: '/images/games/web/1v1-lol.jpg', url: 'https://1v1.lol', maxPlayers: '2', category: 'action', tags: ['building', 'shooter'] },
  { id: 'paper-io-2', name: 'Paper.io 2', description: 'Claim territory game', thumbnail: '/images/games/web/paper-io-2.jpg', url: 'https://paper-io.com', maxPlayers: 'Unlimited', category: 'io', tags: ['casual', 'territory'] },
  { id: 'basketball-stars', name: 'Basketball Stars', description: '1v1 basketball', thumbnail: '/images/games/web/basketball-stars.jpg', url: 'https://www.crazygames.com/game/basketball-stars', maxPlayers: '2', category: 'sports', tags: ['basketball', 'sports'] },
  { id: 'narrow-one', name: 'Narrow One', description: 'Medieval castle siege', thumbnail: '/images/games/web/narrow-one.jpg', url: 'https://www.crazygames.com/game/narrow-one', maxPlayers: '8', category: 'action', tags: ['medieval', 'archery', 'popular'] },
  { id: 'hole-io', name: 'Hole.io', description: 'Black hole swallow game', thumbnail: '/images/games/web/hole-io.jpg', url: 'https://hole-io.com', maxPlayers: 'Unlimited', category: 'io', tags: ['casual', 'fun'] },
  { id: 'zombs-royale', name: 'ZombsRoyale.io', description: '2D battle royale', thumbnail: '/images/games/web/zombs-royale.jpg', url: 'https://zombsroyale.io', maxPlayers: '100', category: 'action', tags: ['battle-royale', 'shooter'] },
  // N64 Games
  { id: 'super-mario-64', name: 'Super Mario 64', description: 'Classic 3D platformer', thumbnail: '/images/games/n64/super-mario-64.jpg', url: 'https://www.retrogames.cc/embed/40466-super-mario-64-usa.html', maxPlayers: '1', category: 'n64', tags: ['platformer', 'mario', 'popular'] },
  { id: 'zelda-ocarina', name: 'Zelda: Ocarina of Time', description: 'Epic action-adventure', thumbnail: '/images/games/n64/zelda-ocarina.jpg', url: 'https://www.retrogames.cc/embed/40450-legend-of-zelda-the-ocarina-of-time-usa.html', maxPlayers: '1', category: 'n64', tags: ['adventure', 'zelda', 'popular'] },
  { id: 'mario-kart-64', name: 'Mario Kart 64', description: 'Multiplayer kart racing', thumbnail: '/images/games/n64/mario-kart-64.jpg', url: 'https://www.retrogames.cc/embed/40460-mario-kart-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['racing', 'mario', 'popular'] },
  { id: 'goldeneye-007', name: 'GoldenEye 007', description: 'Legendary FPS', thumbnail: '/images/games/n64/goldeneye-007.jpg', url: 'https://www.retrogames.cc/embed/40455-goldeneye-007-usa.html', maxPlayers: '4', category: 'n64', tags: ['fps', 'shooter', 'popular'] },
  { id: 'super-smash-bros-64', name: 'Super Smash Bros', description: 'Nintendo fighting game', thumbnail: '/images/games/n64/super-smash-bros-64.jpg', url: 'https://www.retrogames.cc/embed/40468-super-smash-bros-usa.html', maxPlayers: '4', category: 'n64', tags: ['fighting', 'nintendo', 'popular'] },
  { id: 'banjo-kazooie', name: 'Banjo-Kazooie', description: 'Platformer adventure', thumbnail: '/images/games/n64/banjo-kazooie.jpg', url: 'https://www.retrogames.cc/embed/40453-banjo-kazooie-usa.html', maxPlayers: '1', category: 'n64', tags: ['platformer', 'rare'] },
  { id: 'starfox-64', name: 'Star Fox 64', description: 'Space shooter', thumbnail: '/images/games/n64/star-fox-64.jpg', url: 'https://www.retrogames.cc/embed/40467-star-fox-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['shooter', 'space'] },
  { id: 'pokemon-stadium', name: 'Pokemon Stadium', description: '3D Pokemon battles', thumbnail: '/images/games/n64/pokemon-stadium.jpg', url: 'https://www.retrogames.cc/embed/40463-pokemon-stadium-usa-europe.html', maxPlayers: '2', category: 'n64', tags: ['pokemon', 'battle'] },
  { id: 'donkey-kong-64', name: 'Donkey Kong 64', description: '3D platformer', thumbnail: '/images/games/n64/donkey-kong-64.jpg', url: 'https://www.retrogames.cc/embed/40454-donkey-kong-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['platformer', 'rare'] },
  { id: 'paper-mario-64', name: 'Paper Mario', description: 'RPG adventure', thumbnail: '/images/games/n64/paper-mario-64.jpg', url: 'https://www.retrogames.cc/embed/40462-paper-mario-usa.html', maxPlayers: '1', category: 'n64', tags: ['rpg', 'mario'] },
  // PS1 Games
  { id: 'crash-bandicoot', name: 'Crash Bandicoot', description: 'Platform adventure', thumbnail: '/images/games/ps1/crash-bandicoot.jpg', url: 'https://www.retrogames.cc/embed/28839-crash-bandicoot-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'popular'] },
  { id: 'spyro-dragon', name: 'Spyro the Dragon', description: '3D platformer', thumbnail: '/images/games/ps1/spyro-the-dragon.jpg', url: 'https://www.retrogames.cc/embed/29006-spyro-the-dragon-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'popular'] },
  { id: 'tekken-3', name: 'Tekken 3', description: 'Fighting game', thumbnail: '/images/games/ps1/tekken-3.jpg', url: 'https://www.retrogames.cc/embed/29010-tekken-3-usa.html', maxPlayers: '2', category: 'ps1', tags: ['fighting', 'popular'] },
  { id: 'final-fantasy-7', name: 'Final Fantasy VII', description: 'Epic RPG', thumbnail: '/images/games/ps1/final-fantasy-7.jpg', url: 'https://www.retrogames.cc/embed/28860-final-fantasy-vii-usa-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['rpg', 'popular'] },
  { id: 'metal-gear-solid', name: 'Metal Gear Solid', description: 'Stealth action', thumbnail: '/images/games/ps1/metal-gear-solid.jpg', url: 'https://www.retrogames.cc/embed/28916-metal-gear-solid-usa-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['stealth', 'popular'] },
  { id: 'resident-evil', name: 'Resident Evil', description: 'Survival horror', thumbnail: '/images/games/ps1/resident-evil.jpg', url: 'https://www.retrogames.cc/embed/28963-resident-evil-usa.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival'] },
  { id: 'gran-turismo', name: 'Gran Turismo', description: 'Racing simulator', thumbnail: '/images/games/ps1/gran-turismo.jpg', url: 'https://www.retrogames.cc/embed/28877-gran-turismo-usa.html', maxPlayers: '2', category: 'ps1', tags: ['racing', 'simulator'] },
  { id: 'tony-hawk-2', name: "Tony Hawk's Pro Skater 2", description: 'Skateboarding', thumbnail: '/images/games/ps1/tony-hawk-2.jpg', url: 'https://www.retrogames.cc/embed/29014-tony-hawks-pro-skater-2-usa.html', maxPlayers: '2', category: 'ps1', tags: ['sports', 'popular'] },
  { id: 'castlevania-sotn', name: 'Castlevania: SOTN', description: 'Action platformer', thumbnail: '/images/games/ps1/castlevania-sotn.jpg', url: 'https://www.retrogames.cc/embed/28838-castlevania-symphony-of-the-night-usa.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'metroidvania', 'popular'] },
  { id: 'crash-team-racing', name: 'Crash Team Racing', description: 'Kart racing', thumbnail: '/images/games/ps1/crash-team-racing.jpg', url: 'https://www.retrogames.cc/embed/28842-crash-team-racing-usa.html', maxPlayers: '4', category: 'ps1', tags: ['racing', 'multiplayer'] },
  // GBA Games
  { id: 'pokemon-emerald', name: 'Pokemon Emerald', description: 'Pokemon RPG', thumbnail: '/images/games/gba/pokemon-emerald.jpg', url: 'https://www.retrogames.cc/embed/8556-pokemon-emerald-version-usa-europe.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'pokemon', 'popular'] },
  { id: 'pokemon-firered', name: 'Pokemon Fire Red', description: 'Pokemon adventure', thumbnail: '/images/games/gba/pokemon-fire-red.jpg', url: 'https://www.retrogames.cc/embed/8557-pokemon-fire-red-version-usa-europe.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'pokemon', 'popular'] },
  { id: 'zelda-minish-cap', name: 'Zelda: Minish Cap', description: 'Action adventure', thumbnail: '/images/games/gba/zelda-minish-cap.jpg', url: 'https://www.retrogames.cc/embed/8619-legend-of-zelda-the-the-minish-cap-usa.html', maxPlayers: '1', category: 'gba', tags: ['adventure', 'zelda', 'popular'] },
  { id: 'mario-kart-super-circuit', name: 'Mario Kart: Super Circuit', description: 'GBA kart racing', thumbnail: '/images/games/gba/mario-kart-super-circuit.jpg', url: 'https://www.retrogames.cc/embed/8637-mario-kart-super-circuit-usa.html', maxPlayers: '4', category: 'gba', tags: ['racing', 'mario'] },
  { id: 'super-mario-advance-4', name: 'Super Mario Advance 4', description: 'SMB3 remake', thumbnail: '/images/games/gba/super-mario-advance-4.jpg', url: 'https://www.retrogames.cc/embed/8669-super-mario-advance-4-super-mario-bros-3-usa.html', maxPlayers: '1', category: 'gba', tags: ['platformer', 'mario'] },
  { id: 'metroid-fusion', name: 'Metroid Fusion', description: 'Action adventure', thumbnail: '/images/games/gba/metroid-fusion.jpg', url: 'https://www.retrogames.cc/embed/8644-metroid-fusion-usa.html', maxPlayers: '1', category: 'gba', tags: ['action', 'metroidvania'] },
  { id: 'fire-emblem-gba', name: 'Fire Emblem', description: 'Tactical RPG', thumbnail: '/images/games/gba/fire-emblem-gba.jpg', url: 'https://www.retrogames.cc/embed/8504-fire-emblem-usa.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'strategy', 'popular'] },
  { id: 'kirby-amazing-mirror', name: 'Kirby & The Amazing Mirror', description: 'Platformer', thumbnail: '/images/games/gba/kirby-amazing-mirror.jpg', url: 'https://www.retrogames.cc/embed/8601-kirby-and-the-amazing-mirror-usa.html', maxPlayers: '4', category: 'gba', tags: ['platformer', 'kirby'] },
  { id: 'sonic-advance', name: 'Sonic Advance', description: 'Fast platformer', thumbnail: '/images/games/gba/sonic-advance.jpg', url: 'https://www.retrogames.cc/embed/8664-sonic-advance-usa.html', maxPlayers: '1', category: 'gba', tags: ['platformer', 'sonic'] },
  { id: 'golden-sun', name: 'Golden Sun', description: 'Epic RPG', thumbnail: '/images/games/gba/golden-sun.jpg', url: 'https://www.retrogames.cc/embed/8524-golden-sun-usa.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'jrpg', 'popular'] },
  // NES Games
  { id: 'super-mario-bros', name: 'Super Mario Bros', description: 'The classic platformer', thumbnail: '/images/games/nes/super-mario-bros.jpg', url: 'https://www.retrogames.cc/embed/36227-super-mario-bros-usa-europe.html', maxPlayers: '2', category: 'nes', tags: ['platformer', 'mario', 'popular'] },
  { id: 'zelda-nes', name: 'The Legend of Zelda', description: 'Original Hyrule adventure', thumbnail: '/images/games/nes/zelda-nes.jpg', url: 'https://www.retrogames.cc/embed/36154-legend-of-zelda-the-usa.html', maxPlayers: '1', category: 'nes', tags: ['adventure', 'zelda', 'popular'] },
  { id: 'contra-nes', name: 'Contra', description: 'Run and gun action', thumbnail: '/images/games/nes/contra-nes.jpg', url: 'https://www.retrogames.cc/embed/36055-contra-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'shooter', 'popular'] },
  { id: 'mega-man-2', name: 'Mega Man 2', description: 'Defeat Robot Masters', thumbnail: '/images/games/nes/mega-man-2.jpg', url: 'https://www.retrogames.cc/embed/36174-mega-man-2-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer', 'popular'] },
  { id: 'metroid-nes', name: 'Metroid', description: 'Explore planet Zebes', thumbnail: '/images/games/nes/metroid-nes.jpg', url: 'https://www.retrogames.cc/embed/36178-metroid-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'exploration'] },
  { id: 'castlevania-nes', name: 'Castlevania', description: 'Whip through Draculas castle', thumbnail: '/images/games/nes/castlevania-nes.jpg', url: 'https://www.retrogames.cc/embed/36042-castlevania-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'horror'] },
  { id: 'ninja-gaiden', name: 'Ninja Gaiden', description: 'Challenging ninja action', thumbnail: '/images/games/nes/ninja-gaiden.jpg', url: 'https://www.retrogames.cc/embed/36192-ninja-gaiden-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'ninja'] },
  { id: 'duck-hunt', name: 'Duck Hunt', description: 'Classic shooting game', thumbnail: '/images/games/nes/duck-hunt.jpg', url: 'https://www.retrogames.cc/embed/36081-duck-hunt-usa-europe.html', maxPlayers: '2', category: 'nes', tags: ['shooter', 'classic'] },
  { id: 'tetris-nes', name: 'Tetris', description: 'Legendary puzzle game', thumbnail: '/images/games/nes/tetris-nes.jpg', url: 'https://www.retrogames.cc/embed/36246-tetris-usa.html', maxPlayers: '2', category: 'nes', tags: ['puzzle', 'classic', 'popular'] },
  { id: 'pac-man-nes', name: 'Pac-Man', description: 'Eat dots, avoid ghosts', thumbnail: '/images/games/nes/pac-man-nes.jpg', url: 'https://www.retrogames.cc/embed/36198-pac-man-usa-namco.html', maxPlayers: '1', category: 'nes', tags: ['arcade', 'classic'] },
  // SNES Games
  { id: 'super-mario-world', name: 'Super Mario World', description: 'Platformer masterpiece', thumbnail: '/images/games/snes/super-mario-world.jpg', url: 'https://www.retrogames.cc/embed/46254-super-mario-world-usa.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'mario', 'popular'] },
  { id: 'zelda-alttp', name: 'Zelda: A Link to the Past', description: 'Top-down adventure', thumbnail: '/images/games/snes/zelda-alttp.jpg', url: 'https://www.retrogames.cc/embed/46176-legend-of-zelda-the-a-link-to-the-past-usa.html', maxPlayers: '1', category: 'snes', tags: ['adventure', 'zelda', 'popular'] },
  { id: 'chrono-trigger', name: 'Chrono Trigger', description: 'Time-traveling RPG', thumbnail: '/images/games/snes/chrono-trigger.jpg', url: 'https://www.retrogames.cc/embed/46081-chrono-trigger-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'jrpg', 'popular'] },
  { id: 'super-metroid', name: 'Super Metroid', description: 'Defining metroidvania', thumbnail: '/images/games/snes/super-metroid.jpg', url: 'https://www.retrogames.cc/embed/46250-super-metroid-usa-europe.html', maxPlayers: '1', category: 'snes', tags: ['action', 'metroidvania', 'popular'] },
  { id: 'donkey-kong-country', name: 'Donkey Kong Country', description: 'Beautiful platformer', thumbnail: '/images/games/snes/donkey-kong-country.jpg', url: 'https://www.retrogames.cc/embed/46089-donkey-kong-country-usa.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'rare', 'popular'] },
  { id: 'street-fighter-2-turbo', name: 'Street Fighter II Turbo', description: 'Classic fighting', thumbnail: '/images/games/snes/street-fighter-2-turbo.jpg', url: 'https://www.retrogames.cc/embed/46237-street-fighter-ii-turbo-hyper-fighting-usa.html', maxPlayers: '2', category: 'snes', tags: ['fighting', 'arcade', 'popular'] },
  { id: 'final-fantasy-6', name: 'Final Fantasy VI', description: 'Epic RPG', thumbnail: '/images/games/snes/final-fantasy-6.jpg', url: 'https://www.retrogames.cc/embed/46110-final-fantasy-vi-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'jrpg'] },
  { id: 'earthbound', name: 'EarthBound', description: 'Quirky modern-day RPG', thumbnail: '/images/games/snes/earthbound.jpg', url: 'https://www.retrogames.cc/embed/46093-earthbound-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'quirky'] },
  { id: 'super-mario-kart', name: 'Super Mario Kart', description: 'Original kart racer', thumbnail: '/images/games/snes/super-mario-kart.jpg', url: 'https://www.retrogames.cc/embed/46252-super-mario-kart-usa.html', maxPlayers: '2', category: 'snes', tags: ['racing', 'mario', 'popular'] },
  { id: 'mega-man-x', name: 'Mega Man X', description: 'Action-packed robot battles', thumbnail: '/images/games/snes/mega-man-x.jpg', url: 'https://www.retrogames.cc/embed/46196-mega-man-x-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'platformer'] },
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
