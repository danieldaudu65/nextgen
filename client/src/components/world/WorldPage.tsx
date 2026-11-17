'use client';

/*
 * ============================================================
 * NextGen World (/arcade)
 * ============================================================
 * The 3D island (engine/scene.js) + everything on top of it:
 * your level and XP, the level card, the game screen, the results.
 * Stars: useWorldProgress (server for students, this browser for guests).
 * Points: the games' own server routes, through PointsProvider.
 * ============================================================
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Debate, Edition, EditionSummary } from '@/lib/types';
import { levelFor } from '@/lib/levels';
import { fmt, usePoints } from '../PointsProvider';
import GameLock from '../games/GameLock';
import type { World } from './engine/scene';
import { SND } from './engine/sound';
import { WORLD_LEVELS, currentOf } from './worldLevels';
import { useWorldProgress } from './useWorldProgress';
import { BossLevel, DebateLevel, MoneyLevel, PromiseLevel, QuizLevel, SortLevel, WordsLevel, type LevelDone } from './WorldGames';

type Result = { i: number; stars: number; line: string; before: number; wasCurrent: boolean };

export default function WorldPage({ edition, debate, editions, startLevel }: { edition: Edition; debate: Debate | null; editions: EditionSummary[]; startLevel?: number }){
  const { me, points } = usePoints();
  const { stars, save, setFromServer } = useWorldProgress(edition.slug);
  const canvas = useRef<HTMLCanvasElement>(null), callout = useRef<HTMLButtonElement>(null);
  const world = useRef<World | null>(null);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const [card, setCard] = useState<number | null>(null), [playing, setPlaying] = useState<number | null>(null), [result, setResult] = useState<Result | null>(null);
  const [toast, setToast] = useState<string | null>(null), [hint, setHint] = useState(true), [soundOn, setSoundOn] = useState(true), [night, setNight] = useState(false);
  const startPts = useRef(0), hop = useRef<number | null>(null), toastT = useRef(0), opened = useRef(false);
  const overlay = card !== null || playing !== null;
  const overlayRef = useRef(overlay); overlayRef.current = overlay;
  const cur = stars ? currentOf(stars) : 0;
  const curRef = useRef(cur); curRef.current = cur;

  const say = useCallback((t: string) => { setToast(t); clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(null), 2800); }, []);

  // tapping a level in 3D
  const tapLevel = useCallback((i: number) => {
    if (overlayRef.current) return;
    if (i > curRef.current){ world.current?.shake(i); SND.lock(); say(`🔒 Clear level ${curRef.current + 1} (${WORLD_LEVELS[curRef.current]?.short}) first to open this one.`); return; }
    SND.whoosh(); world.current?.focusLevel(i);
    window.setTimeout(() => { setCard(i); SND.open(); }, 850);
  }, [say]);
  const tapRef = useRef(tapLevel); tapRef.current = tapLevel;

  // build the 3D world once (three.js loads only on this page)
  useEffect(() => {
    let live = true, w: World | null = null;
    const others = editions.filter((e) => e.slug !== edition.slug);
    const islands = [
      ...others.filter((e) => e.status === 'archive').slice(0, 2).map((e) => ({ name: `${e.month} Island`, sub: e.title || e.label || 'A past edition' })),
      ...others.filter((e) => e.status === 'upcoming').slice(0, 1).map((e) => ({ name: `${e.month} Island`, sub: `${e.subtitle || e.title || 'The next edition'}. Beat this island's Boss to open it.`, locked: true })),
    ];
    import('./engine/scene').then(({ createWorld }) => {
      if (!live || !canvas.current) return;
      w = createWorld(canvas.current, {
        levels: WORLD_LEVELS.map((l) => ({ key: l.key, color: l.color, short: l.short })),
        islands, callout: callout.current, hideCallout: () => overlayRef.current,
        onLevel: (i) => tapRef.current(i),
        onIsland: (I) => { SND.tap(); say(`${I.locked ? '🔒' : '🏝️'} ${I.name}: ${I.sub}`); },
        onInput: () => setHint(false),
      });
      world.current = w; setReady(true);
    }).catch(() => setFailed(true));
    const start = () => SND.start();
    window.addEventListener('pointerdown', start, { capture: true });
    window.addEventListener('keydown', start, { capture: true });
    return () => { live = false; w?.dispose(); world.current = null; SND.stop(); window.removeEventListener('pointerdown', start, { capture: true }); window.removeEventListener('keydown', start, { capture: true }); };
  }, [edition.slug, editions, say]);

  // night = the site's dark mode
  useEffect(() => {
    const read = () => { const n = document.documentElement.dataset.theme === 'dark'; setNight(n); world.current?.setNight(n); SND.setNight(n); };
    read(); const mo = new MutationObserver(read); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [ready]);
  useEffect(() => { setSoundOn(SND.on); }, []);

  // show progress on the island (when nothing is open on top)
  useEffect(() => {
    if (!ready || !stars || overlay) return;
    const from = hop.current; hop.current = null;
    if (typeof from === 'number' && from < 6 && stars[from] > 0){
      for (let k = 0; k < 5; k++) window.setTimeout(SND.hop, 80 + k * 360);
      world.current?.setProgress(stars, { hopFrom: from, onHopped: () => { SND.unlock(); const n = currentOf(stars); if (n <= 6) say(`🔓 Level ${n + 1} unlocked: ${WORLD_LEVELS[n].name}`); } });
    } else {
      world.current?.setProgress(stars);
      if (from === 6 && stars[6] > 0){ world.current?.unlockNext(); window.setTimeout(SND.unlock, 700); window.setTimeout(() => say('🏝️ Next island unlocked! Its levels arrive with the next edition.'), 1600); }
    }
    // a link like /arcade?level=3 opens that level once
    if (!opened.current && startLevel && startLevel >= 1){ opened.current = true; if (startLevel - 1 <= currentOf(stars)) window.setTimeout(() => tapRef.current(startLevel - 1), 1400); }
  }, [ready, stars, overlay, say, startLevel]);

  const play = (i: number) => { setCard(null); setResult(null); setPlaying(i); startPts.current = points; SND.tap(); SND.mode(i === 6 ? 'boss' : 'game'); };
  const quit = () => { setPlaying(null); setResult(null); SND.mode('world'); world.current?.zoomOut(); };
  const done: LevelDone = (got, info) => {
    if (playing === null) return;
    const i = playing, wasCurrent = i === cur;
    save(WORLD_LEVELS[i].key, got);
    setResult({ i, stars: got, line: info.line, before: startPts.current, wasCurrent });
    SND.mode('result'); if (got) SND.win(); else SND.lose();
    for (let k = 0; k < got; k++) window.setTimeout(() => SND.star(k), 150 + k * 250);
  };
  const next = () => {
    if (!result) return;
    if (!result.stars) return play(result.i);
    if (result.wasCurrent) hop.current = result.i;
    setPlaying(null); setResult(null); SND.mode('world');
  };

  // points and level for the top bar and the results
  const lv = levelFor(points);
  const earned = result ? Math.max(0, points - result.before) : 0;
  const lvBefore = result ? levelFor(result.before) : lv;
  useEffect(() => { if (result && earned > 0) SND.points(); }, [result, earned]);
  useEffect(() => { if (result && lv.level > lvBefore.level) window.setTimeout(SND.levelUp, 600); }, [result, lv.level, lvBefore.level]);

  const L = playing !== null ? WORLD_LEVELS[playing] : card !== null ? WORLD_LEVELS[card] : null;
  const props = { edition, debate, onDone: done };
  const games = [<MoneyLevel key="m" {...props} />, <QuizLevel key="q" {...props} />, <DebateLevel key="d" {...props} />, <SortLevel key="s" {...props} />, <PromiseLevel key="p" {...props} />, <WordsLevel key="w" {...props} />, <BossLevel key="b" {...props} onServer={(r) => setFromServer(r.progress)} />];

  return (
    <section className={`wd${night ? ' night' : ''}`} aria-label="NextGen World">
      <canvas ref={canvas} className="wd-canvas" aria-label="The island. Drag to look around, scroll or pinch to zoom, tap a level." />
      {!ready && <div className="wd-loading">{failed ? <b>Could not load the 3D world. Refresh to try again.</b> : <><b>NEXTGEN WORLD</b><i /></>}</div>}

      <div className="wd-top">
        <div className="wd-me wd-glass">
          <div className="wd-ava" style={{ background: `conic-gradient(#FFD400 0 ${lv.pct}%, rgba(255,255,255,.15) 0)` }}><span>{me ? me.name.slice(0, 2).toUpperCase() : '⚡'}</span><b>{lv.level}</b></div>
          <div><small>Level {lv.level}{me ? ` · @${me.handle}` : ' · Guest'}</small><strong>{lv.rank.name}</strong><div className="wd-xp"><i style={{ width: `${lv.pct}%` }} /></div></div>
        </div>
        <div className="wd-sp" />
        {me && me.streak > 0 && <div className="wd-stat wd-glass wd-streak">🔥 {me.streak}</div>}
        <div className="wd-stat wd-glass"><span style={{ color: '#FFD400' }}>⚡</span> {fmt(points)}</div>
        <button type="button" className="wd-ibtn wd-glass" onClick={() => { SND.start(); const o = SND.toggle(); setSoundOn(o); if (o) SND.tap(); }} aria-label={soundOn ? 'Sound off' : 'Sound on'} aria-pressed={!soundOn}>{soundOn ? '🔊' : '🔇'}</button>
      </div>
      <div className="wd-place wd-glass">{edition.month} Island · {Math.min(7, cur)} / 7 cleared</div>
      {hint && ready && <div className="wd-hint">✋ Drag to look around · Scroll or pinch to zoom · Tap a level</div>}
      <div className="wd-bottom">
        <button type="button" className="wd-pill wd-glass" onClick={() => { SND.whoosh(); world.current?.overview(); }}>🌍 World</button>
        <button type="button" className="wd-pill yel" onClick={() => { SND.whoosh(); world.current?.focusCurrent(); }}>📍 My level</button>
      </div>
      <button type="button" ref={callout} className="wd-callout" onClick={() => tapLevel(cur)}>{cur <= 6 ? `▶ ${WORLD_LEVELS[cur].short} · Play` : '★ Island cleared'}</button>
      {toast && <div className="wd-toast wd-glass" role="status">{toast}</div>}

      {/* the level card */}
      {card !== null && L && (
        <div className="wd-back" onClick={(e) => { if (e.target === e.currentTarget){ setCard(null); world.current?.zoomOut(); } }}>
          <div className="wd-card" role="dialog" aria-modal="true" aria-labelledby="wd-card-title" style={{ '--c': L.color } as CSSProperties}>
            <div className="wd-card-art"><div className="wd-big">{card === 6 ? '♛' : card + 1}</div><span className="wd-lvno">LEVEL {card + 1} · {edition.month.toUpperCase()}</span>
              <button type="button" className="wd-x" aria-label="Close" onClick={() => { setCard(null); world.current?.zoomOut(); }}>×</button></div>
            <div className="wd-card-body">
              <div className="wd-stars3">{[0, 1, 2].map((k) => <span key={k} className={k < (stars?.[card] ?? 0) ? 'on' : ''}>★</span>)}</div>
              <h2 id="wd-card-title">{L.name}</h2><p>{L.text}</p>
              <div className="wd-goals">{L.goals.map(([a, b]) => <div key={a}><b>{a}</b><small>{b}</small></div>)}</div>
            </div>
            <button type="button" className="wd-go" autoFocus onClick={() => play(card)}>{stars?.[card] ? 'Play again' : 'Play'} <small>{L.points}</small></button>
          </div>
        </div>
      )}

      {/* playing */}
      {playing !== null && L && (
        <div className="wd-game" role="dialog" aria-modal="true" aria-labelledby="wd-game-title" style={{ '--c': L.color } as CSSProperties}>
          <div className="wd-gwrap">
            <div className="wd-ghead"><button type="button" className="wd-gx" onClick={quit} aria-label="Back to the island">←</button>
              <div><small>LEVEL {playing + 1} · {L.short.toUpperCase()}</small><h2 id="wd-game-title">{L.name}</h2></div></div>
            {result ? (
              <div className="wg-res">
                <div className="wg-stars">{[0, 1, 2].map((k) => <span key={k} className={k < result.stars ? 'on' : ''} style={{ animationDelay: `${.15 + k * .25}s` }}>★</span>)}</div>
                <h3>{['So close!', 'Nice!', 'Great job!', 'Perfect!'][result.stars]}</h3>
                <p>{result.line}</p>
                {result.stars ? <div className="wg-pts">{earned ? `+${earned} pts` : me ? 'Points already counted for this edition' : 'Join free to keep your points'}</div> : <p><b>Get at least 1 star</b> to open the next level.</p>}
                <div className="wg-xpbox"><div><b>Level {lv.level} · {lv.rank.name}</b><span>{fmt(points)} XP</span></div><div className="wg-xpbar"><i style={{ width: `${lv.pct}%` }} /></div><small>{lv.next ? `${fmt(lv.toNext)} XP to ${lv.next.emoji} ${lv.next.name}` : 'Top level!'}</small></div>
                {lv.level > lvBefore.level && <div className="wg-rankup">⬆ LEVEL UP! You&apos;re now {lv.rank.emoji} {lv.rank.name}</div>}
                <div className="wg-btns"><button type="button" className="wg-ghost" onClick={() => play(result.i)}>↻ Replay</button>
                  <button type="button" className="wg-yel" onClick={next}>{result.stars ? (result.i === 6 ? 'Back to the island ▶' : 'Next level ▶') : 'Try again'}</button></div>
              </div>
            ) : (
              <GameLock>{games[playing]}</GameLock>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
