// Calls for the admin panel. The "admin_token" cookie is sent automatically.
import { API_URL, ApiError } from './api';
import type { Article, Edition, ImageFit, SiteSettings, VocabWord } from './types';
import type { Category, CategoryIcon } from './categories';
import { shrinkImage } from './shrinkImage';

export type Role = 'writer' | 'editor' | 'superadmin';
export type ArticleStatus = 'draft' | 'review' | 'published';

export interface AdminUser { id: string; name: string; email: string; role: Role; active?: boolean; lastLoginAt?: string | null }

export interface AdminArticleRow {
  id: string; slug: string; edition: string; section: string; sectionLabel: string; title: string;
  status: ArticleStatus; readMins: number; updatedAt: string; publishedAt: string | null; createdBy: string; updatedBy: string | null; image?: string;
  imagePosition?: string; imageFit?: ImageFit; homepageFeatured?: boolean;
}

export interface ArticleQuestion { prompt: string; options: string[]; answer: number; explain?: string }

export type AdminArticle = Omit<Article, 'publishedAt'> & {
  question?: ArticleQuestion | null;
  id: string; status: ArticleStatus; reviewNote?: string | null; createdBy: string; createdById: string | null; publishedAt: string | null;
};

/** What the editor sends. null clears a picture / page number. */
export type ArticlePayload = Omit<Partial<AdminArticle>, 'pages' | 'image' | 'imagePosition'> & {
  pages?: string | null; image?: string | null; imagePosition?: string | null; status?: ArticleStatus;
};

/** A story returned by the "Paste your article" formatter */
export interface FormattedStory {
  title: string; dek: string; section: string; sectionLabel: string; tags: string[];
  body: string[]; eli10: string[]; readMins: number; vocab: VocabWord[]; notes: string;
  game?: { label: string; href: string }; points?: number;
  question?: ArticleQuestion | null;
}

/** A picture found on a photographed page: which photo, where (fractions 0–1), and what it is for */
export interface PagePicture { photo: number; box: [number, number, number, number]; caption: string; role: 'cover' | 'profile' | 'inline'; name: string }
/** What "Snap the pages" returns: the story (same as the formatter) and the design read off the photos */
export interface ReadPagesResult {
  story: FormattedStory; source: 'ai' | 'basic'; transcript: string;
  design: { accent: string | null; accentRaw: string | null; pictures: PagePicture[]; order?: number[]; readBy?: string };
}

export interface AdminEditionRow {
  slug: string; title?: string; month: string; volume?: string; year?: number; volumeNumber?: 1 | 2 | 3 | 4; issueMonth?: Edition['issueMonth']; status: Edition['status']; cover?: string; stories: number; published: number;
}

export interface AdminSchool { id: string; name: string; city?: string; state?: string; points: number; studentCount: number; verified: boolean; sample?: boolean; plan?: string | null; seats?: number; accessUntil?: string | null; contactName?: string | null }

/** A category row in Admin → Categories */
export type AdminCategory = Category & { id: string; active: boolean; stories: number; locked?: boolean; updatedAt?: string };
export type CategoryInput = { name?: string; desc?: string; accent?: string; icon?: CategoryIcon; sections?: string[]; link?: string; active?: boolean };
export interface SectionOption { key: string; label: string; stories: number }

/** A published Big News story, for the homepage Big News line-up */
export interface BigNewsStory { id: string; slug: string; title: string; image?: string | null; sectionLabel: string; pages?: string | null; publishedAt: string | null }

/** A story switched on for the homepage hero, and whether it shows right now */
export type HeroState = 'live' | 'waiting' | 'no-picture' | 'not-published';
export interface HeroRow { id: string; slug: string; title: string; status: ArticleStatus; image?: string | null; sectionLabel: string; publishedAt: string | null; homepageAt: string | null; state: HeroState }

