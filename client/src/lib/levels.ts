/*
 * ============================================================
 * XP levels and ranks (the NextGen Arcade)
 * ============================================================
 * 1 point = 1 XP. A student's level comes from their total points,
 * so every point they already have counts. Change the names, emojis
 * or how many points each level needs here, nowhere else.
 * ============================================================
 */

export interface Rank {
  level: number;
  name: string;
  emoji: string;
  color: string;
  min: number; // points needed to reach this level
}

export const RANKS: Rank[] = [
  { level: 1, name: 'Rookie', emoji: '🐣', color: '#9AA3AE', min: 0 },
  { level: 2, name: 'Player One', emoji: '🎮', color: '#2F7DE1', min: 50 },
  { level: 3, name: 'Combo Kid', emoji: '⚡', color: '#2FA36B', min: 150 },
  { level: 4, name: 'Rising Voice', emoji: '📢', color: '#fcb92e', min: 300 },
  { level: 5, name: 'Brain Boss', emoji: '🧠', color: '#E0457B', min: 600 },
  { level: 6, name: 'Game Changer', emoji: '🔥', color: '#E3473B', min: 1000 },
  { level: 7, name: 'Street Smart', emoji: '💎', color: '#6B4FD8', min: 1600 },
  { level: 8, name: 'NextGen Legend', emoji: '👑', color: '#FFD400', min: 2500 },
];

export interface LevelInfo {
  level: number;
  rank: Rank;
  next: Rank | null;
  toNext: number; // points still needed for the next level (0 at the top)
  pct: number;    // 0–100, how full the XP bar is
}

export function levelFor(points?: number | null): LevelInfo {
  const p = Math.max(0, Number(points) || 0);
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (p >= RANKS[k].min) i = k;
  const rank = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  const pct = next ? Math.min(100, ((p - rank.min) / (next.min - rank.min)) * 100) : 100;
  return { level: rank.level, rank, next, toNext: next ? next.min - p : 0, pct };
}
