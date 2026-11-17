'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { VocabWord } from '@/lib/types';

/*
 * "Unlock the words": word cards hanging from ropes.
 *  - Scroll to it: each rope draws in, then its cards drop in one by one, catch on their clip,
 *    swing and settle, then keep a slow sway (each one slightly out of step).
 *  - Tap / click a card: it swings and spins round on its clip to show the meaning.
 *  - Moving the mouse past the cards nudges them like a breeze.
 * Everything is CSS animation driven by a few classes, so it stays smooth on phones.
 * With "reduce motion" on, the cards just appear and flip without swinging.
 */

// cards per rope and how many ropes: laptop 4 × 2, tablet 3 × 2, phone 2 × 3
const perRow = (w: number) => (w <= 640 ? 2 : w <= 1024 ? 3 : 4);
const ropes = (w: number) => (w <= 640 ? 3 : 2);

// small, stable "random" numbers per word so every card sways a little differently
const seed = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

export default function VocabFlips({ words }: { words: VocabWord[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());     // flipped right now
  const [seen, setSeen] = useState<Set<string>>(new Set());     // unlocked at least once
  const [kick, setKick] = useState<Record<string, number>>({}); // re-runs the swing when tapped
  const [cols, setCols] = useState(4);
  const [maxRows, setMaxRows] = useState(2);
  const [shown, setShown] = useState<Set<number>>(new Set());   // rows that have dropped in
  const [hoverMode, setHoverMode] = useState(false);            // desktop (mouse): open on hover; phones: tap

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const on = () => setHoverMode(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const on = () => { setCols(perRow(window.innerWidth)); setMaxRows(ropes(window.innerWidth)); };
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const showing = useMemo(() => words.slice(0, cols * maxRows), [words, cols, maxRows]);
  const rows = useMemo(() => {
    const out: VocabWord[][] = [];
    for (let i = 0; i < showing.length; i += cols) out.push(showing.slice(i, i + cols));
    return out;
  }, [showing, cols]);

  // drop each rope's cards when that rope scrolls into view (once)
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = Number((e.target as HTMLElement).dataset.row);
        setShown((s) => (s.has(i) ? s : new Set(s).add(i)));
        io.unobserve(e.target);
      });
    }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
    rowsRef.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [rows.length]);

  const setCard = (w: string, on: boolean) => {
    setOpen((s) => { if (s.has(w) === on) return s; const n = new Set(s); if (on) n.add(w); else n.delete(w); return n; });
    if (on) setSeen((s) => (s.has(w) ? s : new Set(s).add(w)));
    setKick((k) => ({ ...k, [w]: (k[w] ?? 0) + 1 }));
  };
  const toggle = (w: string) => setCard(w, !open.has(w));

  // breeze: the pointer moving past pushes the cards a little in that direction
  const last = useRef<{ x: number; t: number } | null>(null);
  const breeze = (e: MouseEvent<HTMLDivElement>) => {
    const now = performance.now();
    const prev = last.current;
    last.current = { x: e.clientX, t: now };
    if (!prev || now - prev.t > 120) return;
    const v = (e.clientX - prev.x) / Math.max(1, now - prev.t); // px per ms
    e.currentTarget.querySelectorAll<HTMLElement>('.hang').forEach((card) => {
      const r = card.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      if (d > r.width * 1.4 || e.clientY < r.top - 40 || e.clientY > r.bottom + 40) return;
      const push = Math.max(-9, Math.min(9, v * 7 * (1 - d / (r.width * 1.4))));
      card.style.setProperty('--breeze', `${push.toFixed(2)}deg`);
      window.clearTimeout(Number(card.dataset.calm));
      card.dataset.calm = String(window.setTimeout(() => card.style.setProperty('--breeze', '0deg'), 260));
    });
  };

  return (
    <section className="sec vault" id="vocab">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="tagbar">Vocab Vault</span>
            <h2 className="display">Unlock the words.</h2>
          </div>
          <p className="sub">
            {hoverMode ? 'Point at a card to see what it means.' : 'Tap a card to see what it means.'}
            {showing.length > 0 && <b className="vault-count"> {showing.filter((v) => seen.has(v.word)).length} of {showing.length} unlocked</b>}
          </p>
        </div>

        {rows.map((row, ri) => (
          <div
            key={ri}
            className={`vault-row${shown.has(ri) ? ' in' : ''}`}
            data-row={ri}
            ref={(el) => { rowsRef.current[ri] = el; }}
            onMouseMove={breeze}
            style={{ '--cols': cols } as CSSProperties}
          >
            {/* the rope, sagging a little in the middle */}
            <svg className="vault-rope" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 6 Q500 30 1000 6" pathLength={1} />
            </svg>
            <div className="vault-cards">
              {row.map((v, ci) => {
                const n = seed(v.word);
                const t = row.length > 1 ? ci / (row.length - 1) : 0.5;
                const sag = 4 * t * (1 - t);                    // 0 at the ends, 1 in the middle
                const isOpen = open.has(v.word);
                const style = {
                  '--drop-delay': `${200 + ci * 140}ms`,
                  '--string': `${46 + sag * 16}px`,                   // string from the rope down to the clip
                  '--rope-y': `${(1 + sag * 10).toFixed(1)}px`,       // where the rope is above this card
                  '--sway-dur': `${5.2 + (n % 23) / 10}s`,
                  '--sway-delay': `-${(n % 37) / 10}s`,
                  '--sway-amp': `${0.9 + (n % 7) / 10}deg`,
                  '--tilt': `${((n % 9) - 4) * 0.45}deg`,
                  '--len': Math.max(6, v.word.length),                 // long words get smaller so they fit on one line
                } as CSSProperties;
                return (
                  <div className={`hang${isOpen ? ' on' : ''}${seen.has(v.word) ? ' seen' : ''}`} key={v.word} style={style}>
                    <div className="hang-drop">
                      <span className="hang-string" aria-hidden="true" />
                      <span className="hang-clip" aria-hidden="true" />
                      <div className={`hang-swing${kick[v.word] ? ` kick${kick[v.word] % 2}` : ''}`}>
                        <div className="hang-sway">
                          <div className="hang-breeze">
                            <button
                              type="button"
                              className="hang-card"
                              onClick={() => { if (!hoverMode) toggle(v.word); }}
                              onMouseEnter={() => { if (hoverMode) setCard(v.word, true); }}
                              onMouseLeave={() => { if (hoverMode) setCard(v.word, false); }}
                              onFocus={() => { if (hoverMode) setCard(v.word, true); }}
                              onBlur={() => { if (hoverMode) setCard(v.word, false); }}
                              aria-pressed={isOpen}
                              aria-label={isOpen ? `${v.word}: ${v.definition} ${v.nextgen}` : `${v.word}: tap to see the meaning`}
                            >
                              <span className="hang-flip">
                                <span className="hang-face hang-front">
                                  <span className="hang-top"><small>{v.category}</small><i>{seen.has(v.word) ? '✓ Unlocked' : '🔒'}</i></span>
                                  <span className="hang-word">{v.word}</span>
                                  <span className="hang-hint">{hoverMode ? 'Hover to unlock ↻' : 'Tap to unlock ↻'}</span>
                                </span>
                                <span className="hang-face hang-back">
                                  <b>{v.word}</b>
                                  <span className="hang-def">{v.definition}</span>
                                  {v.nextgen && <em>{v.nextgen}</em>}
                                  {!hoverMode && <span className="hang-hint">Tap to flip back</span>}
                                </span>
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
