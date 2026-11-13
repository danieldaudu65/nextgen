'use client';

import Link from 'next/link';
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
          <details className="nav-dropdown">
            <summary>Categories <span aria-hidden="true">⌄</span></summary>
            <div className="nav-dropdown-menu nav-mega">
              {categories.map((c) => <Link key={c.slug} href={categoryHref(c)}><CategoryIcon name={c.icon} size={18} />{c.name}</Link>)}
            </div>
          </details>
          <Link href="/#arcade">Play &amp; Win</Link>
          <Link href="/#leaders">Leaderboard</Link>
          <details className="nav-dropdown">
            <summary>For Schools <span aria-hidden="true">⌄</span></summary>
            <div className="nav-dropdown-menu">
              {SCHOOLS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
            </div>
          </details>
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
