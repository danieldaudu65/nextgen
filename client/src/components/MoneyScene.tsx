'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

// Scroll story above the categories. The stage sticks under the navbar while you scroll:
//  1. the girl rises up into the picture
//  2. her thoughts (phone, game, bag, burger) pop in one by one, then the little shop pops up
//  3. a crack runs down the picture, it shakes, then breaks into two jagged halves that swing open in 3D
//     with broken pieces flying out and light coming through the gap
//  4. three of her thoughts grow big, fly to their place and turn into 3 story cards (same look as the edition cards)
// then the page carries on into the categories. Everything follows the scroll, so scrolling back plays it backwards.
// Sounds are made in the browser (no sound files). Browsers only allow sound after the visitor has tapped or clicked
// somewhere on the page, so there is a small sound button on the stage.
// Layer positions are % of the full drawing (1570 × 1338).

export type SceneStory = { key: string; title: string; label?: string; pages?: string; blurb?: string; image?: string | null; href: string };

type Layer = { name: string; left: number; top: number; width: number };
const L = (name: string, left: number, top: number, width: number): Layer => ({ name, left, top, width });
const GIRL = L('girl', 42.675, 3.064, 57.325);
const SHOP = L('shop', 0.51, 70.478, 47.643);
const BAG = L('bubble-bag', 32.102, 37.892, 18.726);
// These three travel and become the story cards: big card, top small card, bottom small card
const TRAVELLERS = [L('bubble-game', 14.459, 25.336, 17.389), L('bubble-phone', 31.592, 11.809, 15.732), L('bubble-burger', 83.057, 19.88, 15.987)];

// Timeline, as a share of the whole scroll
const POP: Record<string, [number, number]> = {
  'bubble-phone': [0.1, 0.16], 'bubble-game': [0.145, 0.205], 'bubble-bag': [0.19, 0.25], 'bubble-burger': [0.235, 0.295],
};
const T = {
  girl: [0, 0.1], shop: [0.28, 0.36], crack: [0.38, 0.45], split: [0.45, 0.64],
  fly: [0.5, 0.71], swap: [0.67, 0.79], head: [0.72, 0.82],
} as const;

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

// Broken pieces that fly out of the crack (fixed values so it looks the same every time)
const SHARDS = Array.from({ length: 14 }, (_, i) => {
  const r = (n: number) => { const v = Math.sin((i + 1) * 12.9898 * n) * 43758.5453; return v - Math.floor(v); };
  const [x, y] = CRACK[1 + (i % (CRACK.length - 2))];
  const side = i % 2 ? 1 : -1;
  // rounded so the server and the browser produce exactly the same numbers (Math.sin differs in the last digits)
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

const src = (name: string) => `/images/scene/money-girl/${name}.webp`;
const pos = (l: Layer): CSSProperties => ({ left: `${l.left}%`, top: `${l.top}%`, width: `${l.width}%` });

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
    // bubbly pop, a little higher for each thought
    pop: (n) => { const t = ac.currentTime, f = 420 + n * 90; tone(t, 'sine', f, f * 2.6, 0.11, 0.5); burst(t, 0.03, 0.15, 'highpass', 3000); },
    // glass/plaster crack: sharp snaps, crunchy tail and a low thump
    crack: () => {
      const t = ac.currentTime;
      [0, 0.035, 0.08, 0.13].forEach((dt, i) => burst(t + dt, 0.06 + i * 0.02, 0.9 - i * 0.15, 'highpass', 1800 - i * 300));
      burst(t + 0.02, 0.55, 0.35, 'bandpass', 900, 0.7);
      tone(t, 'sine', 120, 38, 0.35, 0.9);
    },
    // air rushing as the pieces open
    whoosh: () => {
      const t = ac.currentTime;
      const s = ac.createBufferSource(); s.buffer = noise;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
      const g = ac.createGain(); env(g, t, 0.45, 0.18, 0.4);
      s.connect(f).connect(g).connect(master); s.start(t, 0, 0.7);
    },
    // card lands
    thock: (n) => { const t = ac.currentTime; tone(t, 'triangle', 260 - n * 30, 120, 0.12, 0.45); burst(t, 0.025, 0.12, 'lowpass', 1200); },
  };
}

function Door({ side }: { side: 'l' | 'r' }) {
  // One copy of the drawing (without the travelling thoughts). Two copies, each showing one jagged half, make the break.
  return (
    <div className={`ms-door ms-door-${side}`} data-door={side}>
      <div className="ms-door-in" style={{ clipPath: side === 'l' ? CLIP_L : CLIP_R }}>
        <div className="ms-box">
          <img data-layer="shop" className="ms-l" src={src('shop')} alt="" draggable={false} style={pos(SHOP)} />
          <img data-layer="girl" className="ms-l" src={src('girl')} alt="" draggable={false} style={pos(GIRL)} />
          <img data-layer="bubble-bag" className="ms-l" src={src('bubble-bag')} alt="" draggable={false} style={{ ...pos(BAG), transformOrigin: '100% 40%' }} />
        </div>
        {/* the broken edge and shading that turns as the half swings */}
        <svg className="ms-edge" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts(CRACK)} /></svg>
        <span className="ms-shade" data-shade={side} />
      </div>
    </div>
  );
}

