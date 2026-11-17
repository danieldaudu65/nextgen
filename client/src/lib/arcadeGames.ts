import type { Debate, Edition } from './types';

// The 6 arcade cabinets, in the order they stand in the arcade.
// Used by the /arcade page and the homepage teaser.
export type ArcadeKey = 'money' | 'quiz' | 'debate' | 'sort' | 'promise' | 'wordsearch';

export interface ArcadeGame {
  key: ArcadeKey;
  tag: string;    // short neon sign on top of the cabinet
  title: string;
  emoji: string;
  color: string;  // the cabinet's glow
  reward: string;
  blurb: string;
}

export const ARCADE_GAMES: ArcadeGame[] = [
  { key: 'money', tag: 'Money', title: 'The ₦10K Money Mystery', emoji: '💰', color: '#FFD400', reward: '+40 pts', blurb: 'Can you make ₦10K last till Friday?' },
  { key: 'quiz', tag: 'Quiz', title: 'Superpower Challenge', emoji: '⚡', color: '#2F7DE1', reward: '+10 pts each', blurb: 'Quick questions from this edition.' },
  { key: 'debate', tag: 'Debate', title: 'Debate of the Week', emoji: '🗳️', color: '#E0457B', reward: '+20 pts', blurb: 'Pick a side. Make your voice count.' },
  { key: 'sort', tag: 'AI Smart', title: 'Cheat Code or Study Buddy?', emoji: '🤖', color: '#2FA36B', reward: '+25 pts', blurb: 'Is that AI prompt helping you learn?' },
  { key: 'promise', tag: 'Promises', title: 'Promise Checker', emoji: '📢', color: '#fcb92e', reward: '+20 pts', blurb: 'Is it just a promise, or a real plan?' },
  { key: 'wordsearch', tag: 'Words', title: 'Democracy Word Search', emoji: '🔎', color: '#8B6CFF', reward: '+30 pts', blurb: 'Find all the election words.' },
];

// A cabinet only works when this edition has the data for its game
export function gameReady(key: ArcadeKey, edition: Edition, debate: Debate | null): boolean {
  switch (key) {
    case 'money': return Number(edition.money?.start) > 0 && (edition.money?.items?.length ?? 0) > 0;
    case 'quiz': return (edition.quiz?.length ?? 0) > 0;
    case 'debate': return Boolean(debate);
    case 'sort': return (edition.sort?.length ?? 0) > 0;
    case 'promise': return (edition.promiseQuestions?.length ?? 0) > 0;
    case 'wordsearch': return (edition.wordSearch?.grid?.length ?? 0) > 0 && (edition.wordSearch?.words?.length ?? 0) > 0;
    default: return false;
  }
}
