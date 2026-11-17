'use client';

import Link from 'next/link';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';
import { fmt, usePoints } from './PointsProvider';
import { Logo } from './Logo';
import CategoryIcon from './CategoryIcon';
import { useCategories } from '@/lib/useCategories';
import { categoryHref } from '@/lib/categories';

const SCHOOLS = [
  { href: '/schools', label: 'School Showcase' },
  { href: '/schools/guide', label: 'School Guide' },
  { href: '/school/login', label: 'School login' },
];


// A menu that opens when you hover it (desktop) or tap it (phones), and closes when you move away,
// pick a link or press Escape. Built on <details> so it still works without JavaScript.
function NavDropdown({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const open = () => { window.clearTimeout(timer.current); if (canHover() && ref.current) ref.current.open = true; };
  const close = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { if (canHover() && ref.current) ref.current.open = false; }, 180); };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && el.open) { el.open = false; el.querySelector('summary')?.focus(); } };
    const onDoc = (e: MouseEvent) => { if (el.open && !el.contains(e.target as Node)) el.open = false; };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDoc);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onDoc); window.clearTimeout(timer.current); };
  }, []);
  return (
    <details ref={ref} className="nav-dropdown" onMouseEnter={open} onMouseLeave={close}>
      <summary>{label} <span aria-hidden="true">⌄</span></summary>
      <div className={`nav-dropdown-menu${wide ? ' nav-mega' : ''}`} onClick={(e) => { if ((e.target as HTMLElement).closest('a') && ref.current) ref.current.open = false; }}>
        {children}
      </div>
    </details>
  );
}

// The logo lives in components/Logo.tsx (re-exported here for older imports)
export { Logo } from './Logo';

export default function Nav() {
  const { me, points, openJoin, logout } = usePoints();
  const categories = useCategories();
  return (
    <nav>
      <div className="wrap nav-in">
        <Logo onDark />
        <div className="links">
          <Link href="/">Home</Link>
          <NavDropdown label="Categories" wide>
            {categories.map((c) => (
              <Link key={c.slug} href={categoryHref(c)} style={{ '--cat-accent': c.accent } as CSSProperties}>
                <span className="mega-icon"><CategoryIcon name={c.icon} size={20} /></span>
                <span className="mega-text"><b>{c.name}</b>{c.desc && <small>{c.desc}</small>}</span>
              </Link>
            ))}
          </NavDropdown>
          <Link href="/arcade">Play &amp; Win</Link>
          <Link href="/#leaders">Leaderboard</Link>
          <NavDropdown label="For Schools">
            {SCHOOLS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </NavDropdown>
          <Link href="/nominate">Nominate a Star</Link>
          <Link href="/#about">About Us</Link>
        </div>
        <div className="nav-r">
          <div className="pts" title={me ? `Rank #${me.rank}` : 'Join to save your points'}>
            {me && me.streak > 0 && <span className="streak">🔥 {me.streak}</span>}
            <Icon name="bolt" size={18} />
            <span>{fmt(points)}</span>
            <span className="lbl">pts</span>
          </div>
          <ThemeToggle />
          {me ? (
            <button className="btn sm white" onClick={logout} title="Log out">@{me.handle}</button>
          ) : (
            <button className="btn sm" onClick={() => openJoin()}>Join Free</button>
          )}
        </div>
      </div>
    </nav>
  );
}