export default function MoneyScene({ stories = [] }: { stories?: SceneStory[] }) {
  const root = useRef<HTMLElement>(null);
  const picks = stories.slice(0, 3);
  const [sound, setSound] = useState(true);       // visitor's choice
  const [unlocked, setUnlocked] = useState(false); // has the browser allowed sound yet
  const soundRef = useRef(true);
  const sfx = useRef<Sfx | null>(null);
  const ac = useRef<AudioContext | null>(null);

  // remember the sound choice
  useEffect(() => {
    try { const v = localStorage.getItem('ng-scene-sound'); if (v === 'off') { setSound(false); soundRef.current = false; } } catch { /* storage blocked */ }
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
    const evs = ['pointerdown', 'keydown', 'touchend'] as const;
    evs.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  const toggleSound = () => {
    const next = !(sound && unlocked) ? true : false;
    setSound(next); soundRef.current = next;
    try { localStorage.setItem('ng-scene-sound', next ? 'on' : 'off'); } catch { /* storage blocked */ }
    if (next && sfx.current) sfx.current.pop(2);
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const sticky = el.querySelector<HTMLElement>('.ms-sticky')!;
    const q = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
    const doors = { l: q('[data-door="l"]')[0], r: q('[data-door="r"]')[0] };
    const shades = { l: q('[data-shade="l"]')[0], r: q('[data-shade="r"]')[0] };
    const byLayer = Object.fromEntries(['girl', 'shop', 'bubble-bag'].map((n) => [n, q(`[data-layer="${n}"]`)]));
    const travellers = q('.ms-travel');
    const cards = q('.ms-cards .card');
    const shards = q('.ms-shard');
    const crack = el.querySelector<SVGSVGElement>('.ms-crack');
    const glow = q('.ms-glow')[0];
    const edges = q('.ms-edge');
    const head = q('.ms-cards-head')[0];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const nav = document.querySelector('nav');
    const setNav = () => el.style.setProperty('--ms-nav', `${nav ? Math.round(nav.getBoundingClientRect().height) : 0}px`);

    // where each travelling thought has to go: the middle of its card, at the card's size
    let paths: { dx: number; dy: number; s: number }[] = [];
    const measure = () => {
      setNav();
      const box = el.querySelector<HTMLElement>('.ms-travel-box')!;
      // the box is centred with translate(-50%,-50%), which offsetLeft/Top don't include
      const bx = box.offsetLeft - box.offsetWidth / 2, by = box.offsetTop - box.offsetHeight / 2;
      const rel = (n: HTMLElement) => { let x = 0, y = 0, c: HTMLElement | null = n; while (c && c !== sticky) { x += c.offsetLeft; y += c.offsetTop; c = c.offsetParent as HTMLElement | null; } return { x, y }; };
      paths = travellers.map((t, i) => {
        const c = cards[i];
        if (!c || !t.offsetWidth) return { dx: 0, dy: 0, s: 1.6 };
        const tx = bx + t.offsetLeft + t.offsetWidth / 2, ty = by + t.offsetTop + t.offsetHeight / 2;
        const r = rel(c);
        return { dx: r.x + c.offsetWidth / 2 - tx, dy: r.y + c.offsetHeight / 2 - ty, s: Math.min(2.3, c.offsetWidth / t.offsetWidth, c.offsetHeight / t.offsetHeight) };
      });
    };

    // sounds fire once each time you scroll forward past their moment
    const cues: { at: number; play: (s: Sfx) => void; done: boolean }[] = [
      ...TRAVELLERS.map((t, i) => ({ at: POP[t.name][0] + 0.01, play: (s: Sfx) => s.pop([1, 0, 3][i]), done: false })),
      { at: POP['bubble-bag'][0] + 0.01, play: (s: Sfx) => s.pop(2), done: false },
      { at: T.shop[0] + 0.01, play: (s: Sfx) => s.thock(0), done: false },
      { at: T.crack[0] + 0.005, play: (s: Sfx) => s.crack(), done: false },
      { at: T.split[0] + 0.01, play: (s: Sfx) => s.whoosh(), done: false },
      ...[0, 1, 2].map((i) => ({ at: T.swap[0] + (T.swap[1] - T.swap[0]) * (0.25 + i * 0.12), play: (s: Sfx) => s.thock(i), done: false })),
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

      const g = easeOut(seg(p, T.girl));
      byLayer.girl.forEach((n) => { n.style.opacity = String(g); n.style.transform = `translateY(${(1 - g) * 60}%)`; });
      const s = backOut(seg(p, T.shop));
      byLayer.shop.forEach((n) => { n.style.opacity = String(clamp(s)); n.style.transform = `translateY(${(1 - s) * 45}%)`; });
      const b = backOut(seg(p, POP['bubble-bag']));
      byLayer['bubble-bag'].forEach((n) => { n.style.opacity = String(clamp(b * 1.4)); n.style.transform = `scale(${0.2 + 0.8 * b})`; });

      // crack runs down the picture
      const c = easeOut(seg(p, T.crack));
      const d = easeInOut(seg(p, T.split));
      if (crack) { crack.style.setProperty('--c', String(c)); crack.style.opacity = String(c > 0 ? 1 - clamp(d * 4) : 0); }

      // the two halves swing open in 3D, falling a little as they go
      const tilt = easeIn(seg(p, T.split));
      doors.l.style.transform = `translate3d(${-d * 24}%, ${tilt * 22}%, 0) rotateY(${d * 58}deg) rotateZ(${-tilt * 10}deg)`;
      doors.r.style.transform = `translate3d(${d * 24}%, ${tilt * 26}%, 0) rotateY(${-d * 58}deg) rotateZ(${tilt * 12}deg)`;
      edges.forEach((e) => { e.style.opacity = String(c); });
      shades.l.style.opacity = shades.r.style.opacity = String(d * 0.75);
      const doorFade = String(1 - clamp((d - 0.8) * 5));
      doors.l.style.opacity = doors.r.style.opacity = doorFade;
      if (glow) { glow.style.opacity = String(Math.sin(clamp(d * 1.15) * Math.PI) * 0.95 + (c > 0.6 && d === 0 ? 0.25 : 0)); glow.style.transform = `translate(-50%,-50%) scaleX(${0.25 + d * 1.6})`; }

      // pieces fly out of the crack
      shards.forEach((n, i) => {
        const sh = SHARDS[i];
        const k = clamp(seg(p, [T.split[0] - 0.01, T.split[0] + 0.15]) - (i % 4) * 0.02);
        n.style.opacity = k > 0 && k < 1 ? String(1 - k * k) : '0';
        n.style.transform = `translate(${sh.vx * k}vw, ${sh.vy * k + 40 * k * k}vh) rotate(${sh.rot * k}deg) scale(${1 - k * 0.4})`;
      });

      // travelling thoughts: pop in, then fly to their card and grow, then hand over to the card
      const f = easeInOut(seg(p, T.fly));
      const sw = seg(p, T.swap);
      travellers.forEach((t, i) => {
        const pop = backOut(seg(p, POP[TRAVELLERS[i].name]));
        const path = paths[i] ?? { dx: 0, dy: 0, s: 1 };
        const scale = (0.2 + 0.8 * pop) * (1 + (path.s - 1) * f);
        const hasCard = !!cards[i];
        t.style.opacity = String(clamp(pop * 1.4) * (hasCard ? 1 - clamp(sw * 1.4) : 1 - f));
        t.style.transform = `translate(${path.dx * f}px, ${path.dy * f}px) scale(${scale}) rotate(${Math.sin(f * Math.PI) * (i - 1) * 10}deg)`;
      });
      cards.forEach((n, i) => {
        const v = clamp((sw - i * 0.12) / 0.76);
        n.style.opacity = String(v);
        n.style.transform = v >= 1 ? '' : `perspective(900px) rotateX(${(1 - easeOut(v)) * 18}deg) scale(${0.86 + 0.14 * easeOut(v)})`;
        n.style.pointerEvents = v > 0.6 ? 'auto' : 'none';
      });
      if (head) { const h = easeOut(seg(p, T.head)); head.style.opacity = String(h); head.style.transform = `translateY(${(1 - h) * 20}px)`; }
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
  }, [picks.length]);

  const on = sound && unlocked;
  return (
    <section ref={root} className="ms-sec" aria-label="Start here: three stories">
      <div className="ms-sticky">
        <div className="ms-cards">
          <div className="ms-cards-head">
            <div>
              <span className="tagbar">Inside this edition</span>
              <h2 className="display">Start here.</h2>
            </div>
            <p className="sub">Three stories from this edition. Tap one to read.</p>
          </div>
          <div className="ms-cards-row">
            {picks.map((s, i) => (
              <Link key={s.key} href={s.href} className={`card${i === 0 ? ' big' : ''}`}>
                <div className="top">
                  {s.label && <span className="chip">{s.label}</span>}
                  {s.pages && <span className="pg" style={i === 0 ? { color: '#cfe' } : undefined}>{s.pages}</span>}
                </div>
                <h3>{s.title}</h3>
                {i === 0 && s.blurb && <p>{s.blurb}</p>}
                {s.image && <div className="art"><img src={s.image} alt="" loading="lazy" /></div>}
              </Link>
            ))}
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

        <div className="ms-travel-wrap" aria-hidden="true">
          <div className="ms-box ms-travel-box">
            {TRAVELLERS.map((t) => <img key={t.name} className="ms-l ms-travel" src={src(t.name)} alt="" draggable={false} style={pos(t)} />)}
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
