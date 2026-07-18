export type DemoProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  match: number;
  matchReason: string;
  accent: string;
  symbol: string;
  phrases: string[];
};

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: 'flow-water',
    name: 'Flow Water',
    category: 'Hydration',
    description: 'Mineral water made for active, everyday routines.',
    match: 96,
    matchReason: 'Fits the energetic, wellness-focused tone of your video.',
    accent: '#10A37F',
    symbol: 'F',
    phrases: [
      'Quick pause — I’m recharging with Flow Water before we keep going.',
      'Today’s session is powered by Flow Water, my easy hydration reset.',
      'Before the next part, grab a Flow Water and stay in the flow with me.',
    ],
  },
  {
    id: 'pulse-audio',
    name: 'Pulse Audio',
    category: 'Tech',
    description: 'Wireless earbuds tuned for movement and deep focus.',
    match: 91,
    matchReason: 'Your fast-paced edit strongly overlaps with active listeners.',
    accent: '#4F4F4B',
    symbol: 'P',
    phrases: [
      'I’m keeping the energy up today with Pulse Audio in my ears.',
      'This part hits different with Pulse Audio — crisp sound, zero distractions.',
      'A quick shoutout to Pulse Audio for keeping every session in rhythm.',
    ],
  },
  {
    id: 'noura-bites',
    name: 'Noura Bites',
    category: 'Nutrition',
    description: 'Simple protein snacks for busy days and bigger goals.',
    match: 87,
    matchReason: 'A natural fit for viewers interested in healthy daily habits.',
    accent: '#8A8A85',
    symbol: 'N',
    phrases: [
      'Tiny break, big energy — I’ve got a pack of Noura Bites with me.',
      'Noura Bites are my simple way to stay fueled between busy moments.',
      'Before we continue, here’s the snack keeping me going: Noura Bites.',
    ],
  },
];

export const SUGGESTED_INSERTION = '00:18';
