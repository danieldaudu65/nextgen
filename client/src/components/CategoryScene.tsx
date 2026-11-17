'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CATEGORIES, categoryHref, type Category } from '@/lib/categories';
import CategoryIcon from './CategoryIcon';

// "The Categories" as a scroll story, right after the hero. The stage sticks under the navbar while you scroll:
//  1. the smiling girl rises up into the picture
//  2. the 9 categories pop up around her one by one, as thought bubbles with their icon and colour
//  3. a crack runs down the picture, it shakes, then breaks into two jagged halves that swing open in 3D
//     with broken pieces flying out and light coming through the gap
//  4. the bubbles grow big, then drop one by one (with a bounce) into the 9 category cards
// Everything follows the scroll, so scrolling back plays it backwards.
// Sounds are made in the browser (no sound files). Browsers only allow sound after the visitor has tapped or
// clicked somewhere on the page, so there is a small sound button on the stage.
// The categories come from Admin → Categories (the built-in list is used if the server can't be reached).

// Where the bubbles sit around the girl, as % of the picture: [x, y] on a laptop and [x, y] on a phone
const SPOTS: { d: [number, number]; m: [number, number] }[] = [
  { d: [9, 49], m: [10, 11] }, { d: [14.2, 34], m: [30, 11] }, { d: [23.6, 21.6], m: [50, 11] },
  { d: [36, 13.8], m: [70, 11] }, { d: [50, 11], m: [90, 11] }, { d: [64, 13.8], m: [21, 29] },
  { d: [76.4, 21.6], m: [41, 29] }, { d: [85.8, 34], m: [59, 29] }, { d: [91, 49], m: [79, 29] },
];
// the little thought dots point at her head
const HEAD = { d: [50, 40], m: [50, 52] };
const dotDir = ([x, y]: [number, number], [hx, hy]: number[]) => {
  const dx = hx - x, dy = hy - y, len = Math.hypot(dx, dy) || 1;
  return [Math.round((dx / len) * 100) / 100, Math.round((dy / len) * 100) / 100];
};

// Timeline, as a share of the whole scroll
const POP = (i: number): [number, number] => [0.08 + i * 0.028, 0.13 + i * 0.028];
const DROP = (i: number): [number, number] => [0.54 + i * 0.03, 0.615 + i * 0.03];
const T = { girl: [0, 0.08], crack: [0.37, 0.43], split: [0.43, 0.6], grow: [0.43, 0.52], head: [0.5, 0.58] } as const;

// The crack: a jagged line from top to bottom (x%, y% of the stage), and a few small branches off it
const CRACK: [number, number][] = [[51, 0], [47.5, 7], [53, 15], [48.5, 23], [55, 31], [50, 38], [45.5, 46], [52.5, 55], [48, 63], [54.5, 72], [49, 80], [52.5, 89], [48.5, 100]];
const BRANCHES: [number, number][][] = [
  [[53, 15], [58, 12], [61.5, 14]], [[55, 31], [60, 35]], [[45.5, 46], [40, 43], [37, 47]],
  [[52.5, 55], [57.5, 59], [60, 57]], [[48, 63], [43, 67]], [[54.5, 72], [59, 76], [62, 75]], [[49, 80], [44.5, 84]],
];
const pts = (a: [number, number][]) => a.map(([x, y]) => `${x},${y}`).join(' ');
const CLIP_L = `polygon(0% 0%, ${CRACK.map(([x, y]) => `${x}% ${y}%`).join(', ')}, 0% 100%)`;
// the right half overlaps the left by a hair so no seam shows before the break
const CLIP_R = `polygon(${CRACK.map(([x, y]) => `${x - 0.25}% ${y}%`).join(', ')}, 100% 100%, 100% 0%)`;