export type NominationStatus = 'new' | 'shortlisted' | 'featured' | 'declined';
export interface AdminNomination {
  id: string; nomineeName: string; nomineeAge?: number | null; category: string; schoolName?: string | null; city?: string | null; state?: string | null; photo?: string | null;
  headline: string; story: string; links: string[]; nominatorName: string; relationship?: string | null; nominatorEmail?: string | null; nominatorPhone?: string | null;
  consent: boolean; status: NominationStatus; featureBlurb?: string | null; adminNote?: string | null; createdAt: string; sample?: boolean;
}

export interface DashboardCharts {
  days: number;
  daily: { day: string; reads: number; answered: number; correct: number; signups: number; revenue: number; reading: number; quiz: number; games: number; debate: number; streak: number }[];
  topStories: { slug: string; title?: string; reads: number }[];
  topSchools: { name?: string; points: number }[];
  access: { school: number; personal: number };
  codes: { unused: number; used: number; revoked: number };
}

export interface DashboardStats {
  articles: Record<ArticleStatus, number>;
  currentEdition: { slug: string; title?: string; month: string } | null;
  students: number; newStudentsThisWeek: number; schools: number; unverifiedSchools: number; readsThisWeek: number;
  topStories: { slug: string; title?: string; reads: number }[];
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new ApiError(res.status, data.message ?? 'Request failed');
  return data as T;
}

const qs = (params: Record<string, string | undefined>) => {
  const p = Object.entries(params).filter(([, v]) => v);
  return p.length ? `?${new URLSearchParams(p as [string, string][]).toString()}` : '';
};

