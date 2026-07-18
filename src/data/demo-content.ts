export type DemoProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  match: number;
  matchReason: string;
  accent: string;
  logoSource: number;
  logoLayout: 'nike' | 'wide' | 'square';
  phrases: string[];
};

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: 'nike',
    name: 'Nike',
    category: 'Sportswear',
    description: 'Performance gear made for athletes, fans, and everyday movement.',
    match: 94,
    matchReason: 'A strong match for energetic sports and lifestyle content.',
    accent: '#111111',
    logoSource: require('../../assets/brands/nike.jpg'),
    logoLayout: 'nike',
    phrases: [
      'Every big moment starts with the courage to take the first step. Just do it with Nike.',
      'Train harder, play braver, and bring your best with Nike.',
      'From the first whistle to the final push, Nike is made for the moment.',
    ],
  },
  {
    id: 'coca-cola',
    name: 'Coca-Cola',
    category: 'Beverages',
    description: 'The iconic match-day refreshment for fans everywhere.',
    match: 98,
    matchReason: 'A natural fit for football fans choosing a side for the biggest match.',
    accent: '#F40009',
    logoSource: require('../../assets/brands/coca-cola.png'),
    logoLayout: 'wide',
    phrases: [
      'Big match, big rivalry—make it even better with an ice-cold Coca-Cola.',
      "Argentina or Spain? Pick your champion—but don't forget the real MVP: an ice-cold Coca-Cola. Cheers to the beautiful game!",
      'Whatever side you choose, bring everyone together over an ice-cold Coca-Cola.',
    ],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'Music & Audio',
    description: 'Music, podcasts, and playlists for every mood and moment.',
    match: 90,
    matchReason: 'Fits naturally into creator content with a strong soundtrack and rhythm.',
    accent: '#1DB954',
    logoSource: require('../../assets/brands/spotify.png'),
    logoLayout: 'square',
    phrases: [
      'Every match deserves the right soundtrack. Find yours on Spotify.',
      'Keep the energy going with the perfect game-day playlist on Spotify.',
      'Whatever your team, there is a Spotify playlist ready for the moment.',
    ],
  },
];