// Broken pieces that fly out of the crack (fixed, rounded values so the server and the browser match)
const SHARDS = Array.from({ length: 14 }, (_, i) => {
  const r = (n: number) => { const v = Math.sin((i + 1) * 12.9898 * n) * 43758.5453; return v - Math.floor(v); };
  const [x, y] = CRACK[1 + (i % (CRACK.length - 2))];
  const side = i % 2 ? 1 : -1;
  const q = (v: number) => Math.round(v * 10) / 10;
  return {
    x: q(x + side * r(2) * 2), y: q(y + (r(3) - 0.5) * 6), size: Math.round(10 + r(4) * 26),
    vx: q(side * (8 + r(5) * 26)), vy: q(-6 + r(6) * 24), rot: Math.round((r(7) - 0.5) * 720),
    shape: ['50% 0%, 100% 100%, 0% 80%', '0% 0%, 100% 30%, 40% 100%', '20% 0%, 100% 50%, 0% 100%', '0% 20%, 90% 0%, 70% 100%'][i % 4],
  };
});

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p: number, [a, b]: readonly [number, number]) => clamp((p - a) / (b - a));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const backOut = (t: number) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
// falls, hits the card and bounces twice before settling
const bounce = (t: number) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

/* ---------- sound: tiny synth, no files ---------- */
type Sfx = { pop: (n: number) => void; crack: () => void; whoosh: () => void; thock: (n: number) => void };
function makeSfx(ac: AudioContext): Sfx {
  const master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);
  const noise = (() => {
    const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();
  const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  const burst = (t: number, len: number, peak: number, type: BiquadFilterType, freq: number, q = 1) => {
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); env(g, t, peak, 0.002, len);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.5, len + 0.05);
  };
  const tone = (t: number, type: OscillatorType, f0: number, f1: number, len: number, peak: number) => {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
    const g = ac.createGain(); env(g, t, peak, 0.004, len);
    o.connect(g).connect(master); o.start(t); o.stop(t + len + 0.05);
  };
  return {
    // bubbly pop, a little higher for each category
    pop: (n) => { const t = ac.currentTime, f = 380 + n * 55; tone(t, 'sine', f, f * 2.6, 0.11, 0.45); burst(t, 0.03, 0.14, 'highpass', 3000); },
    // plaster crack: sharp snaps, crunchy tail and a low thump
    crack: () => {
      const t = ac.currentTime;
      [0, 0.035, 0.08, 0.13].forEach((dt, i) => burst(t + dt, 0.06 + i * 0.02, 0.9 - i * 0.15, 'highpass', 1800 - i * 300));
      burst(t + 0.02, 0.55, 0.35, 'bandpass', 900, 0.7);
      tone(t, 'sine', 120, 38, 0.35, 0.9);
    },
    // air rushing as the halves open
    whoosh: () => {
      const t = ac.currentTime;
      const s = ac.createBufferSource(); s.buffer = noise;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
      const g = ac.createGain(); env(g, t, 0.45, 0.18, 0.4);
      s.connect(f).connect(g).connect(master); s.start(t, 0, 0.7);
    },
    // a bubble lands in its card
    thock: (n) => { const t = ac.currentTime; tone(t, 'triangle', 300 - n * 18, 120, 0.12, 0.42); burst(t, 0.025, 0.12, 'lowpass', 1200); },
  };
}

function Door({ side }: { side: 'l' | 'r' }) {
  // One copy of the picture (just the girl). Two copies, each showing one jagged half, make the break.
  return (
    <div className={`ms-door ms-door-${side}`} data-door={side}>
      <div className="ms-door-in" style={{ clipPath: side === 'l' ? CLIP_L : CLIP_R }}>
        <div className="cs-box">
          <img data-layer="girl" className="cs-girl" src="/images/scene/smiling-girl.webp" alt="" draggable={false} />
        </div>
        {/* the broken edge and shading that turns as the half swings */}
        <svg className="ms-edge" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts(CRACK)} /></svg>
        <span className="ms-shade" data-shade={side} />
      </div>
    </div>
  );
}

