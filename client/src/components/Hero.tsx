'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ArticleCard, Edition } from '@/lib/types';
import { readPalette, type Palette } from '@/lib/imagePalette';

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
  const [stopped, setStopped] = useState(false);   // the pause button
  const [hidden, setHidden] = useState(false);     // tab in the background
  const [cycle, setCycle] = useState(0);           // restarts the progress bar after a manual change
  const touch = useRef<number | null>(null);

  // Each picture's own colours (read in the browser) → the fade behind it and the glow
  const [palettes, setPalettes] = useState<Record<string, Palette>>({});
  const slideKey = slides.map((x) => x.image).join('|');
  useEffect(() => {
    let alive = true;
    slides.forEach((x) => readPalette(x.image).then((p) => { if (alive && p) setPalettes((m) => (m[x.image] ? m : { ...m, [x.image]: p })); }));
    return () => { alive = false; };
  }, [slideKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full screen: the hero fills the window below the navbar, so the ticker sits at the very bottom
  const [navH, setNavH] = useState(0);
  useEffect(() => {
    const nav = document.querySelector('nav');
    if (!nav) return;
    const on = () => setNavH(Math.round(nav.getBoundingClientRect().height));
    on();
    const ro = new ResizeObserver(on);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

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
  // keeps sliding even with the mouse over it; only the pause button (or a hidden tab) stops it
  const paused = stopped || hidden || count < 2;

  const story = slides[active];
  const upNext = count > 1 ? slides[(active + 1) % count] : null;

  return (
    <header
      className={`hero${story ? ' hero-with-story' : ''}`}
      style={story && navH ? { minHeight: `calc(100svh - ${navH}px)` } : undefined}
      id="top"
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
        <div className={`hero-media${i === active ? ' on' : ''}`} key={s.slug} aria-hidden="true"
          style={palettes[s.image] ? ({ '--pic-edge': palettes[s.image].edge } as CSSProperties) : undefined}>
          {/* The whole picture, never cropped or stretched: it sits on the right, black fills the rest,
              and a dark fade runs to the left behind the text */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-pic" src={s.image} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
        </div>
      ))}
      {/* Warm yellow / orange glow over the picture, like punchnextgen.com */}
      {story && <div className="hero-glow" aria-hidden="true"
        style={palettes[story.image] ? ({ '--glow1': palettes[story.image].glow, '--glow2': palettes[story.image].glow2 } as CSSProperties) : undefined} />}
      <div className="dots" />
      <div className="wrap hero-grid">
        <div>
          {edition ? <span className="edition-pill">Student Edition · {edition.volume || 'Edition'} <b>{(edition.month || '').toUpperCase()}</b></span> : <span className="edition-pill">NEXTGEN · STORIES FOR YOU</span>}
          {/* With featured stories, the story title is the headline (like punchnextgen.com); otherwise the edition's */}
          {!story && (
            <h1 className="display">
              {first} {accent && <span className="g">{accent}</span>}
            </h1>
          )}
          {/* The hero is always one screen tall and its text sits at the bottom, so the buttons stay
              in the same place on every slide; a longer title just grows upwards */}
          {story ? (
            <div className="hero-story on" key={story.slug} aria-live={paused ? 'polite' : 'off'}>
              <span className="hero-story-label">Featured story · {story.sectionLabel}</span>
              <h2>{story.title}</h2>
              {story.dek && <p>{story.dek}</p>}
            </div>
          ) : edition ? <Lede text={edition.lede} /> : <p className="hero-empty">New stories are on the way. Check back soon.</p>}
          {(edition || story) && <div className="hero-cta">
            <a className="btn hero-read-story" href={story ? `/articles/${story.slug}` : '#edition'}>{story ? 'Read the story →' : 'Explore NextGen →'}</a>
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
