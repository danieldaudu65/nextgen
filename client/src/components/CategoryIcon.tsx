import type { CategoryIcon as Name } from '@/lib/categories';

// Simple line icons for the 9 categories (24px grid, currentColor).
const PATHS: Record<Name, string> = {
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 12h7M7 15h4',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  campus: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6',
  wallet: 'M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01',
  briefcase: 'M3 8h18v11H3zM8 8V5h8v3M3 13h18',
  ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7l4 3-1.5 4.5h-5L8 10zM12 3v4M16 10l4.5-1M14.5 14.5 17 19M9.5 14.5 7 19M8 10l-4.5-1',
  chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  scales: 'M12 4v16M7 20h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  game: 'M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.5 1.7L15 14H9l-1.5 1.7A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4zM7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  heart: 'M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z',
  book: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h13v-4',
  tech: 'M5 6h14v10H5zM2 19h20M9 9l-2 2 2 2M15 9l2 2-2 2',
  check: 'M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.7 1 2.7-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9L3.3 14.7l1-2.7-1-2.7 2.4-1.8.9-2.9 3 .2zM8.5 12l2.5 2.5 4.5-5',
};

export default function CategoryIcon({ name, size = 26 }: { name: Name; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.news} />
    </svg>
  );
}
