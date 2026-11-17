/** How a picture fits a box of another shape (see components/SmartImage.tsx) */
export type ImageFit = 'auto' | 'cover' | 'contain';

// Shapes returned by the Express API (server/src/models). Keep the two in sync.

export type IconName =
  | 'ballot' | 'piggy' | 'bulb' | 'robot' | 'trophy' | 'puzzle'
  | 'book' | 'mega' | 'shades' | 'bolt' | 'flame' | 'star' | 'ear';

export type CardVariant = 'big' | 'wide' | 'full' | 'default';
export type CardTone = 'yellow' | 'pink' | 'purple' | 'blue';

export interface SectionCard {
  key: string;
  label: string;          // e.g. "THE BIG NEWS"
  pages: string;          // e.g. "p.2–3"
  title: string;
  blurb?: string;
  genz?: string;          // small black pill line
  image?: string;         // /images/...
  imagePosition?: string; // CSS object-position
  imageFit?: ImageFit;
  icon?: IconName;
  variant?: CardVariant;
  featured?: boolean;     // shown on the homepage
  tone?: CardTone;
  href: string;
}

export interface TickerItem { tag: string; text: string }

export interface VocabWord {
  word: string;
  category: string;
  definition: string;
  nextgen: string;        // the "NextGen translation" line
  aliases?: string[];
}

// One story page: /articles/[slug]
// body/eli10 blocks: "text" paragraph · "## Heading" · "> Callout" · "- bullet" · [[word]] vocab
export interface Article {
  slug: string;
  edition: string;
  section: string;
  sectionLabel: string;
  pages?: string;
  title: string;
  dek?: string;
  image?: string;
  homepageFeatured?: boolean;
  gallery?: { image: string; caption?: string }[];
  imagePosition?: string;
  imageFit?: ImageFit;
  /** The story's colour from the printed page (one of the site colours); none = the normal yellow */
  accent?: string | null;
  author?: string;
  readMins: number;
  points: number;
  publishedAt: string;
  body: string[];
  eli10: string[];
  game?: { label: string; href: string };
  tags?: string[];
  hasQuestion?: boolean; // the story has a check question (the answer stays on the server)
}

export type ArticleCard = Pick<Article, 'slug' | 'edition' | 'section' | 'sectionLabel' | 'title' | 'dek' | 'image' | 'imagePosition' | 'imageFit' | 'readMins' | 'points'> & { author?: string; publishedAt?: string | null };

/** The rotating homepage hero: the stories, how many, and seconds per story (Admin → Settings) */
export interface HomepageHero { articles: ArticleCard[]; total: number; seconds: number }

export interface ArticlePage {
  article: Article;
  edition: { slug: string; title: string; month: string } | null;
  vocab: VocabWord[];
  related: ArticleCard[];
}

export interface ArticlePreview {
  slug: string;
  section: string;
  title: string;
  readMins: number;
  points: number;
  // Use [[word]] to mark a Vocab Vault word inside the text
  body: string;
  eli10: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer?: number;        // only present in trusted seed/admin data, never public quiz payloads
}

export interface SortCard { text: string; answer: 'cheat' | 'buddy' }

export interface MoneyItem { label: string; price: number }

export interface WordSearch { grid: string[]; words: string[] }

export interface Edition {
  slug: string;
  title?: string;
  month: string;          // "Oct 2026"
  volume: string;         // "Vol 4 No 1"
  year?: number;
  volumeNumber?: 1 | 2 | 3 | 4;
  issueMonth?: 'january' | 'february' | 'march' | 'april' | 'may' | 'june' | 'july' | 'august' | 'september' | 'october' | 'november' | 'december' | 'other';
  status: 'current' | 'upcoming' | 'archive';
  cover?: string;
  tagline?: string;
  headline: string[];     // hero lines, e.g. ["Nigeria", "2027"]
  headlineAccent: string; // e.g. "Loading…"
  lede: string;
  electionDate?: string;  // ISO date for the countdown
  ticker: TickerItem[];
  sections: SectionCard[];
  vocab: VocabWord[];
  quiz: QuizQuestion[];
  sort: SortCard[];
  promiseQuestions: string[];
  money: { start: number; save: number; items: MoneyItem[] };
  wordSearch: WordSearch;
}