export default function CategoryScene({ categories = CATEGORIES }: { categories?: Category[] }) {
  const root = useRef<HTMLElement>(null);
  const cats = (categories.length ? categories : CATEGORIES).slice(0, SPOTS.length);
  const [sound, setSound] = useState(true);       // visitor's choice
  const [unlocked, setUnlocked] = useState(false); // has the browser allowed sound yet
  const soundRef = useRef(true);
  const sfx = useRef<Sfx | null>(null);
  const ac = useRef<AudioContext | null>(null);

  // remember the sound choice
  useEffect(() => {
    // sound is on unless this visitor switched it off (v2: earlier test choices don't count)
    try { const v = localStorage.getItem('ng-scene-sound-v2'); if (v === 'off') { setSound(false); soundRef.current = false; } } catch { /* storage blocked */ }
  }, []);

  // sound can only start after a tap/click/key anywhere on the page
  useEffect(() => {
    const unlock = () => {
      try {
        if (!ac.current) {
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!AC) return;
          ac.current = new AC();
          sfx.current = makeSfx(ac.current);
        }
        ac.current.resume().then(() => setUnlocked(true)).catch(() => {});
      } catch { /* no audio */ }
    };
    const evs = ['pointerdown', 'pointerup', 'mousedown', 'click', 'keydown', 'touchend'] as const;
    evs.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  const toggleSound = () => {
    const next = !(sound && unlocked);
    setSound(next); soundRef.current = next;
    try { localStorage.setItem('ng-scene-sound-v2', next ? 'on' : 'off'); } catch { /* storage blocked */ }
    if (next && sfx.current) sfx.current.pop(2);
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const sticky = el.querySelector<HTMLElement>('.ms-sticky')!;
    const q = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
    const doors = { l: q('[data-door="l"]')[0], r: q('[data-door="r"]')[0] };
    const shades = { l: q('[data-shade="l"]')[0], r: q('[data-shade="r"]')[0] };
    const girls = q('[data-layer="girl"]');
    const bubbles = q('.cs-bubble');
    const tags = q('.cs-tag');
    const cards = q('.cs-cats .cat-card');
    const icons = cards.map((c) => c.querySelector<HTMLElement>('.cat-card-icon'));
    const shards = q('.ms-shard');
    const crack = el.querySelector<SVGSVGElement>('.ms-crack');
    const glow = q('.ms-glow')[0];
    const edges = q('.ms-edge');
    const head = q('.cs-head')[0];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // the sticky stage sits right under the navbar
    const nav = document.querySelector('nav');
    const setNav = () => el.style.setProperty('--ms-nav', `${nav ? Math.round(nav.getBoundingClientRect().height) : 0}px`);

    // where each bubble has to drop to: the icon spot of its card, at the icon's size
    let paths: { dx: number; dy: number; s: number }[] = [];
    const measure = () => {
      setNav();
      const box = el.querySelector<HTMLElement>('.cs-bubbles .cs-box')!;
      // the box is centred with translate(-50%,-50%), which offsetLeft/Top don't include
      const bx = box.offsetLeft - box.offsetWidth / 2, by = box.offsetTop - box.offsetHeight / 2;
      const rel = (n: HTMLElement) => { let x = 0, y = 0, c: HTMLElement | null = n; while (c && c !== sticky) { x += c.offsetLeft; y += c.offsetTop; c = c.offsetParent as HTMLElement | null; } return { x, y }; };
      paths = bubbles.map((b, i) => {
        const icon = icons[i] ?? cards[i];
        if (!icon || !b.offsetWidth) return { dx: 0, dy: 0, s: 1 };
        // bubbles are centred on their spot (translate -50%), so offsetLeft/Top is their middle
        const cx = bx + b.offsetLeft, cy = by + b.offsetTop;
        const r = rel(icon);
        return { dx: r.x + icon.offsetWidth / 2 - cx, dy: r.y + icon.offsetHeight / 2 - cy, s: (icon.offsetWidth * 1.35) / b.offsetWidth };
      });
    };

    // sounds fire once each time you scroll forward past their moment
    const cues: { at: number; play: (s: Sfx) => void; done: boolean }[] = [
      ...bubbles.map((_, i) => ({ at: POP(i)[0] + 0.005, play: (s: Sfx) => s.pop(i), done: false })),
      { at: T.crack[0] + 0.005, play: (s: Sfx) => s.crack(), done: false },
      { at: T.split[0] + 0.01, play: (s: Sfx) => s.whoosh(), done: false },
      ...bubbles.map((_, i) => ({ at: DROP(i)[0] + (DROP(i)[1] - DROP(i)[0]) * 0.36, play: (s: Sfx) => s.thock(i), done: false })),
    ];
    let lastP = -1;
    let shakeTimer = 0;

    let raf = 0;
    const draw = () => {
      raf = 0;
      const span = el.offsetHeight - sticky.offsetHeight;
      const p = reduced ? 1 : clamp(span > 0 ? -el.getBoundingClientRect().top / span : 1);

      // sounds + the shake when the crack appears
      if (!reduced && lastP >= 0) {
        cues.forEach((c) => {
          if (p < c.at - 0.004) c.done = false;
          else if (!c.done && lastP < c.at && p >= c.at) {
            c.done = true;
            if (p - c.at < 0.06 && soundRef.current && sfx.current && ac.current?.state === 'running') c.play(sfx.current);
          }
        });
        if (lastP < T.crack[0] && p >= T.crack[0] && p < T.split[0]) {
          sticky.classList.remove('ms-shake'); void sticky.offsetWidth; sticky.classList.add('ms-shake');
          window.clearTimeout(shakeTimer); shakeTimer = window.setTimeout(() => sticky.classList.remove('ms-shake'), 500);
        }
      }
      lastP = p;

      // 1. the girl rises
      const g = easeOut(seg(p, T.girl));
      girls.forEach((n) => { n.style.opacity = String(g); n.style.transform = `translateY(${(1 - g) * 55}%)`; });

      // 3. crack, then the two halves swing open in 3D, falling a little as they go
      const c = easeOut(seg(p, T.crack));
      const d = easeInOut(seg(p, T.split));
      if (crack) { crack.style.setProperty('--c', String(c)); crack.style.opacity = String(c > 0 ? 1 - clamp(d * 4) : 0); }
      const tilt = easeIn(seg(p, T.split));
      doors.l.style.transform = `translate3d(${-d * 24}%, ${tilt * 22}%, 0) rotateY(${d * 58}deg) rotateZ(${-tilt * 10}deg)`;
      doors.r.style.transform = `translate3d(${d * 24}%, ${tilt * 26}%, 0) rotateY(${-d * 58}deg) rotateZ(${tilt * 12}deg)`;
      edges.forEach((e) => { e.style.opacity = String(c); });
      shades.l.style.opacity = shades.r.style.opacity = String(d * 0.75);
      doors.l.style.opacity = doors.r.style.opacity = String(1 - clamp((d - 0.8) * 5));
      if (glow) { glow.style.opacity = String(Math.sin(clamp(d * 1.15) * Math.PI) * 0.95 + (c > 0.6 && d === 0 ? 0.25 : 0)); glow.style.transform = `translate(-50%,-50%) scaleX(${0.25 + d * 1.6})`; }
      shards.forEach((n, i) => {
        const sh = SHARDS[i];
        const late = (i % 4) * 0.08; // some pieces leave a moment later; every piece is gone by the end
        const k = clamp((seg(p, [T.split[0] - 0.01, T.split[0] + 0.15]) - late) / (1 - late));
        n.style.opacity = k > 0 && k < 1 ? String(1 - k * k) : '0';
        n.style.transform = `translate(${sh.vx * k}vw, ${sh.vy * k + 40 * k * k}vh) rotate(${sh.rot * k}deg) scale(${1 - k * 0.4})`;
      });

      // 2 + 4. bubbles pop in, grow big, then drop one by one into their cards
      const grow = easeInOut(seg(p, T.grow));
      const tagsOn = 1 - grow;
      bubbles.forEach((b, i) => {
        const pop = backOut(seg(p, POP(i)));
        const f = seg(p, DROP(i));
        const path = paths[i] ?? { dx: 0, dy: 0, s: 1 };
        // a little lift before the fall, then a bouncy landing
        const lift = Math.sin(Math.min(f / 0.25, 1) * Math.PI) * (f < 0.25 ? 28 : 0);
        const x = path.dx * easeInOut(f);
        const y = path.dy * bounce(f) - lift;
        const big = 1 + 0.55 * grow;
        const scale = (0.2 + 0.8 * pop) * (big + (path.s - big) * easeOut(f));
        const wobble = Math.sin(f * Math.PI * 3) * (1 - f) * 14;
        const float = f === 0 ? Math.sin((p * 60 + i) * 1.3) * 4 * grow : 0;
        b.style.opacity = String(clamp(pop * 1.4) * (1 - clamp((f - 0.82) * 6)));
        b.style.transform = `translate(${x}px, ${y + float}px) scale(${scale}) rotate(${wobble}deg)`;
        if (tags[i]) tags[i].style.opacity = String(clamp(pop) * tagsOn);
        // the thought dots and name tag go away once the bubbles start to grow
        b.style.setProperty('--dots', String(tagsOn));
      });
      // each card appears as its bubble lands in it
      cards.forEach((n, i) => {
        const f = seg(p, DROP(i));
        const v = reduced ? 1 : clamp((f - 0.72) / 0.28);
        n.style.opacity = String(v);
        n.style.transform = v >= 1 ? '' : `translateY(${(1 - easeOut(v)) * 14}px) scale(${0.9 + 0.1 * easeOut(v)})`;
        n.style.pointerEvents = v > 0.6 ? 'auto' : 'none';
      });
      if (head) { const h = easeOut(seg(p, T.head)); head.style.opacity = String(reduced ? 1 : h); head.style.transform = `translateY(${(1 - h) * 20}px)`; }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const onResize = () => { measure(); onScroll(); };

    measure(); draw();
    el.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', onResize, { once: true }); });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const ro = nav ? new ResizeObserver(onResize) : null;
    if (nav && ro) ro.observe(nav);
    return () => {
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize);
      ro?.disconnect(); if (raf) cancelAnimationFrame(raf); window.clearTimeout(shakeTimer);
    };
  }, [cats.length]);

  const on = sound && unlocked;
  return (
    <section ref={root} className="ms-sec cs-sec" aria-labelledby="cat-heading">
      {/* "#categories" links land on the finished cards, at the end of the scroll story */}
      <span id="categories" className="cs-anchor" aria-hidden="true" />
      <div className="ms-sticky">
        <div className="cs-cats">
          <div className="wrap">
            <div className="sec-head cs-head">
              <div>
                <span className="tagbar">Everything that matters to you</span>
                <h2 className="display" id="cat-heading">The Categories</h2>
              </div>
            </div>
            <div className="cat-strip" role="list">
              {cats.map((c) => (
                <Link key={c.slug} className="cat-card" href={categoryHref(c)} role="listitem" style={{ '--cat-accent': c.accent } as CSSProperties}>
                  <span className="cat-card-icon"><CategoryIcon name={c.icon} /></span>
                  <span className="cat-card-big" aria-hidden="true"><CategoryIcon name={c.icon} size={150} /></span>
                  <span className="cat-card-name">{c.name}</span>
                  <span className="cat-card-desc">{c.desc}</span>
                  <span className="cat-card-go" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <span className="ms-glow" aria-hidden="true" />
        <Door side="l" />
        <Door side="r" />

        <svg className="ms-crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline className="main" pathLength={1} points={pts(CRACK)} />
          {BRANCHES.map((br, i) => <polyline key={i} className="branch" pathLength={1} points={pts(br)} style={{ '--i': i } as CSSProperties} />)}
        </svg>

        <div className="ms-shards" aria-hidden="true">
          {SHARDS.map((s, i) => (
            <span key={i} className="ms-shard" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px`, clipPath: `polygon(${s.shape})` }} />
          ))}
        </div>

        {/* the 9 category bubbles around the girl */}
        <div className="cs-bubbles" aria-hidden="true">
          <div className="cs-box">
            {cats.map((c, i) => {
              const spot = SPOTS[i];
              const [ddx, ddy] = dotDir(spot.d, HEAD.d);
              const [mdx, mdy] = dotDir(spot.m, HEAD.m);
              return (
                <span key={c.slug} className="cs-bubble" style={{
                  '--x': `${spot.d[0]}%`, '--y': `${spot.d[1]}%`, '--px': `${spot.m[0]}%`, '--py': `${spot.m[1]}%`,
                  '--dx': ddx, '--dy': ddy, '--pdx': mdx, '--pdy': mdy, '--cat-accent': c.accent,
                } as CSSProperties}>
                  <span className="cs-bubble-in"><CategoryIcon name={c.icon} size={48} /></span>
                  <span className="cs-tag">{c.name}</span>
                </span>
              );
            })}
          </div>
        </div>

        <button type="button" className={`ms-sound${on ? ' on' : ''}`} onClick={toggleSound} aria-pressed={on} aria-label={on ? 'Turn sound off' : 'Turn sound on'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
            {on ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              : <path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
          </svg>
          <span>{on ? 'Sound on' : sound ? 'Tap for sound' : 'Sound off'}</span>
        </button>
      </div>
    </section>
  );
}
