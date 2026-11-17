'use client';

import Link from 'next/link';
import { Logo } from './Logo';
import CategoryIcon from './CategoryIcon';
import { useCategories } from '@/lib/useCategories';
import { categoryHref } from '@/lib/categories';

const EMAIL = 'contact@punchnextgen.com';

const PLAY = [
  { href: '/#arcade', label: 'Crack This' },
  { href: '/#arcade', label: 'Daily Quiz' },
  { href: '/#arcade', label: 'Fact or Cap?' },
  { href: '/#arcade', label: 'Debate' },
  { href: '/#vocab', label: 'Vocab Vault' },
  { href: '/#leaders', label: 'Leaderboard' },
];

// "Punch NEXTGEN" column (Contact Us is added below as an email link)
const ABOUT = [
  { href: '/schools/guide', label: 'School Guide' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Use' },
];

// Footer: brand + the categories from Admin → Categories (story ones; game sections are under Play),
// games, and the Punch NEXTGEN links (guide, contact, privacy, terms). On phones the link groups sit two side by side.
export default function Footer() {
  const categories = useCategories().filter((c) => !c.link).slice(0, 7);
  return (
    <footer id="about">
      <div className="wrap">
        <div className="foot">
          <div className="foot-brand">
            <Logo onDark size="lg" />
            <div className="tln">Think · <span>Learn</span> · Engage</div>
            <p>
              News &amp; interactive learning for Nigeria&apos;s next generation. Published by Punch Nigeria Limited,
              publishers of The Punch Newspaper.
            </p>
            <a className="foot-mail" href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </div>
          <div className="foot-col" role="navigation" aria-label="Explore">
            <h5>Explore</h5>
            {categories.map((c) => (
              <Link key={c.slug} href={categoryHref(c)}><CategoryIcon name={c.icon} size={15} />{c.name}</Link>
            ))}
          </div>
          <div className="foot-col" role="navigation" aria-label="Play">
            <h5>Play &amp; Win</h5>
            {PLAY.map((l) => <Link key={l.label} href={l.href}>{l.label}</Link>)}
          </div>
          <div className="foot-col" role="navigation" aria-label="Punch NextGen">
            <h5>Punch NEXTGEN</h5>
            <Link href={ABOUT[0].href}>{ABOUT[0].label}</Link>
            <a href={`mailto:${EMAIL}`}>Contact Us</a>
            {ABOUT.slice(1).map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </div>
        </div>
        <div className="copy">
          <span>© {new Date().getFullYear()} Punch NextGen · ISSN 3121-7206</span>
          <a className="foot-top" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top ↑</a>
          <span>Built by Punch NextGen</span>
        </div>
      </div>
      {/* the same "Tap In. Level Up." strip as the bottom of the home screen, as the last thing on every page */}
      <div className="hero-ticker foot-ticker" aria-hidden="true" data-no-reveal>
        <div className="hero-ticker-track">
          {Array.from({ length: 12 }).map((_, i) => <span key={i} className="hero-ticker-item">Tap In. Level Up.</span>)}
        </div>
      </div>
    </footer>
  );
}
