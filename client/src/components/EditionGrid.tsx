/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { SectionCard } from '@/lib/types';
import { Icon } from './Icon';
import SmartImage from './SmartImage';

function Top({ s, light }: { s: SectionCard; light?: boolean }) {
  return (
    <div className="top">
      <span className="chip">{s.label}</span>
      <span className="pg" style={light ? { color: '#cfe' } : undefined}>{s.pages}</span>
    </div>
  );
}

function Card({ s }: { s: SectionCard }) {
  const tone = s.tone ? ` c-${s.tone}` : '';

  if (s.variant === 'wide' || s.variant === 'full') {
    return (
      <Link className={`card wide${s.variant === 'full' ? ' full' : ''}${tone}`} href={s.href}>
        <div className="row">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Top s={s} />
            <h3>{s.title}</h3>
            {s.blurb && <p>{s.blurb}</p>}
            {s.genz && <span className="genz">{s.genz}</span>}
          </div>
          {s.image && (
            <div className="side" style={s.variant === 'full' ? { background: 'var(--red)' } : undefined}>
              <SmartImage src={s.image} position={s.imagePosition} fit={s.variant === 'full' ? 'contain' : s.imageFit} />
            </div>
          )}
        </div>
      </Link>
    );
  }

  const big = s.variant === 'big';
  return (
    <Link className={`card${big ? ' big' : ''}${tone}`} href={s.href}>
      <Top s={s} light={big} />
      <h3>{s.title}</h3>
      {s.blurb && <p>{s.blurb}</p>}
      {s.genz && <span className="genz" style={big ? { background: 'var(--yellow)', color: 'var(--ink)' } : undefined}>{s.genz}</span>}
      {s.image ? (
        <div className="art">
          <SmartImage src={s.image} position={s.imagePosition} fit={s.imageFit} />
        </div>
      ) : (
        s.icon && <Icon name={s.icon} className="ico" />
      )}
    </Link>
  );
}

type GridText = { kicker?: string; title?: string; sub?: string; emptyTitle?: string; emptyText?: string };
// limit: show only the first N cards (in a row of 3 when N is 3); more: a link to the rest

export default function EditionGrid({ sections, text = {}, limit, more }: { sections: SectionCard[]; text?: GridText; limit?: number; more?: { href: string; label: string } }) {
  const {
    kicker = 'From the NextGen team', title = 'Fresh stories', sub = 'Published stories, straight from the newsroom.',
    emptyTitle = 'No published stories yet', emptyText = 'Our editors will share the first story here when it is ready.',
  } = text;
  return (
    <section className="sec" id="edition">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="tagbar">{kicker}</span>
            <h2 className="display">{title}</h2>
          </div>
          {more && sections.length > (limit ?? Infinity) ? <Link className="sec-more" href={more.href}>{more.label}</Link> : sub && <p className="sub">{sub}</p>}
        </div>
        {sections.length ? <div className={`bento${limit === 3 ? ' three' : ''}`}>{(limit ? sections.slice(0, limit) : sections).map((s) => <Card key={s.key} s={s} />)}</div> : <div className="empty-stories"><b>{emptyTitle}</b><p>{emptyText}</p></div>}
      </div>
    </section>
  );
}
