'use client';

/*
 * ============================================================
 * NextGen Arcade (/arcade)
 * ============================================================
 * 1. Boot:   CRT screen switches on, "Insert coin" (your points are your credits).
 * 2. Select: 6 neon cabinets in a 3D row. Arrows, swipe, ← → keys, or tap one.
 * 3. Launch: the cabinet screen zooms in, 3-2-1-GO.
 * 4. Play:   the real game runs inside the cabinet screen (members only, see GameLock).
 * The player card shows your level and XP bar (lib/levels.ts). Level up = big celebration.
 * Open a game straight away with /arcade?game=money (quiz, debate, sort, promise, wordsearch).
 * ============================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Debate, Edition } from '@/lib/types';
import { ARCADE_GAMES, gameReady, type ArcadeGame, type ArcadeKey } from '@/lib/arcadeGames';
import { RANKS, levelFor } from '@/lib/levels';
import { fmt, usePoints } from '../PointsProvider';
import GameLock from '../games/GameLock';
import MoneyGame from '../games/MoneyGame';
import QuizGame from '../games/QuizGame';
import DebateVote from '../games/DebateVote';
import SortGame from '../games/SortGame';
import PromiseChecker from '../games/PromiseChecker';
import WordSearchGame from '../games/WordSearchGame';
import { setArcadeMuted, sfx } from './arcadeSound';

type Phase = 'loading' | 'boot' | 'select' | 'launch' | 'play';

const BOOTED_KEY = 'ng-arcade-booted';
const MUTED_KEY = 'ng-arcade-muted';
const COUNTDOWN = ['3', '2', '1', 'GO!'];

function store(kind: 'session' | 'local', key: string, value?: string): string | null {
  try {
    const s = kind === 'session' ? window.sessionStorage : window.localStorage;
    if (value !== undefined) { s.setItem(key, value); return value; }
    return s.getItem(key);
  } catch {
    return null;
  }
}

export default function ArcadePortal({ edition, debate, startGame }: { edition: Edition; debate: Debate | null; startGame?: string }) {
  const reduce = useReducedMotion();
  const { me, points } = usePoints();
  const ready = useMemo(() => ARCADE_GAMES.map((g) => gameReady(g.key, edition, debate)), [edition, debate]);
  const firstReady = Math.max(0, ready.indexOf(true));

  const [phase, setPhase] = useState<Phase>('loading');
  const [sel, setSel] = useState(firstReady);
  const [count, setCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [shake, setShake] = useState(false);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  const game = ARCADE_GAMES[sel];

  // Start: open a game from the link, skip the boot screen if seen this visit, or boot up
  useEffect(() => {
    const m = store('local', MUTED_KEY) === '1';
    setMuted(m);
    setArcadeMuted(m);
    const i = ARCADE_GAMES.findIndex((g) => g.key === startGame);
    if (i >= 0 && ready[i]) { setSel(i); setPhase(reduce ? 'play' : 'launch'); return; }
    setPhase(store('session', BOOTED_KEY) ? 'select' : 'boot');
    // run once on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    setArcadeMuted(m);
    store('local', MUTED_KEY, m ? '1' : '0');
  };

  const insertCoin = useCallback(() => {
    setArcadeMuted(muted);
    sfx.coin();
    store('session', BOOTED_KEY, '1');
    setPhase('select');
  }, [muted]);

  const move = useCallback((d: number) => {
    setSel((s) => {
      const n = Math.min(ARCADE_GAMES.length - 1, Math.max(0, s + d));
      if (n !== s) sfx.move();
      return n;
    });
  }, []);

  const play = useCallback((i: number) => {
    if (!ready[i]) {
      sfx.nope();
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    setSel(i);
    try { window.history.pushState(null, '', `/arcade?game=${ARCADE_GAMES[i].key}`); } catch { /* ignore */ }
    if (reduce) { setPhase('play'); return; }
    sfx.launch();
    setPhase('launch');
  }, [ready, reduce]);

  const exit = useCallback(() => {
    sfx.back();
    try { window.history.replaceState(null, '', '/arcade'); } catch { /* ignore */ }
    setPhase('select');
  }, []);

  // Switch to the next or previous working game while playing
  const hop = (d: number) => {
    let i = sel;
    for (let k = 0; k < ARCADE_GAMES.length; k++) {
      i = (i + d + ARCADE_GAMES.length) % ARCADE_GAMES.length;
      if (ready[i]) break;
    }
    if (i === sel) return;
    sfx.move();
    setSel(i);
    try { window.history.replaceState(null, '', `/arcade?game=${ARCADE_GAMES[i].key}`); } catch { /* ignore */ }
  };

  // 3-2-1-GO, then play
  useEffect(() => {
    if (phase !== 'launch') return;
    setCount(0);
    const timers: number[] = [];
    COUNTDOWN.forEach((_, i) => timers.push(window.setTimeout(() => { setCount(i); if (i < 3) sfx.count(); else sfx.go(); }, 520 + i * 430)));
    timers.push(window.setTimeout(() => setPhase('play'), 520 + COUNTDOWN.length * 430));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // Keyboard: ← → to choose, Enter to play, Esc to leave a game
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('.modal-back')) return; // join / access popup is open
      if (phase === 'boot' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); insertCoin(); }
      else if (phase === 'select') {
        if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); play(sel); }
      } else if (phase === 'play' && e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, sel, insertCoin, move, play, exit]);

  // Phone back button leaves the game, back to the cabinets
  useEffect(() => {
    const onPop = () => {
      const key = new URLSearchParams(window.location.search).get('game');
      const i = ARCADE_GAMES.findIndex((g) => g.key === key);
      if (i >= 0 && ready[i]) { setSel(i); setPhase('play'); }
      else setPhase((p) => (p === 'play' || p === 'launch' ? 'select' : p));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [ready]);

  // Level up: celebrate when points push you into a new level (not when you log in)
  const who = me ? me.id : 'guest';
  const base = useRef<{ who: string; level: number } | null>(null);
  useEffect(() => {
    const lv = levelFor(points).level;
    const b = base.current;
    base.current = { who, level: lv };
    if (!b || b.who !== who || lv <= b.level) return;
    setLevelUp(lv);
    sfx.levelUp();
  }, [points, who]);

  const closeLevelUp = useCallback(() => setLevelUp(null), []);

  // Swipe between cabinets on phones
  const swipe = useRef<number | null>(null);

  return (
    <section className={`arc-room arc-${phase}`} aria-label="NextGen Arcade">
      <div className="arc-sky" aria-hidden="true"><i /><i /><i /></div>
      <div className="arc-floor" aria-hidden="true" />
      <div className="arc-scan" aria-hidden="true" />

      <div className="wrap arc-in">
        <header className="arc-top">
          <div>
            <p className="arc-kicker">{edition.month} edition · {ready.filter(Boolean).length} games</p>
            <h1 className="arc-title" data-text="NEXTGEN ARCADE">NEXTGEN ARCADE</h1>
          </div>
          <button type="button" className="arc-mute" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </header>

        <AnimatePresence mode="wait">
          {phase === 'boot' && (
            <motion.div key="boot" className="arc-boot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.08, filter: 'blur(6px)' }} transition={{ duration: 0.35 }}>
              <div className="arc-crt">
                <div className="arc-crt-on">
                  <p className="arc-boot-line">PLAYER 1 · READY</p>
                  <div className="arc-boot-logo">PRESS START</div>
                  <p className="arc-credits">CREDITS <b>{fmt(points)}</b></p>
                  <button type="button" className="arc-coin" onClick={insertCoin}>
                    <span className="arc-coin-disc" aria-hidden="true">₦</span> Insert coin
                  </button>
                  <p className="arc-boot-tip">Tap the button or press Enter</p>
                </div>
              </div>
            </motion.div>
          )}

          {(phase === 'select' || phase === 'launch') && (
            <motion.div key="select" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <div
                className={`arc-stage${shake ? ' shake' : ''}`}
                onPointerDown={(e) => { swipe.current = e.clientX; }}
                onPointerUp={(e) => {
                  if (swipe.current === null) return;
                  const dx = e.clientX - swipe.current;
                  swipe.current = null;
                  if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
                }}
              >
                {ARCADE_GAMES.map((g, i) => (
                  <Cabinet key={g.key} game={g} offset={i - sel} ok={ready[i]} onClick={() => { if (i === sel) play(i); else { sfx.move(); setSel(i); } }} />
                ))}
              </div>

              <div className="arc-pick">
                <button type="button" className="arc-arrow" onClick={() => move(-1)} disabled={sel === 0} aria-label="Previous game">◀</button>
                <div className="arc-pick-info" style={{ '--c': game.color } as CSSProperties}>
                  <AnimatePresence mode="wait">
                    <motion.div key={game.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                      <b>{game.title}</b>
                      <span>{ready[sel] ? game.blurb : 'Not in this edition yet. Check back soon!'}</span>
                    </motion.div>
                  </AnimatePresence>
                  <button type="button" className="arc-play" onClick={() => play(sel)} disabled={!ready[sel]}>
                    ▶ Play <small>{game.reward}</small>
                  </button>
                </div>
                <button type="button" className="arc-arrow" onClick={() => move(1)} disabled={sel === ARCADE_GAMES.length - 1} aria-label="Next game">▶</button>
              </div>
              <div className="arc-dots" aria-hidden="true">
                {ARCADE_GAMES.map((g, i) => <i key={g.key} className={i === sel ? 'on' : ''} style={{ '--c': g.color } as CSSProperties} />)}
              </div>
            </motion.div>
          )}

          {phase === 'play' && (
            <motion.div
              key="play"
              className="arc-screen"
              style={{ '--c': game.color } as CSSProperties}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotateX: 18 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 170, damping: 22 }}
            >
              <div className="arc-screen-bar">
                <button type="button" className="arc-back" onClick={exit}>◀ Arcade <small>Esc</small></button>
                <div className="arc-screen-title"><span aria-hidden="true">{game.emoji}</span> {game.title}</div>
                <div className="arc-hop">
                  <button type="button" onClick={() => hop(-1)} aria-label="Previous game">⏮</button>
                  <button type="button" onClick={() => hop(1)} aria-label="Next game">⏭</button>
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={game.key} className="arc-game" initial={{ opacity: 0, filter: 'brightness(3) blur(4px)' }} animate={{ opacity: 1, filter: 'brightness(1) blur(0px)' }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <GameLock>{renderGame(game.key, edition, debate)}</GameLock>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {phase !== 'boot' && phase !== 'loading' && <PlayerCard />}
      </div>

      {/* Launch: the cabinet screen fills the page, then 3-2-1-GO */}
      <AnimatePresence>
        {phase === 'launch' && (
          <motion.div
            className="arc-launch"
            style={{ '--c': game.color } as CSSProperties}
            initial={{ clipPath: 'inset(42% 38% 42% 38% round 24px)', opacity: 0.4 }}
            animate={{ clipPath: 'inset(0% 0% 0% 0% round 0px)', opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.7, 0, 0.2, 1] }}
            aria-live="assertive"
          >
            <div className="arc-launch-emoji" aria-hidden="true">{game.emoji}</div>
            <p className="arc-launch-name">{game.title}</p>
            <AnimatePresence mode="popLayout">
              <motion.div key={count} className={`arc-count${count === 3 ? ' go' : ''}`} initial={{ scale: 2.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
                {COUNTDOWN[count]}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{levelUp && <LevelUp level={levelUp} onDone={closeLevelUp} />}</AnimatePresence>
    </section>
  );
}

function renderGame(key: ArcadeKey, edition: Edition, debate: Debate | null): ReactNode {
  switch (key) {
    case 'money': return <MoneyGame money={edition.money} edition={edition.slug} />;
    case 'quiz': return <QuizGame slug={edition.slug} questions={edition.quiz} />;
    case 'debate': return debate ? <DebateVote debate={debate} /> : null;
    case 'sort': return <SortGame cards={edition.sort ?? []} edition={edition.slug} />;
    case 'promise': return <PromiseChecker questions={edition.promiseQuestions ?? []} edition={edition.slug} />;
    case 'wordsearch': return <WordSearchGame data={edition.wordSearch} edition={edition.slug} />;
    default: return null;
  }
}

// One neon cabinet. offset = how far it is from the middle one.
function Cabinet({ game, offset, ok, onClick }: { game: ArcadeGame; offset: number; ok: boolean; onClick: () => void }) {
  const d = Math.abs(offset);
  const on = offset === 0;
  return (
    <motion.button
      type="button"
      className={`arc-cab${on ? ' on' : ''}${ok ? '' : ' broken'}`}
      style={{ '--c': game.color, zIndex: 10 - d } as CSSProperties}
      animate={{
        x: `${offset * 72}%`,
        z: -d * 170,
        rotateY: offset * -24,
        scale: on ? 1 : 0.86 - Math.min(d, 3) * 0.04,
        opacity: d > 2 ? 0 : 1 - d * 0.22,
      }}
      transition={{ type: 'spring', stiffness: 210, damping: 26 }}
      onClick={onClick}
      tabIndex={on ? 0 : -1}
      aria-label={`${game.title}${ok ? '' : ' (not in this edition)'}`}
      aria-hidden={d > 2}
    >
      <span className="arc-cab-sign"><b>{game.tag}</b></span>
      <span className="arc-cab-screen">
        <span className="arc-cab-emoji" aria-hidden="true">{game.emoji}</span>
        <span className="arc-cab-name">{game.title}</span>
        <span className="arc-cab-blink">{ok ? (on ? 'Press play' : game.reward) : 'Out of order'}</span>
      </span>
      <span className="arc-cab-panel" aria-hidden="true"><i className="stick" /><i className="b1" /><i className="b2" /></span>
      <span className="arc-cab-door" aria-hidden="true"><i /><i /></span>
    </motion.button>
  );
}

// Your level, XP bar and the rank ladder
function PlayerCard() {
  const { me, points, openJoin } = usePoints();
  const lv = levelFor(points);
  return (
    <motion.aside className="arc-player" style={{ '--c': lv.rank.color } as CSSProperties} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="arc-player-main">
        <div className="arc-badge" aria-hidden="true"><span>{lv.rank.emoji}</span><b>{lv.level}</b></div>
        <div className="arc-player-text">
          <small>{me ? `@${me.handle}` : 'Guest player'} · Level {lv.level}</small>
          <strong>{lv.rank.name}</strong>
          <div className="arc-xp" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lv.pct)} aria-label="XP to next level">
            <motion.i initial={{ width: 0 }} animate={{ width: `${lv.pct}%` }} transition={{ type: 'spring', stiffness: 60, damping: 16 }} />
          </div>
          <p>
            <b>{fmt(points)} XP</b>
            {lv.next ? <> · {fmt(lv.toNext)} to {lv.next.emoji} {lv.next.name}</> : <> · Top level. Legend!</>}
          </p>
        </div>
        {!me && <button type="button" className="arc-join" onClick={() => openJoin('Join free to save your XP and level up.')}>Join to save XP</button>}
      </div>
      <ol className="arc-ladder">
        {RANKS.map((r) => (
          <li key={r.level} className={r.level <= lv.level ? 'got' : ''} style={{ '--c': r.color } as CSSProperties} title={`${r.name}: ${fmt(r.min)} XP`}>
            <span aria-hidden="true">{r.emoji}</span>
            <small>{r.name}</small>
          </li>
        ))}
      </ol>
    </motion.aside>
  );
}

// The LEVEL UP celebration
function LevelUp({ level, onDone }: { level: number; onDone: () => void }) {
  const rank = RANKS[level - 1] ?? RANKS[RANKS.length - 1];
  useEffect(() => {
    const t = window.setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    x: Math.cos((i / 36) * Math.PI * 2) * (40 + (i % 5) * 9),
    y: Math.sin((i / 36) * Math.PI * 2) * (34 + (i % 4) * 10),
    c: ['#FFD400', '#E0457B', '#2F7DE1', '#2FA36B', '#8B6CFF'][i % 5],
    r: (i * 47) % 360,
  })), []);
  return (
    <motion.div className="arc-levelup" style={{ '--c': rank.color } as CSSProperties} onClick={onDone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status">
      <div className="arc-levelup-bits" aria-hidden="true">
        {bits.map((b, i) => (
          <motion.i key={i} style={{ background: b.c }} initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }} animate={{ x: `${b.x}vw`, y: `${b.y}vh`, rotate: b.r + 540, opacity: 0 }} transition={{ duration: 1.8, ease: 'easeOut' }} />
        ))}
      </div>
      <motion.div className="arc-levelup-card" initial={{ scale: 0.3, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
        <p>LEVEL UP!</p>
        <div className="arc-levelup-emoji" aria-hidden="true">{rank.emoji}</div>
        <strong>Level {rank.level} · {rank.name}</strong>
        <small>Tap to keep playing</small>
      </motion.div>
    </motion.div>
  );
}
