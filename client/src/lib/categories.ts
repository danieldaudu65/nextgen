// Site categories = the edition sections (THE BIG NEWS, MONEY MATTERS, TECH PULSE, POP CULTURE,
// NEXTGEN STARS…). slug = the section key, so a story with section "tech" is in "tech".
// The real list comes from the API (Admin → Categories, GET /categories); CATEGORIES below is
// only the fallback while the server can't be reached. `sections` = extra section keys to include,
// `link` = where the card goes instead of /category/<slug> (CRACK THIS → the games).
export type Category = {
  slug: string;
  name: string;
  desc: string;
  accent: string;
  icon: CategoryIcon;
  sections: string[];
  link?: string;
  order?: number;
};

/** Where a category card or menu item goes */
export const categoryHref = (c: Category) => c.link || `/category/${c.slug}`;

export type CategoryIcon = 'news' | 'music' | 'campus' | 'wallet' | 'briefcase' | 'ball' | 'chat' | 'scales' | 'check' | 'star' | 'bolt' | 'game' | 'globe' | 'heart' | 'book' | 'tech';
export const CATEGORY_ICONS: CategoryIcon[] = ['news', 'music', 'campus', 'wallet', 'briefcase', 'ball', 'chat', 'scales', 'check', 'star', 'bolt', 'game', 'globe', 'heart', 'book', 'tech'];

// Same as the server's starter list (server/services/categories.js): the October 2026 sections
export const CATEGORIES: Category[] = [
  { slug: 'big-news', name: 'The Big News', desc: 'The news that matters, explained without big grammar.', accent: '#FFD400', icon: 'news', sections: [] },
  { slug: 'money', name: 'Money Matters', desc: 'Spending, saving and side hustles. Who ate your money?', accent: '#16A34A', icon: 'wallet', sections: [] },
  { slug: 'tech', name: 'Tech Pulse', desc: "AI, apps and gadgets: what's new and what it means for you.", accent: '#2563EB', icon: 'tech', sections: [] },
  { slug: 'pop', name: 'Pop Culture', desc: "Music, fashion, film and the culture everyone's talking about.", accent: '#DB2777', icon: 'music', sections: [] },
  { slug: 'stars', name: 'NextGen Stars', desc: 'Young Nigerians doing extraordinary things. Meet them.', accent: '#FF8A00', icon: 'star', sections: [] },
  { slug: 'toons', name: 'SmartToons', desc: 'Comics that explain big ideas, panel by panel.', accent: '#7C3AED', icon: 'chat', sections: [] },
  { slug: 'crack', name: 'Crack This', desc: 'Crosswords, word searches and brain games. Crack it, win points.', accent: '#E11D2A', icon: 'game', sections: [], link: '/#arcade' },
  { slug: 'vocab', name: 'Vocab Vault', desc: "New words, explained like you're 10.", accent: '#0EA5E9', icon: 'book', sections: [], link: '/#vocab' },
  { slug: 'debate', name: 'Debate', desc: 'Pick a side, say why, earn points.', accent: '#C2410C', icon: 'scales', sections: [], link: '/#arcade' },
];

export const categoryBySlug = (slug: string, list: Category[] = CATEGORIES) => list.find((c) => c.slug === slug);
const slugify = (s?: string) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const inCategory = (c: Category, section?: string, sectionLabel?: string) => {
  const key = slugify(section), label = slugify(sectionLabel);
  return Boolean((key && (key === c.slug || c.sections.includes(key))) || (label && (label === c.slug || label === slugify(c.name))));
};
