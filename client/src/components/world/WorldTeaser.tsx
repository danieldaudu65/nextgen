'use client';

/*
 * Homepage preview of NextGen World: the island slowly turning, your level,
 * the 7 levels and a Continue button. Tapping anywhere opens /arcade.
 * three.js loads only when this section scrolls into view, and stops when it leaves.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Edition, EditionSummary } from '@/lib/types';
import { getEditions } from '@/lib/api';
import { levelFor } from '@/lib/levels';
import { fmt, usePoints } from '../PointsProvider';
import type { World } from './engine/scene';
import { WORLD_LEVELS, currentOf } from './worldLevels';
import { useWorldProgress } from './useWorldProgress';

export default function WorldTeaser({ edition }: { edition: Edition }){
  const router = useRouter();
  const { me, points } = usePoints();
  const { stars } = useWorldProgress(edition.slug);
  const stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), world = useRef<World | null>(null);
  const [live, setLive] = useState(false), [next, setNext] = useState<EditionSummary | null>(null);
  const [ask, setAsk] = useState<string | null>(null); // where to go once they say yes
  const askRef = useRef(setAsk); askRef.current = setAsk;
  const cur = stars ? currentOf(stars) : 0;
  const lv = levelFor(points);

  useEffect(() => { getEditions().then((list) => setNext(list.find((e) => e.status === 'upcoming') ?? null)).catch(() => {}); }, []);

  // start the 3D preview when it scrolls into view, pause it when it leaves
  useEffect(() => {
    const el = stage.current; if (!el) return;
    let made = false, gone = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !made){
        made = true;
        import('./engine/scene').then(({ createWorld }) => {
          if (gone || !canvas.current) return;
          world.current = createWorld(canvas.current, { teaser: true, levels: WORLD_LEVELS.map((l) => ({ key: l.key, color: l.color, short: l.short })), onEnter: () => askRef.current('/arcade') });
          world.current.setNight(document.documentElement.dataset.theme === 'dark');
          setLive(true);
        }).catch(() => {});
      }
      world.current?.pause(!e.isIntersecting);
    }, { threshold: .15 });
    io.observe(el);
    const mo = new MutationObserver(() => world.current?.setNight(document.documentElement.dataset.theme === 'dark'));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { gone = true; io.disconnect(); mo.disconnect(); world.current?.dispose(); world.current = null; };
  }, [router]);

  useEffect(() => { if (live && stars) world.current?.setProgress(stars); }, [live, stars]);
  // the "Enter the world" button in the section heading (components/Arcade.tsx) asks through this event
  useEffect(() => { const h = (e: Event) => setAsk((e as CustomEvent<string>).detail || '/arcade'); window.addEventListener('ng:enter-world', h); return () => window.removeEventListener('ng:enter-world', h); }, []);
  useEffect(() => { if (!ask) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsk(null); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [ask]);

  return (
    <>
      <div className="wt-stage" ref={stage}>
        {!live && <div className="wt-poster" aria-hidden="true" />}
        <canvas ref={canvas} aria-label="NextGen World preview. Tap to enter." />
        <div className="wt-ov wt-me wd-glass">
          <div className="wd-ava" style={{ background: `conic-gradient(#FFD400 0 ${lv.pct}%, rgba(255,255,255,.15) 0)` }}><span>{me ? me.name.slice(0, 2).toUpperCase() : '⚡'}</span><b>{lv.level}</b></div>
          <div><small style={{ display: 'block', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', fontWeight: 700 }}>Level {lv.level}</small>
            <strong style={{ display: 'block', fontFamily: 'var(--display)', fontSize: 20, lineHeight: 1.1 }}>{lv.rank.name}</strong>
            <div className="wd-xp" style={{ width: 160 }}><i style={{ width: `${lv.pct}%` }} /></div>
            <p><b>{fmt(points)}</b> pts{me && me.streak > 0 ? ` · 🔥 ${me.streak} day streak` : ''}{!me ? ' · Join free to save them' : ''}</p></div>
        </div>
        <div className="wt-ov wt-isle wd-glass">{edition.month} Island · {Math.min(7, cur)} / 7 cleared</div>
        <div className="wt-ov wt-dock wd-glass">
          <div className="wt-lvls">
            {WORLD_LEVELS.map((l, i) => {
              const st = i < cur ? 'done' : i === cur ? 'now' : 'locked', s = stars?.[i] ?? 0;
              return (
                <button type="button" key={l.key} onClick={() => setAsk(st === 'locked' ? '/arcade' : `/arcade?level=${i + 1}`)} className={`wt-lv ${st}`} title={`Level ${i + 1}: ${l.name}`}>
                  <span className="dot" style={{ background: `radial-gradient(circle at 35% 30%,#fff 0,${l.color} 28%,${l.color} 100%)` } as CSSProperties}>{st === 'locked' ? '🔒' : i === 6 ? '♛' : i + 1}</span>
                  <small>{l.short}</small>
                  <span className="st">{st === 'done' ? <><b>{'★'.repeat(s)}</b>{'★'.repeat(3 - s)}</> : null}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="wt-go" onClick={() => setAsk(cur <= 6 ? `/arcade?level=${cur + 1}` : '/arcade')}>
            <small>{cur <= 6 ? (cur ? 'Continue' : 'Start here') : 'Island cleared'}</small>
            <b>{cur <= 6 ? `▶ Level ${cur + 1} · ${WORLD_LEVELS[cur].short}` : '★ Replay for 3 stars'}</b>
          </button>
        </div>
      </div>
      <div className="wt-minis">
        <div className="wt-mini"><div className="ic" aria-hidden="true">🎯</div><div><small>Today&apos;s mission</small>
          <b>{me ? `Read ${me.mission.target} stories today` : 'Read stories, play levels'}</b>
          <p>{me ? `${me.mission.done} of ${me.mission.target} done · bonus points` : 'Every story and level earns points'}</p></div></div>
        <div className="wt-mini"><div className="ic" aria-hidden="true">🏫</div><div><small>Your school</small>
          <b>{me?.school ? `${me.school.name}${me.school.rank ? ` · #${me.school.rank}` : ''}` : 'Play for your school'}</b>
          <p>Your points help your school climb the board</p></div></div>
        <div className="wt-mini"><div className="ic" aria-hidden="true">🔒</div><div><small>Next island</small>
          <b>{next ? `${next.month}${next.subtitle ? ` · ${next.subtitle}` : ''}` : 'Coming with the next edition'}</b>
          <p>Beat the {edition.month} Boss to unlock it</p></div></div>
      </div>
      {ask && (
        <div className="wt-ask-back" onClick={(e) => { if (e.target === e.currentTarget) setAsk(null); }}>
          <div className="wt-ask" role="alertdialog" aria-modal="true" aria-labelledby="wt-ask-title" aria-describedby="wt-ask-text">
            <div className="wt-ask-icon" aria-hidden="true">🌍</div>
            <h3 id="wt-ask-title">Enter NextGen World?</h3>
            <p id="wt-ask-text">{ask.includes('level=') ? `You'll go to level ${ask.split('level=')[1]} on the ${edition.month} island.` : `You'll go to the ${edition.month} island.`} It has sound, so check your volume.</p>
            <div className="wt-ask-btns">
              <button type="button" className="wt-ask-no" onClick={() => setAsk(null)}>Not now</button>
              <button type="button" className="wt-ask-yes" autoFocus onClick={() => { const to = ask; setAsk(null); router.push(to); }}>Yes, enter ▶</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
