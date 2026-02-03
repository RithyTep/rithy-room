import type { GameItem } from '@rithy-room/shared';

export const GAMES_CATALOG: GameItem[] = [
  {
    id: 'smash-karts',
    name: 'Smash Karts',
    description: 'Multiplayer kart battle arena with power-ups and weapons',
    thumbnail: 'https://imgs.crazygames.com/smash-karts.png',
    url: 'https://smashkarts.io',
    maxPlayers: '8',
    category: 'racing',
    tags: ['action', 'karts', 'multiplayer', 'popular'],
  },
  {
    id: 'bloxd-io',
    name: 'Bloxd.io',
    description: 'Minecraft-like multiplayer building and survival game',
    thumbnail: 'https://imgs.crazygames.com/bloxd-io.png',
    url: 'https://bloxd.io',
    maxPlayers: '20',
    category: 'io',
    tags: ['building', 'survival', 'minecraft', 'popular'],
  },
  {
    id: 'shell-shockers',
    name: 'Shell Shockers',
    description: 'First-person shooter where everyone is an egg',
    thumbnail: 'https://imgs.crazygames.com/shell-shockers.png',
    url: 'https://shellshock.io',
    maxPlayers: '8',
    category: 'action',
    tags: ['fps', 'shooter', 'eggs', 'popular'],
  },
  {
    id: 'krunker',
    name: 'Krunker.io',
    description: 'Fast-paced pixelated first-person shooter',
    thumbnail: 'https://imgs.crazygames.com/krunker-io.png',
    url: 'https://krunker.io',
    maxPlayers: '10',
    category: 'action',
    tags: ['fps', 'shooter', 'fast-paced', 'popular'],
  },
  {
    id: 'agar-io',
    name: 'Agar.io',
    description: 'Classic cell-eating multiplayer game',
    thumbnail: 'https://imgs.crazygames.com/agar-io.png',
    url: 'https://agar.io',
    maxPlayers: 'Unlimited',
    category: 'io',
    tags: ['casual', 'classic', 'cells'],
  },
  {
    id: 'slither-io',
    name: 'Slither.io',
    description: 'Snake-like multiplayer game - grow longer and survive',
    thumbnail: 'https://imgs.crazygames.com/slither-io.png',
    url: 'https://slither.io',
    maxPlayers: 'Unlimited',
    category: 'io',
    tags: ['snake', 'casual', 'classic'],
  },
  {
    id: '1v1-lol',
    name: '1v1.LOL',
    description: 'Build and shoot battle royale style combat',
    thumbnail: 'https://imgs.crazygames.com/1v1-lol.png',
    url: 'https://1v1.lol',
    maxPlayers: '2',
    category: 'action',
    tags: ['building', 'shooter', 'battle-royale'],
  },
  {
    id: 'paper-io-2',
    name: 'Paper.io 2',
    description: 'Claim territory by drawing shapes - dont get cut!',
    thumbnail: 'https://imgs.crazygames.com/paper-io-2.png',
    url: 'https://paper-io.com',
    maxPlayers: 'Unlimited',
    category: 'io',
    tags: ['casual', 'territory', 'strategy'],
  },
  {
    id: 'basketball-stars',
    name: 'Basketball Stars',
    description: '1v1 basketball with tricks and moves',
    thumbnail: 'https://imgs.crazygames.com/basketball-stars.png',
    url: 'https://www.crazygames.com/game/basketball-stars',
    maxPlayers: '2',
    category: 'sports',
    tags: ['basketball', 'sports', '1v1'],
  },
  {
    id: 'narrow-one',
    name: 'Narrow One',
    description: 'Medieval castle siege with bows and arrows',
    thumbnail: 'https://imgs.crazygames.com/narrow-one.png',
    url: 'https://www.crazygames.com/game/narrow-one',
    maxPlayers: '8',
    category: 'action',
    tags: ['medieval', 'archery', 'team', 'popular'],
  },
  {
    id: 'hole-io',
    name: 'Hole.io',
    description: 'Control a black hole and swallow everything',
    thumbnail: 'https://imgs.crazygames.com/hole-io.png',
    url: 'https://hole-io.com',
    maxPlayers: 'Unlimited',
    category: 'io',
    tags: ['casual', 'destruction', 'fun'],
  },
  {
    id: 'zombs-royale',
    name: 'ZombsRoyale.io',
    description: '2D battle royale with 100 players',
    thumbnail: 'https://imgs.crazygames.com/zombs-royale.png',
    url: 'https://zombsroyale.io',
    maxPlayers: '100',
    category: 'action',
    tags: ['battle-royale', 'shooter', '2d'],
  },
];

export const GAME_CATEGORIES = [
  { id: 'all', name: 'All Games' },
  { id: 'action', name: 'Action' },
  { id: 'racing', name: 'Racing' },
  { id: 'io', name: 'IO Games' },
  { id: 'sports', name: 'Sports' },
  { id: 'puzzle', name: 'Puzzle' },
] as const;

export type GameCategory = (typeof GAME_CATEGORIES)[number]['id'];

export function filterGames(
  games: GameItem[],
  category: GameCategory,
  searchQuery: string
): GameItem[] {
  return games.filter((game) => {
    const matchesCategory = category === 'all' || game.category === category;
    const matchesSearch =
      !searchQuery ||
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });
}
