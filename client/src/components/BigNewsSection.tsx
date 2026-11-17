'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ArticleCard } from '@/lib/types';
import SmartImage from './SmartImage';

// "The Big News" on the homepage, between the hero and the categories:
// the newest Big News story as the big card on the left, the next two stacked on the right
// (same cards as the edition section). More stories → "See all Big News". None → the section hides.
// The cards slide up when the section comes into view: the big one first, then the two small ones.

type Story = ArticleCard & { pages?: string | null };

export default function BigNewsSection({ stories, href = '/category/big-news' }: { stories: Story[]; href?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const picks = stories.slice(0, 3);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!picks.length) return null;
  return (
    <section ref={ref} className={`sec bn-sec${inView ? ' in' : ''}`} id="big-news" aria-labelledby="bn-heading">
      <div className="wrap">
        <div className="sec-head bn-head">
          <div>
            <span className="tagbar">What everyone is talking about</span>
            <h2 className="display" id="bn-heading">The Big News</h2>
          </div>
          {stories.length > 3 && <Link className="bn-all" href={href}>See all Big News →</Link>}
        </div>
        <div className={`bn-grid bn-${picks.length}`}>
          {picks.map((s, i) => (
            <Link key={s.slug} href={`/articles/${s.slug}`} className={`card bn-card${i === 0 ? ' big' : ''}`} style={{ '--d': `${i === 0 ? 0 : 0.15 + i * 0.12}s` } as CSSProperties}>
              <div className="top">
                <span className="chip">{s.sectionLabel}</span>
                {s.pages && <span className="pg" style={i === 0 ? { color: '#cfe' } : undefined}>{s.pages}</span>}
              </div>
              <h3>{s.title}</h3>
              {i === 0 && s.dek && <p>{s.dek}</p>}
              {s.image && (
                <div className="art">
                  <SmartImage src={s.image} position={s.imagePosition} fit={s.imageFit} />
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
