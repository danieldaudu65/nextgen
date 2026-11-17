// NextGen World calls (server/route_user/world.js). Kept apart from api.ts on purpose.
import { API_URL, ApiError } from './api';
import type { Me } from './types';

export type WorldGame = 'money' | 'quiz' | 'debate' | 'sort' | 'promise' | 'wordsearch' | 'boss';
export type WorldStars = Record<WorldGame, number>;
export interface BossQuestion { id: string; question: string; options: string[] }
export interface BossResult {
  results: { id: string; answer: number; correct: boolean }[];
  right: number; total: number; stars: number;
  awarded: number; locked: boolean; progress: WorldStars | null; user: Me | null;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new ApiError(res.status, data.message ?? 'Request failed', data.code);
  return data as T;
}

const slug = (s: string) => encodeURIComponent(s);
export const worldApi = {
  /** null stars = guest (the browser keeps guest stars) */
  progress: (edition: string) => call<{ stars: WorldStars | null; current: number }>(`/user_world/${slug(edition)}`),
  saveResult: (edition: string, game: Exclude<WorldGame, 'boss'>, stars: number) =>
    call<{ stars: WorldStars; current: number }>(`/user_world/${slug(edition)}/result`, { game, stars }),
  boss: (edition: string) => call<{ questions: BossQuestion[] }>(`/user_world/${slug(edition)}/boss`).then((d) => d.questions),
  /** final: false = just check these answers; final: true = save stars and give points */
  checkBoss: (edition: string, answers: { id: string; choice: number }[], final: boolean) => call<BossResult>(`/user_world/${slug(edition)}/boss`, { answers, final }),
};