export const adminApi = {
  // auth
  login: (email: string, password: string) => call<{ admin: AdminUser }>('/admin_auth/login', 'POST', { email, password }).then((d) => d.admin),
  logout: () => call('/admin_auth/logout', 'POST', {}),
  me: () => call<{ admin: AdminUser }>('/admin_auth/me').then((d) => d.admin),

  dashboard: () => call<{ stats: DashboardStats }>('/admin_dashboard').then((d) => d.stats),
  charts: (days = 14) => call<DashboardCharts>(`/admin_dashboard/charts?days=${days}`),
  settings: () => call<{ settings: SiteSettings; defaults: SiteSettings; payments: { demo: boolean } }>('/admin_settings'),
  saveSettings: (data: SiteSettings) => call<{ settings: SiteSettings; message: string }>('/admin_settings', 'PUT', data),

  // articles
  articles: (f: { status?: string; edition?: string; q?: string; mine?: string } = {}) =>
    call<{ articles: AdminArticleRow[] }>(`/admin_articles${qs(f)}`).then((d) => d.articles),
  article: (id: string) => call<{ article: AdminArticle }>(`/admin_articles/${id}`).then((d) => d.article),
  createArticle: (data: ArticlePayload) => call<{ message: string; article: { id: string; slug: string; status: ArticleStatus } }>('/admin_articles', 'POST', data),
  updateArticle: (id: string, data: ArticlePayload) => call<{ message: string; article: { id: string; slug: string; status: ArticleStatus } }>(`/admin_articles/${id}`, 'PUT', data),
  deleteArticle: (id: string) => call<{ message: string }>(`/admin_articles/${id}`, 'DELETE'),
  /** The homepage hero line-up (which stories rotate, how many fit) */
  homepageHero: () => call<{ max: number; seconds: number; live: number; articles: HeroRow[] }>('/admin_articles/homepage'),
  /** The Big News on the homepage: the story for the big card, top right, bottom right ('' = newest) */
  bigNewsLineup: () => call<{ slots: string[]; stories: BigNewsStory[] }>('/admin_articles/big-news'),
  saveBigNewsLineup: (slots: string[]) => call<{ message: string; slots: string[] }>('/admin_articles/big-news', 'PUT', { slots }),
  freshLineup: () => call<{ slots: string[]; stories: BigNewsStory[] }>('/admin_articles/fresh'),
  saveFreshLineup: (slots: string[]) => call<{ message: string; slots: string[] }>('/admin_articles/fresh', 'PUT', { slots }),
  setHomepage: (id: string, on: boolean) => call<{ message: string; homepageFeatured: boolean }>(`/admin_articles/${id}/homepage`, 'PATCH', { on }),

  // categories (homepage "Explore", top menu, /category pages)
  categories: () => call<{ categories: AdminCategory[]; sections: SectionOption[]; icons: CategoryIcon[] }>('/admin_categories'),
  createCategory: (data: CategoryInput) => call<{ message: string; category: AdminCategory }>('/admin_categories', 'POST', data),
  updateCategory: (id: string, data: CategoryInput) => call<{ message: string; category: AdminCategory }>(`/admin_categories/${id}`, 'PUT', data),
  orderCategories: (ids: string[]) => call<{ message: string }>('/admin_categories/order', 'PUT', { ids }),
  deleteCategory: (id: string) => call<{ message: string }>(`/admin_categories/${id}`, 'DELETE'),
  /** Paste an article, get it back in the NextGen format (nothing is saved) */
  formatArticle: (text: string, edition?: string) =>
    call<{ story: FormattedStory; source: 'ai' | 'basic' }>('/admin_articles/format', 'POST', { text, edition }),
  /** Photos of a printed article (1–4, in order) → the story in the NextGen format + its design (nothing is saved) */
  readPages: (pages: ({ data: string; type: string } | { text: string; accent?: string | null; pictures?: { box: [number, number, number, number]; role: string; caption: string }[] })[], edition?: string) =>
    call<ReadPagesResult>('/admin_articles/read-pages', 'POST', { pages, edition }),

  // editions
  editions: () => call<{ editions: AdminEditionRow[] }>('/admin_editions').then((d) => d.editions),
  edition: (slug: string) => call<{ edition: Edition & { vocab: VocabWord[] } }>(`/admin_editions/${slug}`).then((d) => d.edition),
  createEdition: (data: Partial<Edition>) => call<{ message: string }>('/admin_editions', 'POST', data),
  updateEdition: (slug: string, data: Partial<Edition>) => call<{ message: string }>(`/admin_editions/${slug}`, 'PUT', data),

  // schools
  schools: (f: { q?: string; verified?: string } = {}) => call<{ schools: AdminSchool[] }>(`/admin_schools${qs(f)}`).then((d) => d.schools),
  createSchool: (data: Partial<AdminSchool>) => call<{ message: string }>('/admin_schools', 'POST', data),
  updateSchool: (id: string, data: Partial<AdminSchool>) => call<{ message: string }>(`/admin_schools/${id}`, 'PUT', data),
  deleteSchool: (id: string) => call<{ message: string }>(`/admin_schools/${id}`, 'DELETE'),
  nominations: (f: { status?: string; q?: string } = {}) => call<{ nominations: AdminNomination[]; counts: Record<NominationStatus, number> }>(`/admin_nominations${qs(f)}`),
  updateNomination: (id: string, data: { status?: NominationStatus; featureBlurb?: string; adminNote?: string }) => call<{ message: string }>(`/admin_nominations/${id}`, 'PUT', data),
  deleteNomination: (id: string) => call<{ message: string }>(`/admin_nominations/${id}`, 'DELETE'),
  grantPlan: (id: string, data: { planId?: string; seats?: number; days?: number }) => call<{ message: string }>(`/admin_schools/${id}/grant`, 'POST', data),

  // team (superadmin)
  team: () => call<{ team: AdminUser[] }>('/admin_team').then((d) => d.team),
  addMember: (data: { name: string; email: string; password: string; role: Role }) => call<{ message: string }>('/admin_team', 'POST', data),
  updateMember: (id: string, data: { role?: Role; active?: boolean; password?: string }) => call<{ message: string }>(`/admin_team/${id}`, 'PUT', data),

  // uploads
  uploadStatus: () => call<{ storage: 'cloudinary' | 'local' }>('/admin_uploads/status').then((d) => d.storage),
  uploadImage: async (file: File) => {
    const form = new FormData();
    form.append('image', await shrinkImage(file));
    return call<{ url: string }>('/admin_uploads/image', 'POST', form).then((d) => d.url);
  },
};

export const RANK: Record<Role, number> = { writer: 1, editor: 2, superadmin: 3 };
export const can = (user: AdminUser | null, min: Role) => Boolean(user && RANK[user.role] >= RANK[min]);
