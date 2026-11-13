import type { Category } from './categories';
import type { ArticleCard, HomepageHero, ArticlePage, ArticlePreview, Debate, Edition, EditionSummary, Leaderboard, LeaderRange, Me, NominationForm, QuestionState, School, Showcase, SiteSettings, Star, StoryQuestion, VocabWord } from './types';
import { getDeviceId } from './device';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000').replace(/\/$/, '');

// Every server response looks like { success, message?, ...data }

// Public content is server-owned. A missing/unavailable API returns no content,
// never bundled demo articles or editions.
async function getOptional<T>(path: string, key: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message ?? `${res.status} ${path}`);
    return (key ? data[key] : data) as T;
  } catch (err) {
    console.warn(`[api] no server content for ${path}:`, (err as Error).message);
    return null;
  }
}

export const getCurrentEdition = () => getOptional<Edition>('/editions/current', 'edition');
export const getHomepageArticles = async (): Promise<ArticleCard[]> => (await getOptional<ArticleCard[]>('/articles/homepage', 'articles')) ?? [];
// Stories for the rotating hero + how many and how long each (Admin → Settings → Homepage)
export async function getHomepageHero(): Promise<HomepageHero> {
  const d = await getOptional<HomepageHero>('/articles/homepage', '');
  const articles = d?.articles ?? [];
  return { articles, total: d?.total ?? articles.length, seconds: d?.seconds ?? 7 };
}
// Site categories from Admin → Categories (null when the server can't be reached)
export const getCategories = () => getOptional<Category[]>('/categories', 'categories');
export const getCategory = (slug: string) => getOptional<{ category: Category; articles: ArticleCard[] }>(`/categories/${encodeURIComponent(slug)}`, '');
export const getPublishedArticles = async (): Promise<ArticleCard[]> => (await getOptional<ArticleCard[]>('/articles', 'articles')) ?? [];
export const getEditions = async (): Promise<EditionSummary[]> => (await getOptional<EditionSummary[]>('/editions', 'editions')) ?? [];
export const getDebate = () => getOptional<Debate>('/user_debate/current', 'debate');
export async function getLeadArticle(): Promise<{ article: ArticlePreview; vocab: VocabWord[] } | null> {
  const lead = await getOptional<{ article: ArticleCard & { body: string[]; eli10: string[] }; vocab: VocabWord[] }>('/articles/lead', '');
  if (!lead?.article) return null;
  const { article, vocab } = lead;
  return {
    article: {
      slug: article.slug, section: article.sectionLabel || article.section, title: article.title,
      readMins: article.readMins, points: article.points,
      body: article.body.filter((block) => block && !/^(#{1,3} |[-*] |\d+\. |>|!\[)/.test(block)).slice(0, 2).join(' '),
      eli10: (article.eli10 ?? []).filter((block) => block && !/^(#{1,3} |[-*] |\d+\. |>|!\[)/.test(block)).slice(0, 2).join(' '),
    },
    vocab,
  };
}
// One story page. null = not found (page shows 404)
export async function getArticle(slug: string): Promise<ArticlePage | null> {
  try {
    const res = await fetch(`${API_URL}/articles/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message ?? `${res.status}`);
    return { article: data.article, edition: data.edition, vocab: data.vocab, related: data.related };
  } catch (err) {
    console.warn(`[api] article unavailable from server for /articles/${slug}:`, (err as Error).message);
    return null;
  }
}

// Range comes from Admin → Settings unless one is asked for
export const getLeaderboard = (range?: LeaderRange) => getOptional<Leaderboard>(`/leaderboard${range ? `?range=${range}` : ''}`, '');

// ---------- browser-side calls (login cookie is sent automatically) ----------

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

async function call<T>(path: string, body?: unknown, opts: { device?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.device) headers['X-Device-Id'] = getDeviceId(); // school-code accounts are locked to one device
  const res = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include', // send/receive the httpOnly "token" cookie
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new ApiError(res.status, data.message ?? 'Request failed', data.code);
  return data as T;
}

type WithUser = { user: Me };

export const api = {
  // students
  me: () => call<WithUser>('/user_auth/me').then((d) => d.user),
  register: (body: { name: string; handle: string; password: string; schoolId?: string; className?: string; code?: string }) =>
    call<WithUser>('/user_auth/register', body, { device: true }).then((d) => d.user),
  login: (body: { handle: string; password: string }) => call<WithUser>('/user_auth/login', body, { device: true }).then((d) => d.user),
  redeem: (code: string) => call<WithUser & { message: string }>('/user_auth/redeem', { code }, { device: true }),
  logout: () => call<{ message: string }>('/user_auth/logout', {}),

  // tracking + games
  readingProgress: (body: { edition: string; article: string; activeSeconds: number; scrollDepth: number; startedAt?: string }) =>
    call<{ progress: { completed: boolean; activeSeconds: number; needSeconds: number }; question: QuestionState | null; earned: { label: string; points: number }[]; locked: boolean; user: Me }>('/user_reading/progress', body),
  startQuestion: (article: string) => call<{ state: QuestionState; question: StoryQuestion | null; seconds?: number; message?: string }>('/user_reading/question/start', { article }),
  answerQuestion: (article: string, choice: number) =>
    call<{ correct: boolean; triesLeft: number; answer: number | null; explain: string; awarded: number; locked: boolean; user: Me }>('/user_reading/question/answer', { article, choice }),
  completeGame: (game: string, edition: string) => call<{ awarded: number; locked?: boolean; user: Me }>('/user_games/complete', { game, edition }),
  checkQuiz: (slug: string, questionId: string, choice: number) =>
    call<{ correct: boolean; answer: number; awarded: number; points: number | null; locked?: boolean }>(`/user_quiz/${slug}/check`, { questionId, choice }),
  currentDebate: () => call<{ debate: Debate }>('/user_debate/current').then((d) => d.debate),
  vote: (id: string, side: 'A' | 'B') => call<{ debate: Debate; awarded: number; points: number; locked?: boolean }>(`/user_debate/${id}/vote`, { side }),

  // paying for yourself (Paystack; demo checkout when the server has no key)
  payPersonal: (planId: string, email: string) => call<{ url: string; reference: string; demo: boolean }>('/user_pay/personal', { planId, email }),
  verifyPayment: (reference: string) => call<{ payment: { reference: string; kind: 'school' | 'personal'; status: 'pending' | 'paid' | 'failed'; amount: number; seats: number; days: number }; user: Me | null }>(`/user_pay/verify/${encodeURIComponent(reference)}`),
  demoPayment: (reference: string) => call<{ payment: { reference: string; kind: string; amount: number; seats: number; days: number; status: string; email?: string } }>(`/user_pay/demo/${encodeURIComponent(reference)}`),
  finishDemoPayment: (reference: string, outcome: 'paid' | 'failed') => call<{ success: boolean }>(`/user_pay/demo/${encodeURIComponent(reference)}`, { outcome }),

  // public
  schools: () => call<{ schools: School[] }>('/schools').then((d) => d.schools),
  siteSettings: () => call<{ settings: SiteSettings; demoPayments: boolean }>('/site/settings'),
  checkCode: (code: string) => call<{ valid: boolean; message: string | null; school: { name: string; city?: string } | null }>(`/site/codes/${encodeURIComponent(code)}`),
  leaderboard: (range?: LeaderRange) => call<Leaderboard>(`/leaderboard${range ? `?range=${range}` : ''}`),
  showcase: (f: { q?: string; state?: string; page?: number } = {}) =>
    call<Showcase>(`/schools/showcase?q=${encodeURIComponent(f.q ?? '')}&state=${encodeURIComponent(f.state ?? '')}&page=${f.page ?? 1}`),

  // Nominate a Star
  stars: () => call<{ stars: Star[]; categories: string[]; relationships: string[] }>('/nominations/stars'),
  nominate: (f: NominationForm) => call<{ message: string }>('/nominations', { ...f, nomineeAge: f.nomineeAge || null }),
  nominationPhoto: async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${API_URL}/nominations/photo`, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new ApiError(res.status, data.message ?? 'Upload failed');
    return data.url as string;
  },
};
