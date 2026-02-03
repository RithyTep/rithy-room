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
  // ==================== N64 GAMES ====================
  { id: 'super-mario-64', name: 'Super Mario 64', description: 'Classic 3D platformer - collect stars in Princess Peach Castle', thumbnail: '/images/games/n64/super-mario-64.jpg', url: 'https://www.retrogames.cc/embed/40466-super-mario-64-usa.html', maxPlayers: '1', category: 'n64', tags: ['platformer', 'mario', 'nintendo', 'popular'] },
  { id: 'zelda-ocarina', name: 'Zelda: Ocarina of Time', description: 'Epic action-adventure through Hyrule', thumbnail: '/images/games/n64/zelda-ocarina.jpg', url: 'https://www.retrogames.cc/embed/40450-legend-of-zelda-the-ocarina-of-time-usa.html', maxPlayers: '1', category: 'n64', tags: ['adventure', 'zelda', 'nintendo', 'popular'] },
  { id: 'mario-kart-64', name: 'Mario Kart 64', description: 'Classic multiplayer kart racing', thumbnail: '/images/games/n64/mario-kart-64.jpg', url: 'https://www.retrogames.cc/embed/40460-mario-kart-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['racing', 'mario', 'multiplayer', 'popular'] },
  { id: 'goldeneye-007', name: 'GoldenEye 007', description: 'Legendary FPS based on James Bond', thumbnail: '/images/games/n64/goldeneye-007.jpg', url: 'https://www.retrogames.cc/embed/40455-goldeneye-007-usa.html', maxPlayers: '4', category: 'n64', tags: ['fps', 'shooter', 'james-bond', 'popular'] },
  { id: 'super-smash-bros-64', name: 'Super Smash Bros', description: 'Nintendo characters battle it out', thumbnail: '/images/games/n64/super-smash-bros-64.jpg', url: 'https://www.retrogames.cc/embed/40468-super-smash-bros-usa.html', maxPlayers: '4', category: 'n64', tags: ['fighting', 'nintendo', 'multiplayer', 'popular'] },
  { id: 'banjo-kazooie', name: 'Banjo-Kazooie', description: 'Collect jiggies in this platformer adventure', thumbnail: '/images/games/n64/banjo-kazooie.jpg', url: 'https://www.retrogames.cc/embed/40453-banjo-kazooie-usa.html', maxPlayers: '1', category: 'n64', tags: ['platformer', 'rare', 'adventure'] },
  { id: 'starfox-64', name: 'Star Fox 64', description: 'Space shooter - Do a barrel roll!', thumbnail: '/images/games/n64/star-fox-64.jpg', url: 'https://www.retrogames.cc/embed/40467-star-fox-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['shooter', 'space', 'nintendo'] },
  { id: 'pokemon-stadium', name: 'Pokemon Stadium', description: '3D Pokemon battles', thumbnail: '/images/games/n64/pokemon-stadium.jpg', url: 'https://www.retrogames.cc/embed/40463-pokemon-stadium-usa-europe.html', maxPlayers: '2', category: 'n64', tags: ['pokemon', 'nintendo', 'battle'] },
  { id: 'donkey-kong-64', name: 'Donkey Kong 64', description: '3D platformer with the Kong family', thumbnail: '/images/games/n64/donkey-kong-64.jpg', url: 'https://www.retrogames.cc/embed/40454-donkey-kong-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['platformer', 'rare', 'nintendo'] },
  { id: 'paper-mario-64', name: 'Paper Mario', description: 'RPG adventure with paper-style graphics', thumbnail: '/images/games/n64/paper-mario-64.jpg', url: 'https://www.retrogames.cc/embed/40462-paper-mario-usa.html', maxPlayers: '1', category: 'n64', tags: ['rpg', 'mario', 'nintendo'] },
  { id: 'zelda-majoras-mask', name: 'Zelda: Majoras Mask', description: 'Dark sequel with 3-day time loop', thumbnail: '/images/games/n64/zelda-majoras-mask.jpg', url: 'https://www.retrogames.cc/embed/40451-legend-of-zelda-the-majoras-mask-usa.html', maxPlayers: '1', category: 'n64', tags: ['adventure', 'zelda', 'nintendo', 'popular'] },
  { id: 'diddy-kong-racing', name: 'Diddy Kong Racing', description: 'Racing adventure with planes and hovercrafts', thumbnail: '/images/games/n64/diddy-kong-racing.jpg', url: 'https://www.retrogames.cc/embed/40452-diddy-kong-racing-usa.html', maxPlayers: '4', category: 'n64', tags: ['racing', 'rare', 'multiplayer'] },
  { id: 'perfect-dark', name: 'Perfect Dark', description: 'Sci-fi FPS from Rare', thumbnail: '/images/games/n64/perfect-dark.jpg', url: 'https://www.retrogames.cc/embed/40464-perfect-dark-usa.html', maxPlayers: '4', category: 'n64', tags: ['fps', 'shooter', 'rare', 'popular'] },
  { id: 'mario-party-2', name: 'Mario Party 2', description: 'Board game fun with minigames', thumbnail: '/images/games/n64/mario-party-2.jpg', url: 'https://www.retrogames.cc/embed/40459-mario-party-2-usa.html', maxPlayers: '4', category: 'n64', tags: ['party', 'mario', 'multiplayer'] },
  { id: 'f-zero-x', name: 'F-Zero X', description: 'High-speed futuristic racing', thumbnail: '/images/games/n64/f-zero-x.jpg', url: 'https://www.retrogames.cc/embed/40456-f-zero-x-usa.html', maxPlayers: '4', category: 'n64', tags: ['racing', 'nintendo', 'fast'] },
  { id: 'pokemon-stadium-2', name: 'Pokemon Stadium 2', description: 'Gen 2 Pokemon battles in 3D', thumbnail: '/images/games/n64/pokemon-stadium-2.jpg', url: 'https://www.retrogames.cc/embed/40465-pokemon-stadium-2-usa.html', maxPlayers: '2', category: 'n64', tags: ['pokemon', 'nintendo', 'battle'] },
  { id: 'wave-race-64', name: 'Wave Race 64', description: 'Jet ski racing with realistic water', thumbnail: '/images/games/n64/wave-race-64.jpg', url: 'https://www.retrogames.cc/embed/40469-wave-race-64-usa.html', maxPlayers: '2', category: 'n64', tags: ['racing', 'water', 'nintendo'] },
  { id: 'mario-party-3', name: 'Mario Party 3', description: 'More minigame madness', thumbnail: '/images/games/n64/mario-party-3.jpg', url: 'https://www.retrogames.cc/embed/40458-mario-party-3-usa.html', maxPlayers: '4', category: 'n64', tags: ['party', 'mario', 'multiplayer'] },
  { id: 'yoshis-story', name: 'Yoshis Story', description: 'Cute platformer adventure', thumbnail: '/images/games/n64/yoshis-story.jpg', url: 'https://www.retrogames.cc/embed/40470-yoshis-story-usa.html', maxPlayers: '1', category: 'n64', tags: ['platformer', 'yoshi', 'nintendo'] },
  { id: 'pokemon-snap', name: 'Pokemon Snap', description: 'Photograph Pokemon in the wild', thumbnail: '/images/games/n64/pokemon-snap.jpg', url: 'https://www.retrogames.cc/embed/40461-pokemon-snap-usa.html', maxPlayers: '1', category: 'n64', tags: ['pokemon', 'photography', 'nintendo'] },
  { id: 'bomberman-64', name: 'Bomberman 64', description: '3D explosive action', thumbnail: '/images/games/n64/bomberman-64.jpg', url: 'https://www.retrogames.cc/embed/40471-bomberman-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['action', 'puzzle', 'multiplayer'] },
  { id: 'mario-tennis-64', name: 'Mario Tennis', description: 'Tennis with Mario characters', thumbnail: '/images/games/n64/mario-tennis-64.jpg', url: 'https://www.retrogames.cc/embed/40457-mario-tennis-usa.html', maxPlayers: '4', category: 'n64', tags: ['sports', 'tennis', 'multiplayer'] },
  { id: 'turok-dinosaur', name: 'Turok: Dinosaur Hunter', description: 'Hunt dinosaurs with big guns', thumbnail: '/images/games/n64/turok-dinosaur.jpg', url: 'https://www.retrogames.cc/embed/40472-turok-dinosaur-hunter-usa.html', maxPlayers: '1', category: 'n64', tags: ['fps', 'shooter', 'action'] },
  { id: 'pilotwings-64', name: 'Pilotwings 64', description: 'Flight simulation fun', thumbnail: '/images/games/n64/pilotwings-64.jpg', url: 'https://www.retrogames.cc/embed/40473-pilotwings-64-usa.html', maxPlayers: '1', category: 'n64', tags: ['simulation', 'flying', 'nintendo'] },
  // ==================== PS1 GAMES ====================
  { id: 'crash-bandicoot', name: 'Crash Bandicoot', description: 'Classic platform adventure with Crash', thumbnail: '/images/games/ps1/crash-bandicoot.jpg', url: 'https://www.retrogames.cc/embed/28839-crash-bandicoot-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'crash', 'playstation', 'popular'] },
  { id: 'spyro-dragon', name: 'Spyro the Dragon', description: '3D platformer adventure with the purple dragon', thumbnail: '/images/games/ps1/spyro-the-dragon.jpg', url: 'https://www.retrogames.cc/embed/29006-spyro-the-dragon-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'spyro', 'playstation', 'popular'] },
  { id: 'tekken-3', name: 'Tekken 3', description: 'Legendary fighting game', thumbnail: '/images/games/ps1/tekken-3.jpg', url: 'https://www.retrogames.cc/embed/29010-tekken-3-usa.html', maxPlayers: '2', category: 'ps1', tags: ['fighting', 'arcade', 'popular'] },
  { id: 'final-fantasy-7', name: 'Final Fantasy VII', description: 'Epic RPG - Follow Cloud and AVALANCHE', thumbnail: '/images/games/ps1/final-fantasy-7.jpg', url: 'https://www.retrogames.cc/embed/28860-final-fantasy-vii-usa-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['rpg', 'jrpg', 'squaresoft', 'popular'] },
  { id: 'metal-gear-solid', name: 'Metal Gear Solid', description: 'Stealth action - Solid Snake infiltrates', thumbnail: '/images/games/ps1/metal-gear-solid.jpg', url: 'https://www.retrogames.cc/embed/28916-metal-gear-solid-usa-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['stealth', 'action', 'konami', 'popular'] },
  { id: 'resident-evil', name: 'Resident Evil', description: 'Survival horror classic - Escape the mansion', thumbnail: '/images/games/ps1/resident-evil.jpg', url: 'https://www.retrogames.cc/embed/28963-resident-evil-usa.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'capcom'] },
  { id: 'gran-turismo', name: 'Gran Turismo', description: 'The real driving simulator', thumbnail: '/images/games/ps1/gran-turismo.jpg', url: 'https://www.retrogames.cc/embed/28877-gran-turismo-usa.html', maxPlayers: '2', category: 'ps1', tags: ['racing', 'simulator', 'cars'] },
  { id: 'tony-hawk-2', name: "Tony Hawk's Pro Skater 2", description: 'Skateboarding classic - nail those combos', thumbnail: '/images/games/ps1/tony-hawk-2.jpg', url: 'https://www.retrogames.cc/embed/29014-tony-hawks-pro-skater-2-usa.html', maxPlayers: '2', category: 'ps1', tags: ['sports', 'skateboard', 'popular'] },
  { id: 'castlevania-sotn', name: 'Castlevania: SOTN', description: 'Symphony of the Night - Explore Draculas castle', thumbnail: '/images/games/ps1/castlevania-sotn.jpg', url: 'https://www.retrogames.cc/embed/28838-castlevania-symphony-of-the-night-usa.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'metroidvania', 'konami', 'popular'] },
  { id: 'crash-team-racing', name: 'Crash Team Racing', description: 'Kart racing with Crash characters', thumbnail: '/images/games/ps1/crash-team-racing.jpg', url: 'https://www.retrogames.cc/embed/28842-crash-team-racing-usa.html', maxPlayers: '4', category: 'ps1', tags: ['racing', 'crash', 'multiplayer'] },
  { id: 'crash-bandicoot-2', name: 'Crash Bandicoot 2', description: 'Cortex Strikes Back - more platforming fun', thumbnail: '/images/games/ps1/crash-bandicoot-2.jpg', url: 'https://www.retrogames.cc/embed/28840-crash-bandicoot-2-cortex-strikes-back-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'crash', 'popular'] },
  { id: 'crash-bandicoot-3', name: 'Crash Bandicoot 3: Warped', description: 'Time-traveling platformer adventure', thumbnail: '/images/games/ps1/crash-bandicoot-3.jpg', url: 'https://www.retrogames.cc/embed/28841-crash-bandicoot-warped-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'crash', 'popular'] },
  { id: 'spyro-2', name: 'Spyro 2: Riptos Rage', description: 'Dragon adventure continues', thumbnail: '/images/games/ps1/spyro-2.jpg', url: 'https://www.retrogames.cc/embed/29007-spyro-2-riptos-rage-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'spyro', 'popular'] },
  { id: 'resident-evil-2', name: 'Resident Evil 2', description: 'Survival horror in Raccoon City', thumbnail: '/images/games/ps1/resident-evil-2.jpg', url: 'https://www.retrogames.cc/embed/28964-resident-evil-2-usa-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'capcom', 'popular'] },
  { id: 'twisted-metal-2', name: 'Twisted Metal 2', description: 'Vehicular combat destruction', thumbnail: '/images/games/ps1/twisted-metal-2.jpg', url: 'https://www.retrogames.cc/embed/29018-twisted-metal-2-usa.html', maxPlayers: '2', category: 'ps1', tags: ['action', 'vehicles', 'multiplayer'] },
  { id: 'ape-escape', name: 'Ape Escape', description: 'Catch monkeys with gadgets', thumbnail: '/images/games/ps1/ape-escape.jpg', url: 'https://www.retrogames.cc/embed/28822-ape-escape-usa.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'action', 'sony'] },
  { id: 'medievil', name: 'MediEvil', description: 'Undead knight adventure', thumbnail: '/images/games/ps1/medievil.jpg', url: 'https://www.retrogames.cc/embed/28912-medievil-usa.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'adventure', 'horror'] },
  { id: 'silent-hill', name: 'Silent Hill', description: 'Psychological horror classic', thumbnail: '/images/games/ps1/silent-hill.jpg', url: 'https://www.retrogames.cc/embed/28989-silent-hill-usa.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'konami', 'popular'] },
  { id: 'tomb-raider', name: 'Tomb Raider', description: 'Lara Croft adventure begins', thumbnail: '/images/games/ps1/tomb-raider.jpg', url: 'https://www.retrogames.cc/embed/29015-tomb-raider-usa.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'adventure', 'popular'] },
  { id: 'wipeout-xl', name: 'Wipeout XL', description: 'Futuristic anti-gravity racing', thumbnail: '/images/games/ps1/wipeout-xl.jpg', url: 'https://www.retrogames.cc/embed/29024-wipeout-xl-usa.html', maxPlayers: '2', category: 'ps1', tags: ['racing', 'futuristic', 'fast'] },
  { id: 'parappa-rapper', name: 'PaRappa the Rapper', description: 'Kick punch its all in the mind', thumbnail: '/images/games/ps1/parappa-rapper.jpg', url: 'https://www.retrogames.cc/embed/28940-parappa-the-rapper-usa.html', maxPlayers: '1', category: 'ps1', tags: ['rhythm', 'music', 'unique'] },
  { id: 'syphon-filter', name: 'Syphon Filter', description: 'Third-person stealth action', thumbnail: '/images/games/ps1/syphon-filter.jpg', url: 'https://www.retrogames.cc/embed/29009-syphon-filter-usa.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'stealth', 'shooter'] },
  { id: 'dino-crisis', name: 'Dino Crisis', description: 'Resident Evil with dinosaurs', thumbnail: '/images/games/ps1/dino-crisis.jpg', url: 'https://www.retrogames.cc/embed/28850-dino-crisis-usa.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'capcom'] },
  { id: 'vagrant-story', name: 'Vagrant Story', description: 'Dark action RPG', thumbnail: '/images/games/ps1/vagrant-story.jpg', url: 'https://www.retrogames.cc/embed/29019-vagrant-story-usa.html', maxPlayers: '1', category: 'ps1', tags: ['rpg', 'action', 'squaresoft'] },
  // ==================== GBA GAMES ====================
  { id: 'pokemon-emerald', name: 'Pokemon Emerald', description: 'Pokemon adventure in the Hoenn region', thumbnail: '/images/games/gba/pokemon-emerald.jpg', url: 'https://www.retrogames.cc/embed/8556-pokemon-emerald-version-usa-europe.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'pokemon', 'nintendo', 'popular'] },
  { id: 'pokemon-firered', name: 'Pokemon Fire Red', description: 'Classic Kanto adventure remade', thumbnail: '/images/games/gba/pokemon-fire-red.jpg', url: 'https://www.retrogames.cc/embed/8557-pokemon-fire-red-version-usa-europe.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'pokemon', 'nintendo', 'popular'] },
  { id: 'zelda-minish-cap', name: 'Zelda: Minish Cap', description: 'Shrink down and explore a tiny world', thumbnail: '/images/games/gba/zelda-minish-cap.jpg', url: 'https://www.retrogames.cc/embed/8619-legend-of-zelda-the-the-minish-cap-usa.html', maxPlayers: '1', category: 'gba', tags: ['adventure', 'zelda', 'nintendo', 'popular'] },
  { id: 'mario-kart-super-circuit', name: 'Mario Kart: Super Circuit', description: 'GBA kart racing fun', thumbnail: '/images/games/gba/mario-kart-super-circuit.jpg', url: 'https://www.retrogames.cc/embed/8637-mario-kart-super-circuit-usa.html', maxPlayers: '4', category: 'gba', tags: ['racing', 'mario', 'nintendo'] },
  { id: 'super-mario-advance-4', name: 'Super Mario Advance 4', description: 'Super Mario Bros 3 remake', thumbnail: '/images/games/gba/super-mario-advance-4.jpg', url: 'https://www.retrogames.cc/embed/8669-super-mario-advance-4-super-mario-bros-3-usa.html', maxPlayers: '1', category: 'gba', tags: ['platformer', 'mario', 'nintendo'] },
  { id: 'metroid-fusion', name: 'Metroid Fusion', description: 'Samus faces the X parasites', thumbnail: '/images/games/gba/metroid-fusion.jpg', url: 'https://www.retrogames.cc/embed/8644-metroid-fusion-usa.html', maxPlayers: '1', category: 'gba', tags: ['action', 'metroidvania', 'nintendo'] },
  { id: 'fire-emblem-gba', name: 'Fire Emblem', description: 'Tactical RPG - Lead your army', thumbnail: '/images/games/gba/fire-emblem-gba.jpg', url: 'https://www.retrogames.cc/embed/8504-fire-emblem-usa.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'strategy', 'nintendo', 'popular'] },
  { id: 'kirby-amazing-mirror', name: 'Kirby & The Amazing Mirror', description: 'Explore a labyrinthine world', thumbnail: '/images/games/gba/kirby-amazing-mirror.jpg', url: 'https://www.retrogames.cc/embed/8601-kirby-and-the-amazing-mirror-usa.html', maxPlayers: '4', category: 'gba', tags: ['platformer', 'kirby', 'nintendo'] },
  { id: 'sonic-advance', name: 'Sonic Advance', description: 'Fast-paced platforming with Sonic', thumbnail: '/images/games/gba/sonic-advance.jpg', url: 'https://www.retrogames.cc/embed/8664-sonic-advance-usa.html', maxPlayers: '1', category: 'gba', tags: ['platformer', 'sonic', 'sega'] },
  { id: 'golden-sun', name: 'Golden Sun', description: 'Epic RPG adventure with Psynergy', thumbnail: '/images/games/gba/golden-sun.jpg', url: 'https://www.retrogames.cc/embed/8524-golden-sun-usa.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'jrpg', 'nintendo', 'popular'] },
  { id: 'pokemon-ruby', name: 'Pokemon Ruby', description: 'Hoenn adventure begins', thumbnail: '/images/games/gba/pokemon-ruby.jpg', url: 'https://www.retrogames.cc/embed/8558-pokemon-ruby-version-usa-europe.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'pokemon', 'popular'] },
  { id: 'advance-wars', name: 'Advance Wars', description: 'Turn-based tactical combat', thumbnail: '/images/games/gba/advance-wars.jpg', url: 'https://www.retrogames.cc/embed/8456-advance-wars-usa.html', maxPlayers: '2', category: 'gba', tags: ['strategy', 'tactics', 'popular'] },
  { id: 'castlevania-aria', name: 'Castlevania: Aria of Sorrow', description: 'Metroidvania in Draculas castle', thumbnail: '/images/games/gba/castlevania-aria.jpg', url: 'https://www.retrogames.cc/embed/8476-castlevania-aria-of-sorrow-usa.html', maxPlayers: '1', category: 'gba', tags: ['action', 'metroidvania', 'konami', 'popular'] },
  { id: 'wario-ware', name: 'WarioWare Inc', description: 'Microgame madness', thumbnail: '/images/games/gba/wario-ware.jpg', url: 'https://www.retrogames.cc/embed/8691-warioware-inc-mega-microgame-usa.html', maxPlayers: '1', category: 'gba', tags: ['puzzle', 'minigames', 'nintendo'] },
  { id: 'metroid-zero-mission', name: 'Metroid: Zero Mission', description: 'Remake of the original Metroid', thumbnail: '/images/games/gba/metroid-zero-mission.jpg', url: 'https://www.retrogames.cc/embed/8645-metroid-zero-mission-usa.html', maxPlayers: '1', category: 'gba', tags: ['action', 'metroidvania', 'nintendo', 'popular'] },
  { id: 'final-fantasy-tactics', name: 'FF Tactics Advance', description: 'Strategic RPG battles', thumbnail: '/images/games/gba/final-fantasy-tactics.jpg', url: 'https://www.retrogames.cc/embed/8502-final-fantasy-tactics-advance-usa.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'strategy', 'squaresoft'] },
  { id: 'dragon-ball-z-buu', name: 'DBZ: Buus Fury', description: 'Dragon Ball Z action RPG', thumbnail: '/images/games/gba/dragon-ball-z-buu.jpg', url: 'https://www.retrogames.cc/embed/8494-dragon-ball-z-buus-fury-usa.html', maxPlayers: '1', category: 'gba', tags: ['action', 'rpg', 'anime'] },
  { id: 'pokemon-sapphire', name: 'Pokemon Sapphire', description: 'Hoenn adventure with Kyogre', thumbnail: '/images/games/gba/pokemon-sapphire.jpg', url: 'https://www.retrogames.cc/embed/8559-pokemon-sapphire-version-usa-europe.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'pokemon', 'popular'] },
  { id: 'pokemon-leafgreen', name: 'Pokemon Leaf Green', description: 'Kanto remade in color', thumbnail: '/images/games/gba/pokemon-leafgreen.jpg', url: 'https://www.retrogames.cc/embed/8555-pokemon-leaf-green-version-usa-europe.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'pokemon', 'popular'] },
  { id: 'advance-wars-2', name: 'Advance Wars 2', description: 'Black Hole Rising tactical combat', thumbnail: '/images/games/gba/advance-wars-2.jpg', url: 'https://www.retrogames.cc/embed/8457-advance-wars-2-black-hole-rising-usa.html', maxPlayers: '2', category: 'gba', tags: ['strategy', 'tactics', 'popular'] },
  { id: 'mega-man-zero', name: 'Mega Man Zero', description: 'Fast-paced action platformer', thumbnail: '/images/games/gba/mega-man-zero.jpg', url: 'https://www.retrogames.cc/embed/8640-mega-man-zero-usa.html', maxPlayers: '1', category: 'gba', tags: ['action', 'platformer', 'capcom'] },
  { id: 'golden-sun-2', name: 'Golden Sun: Lost Age', description: 'Epic RPG sequel', thumbnail: '/images/games/gba/golden-sun-2.jpg', url: 'https://www.retrogames.cc/embed/8525-golden-sun-the-lost-age-usa.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'jrpg', 'popular'] },
  { id: 'super-mario-advance-2', name: 'Super Mario World GBA', description: 'Super Mario World remake', thumbnail: '/images/games/gba/super-mario-advance-2.jpg', url: 'https://www.retrogames.cc/embed/8667-super-mario-advance-2-super-mario-world-usa.html', maxPlayers: '1', category: 'gba', tags: ['platformer', 'mario', 'nintendo'] },
  { id: 'kingdom-hearts-chain', name: 'Kingdom Hearts: Chain', description: 'Card-based action RPG', thumbnail: '/images/games/gba/kingdom-hearts-chain.jpg', url: 'https://www.retrogames.cc/embed/8602-kingdom-hearts-chain-of-memories-usa.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'action', 'disney'] },
  // ==================== NES GAMES ====================
  { id: 'super-mario-bros', name: 'Super Mario Bros', description: 'The classic platformer that started it all', thumbnail: '/images/games/nes/super-mario-bros.jpg', url: 'https://www.retrogames.cc/embed/36227-super-mario-bros-usa-europe.html', maxPlayers: '2', category: 'nes', tags: ['platformer', 'mario', 'nintendo', 'popular'] },
  { id: 'zelda-nes', name: 'The Legend of Zelda', description: 'Original adventure in Hyrule', thumbnail: '/images/games/nes/zelda-nes.jpg', url: 'https://www.retrogames.cc/embed/36154-legend-of-zelda-the-usa.html', maxPlayers: '1', category: 'nes', tags: ['adventure', 'zelda', 'nintendo', 'popular'] },
  { id: 'contra-nes', name: 'Contra', description: 'Run and gun action - Up Up Down Down', thumbnail: '/images/games/nes/contra-nes.jpg', url: 'https://www.retrogames.cc/embed/36055-contra-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'shooter', 'konami', 'popular'] },
  { id: 'mega-man-2', name: 'Mega Man 2', description: 'Defeat the Robot Masters', thumbnail: '/images/games/nes/mega-man-2.jpg', url: 'https://www.retrogames.cc/embed/36174-mega-man-2-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer', 'capcom', 'popular'] },
  { id: 'metroid-nes', name: 'Metroid', description: 'Explore planet Zebes as Samus', thumbnail: '/images/games/nes/metroid-nes.jpg', url: 'https://www.retrogames.cc/embed/36178-metroid-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'exploration', 'nintendo'] },
  { id: 'castlevania-nes', name: 'Castlevania', description: 'Whip your way through Draculas castle', thumbnail: '/images/games/nes/castlevania-nes.jpg', url: 'https://www.retrogames.cc/embed/36042-castlevania-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'horror', 'konami'] },
  { id: 'ninja-gaiden', name: 'Ninja Gaiden', description: 'Challenging ninja action', thumbnail: '/images/games/nes/ninja-gaiden.jpg', url: 'https://www.retrogames.cc/embed/36192-ninja-gaiden-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'ninja', 'tecmo'] },
  { id: 'duck-hunt', name: 'Duck Hunt', description: 'Classic shooting game', thumbnail: '/images/games/nes/duck-hunt.jpg', url: 'https://www.retrogames.cc/embed/36081-duck-hunt-usa-europe.html', maxPlayers: '2', category: 'nes', tags: ['shooter', 'light-gun', 'nintendo'] },
  { id: 'tetris-nes', name: 'Tetris', description: 'The legendary puzzle game', thumbnail: '/images/games/nes/tetris-nes.jpg', url: 'https://www.retrogames.cc/embed/36246-tetris-usa.html', maxPlayers: '2', category: 'nes', tags: ['puzzle', 'classic', 'popular'] },
  { id: 'pac-man-nes', name: 'Pac-Man', description: 'Eat dots, avoid ghosts', thumbnail: '/images/games/nes/pac-man-nes.jpg', url: 'https://www.retrogames.cc/embed/36198-pac-man-usa-namco.html', maxPlayers: '1', category: 'nes', tags: ['arcade', 'classic', 'namco'] },
  { id: 'super-mario-bros-3', name: 'Super Mario Bros 3', description: 'Fly with the raccoon suit', thumbnail: '/images/games/nes/super-mario-bros-3.jpg', url: 'https://www.retrogames.cc/embed/36229-super-mario-bros-3-usa.html', maxPlayers: '2', category: 'nes', tags: ['platformer', 'mario', 'popular'] },
  { id: 'kirby-adventure', name: 'Kirbys Adventure', description: 'Copy enemy abilities', thumbnail: '/images/games/nes/kirby-adventure.jpg', url: 'https://www.retrogames.cc/embed/36141-kirbys-adventure-usa.html', maxPlayers: '1', category: 'nes', tags: ['platformer', 'kirby', 'nintendo'] },
  { id: 'mega-man-3', name: 'Mega Man 3', description: 'Slide and defeat more Robot Masters', thumbnail: '/images/games/nes/mega-man-3.jpg', url: 'https://www.retrogames.cc/embed/36175-mega-man-3-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer', 'capcom'] },
  { id: 'punch-out', name: 'Punch-Out!!', description: 'Boxing with Little Mac', thumbnail: '/images/games/nes/punch-out.jpg', url: 'https://www.retrogames.cc/embed/36207-mike-tysons-punch-out-usa.html', maxPlayers: '1', category: 'nes', tags: ['sports', 'boxing', 'nintendo', 'popular'] },
  { id: 'double-dragon', name: 'Double Dragon', description: 'Beat em up classic', thumbnail: '/images/games/nes/double-dragon.jpg', url: 'https://www.retrogames.cc/embed/36075-double-dragon-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'brawler', 'arcade'] },
  { id: 'battletoads', name: 'Battletoads', description: 'Notoriously difficult action game', thumbnail: '/images/games/nes/battletoads.jpg', url: 'https://www.retrogames.cc/embed/36028-battletoads-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'brawler', 'hard'] },
  { id: 'excitebike', name: 'Excitebike', description: 'Motocross racing classic', thumbnail: '/images/games/nes/excitebike.jpg', url: 'https://www.retrogames.cc/embed/36089-excitebike-usa.html', maxPlayers: '1', category: 'nes', tags: ['racing', 'sports', 'nintendo'] },
  { id: 'super-mario-bros-2', name: 'Super Mario Bros 2', description: 'Dream world platformer', thumbnail: '/images/games/nes/super-mario-bros-2.jpg', url: 'https://www.retrogames.cc/embed/36228-super-mario-bros-2-usa.html', maxPlayers: '1', category: 'nes', tags: ['platformer', 'mario', 'popular'] },
  { id: 'zelda-2-adventure', name: 'Zelda II: Adventure of Link', description: 'Side-scrolling Zelda action', thumbnail: '/images/games/nes/zelda-2-adventure.jpg', url: 'https://www.retrogames.cc/embed/36282-zelda-ii-the-adventure-of-link-usa.html', maxPlayers: '1', category: 'nes', tags: ['adventure', 'zelda', 'action'] },
  { id: 'mega-man', name: 'Mega Man', description: 'The original Robot Master hunter', thumbnail: '/images/games/nes/mega-man.jpg', url: 'https://www.retrogames.cc/embed/36173-mega-man-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer', 'capcom'] },
  { id: 'final-fantasy-nes', name: 'Final Fantasy', description: 'The RPG that started it all', thumbnail: '/images/games/nes/final-fantasy-nes.jpg', url: 'https://www.retrogames.cc/embed/36094-final-fantasy-usa.html', maxPlayers: '1', category: 'nes', tags: ['rpg', 'jrpg', 'squaresoft'] },
  { id: 'dragon-warrior', name: 'Dragon Warrior', description: 'Classic JRPG adventure', thumbnail: '/images/games/nes/dragon-warrior.jpg', url: 'https://www.retrogames.cc/embed/36078-dragon-warrior-usa.html', maxPlayers: '1', category: 'nes', tags: ['rpg', 'jrpg', 'classic'] },
  { id: 'ice-climber', name: 'Ice Climber', description: 'Climb icy mountains together', thumbnail: '/images/games/nes/ice-climber.jpg', url: 'https://www.retrogames.cc/embed/36124-ice-climber-usa-europe.html', maxPlayers: '2', category: 'nes', tags: ['platformer', 'arcade', 'multiplayer'] },
  { id: 'balloon-fight', name: 'Balloon Fight', description: 'Pop balloons and survive', thumbnail: '/images/games/nes/balloon-fight.jpg', url: 'https://www.retrogames.cc/embed/36024-balloon-fight-usa.html', maxPlayers: '2', category: 'nes', tags: ['arcade', 'action', 'multiplayer'] },
  // ==================== SNES GAMES ====================
  { id: 'super-mario-world', name: 'Super Mario World', description: 'Platformer masterpiece with Yoshi', thumbnail: '/images/games/snes/super-mario-world.jpg', url: 'https://www.retrogames.cc/embed/46254-super-mario-world-usa.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'mario', 'nintendo', 'popular'] },
  { id: 'zelda-alttp', name: 'Zelda: A Link to the Past', description: 'Top-down adventure classic', thumbnail: '/images/games/snes/zelda-alttp.jpg', url: 'https://www.retrogames.cc/embed/46176-legend-of-zelda-the-a-link-to-the-past-usa.html', maxPlayers: '1', category: 'snes', tags: ['adventure', 'zelda', 'nintendo', 'popular'] },
  { id: 'chrono-trigger', name: 'Chrono Trigger', description: 'Time-traveling RPG masterpiece', thumbnail: '/images/games/snes/chrono-trigger.jpg', url: 'https://www.retrogames.cc/embed/46081-chrono-trigger-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'jrpg', 'squaresoft', 'popular'] },
  { id: 'super-metroid', name: 'Super Metroid', description: 'The defining metroidvania experience', thumbnail: '/images/games/snes/super-metroid.jpg', url: 'https://www.retrogames.cc/embed/46250-super-metroid-usa-europe.html', maxPlayers: '1', category: 'snes', tags: ['action', 'metroidvania', 'nintendo', 'popular'] },
  { id: 'donkey-kong-country', name: 'Donkey Kong Country', description: 'Beautiful platformer with DK and Diddy', thumbnail: '/images/games/snes/donkey-kong-country.jpg', url: 'https://www.retrogames.cc/embed/46089-donkey-kong-country-usa.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'rare', 'nintendo', 'popular'] },
  { id: 'street-fighter-2-turbo', name: 'Street Fighter II Turbo', description: 'Classic fighting game', thumbnail: '/images/games/snes/street-fighter-2-turbo.jpg', url: 'https://www.retrogames.cc/embed/46237-street-fighter-ii-turbo-hyper-fighting-usa.html', maxPlayers: '2', category: 'snes', tags: ['fighting', 'capcom', 'arcade', 'popular'] },
  { id: 'final-fantasy-6', name: 'Final Fantasy VI', description: 'Epic RPG with a massive cast', thumbnail: '/images/games/snes/final-fantasy-6.jpg', url: 'https://www.retrogames.cc/embed/46110-final-fantasy-vi-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'jrpg', 'squaresoft'] },
  { id: 'earthbound', name: 'EarthBound', description: 'Quirky modern-day RPG adventure', thumbnail: '/images/games/snes/earthbound.jpg', url: 'https://www.retrogames.cc/embed/46093-earthbound-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'nintendo', 'quirky'] },
  { id: 'super-mario-kart', name: 'Super Mario Kart', description: 'The original kart racer', thumbnail: '/images/games/snes/super-mario-kart.jpg', url: 'https://www.retrogames.cc/embed/46252-super-mario-kart-usa.html', maxPlayers: '2', category: 'snes', tags: ['racing', 'mario', 'nintendo', 'popular'] },
  { id: 'mega-man-x', name: 'Mega Man X', description: 'Action-packed robot battles', thumbnail: '/images/games/snes/mega-man-x.jpg', url: 'https://www.retrogames.cc/embed/46196-mega-man-x-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'platformer', 'capcom'] },
  { id: 'donkey-kong-country-2', name: 'DKC 2: Diddys Quest', description: 'Diddy and Dixie Kong adventure', thumbnail: '/images/games/snes/donkey-kong-country-2.jpg', url: 'https://www.retrogames.cc/embed/46090-donkey-kong-country-2-diddys-kong-quest-usa.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'rare', 'popular'] },
  { id: 'super-mario-rpg', name: 'Super Mario RPG', description: 'Mario meets RPG gameplay', thumbnail: '/images/games/snes/super-mario-rpg.jpg', url: 'https://www.retrogames.cc/embed/46253-super-mario-rpg-legend-of-the-seven-stars-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'mario', 'squaresoft', 'popular'] },
  { id: 'secret-of-mana', name: 'Secret of Mana', description: 'Action RPG with co-op', thumbnail: '/images/games/snes/secret-of-mana.jpg', url: 'https://www.retrogames.cc/embed/46230-secret-of-mana-usa.html', maxPlayers: '3', category: 'snes', tags: ['rpg', 'action', 'multiplayer'] },
  { id: 'super-castlevania-4', name: 'Super Castlevania IV', description: 'Whip through Draculas castle', thumbnail: '/images/games/snes/super-castlevania-4.jpg', url: 'https://www.retrogames.cc/embed/46241-super-castlevania-iv-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'horror', 'konami'] },
  { id: 'contra-3', name: 'Contra III: Alien Wars', description: 'Run and gun alien blasting', thumbnail: '/images/games/snes/contra-3.jpg', url: 'https://www.retrogames.cc/embed/46083-contra-iii-the-alien-wars-usa.html', maxPlayers: '2', category: 'snes', tags: ['action', 'shooter', 'konami', 'popular'] },
  { id: 'super-bomberman', name: 'Super Bomberman', description: 'Explosive multiplayer fun', thumbnail: '/images/games/snes/super-bomberman.jpg', url: 'https://www.retrogames.cc/embed/46239-super-bomberman-europe.html', maxPlayers: '4', category: 'snes', tags: ['action', 'puzzle', 'multiplayer'] },
  { id: 'mortal-kombat-2', name: 'Mortal Kombat II', description: 'Fatalities and Friendships', thumbnail: '/images/games/snes/mortal-kombat-2.jpg', url: 'https://www.retrogames.cc/embed/46199-mortal-kombat-ii-usa.html', maxPlayers: '2', category: 'snes', tags: ['fighting', 'arcade', 'violent'] },
  { id: 'donkey-kong-country-3', name: 'DKC 3: Dixies Quest', description: 'Dixie and Kiddy Kong adventure', thumbnail: '/images/games/snes/donkey-kong-country-3.jpg', url: 'https://www.retrogames.cc/embed/46091-donkey-kong-country-3-dixie-kongs-double-trouble-usa.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'rare', 'popular'] },
  { id: 'final-fantasy-4', name: 'Final Fantasy IV', description: 'Cecils journey of redemption', thumbnail: '/images/games/snes/final-fantasy-4.jpg', url: 'https://www.retrogames.cc/embed/46109-final-fantasy-iv-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'jrpg', 'squaresoft'] },
  { id: 'mega-man-x2', name: 'Mega Man X2', description: 'More robot-hunting action', thumbnail: '/images/games/snes/mega-man-x2.jpg', url: 'https://www.retrogames.cc/embed/46197-mega-man-x2-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'platformer', 'capcom'] },
  { id: 'super-punch-out', name: 'Super Punch-Out!!', description: 'Boxing champion sequel', thumbnail: '/images/games/snes/super-punch-out.jpg', url: 'https://www.retrogames.cc/embed/46259-super-punch-out-usa.html', maxPlayers: '1', category: 'snes', tags: ['sports', 'boxing', 'nintendo'] },
  { id: 'starfox-snes', name: 'Star Fox', description: 'Original 3D space shooter', thumbnail: '/images/games/snes/starfox-snes.jpg', url: 'https://www.retrogames.cc/embed/46234-star-fox-usa.html', maxPlayers: '1', category: 'snes', tags: ['shooter', 'space', 'nintendo'] },
  { id: 'kirby-super-star', name: 'Kirby Super Star', description: 'Multiple Kirby adventures', thumbnail: '/images/games/snes/kirby-super-star.jpg', url: 'https://www.retrogames.cc/embed/46162-kirby-super-star-usa.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'kirby', 'multiplayer'] },
  { id: 'yoshis-island', name: 'Yoshis Island', description: 'Baby Mario escort mission', thumbnail: '/images/games/snes/yoshis-island.jpg', url: 'https://www.retrogames.cc/embed/46260-super-mario-world-2-yoshis-island-usa.html', maxPlayers: '1', category: 'snes', tags: ['platformer', 'yoshi', 'nintendo', 'popular'] },
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
