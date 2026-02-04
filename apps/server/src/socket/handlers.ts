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
  { id: 'crash-bandicoot', name: 'Crash Bandicoot', description: 'Classic platform adventure with Crash', thumbnail: '/images/games/ps1/crash-bandicoot.jpg', url: 'https://www.retrogames.cc/embed/40784-crash-bandicoot.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'crash', 'playstation', 'popular'] },
  { id: 'spyro-dragon', name: 'Spyro the Dragon', description: '3D platformer adventure with the purple dragon', thumbnail: '/images/games/ps1/spyro-the-dragon.jpg', url: 'https://www.retrogames.cc/embed/40796-spyro-the-dragon.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'spyro', 'playstation', 'popular'] },
  { id: 'tekken-3', name: 'Tekken 3', description: 'Legendary fighting game', thumbnail: '/images/games/ps1/tekken-3.jpg', url: 'https://www.retrogames.cc/embed/40238-tekken-3.html', maxPlayers: '2', category: 'ps1', tags: ['fighting', 'arcade', 'popular'] },
  { id: 'final-fantasy-7', name: 'Final Fantasy VII', description: 'Epic RPG - Follow Cloud and AVALANCHE', thumbnail: '/images/games/ps1/final-fantasy-7.jpg', url: 'https://www.retrogames.cc/embed/43658-final-fantasy-vii-usa-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['rpg', 'jrpg', 'squaresoft', 'popular'] },
  { id: 'metal-gear-solid', name: 'Metal Gear Solid', description: 'Stealth action - Solid Snake infiltrates', thumbnail: '/images/games/ps1/metal-gear-solid.jpg', url: 'https://www.retrogames.cc/embed/43266-metal-gear-solid-disc-1.html', maxPlayers: '1', category: 'ps1', tags: ['stealth', 'action', 'konami', 'popular'] },
  { id: 'resident-evil', name: 'Resident Evil', description: 'Survival horror classic - Escape the mansion', thumbnail: '/images/games/ps1/resident-evil.jpg', url: 'https://www.retrogames.cc/embed/42875-resident-evil.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'capcom'] },
  { id: 'gran-turismo', name: 'Gran Turismo', description: 'The real driving simulator', thumbnail: '/images/games/ps1/gran-turismo.jpg', url: 'https://www.retrogames.cc/embed/41826-gran-turismo.html', maxPlayers: '2', category: 'ps1', tags: ['racing', 'simulator', 'cars'] },
  { id: 'tony-hawk-2', name: "Tony Hawk's Pro Skater 2", description: 'Skateboarding classic - nail those combos', thumbnail: '/images/games/ps1/tony-hawk-2.jpg', url: 'https://www.retrogames.cc/embed/42153-tony-hawks-pro-skater-2.html', maxPlayers: '2', category: 'ps1', tags: ['sports', 'skateboard', 'popular'] },
  { id: 'castlevania-sotn', name: 'Castlevania: SOTN', description: 'Symphony of the Night - Explore Draculas castle', thumbnail: '/images/games/ps1/castlevania-sotn.jpg', url: 'https://www.retrogames.cc/embed/41504-castlevania-symphony-of-the-night.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'metroidvania', 'konami', 'popular'] },
  { id: 'crash-team-racing', name: 'Crash Team Racing', description: 'Kart racing with Crash characters', thumbnail: '/images/games/ps1/crash-team-racing.jpg', url: 'https://www.retrogames.cc/embed/41687-crash-team-racing.html', maxPlayers: '4', category: 'ps1', tags: ['racing', 'crash', 'multiplayer'] },
  { id: 'crash-bandicoot-2', name: 'Crash Bandicoot 2', description: 'Cortex Strikes Back - more platforming fun', thumbnail: '/images/games/ps1/crash-bandicoot-2.jpg', url: 'https://www.retrogames.cc/embed/40129-crash-bandicoot-2-cortex-strikes-back.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'crash', 'popular'] },
  { id: 'crash-bandicoot-3', name: 'Crash Bandicoot 3: Warped', description: 'Time-traveling platformer adventure', thumbnail: '/images/games/ps1/crash-bandicoot-3.jpg', url: 'https://www.retrogames.cc/embed/40136-crash-bandicoot-warped.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'crash', 'popular'] },
  { id: 'spyro-2', name: 'Spyro 2: Riptos Rage', description: 'Dragon adventure continues', thumbnail: '/images/games/ps1/spyro-2.jpg', url: 'https://www.retrogames.cc/embed/40797-spyro-2-riptos-rage.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'spyro', 'popular'] },
  { id: 'resident-evil-2', name: 'Resident Evil 2', description: 'Survival horror in Raccoon City', thumbnail: '/images/games/ps1/resident-evil-2.jpg', url: 'https://www.retrogames.cc/embed/42943-resident-evil-2-dual-shock-ver-disc-1-leon.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'capcom', 'popular'] },
  { id: 'twisted-metal-2', name: 'Twisted Metal 2', description: 'Vehicular combat destruction', thumbnail: '/images/games/ps1/twisted-metal-2.jpg', url: 'https://www.retrogames.cc/embed/41546-twisted-metal-2.html', maxPlayers: '2', category: 'ps1', tags: ['action', 'vehicles', 'multiplayer'] },
  { id: 'ape-escape', name: 'Ape Escape', description: 'Catch monkeys with gadgets', thumbnail: '/images/games/ps1/ape-escape.jpg', url: 'https://www.retrogames.cc/embed/40196-ape-escape.html', maxPlayers: '1', category: 'ps1', tags: ['platformer', 'action', 'sony'] },
  { id: 'medievil', name: 'MediEvil', description: 'Undead knight adventure', thumbnail: '/images/games/ps1/medievil.jpg', url: 'https://www.retrogames.cc/embed/41511-medievil.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'adventure', 'horror'] },
  { id: 'silent-hill', name: 'Silent Hill', description: 'Psychological horror classic', thumbnail: '/images/games/ps1/silent-hill.jpg', url: 'https://www.retrogames.cc/embed/41684-silent-hill.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'konami', 'popular'] },
  { id: 'tomb-raider', name: 'Tomb Raider', description: 'Lara Croft adventure begins', thumbnail: '/images/games/ps1/tomb-raider.jpg', url: 'https://www.retrogames.cc/embed/42723-tomb-raider.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'adventure', 'popular'] },
  { id: 'wipeout-xl', name: 'Wipeout XL', description: 'Futuristic anti-gravity racing', thumbnail: '/images/games/ps1/wipeout-xl.jpg', url: 'https://www.retrogames.cc/embed/46521-wipeout-xl-usa.html', maxPlayers: '2', category: 'ps1', tags: ['racing', 'futuristic', 'fast'] },
  { id: 'parappa-rapper', name: 'PaRappa the Rapper', description: 'Kick punch its all in the mind', thumbnail: '/images/games/ps1/parappa-rapper.jpg', url: 'https://www.retrogames.cc/embed/41581-parappa-the-rapper.html', maxPlayers: '1', category: 'ps1', tags: ['rhythm', 'music', 'unique'] },
  { id: 'syphon-filter', name: 'Syphon Filter', description: 'Third-person stealth action', thumbnail: '/images/games/ps1/syphon-filter.jpg', url: 'https://www.retrogames.cc/embed/40805-syphon-filter.html', maxPlayers: '1', category: 'ps1', tags: ['action', 'stealth', 'shooter'] },
  { id: 'dino-crisis', name: 'Dino Crisis', description: 'Resident Evil with dinosaurs', thumbnail: '/images/games/ps1/dino-crisis.jpg', url: 'https://www.retrogames.cc/embed/40239-dino-crisis.html', maxPlayers: '1', category: 'ps1', tags: ['horror', 'survival', 'capcom'] },
  { id: 'vagrant-story', name: 'Vagrant Story', description: 'Dark action RPG', thumbnail: '/images/games/ps1/vagrant-story.jpg', url: 'https://www.retrogames.cc/embed/40117-vagrant-story.html', maxPlayers: '1', category: 'ps1', tags: ['rpg', 'action', 'squaresoft'] },
  // ==================== NES GAMES ====================
  { id: 'nes-contra', name: 'Contra', description: 'Classic run and gun action', thumbnail: '/images/games/nes/contra.jpg', url: 'https://www.retrogames.cc/embed/16841-contra-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'shooter', 'popular'] },
  { id: 'nes-mega-man-2', name: 'Mega Man 2', description: 'Action platformer classic', thumbnail: '/images/games/nes/mega-man-2.jpg', url: 'https://www.retrogames.cc/embed/20460-mega-man-2-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer', 'popular'] },
  { id: 'nes-castlevania', name: 'Castlevania', description: 'Gothic action adventure', thumbnail: '/images/games/nes/castlevania.jpg', url: 'https://www.retrogames.cc/embed/20903-castlevania-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'horror', 'popular'] },
  { id: 'nes-tetris', name: 'Tetris', description: 'The original puzzle game', thumbnail: '/images/games/nes/tetris.jpg', url: 'https://www.retrogames.cc/embed/17612-tetris-usa.html', maxPlayers: '1', category: 'nes', tags: ['puzzle', 'classic', 'popular'] },
  { id: 'nes-double-dragon', name: 'Double Dragon', description: 'Beat em up classic', thumbnail: '/images/games/nes/double-dragon.jpg', url: 'https://www.retrogames.cc/embed/22098-double-dragon-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'fighting'] },
  { id: 'nes-final-fantasy', name: 'Final Fantasy', description: 'The RPG that started it all', thumbnail: '/images/games/nes/final-fantasy.jpg', url: 'https://www.retrogames.cc/embed/17923-final-fantasy-usa.html', maxPlayers: '1', category: 'nes', tags: ['rpg', 'classic', 'popular'] },
  { id: 'nes-ninja-gaiden', name: 'Ninja Gaiden', description: 'Intense ninja action', thumbnail: '/images/games/nes/ninja-gaiden.jpg', url: 'https://www.retrogames.cc/embed/21420-ninja-gaiden-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'ninja', 'popular'] },
  { id: 'nes-battletoads', name: 'Battletoads', description: 'Tough beat em up adventure', thumbnail: '/images/games/nes/battletoads.jpg', url: 'https://www.retrogames.cc/embed/16868-battletoads-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'difficult', 'popular'] },
  { id: 'nes-duck-tales', name: 'DuckTales', description: 'Scrooge McDuck adventure', thumbnail: '/images/games/nes/duck-tales.jpg', url: 'https://www.retrogames.cc/embed/20967-duck-tales-usa.html', maxPlayers: '1', category: 'nes', tags: ['platformer', 'disney'] },
  { id: 'nes-gradius', name: 'Gradius', description: 'Space shooter classic', thumbnail: '/images/games/nes/gradius.jpg', url: 'https://www.retrogames.cc/embed/22045-gradius-usa.html', maxPlayers: '1', category: 'nes', tags: ['shooter', 'space'] },
  { id: 'nes-punch-out', name: 'Punch-Out!!', description: 'Boxing with Little Mac', thumbnail: '/images/games/nes/punch-out.jpg', url: 'https://www.retrogames.cc/embed/20466-punch-out-usa.html', maxPlayers: '1', category: 'nes', tags: ['sports', 'boxing', 'popular'] },
  { id: 'nes-bionic-commando', name: 'Bionic Commando', description: 'Grappling hook action', thumbnail: '/images/games/nes/bionic-commando.jpg', url: 'https://www.retrogames.cc/embed/17821-bionic-commando-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer'] },
  { id: 'nes-ghosts-n-goblins', name: "Ghosts 'n Goblins", description: 'Legendary difficult platformer', thumbnail: '/images/games/nes/ghosts-n-goblins.jpg', url: 'https://www.retrogames.cc/embed/22135-ghosts-n-goblins-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'difficult'] },
  { id: 'nes-tmnt', name: 'Teenage Mutant Ninja Turtles', description: 'Turtle power action', thumbnail: '/images/games/nes/tmnt.jpg', url: 'https://www.retrogames.cc/embed/21211-teenage-mutant-ninja-turtles-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'popular'] },
  { id: 'nes-metal-gear', name: 'Metal Gear', description: 'Stealth action begins', thumbnail: '/images/games/nes/metal-gear.jpg', url: 'https://www.retrogames.cc/embed/17916-metal-gear-usa.html', maxPlayers: '1', category: 'nes', tags: ['stealth', 'action'] },
  { id: 'nes-batman', name: 'Batman', description: 'Dark Knight action game', thumbnail: '/images/games/nes/batman.jpg', url: 'https://www.retrogames.cc/embed/22113-batman-the-video-game-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'superhero'] },
  { id: 'nes-mega-man', name: 'Mega Man', description: 'Blue bomber origins', thumbnail: '/images/games/nes/mega-man.jpg', url: 'https://www.retrogames.cc/embed/16698-mega-man-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer'] },
  { id: 'nes-mega-man-3', name: 'Mega Man 3', description: 'Slide into action', thumbnail: '/images/games/nes/mega-man-3.jpg', url: 'https://www.retrogames.cc/embed/16782-mega-man-3-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer'] },
  { id: 'nes-mega-man-4', name: 'Mega Man 4', description: 'Charge shot debut', thumbnail: '/images/games/nes/mega-man-4.jpg', url: 'https://www.retrogames.cc/embed/16783-mega-man-4-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer'] },
  { id: 'nes-mega-man-5', name: 'Mega Man 5', description: 'Proto Man mystery', thumbnail: '/images/games/nes/mega-man-5.jpg', url: 'https://www.retrogames.cc/embed/16695-mega-man-5-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer'] },
  { id: 'nes-mega-man-6', name: 'Mega Man 6', description: 'NES finale', thumbnail: '/images/games/nes/mega-man-6.jpg', url: 'https://www.retrogames.cc/embed/16696-mega-man-6-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'platformer'] },
  { id: 'nes-double-dragon-2', name: 'Double Dragon II', description: 'The Revenge continues', thumbnail: '/images/games/nes/double-dragon-2.jpg', url: 'https://www.retrogames.cc/embed/22234-double-dragon-ii-the-revenge-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'fighting'] },
  { id: 'nes-double-dragon-3', name: 'Double Dragon III', description: 'Sacred stones quest', thumbnail: '/images/games/nes/double-dragon-3.jpg', url: 'https://www.retrogames.cc/embed/22161-double-dragon-iii-the-sacred-stones-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'fighting'] },
  { id: 'nes-river-city-ransom', name: 'River City Ransom', description: 'Beat em up RPG hybrid', thumbnail: '/images/games/nes/river-city-ransom.jpg', url: 'https://www.retrogames.cc/embed/21949-river-city-ransom-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'rpg', 'popular'] },
  { id: 'nes-blades-of-steel', name: 'Blades of Steel', description: 'Classic hockey action', thumbnail: '/images/games/nes/blades-of-steel.jpg', url: 'https://www.retrogames.cc/embed/18071-blades-of-steel-usa.html', maxPlayers: '2', category: 'nes', tags: ['sports', 'hockey'] },
  { id: 'nes-ice-hockey', name: 'Ice Hockey', description: 'Fat and skinny players', thumbnail: '/images/games/nes/ice-hockey.jpg', url: 'https://www.retrogames.cc/embed/21659-ice-hockey-usa.html', maxPlayers: '2', category: 'nes', tags: ['sports', 'hockey'] },
  { id: 'nes-tecmo-super-bowl', name: 'Tecmo Super Bowl', description: 'Football classic', thumbnail: '/images/games/nes/tecmo-super-bowl.jpg', url: 'https://www.retrogames.cc/embed/17639-tecmo-super-bowl-usa.html', maxPlayers: '2', category: 'nes', tags: ['sports', 'football', 'popular'] },
  { id: 'nes-marble-madness', name: 'Marble Madness', description: 'Roll to the finish', thumbnail: '/images/games/nes/marble-madness.jpg', url: 'https://www.retrogames.cc/embed/17819-marble-madness-usa.html', maxPlayers: '2', category: 'nes', tags: ['puzzle', 'arcade'] },
  { id: 'nes-bubble-bobble', name: 'Bubble Bobble', description: 'Bubble shooting dragons', thumbnail: '/images/games/nes/bubble-bobble.jpg', url: 'https://www.retrogames.cc/embed/21335-bubble-bobble-usa.html', maxPlayers: '2', category: 'nes', tags: ['platformer', 'arcade', 'popular'] },
  { id: 'nes-jackal', name: 'Jackal', description: 'Jeep rescue mission', thumbnail: '/images/games/nes/jackal.jpg', url: 'https://www.retrogames.cc/embed/20756-jackal-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'shooter'] },
  { id: 'nes-life-force', name: 'Life Force', description: 'Gradius spin-off shooter', thumbnail: '/images/games/nes/life-force.jpg', url: 'https://www.retrogames.cc/embed/18069-life-force-usa.html', maxPlayers: '2', category: 'nes', tags: ['shooter', 'space'] },
  { id: 'nes-excitebike', name: 'Excitebike', description: 'Motocross racing', thumbnail: '/images/games/nes/excitebike.jpg', url: 'https://www.retrogames.cc/embed/20552-excitebike-japan-usa.html', maxPlayers: '1', category: 'nes', tags: ['racing', 'sports'] },
  { id: 'nes-balloon-fight', name: 'Balloon Fight', description: 'Float and fight', thumbnail: '/images/games/nes/balloon-fight.jpg', url: 'https://www.retrogames.cc/embed/19300-balloon-fight-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'arcade'] },
  { id: 'nes-ice-climber', name: 'Ice Climber', description: 'Climb the mountain', thumbnail: '/images/games/nes/ice-climber.jpg', url: 'https://www.retrogames.cc/embed/17897-ice-climber-usa-europe.html', maxPlayers: '2', category: 'nes', tags: ['platformer', 'arcade'] },
  { id: 'nes-kung-fu', name: 'Kung Fu', description: 'Beat em up origins', thumbnail: '/images/games/nes/kung-fu.jpg', url: 'https://www.retrogames.cc/embed/22046-kung-fu-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'fighting'] },
  { id: 'nes-galaga', name: 'Galaga', description: 'Space invader shooter', thumbnail: '/images/games/nes/galaga.jpg', url: 'https://www.retrogames.cc/embed/20918-galaga-japan.html', maxPlayers: '1', category: 'nes', tags: ['shooter', 'arcade', 'popular'] },
  { id: 'nes-dig-dug', name: 'Dig Dug', description: 'Underground arcade action', thumbnail: '/images/games/nes/dig-dug.jpg', url: 'https://www.retrogames.cc/embed/21051-dig-dug-japan.html', maxPlayers: '1', category: 'nes', tags: ['arcade', 'classic'] },
  { id: 'nes-xevious', name: 'Xevious', description: 'Vertical shooter classic', thumbnail: '/images/games/nes/xevious.jpg', url: 'https://www.retrogames.cc/embed/20836-xevious-japan.html', maxPlayers: '1', category: 'nes', tags: ['shooter', 'arcade'] },
  { id: 'nes-mappy', name: 'Mappy', description: 'Police mouse platformer', thumbnail: '/images/games/nes/mappy.jpg', url: 'https://www.retrogames.cc/embed/21016-mappy-japan.html', maxPlayers: '1', category: 'nes', tags: ['platformer', 'arcade'] },
  { id: 'nes-sky-kid', name: 'Sky Kid', description: 'Biplane shooter', thumbnail: '/images/games/nes/sky-kid.jpg', url: 'https://www.retrogames.cc/embed/20696-sky-kid-usa.html', maxPlayers: '2', category: 'nes', tags: ['shooter', 'arcade'] },
  { id: 'nes-gauntlet', name: 'Gauntlet', description: 'Dungeon crawler classic', thumbnail: '/images/games/nes/gauntlet.jpg', url: 'https://www.retrogames.cc/embed/20632-gauntlet-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'rpg'] },
  { id: 'nes-rampage', name: 'Rampage', description: 'Monster destruction', thumbnail: '/images/games/nes/rampage.jpg', url: 'https://www.retrogames.cc/embed/17704-rampage-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'arcade'] },
  { id: 'nes-paperboy', name: 'Paperboy', description: 'Deliver newspapers chaos', thumbnail: '/images/games/nes/paperboy.jpg', url: 'https://www.retrogames.cc/embed/21581-paperboy-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'arcade'] },
  { id: 'nes-spy-hunter', name: 'Spy Hunter', description: 'Vehicle combat', thumbnail: '/images/games/nes/spy-hunter.jpg', url: 'https://www.retrogames.cc/embed/21739-spy-hunter-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'racing'] },
  { id: 'nes-defender-ii', name: 'Defender II', description: 'Space defense shooter', thumbnail: '/images/games/nes/defender-ii.jpg', url: 'https://www.retrogames.cc/embed/20671-defender-ii-usa.html', maxPlayers: '1', category: 'nes', tags: ['shooter', 'arcade'] },
  { id: 'nes-joust', name: 'Joust', description: 'Ostrich jousting battle', thumbnail: '/images/games/nes/joust.jpg', url: 'https://www.retrogames.cc/embed/17105-joust-usa.html', maxPlayers: '2', category: 'nes', tags: ['action', 'arcade'] },
  { id: 'nes-qbert', name: 'Q*bert', description: 'Cube hopping puzzle', thumbnail: '/images/games/nes/qbert.jpg', url: 'https://www.retrogames.cc/embed/22140-q-bert-usa.html', maxPlayers: '1', category: 'nes', tags: ['puzzle', 'arcade'] },
  { id: 'nes-arkanoid', name: 'Arkanoid', description: 'Block breaking action', thumbnail: '/images/games/nes/arkanoid.jpg', url: 'https://www.retrogames.cc/embed/21189-arkanoid-usa.html', maxPlayers: '1', category: 'nes', tags: ['puzzle', 'arcade', 'popular'] },
  { id: 'nes-bomberman', name: 'Bomberman', description: 'Bomb maze action', thumbnail: '/images/games/nes/bomberman.jpg', url: 'https://www.retrogames.cc/embed/20411-bomberman-usa.html', maxPlayers: '1', category: 'nes', tags: ['action', 'puzzle', 'popular'] },
  // ==================== SNES GAMES ====================
  { id: 'snes-chrono-trigger', name: 'Chrono Trigger', description: 'Time-traveling RPG masterpiece', thumbnail: '/images/games/snes/chrono-trigger.jpg', url: 'https://www.retrogames.cc/embed/22857-chrono-trigger-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'classic', 'popular'] },
  { id: 'snes-ff3', name: 'Final Fantasy III', description: 'Epic SNES RPG (FF6)', thumbnail: '/images/games/snes/final-fantasy-3.jpg', url: 'https://www.retrogames.cc/embed/24569-final-fantasy-iii-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'classic', 'popular'] },
  { id: 'snes-street-fighter-2', name: 'Street Fighter II Turbo', description: 'Legendary fighting game', thumbnail: '/images/games/snes/street-fighter-2.jpg', url: 'https://www.retrogames.cc/embed/20197-street-fighter-ii-turbo-hyper-fighting-usa.html', maxPlayers: '2', category: 'snes', tags: ['fighting', 'arcade', 'popular'] },
  { id: 'snes-secret-of-mana', name: 'Secret of Mana', description: 'Action RPG classic', thumbnail: '/images/games/snes/secret-of-mana.jpg', url: 'https://www.retrogames.cc/embed/16823-secret-of-mana-usa.html', maxPlayers: '3', category: 'snes', tags: ['rpg', 'action', 'popular'] },
  { id: 'snes-earthbound', name: 'EarthBound', description: 'Quirky modern RPG', thumbnail: '/images/games/snes/earthbound.jpg', url: 'https://www.retrogames.cc/embed/24789-earthbound-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'unique', 'popular'] },
  { id: 'snes-super-metroid', name: 'Super Metroid', description: 'Exploration action perfection', thumbnail: '/images/games/snes/super-metroid.jpg', url: 'https://www.retrogames.cc/embed/16893-super-metroid-japan-usa-en-ja.html', maxPlayers: '1', category: 'snes', tags: ['action', 'exploration', 'popular'] },
  { id: 'snes-dkc', name: 'Donkey Kong Country', description: 'Platformer with stunning graphics', thumbnail: '/images/games/snes/donkey-kong-country.jpg', url: 'https://www.retrogames.cc/embed/23005-donkey-kong-country-usa.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'popular'] },
  { id: 'snes-contra-3', name: 'Contra III: The Alien Wars', description: 'Run and gun action', thumbnail: '/images/games/snes/contra-3.jpg', url: 'https://www.retrogames.cc/embed/23268-contra-iii-the-alien-wars-usa.html', maxPlayers: '2', category: 'snes', tags: ['action', 'shooter', 'popular'] },
  { id: 'snes-super-castlevania-4', name: 'Super Castlevania IV', description: 'Gothic platformer action', thumbnail: '/images/games/snes/super-castlevania-4.jpg', url: 'https://www.retrogames.cc/embed/23973-super-castlevania-iv-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'horror', 'popular'] },
  { id: 'snes-actraiser', name: 'ActRaiser', description: 'Action and simulation hybrid', thumbnail: '/images/games/snes/actraiser.jpg', url: 'https://www.retrogames.cc/embed/22537-actraiser-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'simulation'] },
  { id: 'snes-tmnt-4', name: 'TMNT IV: Turtles in Time', description: 'Best TMNT beat em up', thumbnail: '/images/games/snes/tmnt-4.jpg', url: 'https://www.retrogames.cc/embed/24621-teenage-mutant-ninja-turtles-iv-turtles-in-time-usa.html', maxPlayers: '2', category: 'snes', tags: ['action', 'popular'] },
  { id: 'snes-mortal-kombat-2', name: 'Mortal Kombat II', description: 'Brutal fighting sequel', thumbnail: '/images/games/snes/mortal-kombat-2.jpg', url: 'https://www.retrogames.cc/embed/22440-mortal-kombat-ii-usa.html', maxPlayers: '2', category: 'snes', tags: ['fighting', 'popular'] },
  { id: 'snes-killer-instinct', name: 'Killer Instinct', description: 'Combo-heavy fighting', thumbnail: '/images/games/snes/killer-instinct.jpg', url: 'https://www.retrogames.cc/embed/17355-killer-instinct-usa.html', maxPlayers: '2', category: 'snes', tags: ['fighting', 'popular'] },
  { id: 'snes-super-punch-out', name: 'Super Punch-Out!!', description: 'Boxing sequel', thumbnail: '/images/games/snes/super-punch-out.jpg', url: 'https://www.retrogames.cc/embed/23492-super-punch-out-usa.html', maxPlayers: '1', category: 'snes', tags: ['sports', 'boxing'] },
  { id: 'snes-sunset-riders', name: 'Sunset Riders', description: 'Wild west run and gun', thumbnail: '/images/games/snes/sunset-riders.jpg', url: 'https://www.retrogames.cc/embed/19970-sunset-riders-usa.html', maxPlayers: '2', category: 'snes', tags: ['action', 'shooter'] },
  { id: 'snes-ff2', name: 'Final Fantasy II', description: 'SNES RPG classic (FF4)', thumbnail: '/images/games/snes/final-fantasy-2.jpg', url: 'https://www.retrogames.cc/embed/19618-final-fantasy-ii-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'classic'] },
  { id: 'snes-breath-of-fire', name: 'Breath of Fire', description: 'Dragon RPG adventure', thumbnail: '/images/games/snes/breath-of-fire.jpg', url: 'https://www.retrogames.cc/embed/19822-breath-of-fire-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg'] },
  { id: 'snes-breath-of-fire-2', name: 'Breath of Fire II', description: 'Dragon RPG sequel', thumbnail: '/images/games/snes/breath-of-fire-2.jpg', url: 'https://www.retrogames.cc/embed/19771-breath-of-fire-ii-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg'] },
  { id: 'snes-illusion-of-gaia', name: 'Illusion of Gaia', description: 'Action RPG adventure', thumbnail: '/images/games/snes/illusion-of-gaia.jpg', url: 'https://www.retrogames.cc/embed/23950-illusion-of-gaia-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'action'] },
  { id: 'snes-soul-blazer', name: 'Soul Blazer', description: 'Town rebuilding RPG', thumbnail: '/images/games/snes/soul-blazer.jpg', url: 'https://www.retrogames.cc/embed/23401-soul-blazer-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'action'] },
  { id: 'snes-terranigma', name: 'Terranigma', description: 'World creation RPG', thumbnail: '/images/games/snes/terranigma.jpg', url: 'https://www.retrogames.cc/embed/22360-terranigma-europe.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'action', 'popular'] },
  { id: 'snes-lufia', name: 'Lufia & The Fortress of Doom', description: 'Classic JRPG', thumbnail: '/images/games/snes/lufia.jpg', url: 'https://www.retrogames.cc/embed/24921-lufia-the-fortress-of-doom-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg'] },
  { id: 'snes-lufia-2', name: 'Lufia II: Rise of the Sinistrals', description: 'Puzzle dungeon RPG', thumbnail: '/images/games/snes/lufia-2.jpg', url: 'https://www.retrogames.cc/embed/23528-lufia-ii-rise-of-the-sinistrals-usa.html', maxPlayers: '1', category: 'snes', tags: ['rpg', 'puzzle', 'popular'] },
  { id: 'snes-mega-man-x2', name: 'Mega Man X2', description: 'X continues the fight', thumbnail: '/images/games/snes/mega-man-x2.jpg', url: 'https://www.retrogames.cc/embed/19996-megaman-x2-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'platformer'] },
  { id: 'snes-mega-man-x3', name: 'Mega Man X3', description: 'Zero becomes playable', thumbnail: '/images/games/snes/mega-man-x3.jpg', url: 'https://www.retrogames.cc/embed/19667-megaman-x3-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'platformer'] },
  { id: 'snes-dkc2', name: 'Donkey Kong Country 2', description: 'Diddys Kong Quest', thumbnail: '/images/games/snes/donkey-kong-country-2.jpg', url: 'https://www.retrogames.cc/embed/23926-donkey-kong-country-2-diddy-s-kong-quest-usa-en-fr.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'popular'] },
  { id: 'snes-dkc3', name: 'Donkey Kong Country 3', description: 'Dixie Kongs Double Trouble', thumbnail: '/images/games/snes/donkey-kong-country-3.jpg', url: 'https://www.retrogames.cc/embed/24602-donkey-kong-country-3-dixie-kong-s-double-trouble-usa-en-fr.html', maxPlayers: '2', category: 'snes', tags: ['platformer'] },
  { id: 'snes-super-double-dragon', name: 'Super Double Dragon', description: '16-bit beat em up', thumbnail: '/images/games/snes/super-double-dragon.jpg', url: 'https://www.retrogames.cc/embed/24499-super-double-dragon-usa.html', maxPlayers: '2', category: 'snes', tags: ['action', 'fighting'] },
  { id: 'snes-final-fight', name: 'Final Fight', description: 'Arcade beat em up', thumbnail: '/images/games/snes/final-fight.jpg', url: 'https://www.retrogames.cc/embed/17377-final-fight-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'fighting', 'popular'] },
  { id: 'snes-final-fight-2', name: 'Final Fight 2', description: 'Beat em up sequel', thumbnail: '/images/games/snes/final-fight-2.jpg', url: 'https://www.retrogames.cc/embed/24742-final-fight-2-usa.html', maxPlayers: '2', category: 'snes', tags: ['action', 'fighting'] },
  { id: 'snes-final-fight-3', name: 'Final Fight 3', description: 'Final beat em up', thumbnail: '/images/games/snes/final-fight-3.jpg', url: 'https://www.retrogames.cc/embed/24623-final-fight-3-usa.html', maxPlayers: '2', category: 'snes', tags: ['action', 'fighting'] },
  { id: 'snes-super-ghouls-n-ghosts', name: "Super Ghouls 'n Ghosts", description: 'Difficult platformer sequel', thumbnail: '/images/games/snes/super-ghouls-n-ghosts.jpg', url: 'https://www.retrogames.cc/embed/24481-super-ghouls-n-ghosts-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'difficult'] },
  { id: 'snes-demons-crest', name: "Demon's Crest", description: 'Gothic action adventure', thumbnail: '/images/games/snes/demons-crest.jpg', url: 'https://www.retrogames.cc/embed/23292-demon-s-crest-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'horror'] },
  { id: 'snes-aladdin', name: 'Aladdin', description: 'Disney platformer', thumbnail: '/images/games/snes/aladdin.jpg', url: 'https://www.retrogames.cc/embed/17022-aladdin-usa.html', maxPlayers: '1', category: 'snes', tags: ['platformer', 'disney'] },
  { id: 'snes-pilotwings', name: 'Pilotwings', description: 'Flight simulation', thumbnail: '/images/games/snes/pilotwings.jpg', url: 'https://www.retrogames.cc/embed/22718-pilotwings-usa.html', maxPlayers: '1', category: 'snes', tags: ['simulation', 'flying'] },
  { id: 'snes-gradius-3', name: 'Gradius III', description: 'Space shooter sequel', thumbnail: '/images/games/snes/gradius-3.jpg', url: 'https://www.retrogames.cc/embed/24868-gradius-iii-usa.html', maxPlayers: '1', category: 'snes', tags: ['shooter', 'space'] },
  { id: 'snes-r-type-3', name: 'R-Type III', description: 'Side scrolling shooter', thumbnail: '/images/games/snes/r-type-3.jpg', url: 'https://www.retrogames.cc/embed/22997-r-type-iii-the-third-lightning-usa.html', maxPlayers: '1', category: 'snes', tags: ['shooter', 'space'] },
  { id: 'snes-axelay', name: 'Axelay', description: 'Konami shooter classic', thumbnail: '/images/games/snes/axelay.jpg', url: 'https://www.retrogames.cc/embed/23751-axelay-usa.html', maxPlayers: '1', category: 'snes', tags: ['shooter', 'space'] },
  { id: 'snes-zombies', name: 'Zombies Ate My Neighbors', description: 'Campy horror action', thumbnail: '/images/games/snes/zombies.jpg', url: 'https://www.retrogames.cc/embed/22847-zombies-ate-my-neighbors-usa.html', maxPlayers: '2', category: 'snes', tags: ['action', 'horror', 'popular'] },
  { id: 'snes-rock-n-roll-racing', name: "Rock n' Roll Racing", description: 'Combat racing with rock', thumbnail: '/images/games/snes/rock-n-roll-racing.jpg', url: 'https://www.retrogames.cc/embed/24053-rock-n-roll-racing-usa.html', maxPlayers: '2', category: 'snes', tags: ['racing', 'action'] },
  { id: 'snes-star-fox', name: 'Star Fox', description: '3D space shooter', thumbnail: '/images/games/snes/star-fox.jpg', url: 'https://www.retrogames.cc/embed/19754-star-fox-usa.html', maxPlayers: '1', category: 'snes', tags: ['shooter', 'space', 'popular'] },
  { id: 'snes-f-zero', name: 'F-Zero', description: 'Futuristic racing', thumbnail: '/images/games/snes/f-zero.jpg', url: 'https://www.retrogames.cc/embed/20082-f-zero-usa.html', maxPlayers: '1', category: 'snes', tags: ['racing', 'futuristic', 'popular'] },
  { id: 'snes-sparkster', name: 'Sparkster', description: 'Rocket knight action', thumbnail: '/images/games/snes/sparkster.jpg', url: 'https://www.retrogames.cc/embed/20064-sparkster-usa.html', maxPlayers: '1', category: 'snes', tags: ['action', 'platformer'] },
  { id: 'snes-kirby-super-star', name: 'Kirby Super Star', description: 'Multiple Kirby games', thumbnail: '/images/games/snes/kirby-super-star.jpg', url: 'https://www.retrogames.cc/embed/24938-kirby-super-star-usa.html', maxPlayers: '2', category: 'snes', tags: ['platformer', 'popular'] },
  // ==================== N64 GAMES ====================
  { id: 'n64-goldeneye', name: 'GoldenEye 007', description: 'Legendary FPS', thumbnail: '/images/games/n64/goldeneye.jpg', url: 'https://www.retrogames.cc/embed/32471-007-goldeneye-usa.html', maxPlayers: '4', category: 'n64', tags: ['fps', 'shooter', 'popular'] },
  { id: 'n64-banjo-kazooie', name: 'Banjo-Kazooie', description: '3D platformer adventure', thumbnail: '/images/games/n64/banjo-kazooie.jpg', url: 'https://www.retrogames.cc/embed/32914-banjo-kazooie-usa.html', maxPlayers: '1', category: 'n64', tags: ['platformer', 'adventure', 'popular'] },
  { id: 'n64-perfect-dark', name: 'Perfect Dark', description: 'Sci-fi FPS sequel', thumbnail: '/images/games/n64/perfect-dark.jpg', url: 'https://www.retrogames.cc/embed/32790-perfect-dark-usa.html', maxPlayers: '4', category: 'n64', tags: ['fps', 'shooter', 'popular'] },
  { id: 'n64-turok', name: 'Turok: Dinosaur Hunter', description: 'Dino hunting FPS', thumbnail: '/images/games/n64/turok.jpg', url: 'https://www.retrogames.cc/embed/32866-turok-dinosaur-hunter-usa.html', maxPlayers: '1', category: 'n64', tags: ['fps', 'shooter'] },
  { id: 'n64-wwf-no-mercy', name: 'WWF No Mercy', description: 'Best wrestling game ever', thumbnail: '/images/games/n64/wwf-no-mercy.jpg', url: 'https://www.retrogames.cc/embed/32254-wwf-no-mercy-usa.html', maxPlayers: '4', category: 'n64', tags: ['wrestling', 'sports', 'popular'] },
  { id: 'n64-mortal-kombat-4', name: 'Mortal Kombat 4', description: '3D fighting brutality', thumbnail: '/images/games/n64/mortal-kombat-4.jpg', url: 'https://www.retrogames.cc/embed/32474-mortal-kombat-4-usa.html', maxPlayers: '2', category: 'n64', tags: ['fighting'] },
  { id: 'n64-doom-64', name: 'Doom 64', description: 'Exclusive Doom sequel', thumbnail: '/images/games/n64/doom-64.jpg', url: 'https://www.retrogames.cc/embed/32928-doom-64-usa.html', maxPlayers: '1', category: 'n64', tags: ['fps', 'horror', 'popular'] },
  { id: 'n64-re2', name: 'Resident Evil 2', description: 'Survival horror port', thumbnail: '/images/games/n64/resident-evil-2.jpg', url: 'https://www.retrogames.cc/embed/32483-resident-evil-2-usa.html', maxPlayers: '1', category: 'n64', tags: ['horror', 'survival'] },
  { id: 'n64-killer-instinct-gold', name: 'Killer Instinct Gold', description: 'Combo fighting action', thumbnail: '/images/games/n64/killer-instinct-gold.jpg', url: 'https://www.retrogames.cc/embed/32280-killer-instinct-gold-usa.html', maxPlayers: '2', category: 'n64', tags: ['fighting', 'popular'] },
  { id: 'n64-blast-corps', name: 'Blast Corps', description: 'Destruction puzzle game', thumbnail: '/images/games/n64/blast-corps.jpg', url: 'https://www.retrogames.cc/embed/32273-blast-corps-usa.html', maxPlayers: '1', category: 'n64', tags: ['action', 'puzzle'] },
  { id: 'n64-jet-force-gemini', name: 'Jet Force Gemini', description: 'Sci-fi action shooter', thumbnail: '/images/games/n64/jet-force-gemini.jpg', url: 'https://www.retrogames.cc/embed/32163-jet-force-gemini-usa.html', maxPlayers: '2', category: 'n64', tags: ['action', 'shooter'] },
  { id: 'n64-mischief-makers', name: 'Mischief Makers', description: 'Shake shake platformer', thumbnail: '/images/games/n64/mischief-makers.jpg', url: 'https://www.retrogames.cc/embed/32636-mischief-makers-usa.html', maxPlayers: '1', category: 'n64', tags: ['platformer', 'action'] },
  { id: 'n64-turok-2', name: 'Turok 2: Seeds of Evil', description: 'Cerebral bore shooter', thumbnail: '/images/games/n64/turok-2.jpg', url: 'https://www.retrogames.cc/embed/32283-turok-2-seeds-of-evil-usa.html', maxPlayers: '4', category: 'n64', tags: ['fps', 'shooter'] },
  { id: 'n64-turok-3', name: 'Turok 3: Shadow of Oblivion', description: 'Final N64 Turok', thumbnail: '/images/games/n64/turok-3.jpg', url: 'https://www.retrogames.cc/embed/32696-turok-3-shadow-of-oblivion-usa.html', maxPlayers: '4', category: 'n64', tags: ['fps', 'shooter'] },
  { id: 'n64-wcw-revenge', name: 'WCW/nWo Revenge', description: 'Classic wrestling', thumbnail: '/images/games/n64/wcw-revenge.jpg', url: 'https://www.retrogames.cc/embed/32467-wcw-nwo-revenge-usa.html', maxPlayers: '4', category: 'n64', tags: ['wrestling', 'sports'] },
  { id: 'n64-wrestlemania-2000', name: 'WWF WrestleMania 2000', description: 'Wrestling classic', thumbnail: '/images/games/n64/wrestlemania-2000.jpg', url: 'https://www.retrogames.cc/embed/32768-wwf-wrestlemania-2000-usa.html', maxPlayers: '4', category: 'n64', tags: ['wrestling', 'sports'] },
  { id: 'n64-tony-hawk', name: "Tony Hawk's Pro Skater", description: 'Skateboarding revolution', thumbnail: '/images/games/n64/tony-hawk.jpg', url: 'https://www.retrogames.cc/embed/32693-tony-hawk-s-pro-skater-usa.html', maxPlayers: '2', category: 'n64', tags: ['sports', 'skateboard', 'popular'] },
  { id: 'n64-tony-hawk-2', name: "Tony Hawk's Pro Skater 2", description: 'Best skating game', thumbnail: '/images/games/n64/tony-hawk-2.jpg', url: 'https://www.retrogames.cc/embed/32673-tony-hawk-s-pro-skater-2-usa.html', maxPlayers: '2', category: 'n64', tags: ['sports', 'skateboard', 'popular'] },
  { id: 'n64-tony-hawk-3', name: "Tony Hawk's Pro Skater 3", description: 'Revert combo madness', thumbnail: '/images/games/n64/tony-hawk-3.jpg', url: 'https://www.retrogames.cc/embed/32454-tony-hawk-s-pro-skater-3-usa.html', maxPlayers: '2', category: 'n64', tags: ['sports', 'skateboard'] },
  { id: 'n64-wave-race', name: 'Wave Race 64', description: 'Jet ski racing', thumbnail: '/images/games/n64/wave-race.jpg', url: 'https://www.retrogames.cc/embed/32409-wave-race-64-usa.html', maxPlayers: '2', category: 'n64', tags: ['racing', 'water'] },
  { id: 'n64-excitebike-64', name: 'Excitebike 64', description: 'Motocross racing', thumbnail: '/images/games/n64/excitebike-64.jpg', url: 'https://www.retrogames.cc/embed/32344-excitebike-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['racing', 'sports'] },
  { id: 'n64-f-zero-x', name: 'F-Zero X', description: 'Futuristic racing', thumbnail: '/images/games/n64/f-zero-x.jpg', url: 'https://www.retrogames.cc/embed/32319-f-zero-x-usa.html', maxPlayers: '4', category: 'n64', tags: ['racing', 'futuristic', 'popular'] },
  { id: 'n64-nfl-blitz', name: 'NFL Blitz', description: 'Arcade football', thumbnail: '/images/games/n64/nfl-blitz.jpg', url: 'https://www.retrogames.cc/embed/32827-nfl-blitz-usa.html', maxPlayers: '4', category: 'n64', tags: ['sports', 'football'] },
  { id: 'n64-nba-jam-99', name: 'NBA Jam 99', description: 'Arcade basketball', thumbnail: '/images/games/n64/nba-jam-99.jpg', url: 'https://www.retrogames.cc/embed/32781-nba-jam-99-usa.html', maxPlayers: '4', category: 'n64', tags: ['sports', 'basketball'] },
  { id: 'n64-nba-hangtime', name: 'NBA Hangtime', description: 'Classic NBA Jam style', thumbnail: '/images/games/n64/nba-hangtime.jpg', url: 'https://www.retrogames.cc/embed/32691-nba-hangtime-usa.html', maxPlayers: '4', category: 'n64', tags: ['sports', 'basketball'] },
  { id: 'n64-wayne-gretzky', name: "Wayne Gretzky's 3D Hockey", description: 'Arcade hockey', thumbnail: '/images/games/n64/wayne-gretzky.jpg', url: 'https://www.retrogames.cc/embed/32154-wayne-gretzky-s-3d-hockey-usa.html', maxPlayers: '4', category: 'n64', tags: ['sports', 'hockey'] },
  { id: 'n64-mission-impossible', name: 'Mission: Impossible', description: 'Stealth action', thumbnail: '/images/games/n64/mission-impossible.jpg', url: 'https://www.retrogames.cc/embed/32179-mission-impossible-usa.html', maxPlayers: '1', category: 'n64', tags: ['action', 'stealth'] },
  { id: 'n64-duke-nukem', name: 'Duke Nukem 64', description: 'Hail to the king', thumbnail: '/images/games/n64/duke-nukem.jpg', url: 'https://www.retrogames.cc/embed/32786-duke-nukem-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['fps', 'shooter'] },
  { id: 'n64-starcraft', name: 'StarCraft 64', description: 'RTS on console', thumbnail: '/images/games/n64/starcraft.jpg', url: 'https://www.retrogames.cc/embed/32178-starcraft-64-usa.html', maxPlayers: '2', category: 'n64', tags: ['strategy', 'rts'] },
  { id: 'n64-body-harvest', name: 'Body Harvest', description: 'Open world action', thumbnail: '/images/games/n64/body-harvest.jpg', url: 'https://www.retrogames.cc/embed/32336-body-harvest-usa.html', maxPlayers: '1', category: 'n64', tags: ['action', 'open-world'] },
  { id: 'n64-hybrid-heaven', name: 'Hybrid Heaven', description: 'RPG fighting hybrid', thumbnail: '/images/games/n64/hybrid-heaven.jpg', url: 'https://www.retrogames.cc/embed/32736-hybrid-heaven-usa.html', maxPlayers: '1', category: 'n64', tags: ['rpg', 'action'] },
  { id: 'n64-winback', name: 'WinBack', description: 'Cover shooter pioneer', thumbnail: '/images/games/n64/winback.jpg', url: 'https://www.retrogames.cc/embed/32398-winback-covert-operations-usa.html', maxPlayers: '4', category: 'n64', tags: ['action', 'shooter'] },
  { id: 'n64-battletanx', name: 'BattleTanx', description: 'Tank combat action', thumbnail: '/images/games/n64/battletanx.jpg', url: 'https://www.retrogames.cc/embed/32256-battletanx-usa.html', maxPlayers: '4', category: 'n64', tags: ['action', 'tanks'] },
  { id: 'n64-vigilante-8', name: 'Vigilante 8', description: 'Vehicle combat', thumbnail: '/images/games/n64/vigilante-8.jpg', url: 'https://www.retrogames.cc/embed/32140-vigilante-8-usa.html', maxPlayers: '4', category: 'n64', tags: ['action', 'vehicles'] },
  { id: 'n64-south-park', name: 'South Park', description: 'Crude FPS action', thumbnail: '/images/games/n64/south-park.jpg', url: 'https://www.retrogames.cc/embed/32288-south-park-usa.html', maxPlayers: '4', category: 'n64', tags: ['fps', 'comedy'] },
  { id: 'n64-snowboard-kids', name: 'Snowboard Kids', description: 'Kart racing on snow', thumbnail: '/images/games/n64/snowboard-kids.jpg', url: 'https://www.retrogames.cc/embed/32737-snowboard-kids-usa.html', maxPlayers: '4', category: 'n64', tags: ['racing', 'sports'] },
  { id: 'n64-hydro-thunder', name: 'Hydro Thunder', description: 'Boat racing arcade', thumbnail: '/images/games/n64/hydro-thunder.jpg', url: 'https://www.retrogames.cc/embed/32211-hydro-thunder-usa.html', maxPlayers: '2', category: 'n64', tags: ['racing', 'water', 'popular'] },
  { id: 'n64-road-rash', name: 'Road Rash 64', description: 'Motorcycle combat racing', thumbnail: '/images/games/n64/road-rash.jpg', url: 'https://www.retrogames.cc/embed/32255-road-rash-64-usa.html', maxPlayers: '4', category: 'n64', tags: ['racing', 'action'] },
  { id: 'n64-extreme-g', name: 'Extreme-G', description: 'Futuristic bike racing', thumbnail: '/images/games/n64/extreme-g.jpg', url: 'https://www.retrogames.cc/embed/32816-extreme-g-usa.html', maxPlayers: '4', category: 'n64', tags: ['racing', 'futuristic'] },
  { id: 'n64-wipeout', name: 'Wipeout 64', description: 'Anti-gravity racing', thumbnail: '/images/games/n64/wipeout.jpg', url: 'https://www.retrogames.cc/embed/32342-wipeout-64-usa.html', maxPlayers: '2', category: 'n64', tags: ['racing', 'futuristic'] },
  { id: 'n64-star-wars-rogue', name: 'Star Wars: Rogue Squadron', description: 'X-Wing space combat', thumbnail: '/images/games/n64/star-wars-rogue.jpg', url: 'https://www.retrogames.cc/embed/32617-star-wars-rogue-squadron-usa.html', maxPlayers: '1', category: 'n64', tags: ['shooter', 'space', 'popular'] },
  { id: 'n64-star-wars-racer', name: 'Star Wars Episode I: Racer', description: 'Podracing action', thumbnail: '/images/games/n64/star-wars-racer.jpg', url: 'https://www.retrogames.cc/embed/32251-star-wars-episode-i-racer-usa.html', maxPlayers: '2', category: 'n64', tags: ['racing', 'popular'] },
  // ==================== GBA GAMES ====================
  { id: 'gba-castlevania-aria', name: 'Castlevania: Aria of Sorrow', description: 'Best GBA Castlevania', thumbnail: '/images/games/gba/castlevania-aria.jpg', url: 'https://www.retrogames.cc/embed/29282-castlevania-aria-of-sorrow-u-gbatemp.html', maxPlayers: '1', category: 'gba', tags: ['action', 'metroidvania', 'popular'] },
  { id: 'gba-ff-tactics', name: 'Final Fantasy Tactics Advance', description: 'Tactical RPG masterpiece', thumbnail: '/images/games/gba/ff-tactics.jpg', url: 'https://www.retrogames.cc/embed/26411-final-fantasy-tactics-advance-u-eurasia.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'strategy', 'popular'] },
  { id: 'gba-fire-emblem', name: 'Fire Emblem', description: 'Tactical RPG classic', thumbnail: '/images/games/gba/fire-emblem.jpg', url: 'https://www.retrogames.cc/embed/26190-fire-emblem-u-venom.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'strategy', 'popular'] },
  { id: 'gba-golden-sun', name: 'Golden Sun', description: 'Epic handheld RPG', thumbnail: '/images/games/gba/golden-sun.jpg', url: 'https://www.retrogames.cc/embed/28962-golden-sun-u-mode7.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'popular'] },
  { id: 'gba-advance-wars', name: 'Advance Wars', description: 'Turn-based strategy', thumbnail: '/images/games/gba/advance-wars.jpg', url: 'https://www.retrogames.cc/embed/27968-advance-wars-u-mode7.html', maxPlayers: '2', category: 'gba', tags: ['strategy', 'popular'] },
  { id: 'gba-metroid-fusion', name: 'Metroid Fusion', description: 'Scary Metroid adventure', thumbnail: '/images/games/gba/metroid-fusion.jpg', url: 'https://www.retrogames.cc/embed/20567-metroid-fusion-u-gbanow.html', maxPlayers: '1', category: 'gba', tags: ['action', 'metroidvania', 'popular'] },
  { id: 'gba-mega-man-zero', name: 'Mega Man Zero', description: 'Tough action platformer', thumbnail: '/images/games/gba/mega-man-zero.jpg', url: 'https://www.retrogames.cc/embed/44503-mega-man-zero-restoration.html', maxPlayers: '1', category: 'gba', tags: ['action', 'platformer', 'popular'] },
  { id: 'gba-sonic-advance', name: 'Sonic Advance', description: '2D Sonic returns', thumbnail: '/images/games/gba/sonic-advance.jpg', url: 'https://www.retrogames.cc/embed/19409-sonic-advance-u-lord-moyne.html', maxPlayers: '1', category: 'gba', tags: ['platformer', 'fast'] },
  { id: 'gba-kingdom-hearts', name: 'Kingdom Hearts: Chain of Memories', description: 'Card-based RPG', thumbnail: '/images/games/gba/kingdom-hearts.jpg', url: 'https://www.retrogames.cc/embed/29441-kingdom-hearts-chain-of-memories-u-venom.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'action'] },
  { id: 'gba-dbz-buus-fury', name: "Dragon Ball Z: Buu's Fury", description: 'DBZ action RPG', thumbnail: '/images/games/gba/dbz-buus-fury.jpg', url: 'https://www.retrogames.cc/embed/28935-dragon-ball-z-buu-s-fury-u-psychosis.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'action', 'popular'] },
  { id: 'gba-kirby-nightmare', name: 'Kirby: Nightmare in Dream Land', description: 'Kirby platformer remake', thumbnail: '/images/games/gba/kirby-nightmare.jpg', url: 'https://www.retrogames.cc/embed/26683-kirby-nightmare-in-dreamland-u-mode7.html', maxPlayers: '1', category: 'gba', tags: ['platformer'] },
  { id: 'gba-warioware', name: 'WarioWare, Inc.', description: 'Microgame madness', thumbnail: '/images/games/gba/warioware.jpg', url: 'https://www.retrogames.cc/embed/28833-wario-ware-inc-u-precision.html', maxPlayers: '1', category: 'gba', tags: ['party', 'unique', 'popular'] },
  { id: 'gba-tactics-ogre', name: 'Tactics Ogre: Knight of Lodis', description: 'Tactical RPG depth', thumbnail: '/images/games/gba/tactics-ogre.jpg', url: 'https://www.retrogames.cc/embed/18868-tactics-ogre-the-knight-of-lodis-u-mode7.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'strategy'] },
  { id: 'gba-breath-of-fire', name: 'Breath of Fire', description: 'GBA RPG port', thumbnail: '/images/games/gba/breath-of-fire.jpg', url: 'https://www.retrogames.cc/embed/29294-breath-of-fire-u-mode7.html', maxPlayers: '1', category: 'gba', tags: ['rpg'] },
  { id: 'gba-ff-dawn-of-souls', name: 'Final Fantasy I & II: Dawn of Souls', description: 'Classic FF remakes', thumbnail: '/images/games/gba/ff-dawn-of-souls.jpg', url: 'https://www.retrogames.cc/embed/28795-final-fantasy-i-ii-dawn-of-souls-u-independent.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'classic'] },
  { id: 'gba-golden-sun-2', name: 'Golden Sun: The Lost Age', description: 'Epic RPG sequel', thumbnail: '/images/games/gba/golden-sun-2.jpg', url: 'https://www.retrogames.cc/embed/29462-golden-sun-2-the-lost-age-u-megaroms.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'popular'] },
  { id: 'gba-advance-wars-2', name: 'Advance Wars 2: Black Hole Rising', description: 'Strategy sequel', thumbnail: '/images/games/gba/advance-wars-2.jpg', url: 'https://www.retrogames.cc/embed/28038-advance-wars-2-black-hole-rising-u-mode7.html', maxPlayers: '2', category: 'gba', tags: ['strategy', 'popular'] },
  { id: 'gba-mega-man-zero-2', name: 'Mega Man Zero 2', description: 'Improved action', thumbnail: '/images/games/gba/mega-man-zero-2.jpg', url: 'https://www.retrogames.cc/embed/28812-megaman-zero-2-u-eurasia.html', maxPlayers: '1', category: 'gba', tags: ['action', 'platformer'] },
  { id: 'gba-mega-man-zero-3', name: 'Mega Man Zero 3', description: 'Cyber elf system', thumbnail: '/images/games/gba/mega-man-zero-3.jpg', url: 'https://www.retrogames.cc/embed/28948-megaman-zero-3-u-rising-sun.html', maxPlayers: '1', category: 'gba', tags: ['action', 'platformer'] },
  { id: 'gba-mega-man-zero-4', name: 'Mega Man Zero 4', description: 'Zero finale', thumbnail: '/images/games/gba/mega-man-zero-4.jpg', url: 'https://www.retrogames.cc/embed/29044-megaman-zero-4-u-trashman.html', maxPlayers: '1', category: 'gba', tags: ['action', 'platformer'] },
  { id: 'gba-mmbn', name: 'Mega Man Battle Network', description: 'Action RPG unique', thumbnail: '/images/games/gba/mega-man-battle-network.jpg', url: 'https://www.retrogames.cc/embed/19487-megaman-battle-network-u-venom.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'action'] },
  { id: 'gba-mmbn-2', name: 'Mega Man Battle Network 2', description: 'Improved net battles', thumbnail: '/images/games/gba/mega-man-battle-network-2.jpg', url: 'https://www.retrogames.cc/embed/29324-mega-man-battle-network-2-virtual-console.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'action'] },
  { id: 'gba-castlevania-circle', name: 'Castlevania: Circle of the Moon', description: 'DSS card system', thumbnail: '/images/games/gba/castlevania-circle.jpg', url: 'https://www.retrogames.cc/embed/26147-castlevania-circle-of-the-moon-u-cezar.html', maxPlayers: '1', category: 'gba', tags: ['action', 'metroidvania'] },
  { id: 'gba-castlevania-harmony', name: 'Castlevania: Harmony of Dissonance', description: 'Juste Belmont adventure', thumbnail: '/images/games/gba/castlevania-harmony.jpg', url: 'https://www.retrogames.cc/embed/29237-castlevania-harmony-of-dissonance-u-independent.html', maxPlayers: '1', category: 'gba', tags: ['action', 'metroidvania'] },
  { id: 'gba-sonic-advance-2', name: 'Sonic Advance 2', description: 'Faster Sonic action', thumbnail: '/images/games/gba/sonic-advance-2.jpg', url: 'https://www.retrogames.cc/embed/29112-sonic-advance-2-u-independent.html', maxPlayers: '1', category: 'gba', tags: ['platformer', 'fast'] },
  { id: 'gba-sonic-advance-3', name: 'Sonic Advance 3', description: 'Tag team Sonic', thumbnail: '/images/games/gba/sonic-advance-3.jpg', url: 'https://www.retrogames.cc/embed/29326-sonic-advance-3-u-venom.html', maxPlayers: '1', category: 'gba', tags: ['platformer', 'fast'] },
  { id: 'gba-ff4-advance', name: 'Final Fantasy IV Advance', description: 'Classic RPG enhanced', thumbnail: '/images/games/gba/ff4-advance.jpg', url: 'https://www.retrogames.cc/embed/28796-final-fantasy-iv-advance-u-independent.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'classic'] },
  { id: 'gba-ff5-advance', name: 'Final Fantasy V Advance', description: 'Job system RPG', thumbnail: '/images/games/gba/ff5-advance.jpg', url: 'https://www.retrogames.cc/embed/19411-final-fantasy-v-advance-u-independent.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'classic'] },
  { id: 'gba-ff6-advance', name: 'Final Fantasy VI Advance', description: 'Best FF portable', thumbnail: '/images/games/gba/ff6-advance.jpg', url: 'https://www.retrogames.cc/embed/26269-final-fantasy-vi-advance-u-xenophobia.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'classic', 'popular'] },
  { id: 'gba-metroid-zero', name: 'Metroid: Zero Mission', description: 'Metroid 1 reimagined', thumbnail: '/images/games/gba/metroid-zero.jpg', url: 'https://www.retrogames.cc/embed/27866-metroid-zero-mission-u-trashman.html', maxPlayers: '1', category: 'gba', tags: ['action', 'metroidvania', 'popular'] },
  { id: 'gba-drill-dozer', name: 'Drill Dozer', description: 'Unique drilling action', thumbnail: '/images/games/gba/drill-dozer.jpg', url: 'https://www.retrogames.cc/embed/18812-drill-dozer-u-trashman.html', maxPlayers: '1', category: 'gba', tags: ['action', 'platformer'] },
  { id: 'gba-riviera', name: 'Riviera: The Promised Land', description: 'Unique RPG adventure', thumbnail: '/images/games/gba/riviera.jpg', url: 'https://www.retrogames.cc/embed/19429-riviera-the-promised-land-u-trashman.html', maxPlayers: '1', category: 'gba', tags: ['rpg'] },
  { id: 'gba-gunstar', name: 'Gunstar Super Heroes', description: 'Run and gun action', thumbnail: '/images/games/gba/gunstar.jpg', url: 'https://www.retrogames.cc/embed/28819-gunstar-super-heroes-u-trashman.html', maxPlayers: '1', category: 'gba', tags: ['action', 'shooter'] },
  { id: 'gba-ninja-five-o', name: 'Ninja Five-O', description: 'Rare ninja action', thumbnail: '/images/games/gba/ninja-five-o.jpg', url: 'https://www.retrogames.cc/embed/26786-ninja-five-0-u-trashman.html', maxPlayers: '1', category: 'gba', tags: ['action', 'platformer'] },
  { id: 'gba-astro-boy', name: 'Astro Boy: Omega Factor', description: 'Treasure action game', thumbnail: '/images/games/gba/astro-boy.jpg', url: 'https://www.retrogames.cc/embed/29426-astro-boy-omega-factor-u-venom.html', maxPlayers: '1', category: 'gba', tags: ['action', 'popular'] },
  { id: 'gba-boktai', name: 'Boktai: The Sun is in Your Hand', description: 'Solar sensor game', thumbnail: '/images/games/gba/boktai.jpg', url: 'https://www.retrogames.cc/embed/26521-boktai-the-sun-is-in-your-hand-u-eurasia.html', maxPlayers: '1', category: 'gba', tags: ['action', 'rpg'] },
  { id: 'gba-konami-racers', name: 'Konami Krazy Racers', description: 'Konami kart racing', thumbnail: '/images/games/gba/konami-racers.jpg', url: 'https://www.retrogames.cc/embed/28051-konami-krazy-racers-u-menace.html', maxPlayers: '4', category: 'gba', tags: ['racing'] },
  { id: 'gba-dbz-legacy-1', name: 'Dragon Ball Z: Legacy of Goku', description: 'DBZ action RPG', thumbnail: '/images/games/gba/dbz-legacy-1.jpg', url: 'https://www.retrogames.cc/embed/29516-dragon-ball-z-the-legacy-of-goku-u-mode7.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'action'] },
  { id: 'gba-dbz-legacy-2', name: 'Dragon Ball Z: Legacy of Goku II', description: 'Improved DBZ RPG', thumbnail: '/images/games/gba/dbz-legacy-2.jpg', url: 'https://www.retrogames.cc/embed/17285-dragon-ball-z-the-legacy-of-goku-ii-u-trashman.html', maxPlayers: '1', category: 'gba', tags: ['rpg', 'action', 'popular'] },
  { id: 'gba-naruto', name: 'Naruto: Ninja Council', description: 'Ninja action', thumbnail: '/images/games/gba/naruto.jpg', url: 'https://www.retrogames.cc/embed/19351-naruto-ninja-council-u-trashman.html', maxPlayers: '1', category: 'gba', tags: ['action'] },
  { id: 'gba-naruto-2', name: 'Naruto: Ninja Council 2', description: 'More ninja action', thumbnail: '/images/games/gba/naruto-2.jpg', url: 'https://www.retrogames.cc/embed/26573-naruto-ninja-council-2-u-rising-sun.html', maxPlayers: '1', category: 'gba', tags: ['action'] },
  { id: 'gba-yugioh', name: 'Yu-Gi-Oh! Worldwide Edition', description: 'Card battle game', thumbnail: '/images/games/gba/yugioh.jpg', url: 'https://www.retrogames.cc/embed/19497-yu-gi-oh-worldwide-edition-u-rdg.html', maxPlayers: '1', category: 'gba', tags: ['card-game'] },
  { id: 'gba-harvest-moon', name: 'Harvest Moon: Friends of Mineral Town', description: 'Farming simulation', thumbnail: '/images/games/gba/harvest-moon.jpg', url: 'https://www.retrogames.cc/embed/27749-harvest-moon-friends-of-mineral-town-u-mode7.html', maxPlayers: '1', category: 'gba', tags: ['simulation', 'popular'] },
  { id: 'gba-spyro', name: 'Spyro: Season of Ice', description: 'Dragon platformer', thumbnail: '/images/games/gba/spyro.jpg', url: 'https://www.retrogames.cc/embed/28725-spyro-season-of-ice-e-eurasia.html', maxPlayers: '1', category: 'gba', tags: ['platformer'] },
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