export interface EditionSummary {
  slug: string;
  title?: string;
  month: string;
  status: Edition['status'];
  cover?: string;
  label?: string;
  subtitle?: string;
}

export interface Debate {
  id: string;
  question: string;
  teamA: { label: string; pitch: string };
  teamB: { label: string; pitch: string };
  votesA: number;
  votesB: number;
  imageA?: string;
  imageB?: string;
  mySide?: 'A' | 'B' | null;
}

export interface LeaderRow {
  rank: number;
  id?: string;
  name: string;
  points: number;
  color?: string;
  school?: string;     // readers/players: their school
  streak?: number;
  students?: number;   // schools: students in the school
  active?: number;     // schools: students who earned points in this range
  perStudent?: number; // schools: average points per active student
}

export type LeaderRange = 'volume' | 'edition' | 'week' | 'all';
export interface Leaderboard {
  period: 'week' | 'all';
  range?: LeaderRange;
  label?: string;            // "Volume 4", "2026 edition", "This week", "All time"
  ranking?: 'total' | 'average';
  boards?: { readers: boolean; players: boolean; schools: boolean };
  showOnHome?: boolean;      // Admin → Settings: show the leaderboard on the homepage
  readers: LeaderRow[];      // Top Readers: reading + story question points
  players?: LeaderRow[];     // Top Players: every point, games included
  schools: LeaderRow[];
}

// GET /site/settings (Admin → Settings, the parts the website needs)
export interface SiteSettings {
  leaderboard: { range: LeaderRange; size: number; boards: { readers: boolean; players: boolean; schools: boolean }; schoolRanking: 'total' | 'average'; showOnHome: boolean };
  reading: { mode: 'fixed' | 'story'; readSeconds: number; questionSeconds: number; retries: number; readPoints: number; questionPoints: number };
  home: { heroMax: number; heroSeconds: number; bigNews?: string[]; fresh?: string[] };
  access: { requireAccessForPoints: boolean };
  personalPlans: PersonalPlan[]; // packages for students who are not with a subscribed school
  schoolPlans: SchoolPlan[];
}
export interface SchoolPlan { id: string; name: string; seats: number; price: number; days: number }
export interface PersonalPlan { id: string; name: string; price: number; days: number }

export interface QuestionState { status: 'ready' | 'open' | 'done' | 'out'; attempts: number; triesLeft: number; secondsLeft?: number }
export interface StoryQuestion { prompt: string; options: string[] }

export interface School { id: string; name: string; city?: string; state?: string }

// GET /api/me
export interface Me {
  id: string;
  name: string;
  handle: string;
  color?: string;
  className?: string;
  points: number;
  streak: number;
  bestStreak: number;
  rank: number;
  school: { id: string; name: string; city?: string; rank: number | null } | null;
  mission: { done: number; target: number };
  access?: { active: boolean; type: 'school' | 'personal' | null; until: string | null };
}

// ---------- School Showcase (GET /schools/showcase) ----------
export interface ShowcaseStudent { name: string; handle: string; color?: string; className?: string; points: number; streak?: number }
export interface ShowcaseSchool {
  id: string; slug: string; name: string; city?: string; state?: string; verified: boolean;
  logo?: string | null; motto?: string | null; about?: string | null; website?: string | null; founded?: number | null; schoolType?: string | null;
  points: number; studentCount: number; rank: number; member: boolean;
  top: ShowcaseStudent[];
}
export interface Showcase { page: number; pages: number; total: number; states: string[]; schools: ShowcaseSchool[] }

// ---------- Nominate a Star (GET /nominations/stars) ----------
export interface Star {
  id: string; kind: 'story' | 'nominee'; name: string; headline?: string | null; photo?: string | null; imagePosition?: string | null;
  href?: string; age?: number | null; category?: string; school?: string | null; place?: string | null; blurb?: string | null;
}
export interface NominationForm {
  nomineeName: string; nomineeAge: string; category: string; schoolName: string; city: string; state: string; photo: string;
  headline: string; story: string; links: string;
  nominatorName: string; relationship: string; nominatorEmail: string; nominatorPhone: string; consent: boolean;
}
