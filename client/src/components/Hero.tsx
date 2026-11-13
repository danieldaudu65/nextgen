'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArticleCard, Edition } from '@/lib/types';
import SmartImage from './SmartImage';

function useCountdown(target?: string) {
  const [left, setLeft] = useState({ d: 0, h: 0, m: 0 });
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = Math.max(0, new Date(target).getTime() - Date.now());
      setLeft({ d: Math.floor(diff / 864e5), h: Math.floor(diff / 36e5) % 24, m: Math.floor(diff / 6e4) % 60 });
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Renders **YOU** style emphasis from the lede
function Lede({ text }: { text?: string | null }) {
  const copy = text?.trim();
  if (!copy) return <p className="hero-empty">This edition’s introduction is coming soon.</p>;
  const parts = copy.split(/(\bYOU\b)/);
  return <p className="lede">{parts.map((p, i) => (p === 'YOU' ? <b key={i}>YOU</b> : p))}</p>;
}

export default function Hero({ edition, stories = [], seconds = 7, total }: { edition: Edition | null; stories?: ArticleCard[]; seconds?: number; total?: number }) {
  const { d, h, m } = useCountdown(edition?.electionDate);

  const [first, accent] = edition?.headline ?? ['Stories', 'for you'];
  // The stories an editor switched on for the homepage (★ in Admin → Stories); the API already caps
  // how many (Admin → Settings → Homepage hero). Only stories with a picture can show.
  const slides = stories.filter((story): story is ArticleCard & { image: string } => Boolean(story.image));
  const count = Math.min(slides.length, total ?? slides.length) || slides.length;
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [stopped, setStopped] = useState(false);   // the pause button
  const [hidden, setHidden] = useState(false);     // tab in the background
  const [cycle, setCycle] = useState(0);           // restarts the progress bar after a manual change
  const touch = useRef<number | null>(null);

  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  useEffect(() => { if (active >= count) setActive(0); }, [active, count]);

  const go = useCallback((i: number) => {
    if (!count) return;
    setActive(((i % count) + count) % count);
    setCycle((c) => c + 1);
  }, [count]);
  const next = () => go(active + 1);
  const prev = () => go(active - 1);
  const paused = hovered || stopped || hidden || count < 2;

  const story = slides[active];
  const upNext = count > 1 ? slides[(active + 1) % count] : null;

  return (
    <header
      className={`hero${story ? ' hero-with-story' : ''}`}
      id="top"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current === null || count < 2) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
      }}
    >
      {/* Featured pictures stacked; the active one fades in (all stay loaded so switching is instant) */}
      {slides.slice(0, count).map((s, i) => (
        <div className={`hero-media${i === active ? ' on' : ''}`} key={s.slug} aria-hidden="true">
          <SmartImage src={s.image} position={s.imagePosition} fit={s.imageFit} align="right center" tolerance={0.5} />
        </div>
      ))}
      <div className="dots" />
      <div className="wrap hero-grid">
        <div>
          {edition ? <span className="edition-pill">Student Edition · {edition.volume || 'Edition'} <b>{(edition.month || '').toUpperCase()}</b></span> : <span className="edition-pill">NEXTGEN · STORIES FOR YOU</span>}
          <h1 className="display">
            {first} {accent && <span className="g">{accent}</span>}
          </h1>
          <div className="loading">
            <span className="display">{edition?.headlineAccent ?? 'Coming soon'}</span>
            <div className="bar" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => <i key={i} />)}
            </div>
          </div>
          {story ? <div className="hero-story" key={story.slug} aria-live={paused ? 'polite' : 'off'}>
            <span className="hero-story-label">Featured story · {story.sectionLabel}</span>
            <h2>{story.title}</h2>
            {story.dek && <p>{story.dek}</p>}
            <a className="btn" href={`/articles/${story.slug}`}>Read this story →</a>
          </div> : edition ? <Lede text={edition.lede} /> : <p className="hero-empty">New stories are on the way. Check back soon.</p>}
          {(edition || story) && <div className="hero-cta">
            <a className="btn white hero-read-story" href={story ? `/articles/${story.slug}` : '#edition'}>{story ? 'Read story' : 'Explore NextGen →'}</a>
            {edition && <a className="btn dark" href="#edition">Explore this edition →</a>}
          </div>}
          {edition?.electionDate && (
            <div className="countdown">
              <div className="lbl">
                Countdown to Election Day
                <small>Presidential &amp; NASS · 16 Jan 2027</small>
              </div>
              <div className="cd">
                <div><b>{pad(d)}</b><span>DAYS</span></div>
                <div><b>{pad(h)}</b><span>HRS</span></div>
                <div><b>{pad(m)}</b><span>MINS</span></div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Slide controls: dots in the middle, 01 / 05 + up next on the right (like punchnextgen.com) */}
      {count > 1 && (
        <div className="hero-controls" role="group" aria-label="Featured stories"
          onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); next(); } if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); } }}>
          <div className="hero-nav-btns">
            <button className="hero-arrow" onClick={prev} aria-label="Previous story">‹</button>
            <button className="hero-arrow" onClick={next} aria-label="Next story">›</button>
          </div>
          <div className="hero-dots">
            {slides.slice(0, count).map((slide, i) => (
              <button key={slide.slug} aria-label={`Story ${i + 1} of ${count}: ${slide.title}`} aria-current={i === active} onClick={() => go(i)}>
                {i === active && (
                  <i
                    key={`${active}-${cycle}`}
                    className="hero-dot-fill"
                    style={{ animationDuration: `${seconds}s`, animationPlayState: paused ? 'paused' : 'running' }}
                    onAnimationEnd={next}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="hero-count">
            <button className="hero-pause" onClick={() => setStopped((v) => !v)} aria-label={stopped ? 'Play the slideshow' : 'Pause the slideshow'} aria-pressed={stopped}>
              {stopped ? '▶' : '❚❚'}
            </button>
            <span className="hero-count-num" aria-label={`Story ${active + 1} of ${count}`}><b>{pad(active + 1)}</b> / {pad(count)}</span>
            {upNext && <button className="hero-upnext" onClick={next}><small>Up next</small><span>{upNext.title}</span></button>}
          </div>
        </div>
      )}

      {/* "Tap In. Level Up." ticker — two identical halves so the -50% loop is seamless */}
      <div className="hero-ticker" aria-hidden="true">
        <div className="hero-ticker-track">
          {Array.from({ length: 12 }).map((_, i) => <span key={i} className="hero-ticker-item">Tap In. Level Up.</span>)}
        </div>
      </div>
    </header>
  );
}
