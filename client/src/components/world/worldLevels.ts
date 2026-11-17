import type { WorldGame } from '@/lib/worldApi';

// The 7 levels on every edition's island, in road order (same keys as server/services/world.js)
export interface WorldLevel {
  key: WorldGame;
  name: string;
  short: string;
  color: string;
  text: string;
  goals: [string, string][];
  points: string;
}

export const WORLD_LEVELS: WorldLevel[] = [
  { key: 'money', name: 'The ₦10K Money Mystery', short: 'Money', color: '#FFD400', points: '+40 pts', text: 'You get ₦10,000 for the week. Can you still have money on Friday? Save first, then spend smart.', goals: [['1★', 'Reach Friday'], ['2★', 'Save first'], ['3★', '₦1,000+ left']] },
  { key: 'quiz', name: 'Superpower Challenge', short: 'Quiz', color: '#2F7DE1', points: '+10 pts each', text: 'Quick questions from this edition. Every right answer is +10 pts. Get them all for 3 stars.', goals: [['1★', '1 right'], ['2★', '2 right'], ['3★', 'All right']] },
  { key: 'debate', name: 'Debate of the Week', short: 'Debate', color: '#E0457B', points: '+20 pts', text: 'Pick your team, say why, and watch the live vote move. One vote per student.', goals: [['1★', 'Vote'], ['2★', 'Vote'], ['3★', 'Give a reason']] },
  { key: 'sort', name: 'Cheat Code or Study Buddy?', short: 'AI', color: '#2FA36B', points: '+25 pts', text: 'Is that AI prompt helping you learn, or skipping the learning? Sort them all.', goals: [['1★', '3 right'], ['2★', '4 right'], ['3★', 'All right']] },
  { key: 'promise', name: 'Promise or Plan?', short: 'Promise', color: '#fcb92e', points: '+20 pts', text: 'A promise is easy. A plan has details. Spot which is which.', goals: [['1★', '2 right'], ['2★', '3 right'], ['3★', 'All right']] },
  { key: 'wordsearch', name: 'Democracy Word Search', short: 'Words', color: '#6B4FD8', points: '+30 pts', text: 'Find all the election words hiding in the grid. Be quick for 3 stars.', goals: [['1★', '5 words'], ['2★', 'All words'], ['3★', 'Under 90s']] },
  { key: 'boss', name: 'Edition Boss', short: 'Boss', color: '#E3473B', points: '+100 pts', text: 'The final level at the top of the mountain. 5 questions from this edition, 12 seconds each. Beat it to open the next island.', goals: [['1★', '3 hits'], ['2★', '4 hits'], ['3★', 'All 5']] },
];

// "Promise or Plan?" cards. TODO: move these into the edition (Admin → Editions) so each edition has its own.
export const PROMISE_CARDS: { text: string; answer: 'promise' | 'plan'; why: string }[] = [
  { text: '"If you vote for me, I will create one million jobs!"', answer: 'promise', why: "It doesn't say how, when, or where the money comes from." },
  { text: '"We will train 5,000 young people in coding by June 2027, paid for by the state tech fund."', answer: 'plan', why: 'It says what, how many, when and who pays.' },
  { text: '"Our state will be the best in Africa!"', answer: 'promise', why: 'Big feeling, zero details.' },
  { text: '"We will fix 120 km of roads in 12 months, using ₦40bn from the works budget."', answer: 'plan', why: 'It answers what, how much, when and where from.' },
];

export const starsArray = (s?: Partial<Record<WorldGame, number>> | null) => WORLD_LEVELS.map((l) => Math.max(0, Math.min(3, Math.round(Number(s?.[l.key]) || 0))));
export const currentOf = (stars: number[]) => { const i = stars.findIndex((s) => !s); return i < 0 ? WORLD_LEVELS.length : i; };
