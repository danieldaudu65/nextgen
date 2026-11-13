'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, animate, motion, useInView } from 'framer-motion';
import type { Leaderboard, LeaderRow } from '@/lib/types';
import { fmt, usePoints } from './PointsProvider';

/*
 * Three leaderboards on a 3D carousel:
 *   Top Readers  → points from reading + story questions
 *   Top Players  → every point (games, quizzes, debates, streaks too)
 *   Top Schools  → all points of each school's students
 * The range (this volume / this edition / week / all time) is set in Admin → Settings.
 * Swipe or tap the tabs; it turns by itself every few seconds until you touch it.
 */

type BoardKey = 'readers' | 'players' | 'schools';
const BOARDS: { key: BoardKey; title: string; icon: string; blurb: string }[] = [
  { key: 'readers', title: 'Top Readers', icon: '📖', blurb: 'Reading + quick-check points' },
  { key: 'players', title: 'Top Players', icon: '🎮', blurb: 'Every point: reading, games, quizzes, debates' },
  { key: 'schools', title: 'Top Schools', icon: '🏫', blurb: 'All points of each school’s students' },
];

const short = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : fmt(n));

function CountUp({ value, run }: { value: number; run: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    const c = animate(0, value, { duration: 1.1, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [value, run]);
  return <>{short(run ? n : value)}</>;
}

export default function LeaderboardSection({ data }: { data: Leaderboard }) {
  const { me, points, openJoin } = usePoints();
  // all three boards unless one is switched off in Admin → Settings
  const boards = useMemo(() => BOARDS.filter((b) => data.boards?.[b.key] ?? true), [data]);
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const [wide, setWide] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.3 });

  useEffect(() => {
    const on = () => setWide(innerWidth > 900);
    on();
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);

  // turn by itself while on screen, until someone touches it
  useEffect(() => {
    if (touched || !inView || !wide || boards.length < 2) return;
    const t = setInterval(() => setActive((a) => (a + 1) % boards.length), 6500);
    return () => clearInterval(t);
  }, [touched, inView, boards.length]);

  const go = (i: number) => { setTouched(true); setActive(((i % boards.length) + boards.length) % boards.length); };
  const rowsFor = (k: BoardKey): LeaderRow[] => (k === 'readers' ? data.readers : k === 'players' ? data.players ?? [] : data.schools) ?? [];
  const label = data.label ?? (data.period === 'week' ? 'This week' : 'All time');

  return (
    <section className="sec lb3d-sec" id="leaders" ref={ref}>
      <div className="lb3d-orbs" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.i key={i} animate={{ x: [0, 40 - i * 30, 0], y: [0, -30 + i * 20, 0], scale: [1, 1.15, 1] }} transition={{ duration: 9 + i * 3, repeat: Infinity, ease: 'easeInOut' }} />
        ))}
      </div>
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="tagbar">{label.toUpperCase()}</span>
            <h2 className="display">Leaderboard.</h2>
          </div>
          <p className="sub">Read, answer, play. Every point you earn also counts for your school.</p>
        </div>

        {/* Phones: the earlier simple design, boards stacked in a column (no 3D) */}
        <div className="lb-mobile">
          {boards.map((b) => {
            const rows = rowsFor(b.key).slice(0, 5);
            const school = b.key === 'schools';
            return (
              <div className="lb" key={b.key}>
                <h3>{b.icon} {b.title}</h3>
                <p className="lb-blurb">{b.blurb}</p>
                <ol>
                  {rows.length === 0 && <li className="lb-none">No points yet. Be the first! 🚀</li>}
                  {rows.map((r) => (
                    <li key={r.id ?? r.name}>
                      <span className="r">{r.rank}</span>
                      {school ? <span className="av sch">🏫</span> : <span className="av" style={{ background: r.color ?? '#ddd' }} />}
                      <span className="nm">{r.name}{school ? r.active ? <small className="lb-sub">{r.active} active · {fmt(r.perStudent ?? 0)} avg</small> : null : r.school ? <small className="lb-sub">{r.school}</small> : null}</span>
                      <span className="p">{short(r.points)}</span>
                    </li>
                  ))}
                  {!school && (me
                    ? <li className="me"><span className="r">{me.rank}</span><span className="av" style={{ background: me.color ?? '#fff' }} /><span className="nm">You</span><span className="p">{fmt(points)}</span></li>
                    : <li className="me"><span className="r">?</span><span className="nm">Where do you rank?</span><button className="btn sm white" onClick={() => openJoin()}>Join free</button></li>)}
                  {school && me?.school && <li className="me"><span className="r">{me.school.rank ?? '–'}</span><span className="nm">🏫 {me.school.name}</span><span className="p">your school</span></li>}
                </ol>
              </div>
            );
          })}
        </div>

        {/* Desktop: the 3D carousel */}
        <div className="lb-desktop">
        <div className="lb3d-tabs" role="tablist">
          {boards.map((b, i) => (
            <button key={b.key} role="tab" aria-selected={i === active} className={i === active ? 'on' : ''} onClick={() => go(i)}>
              {i === active && <motion.span layoutId="lb3d-pill" className="pill" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
              <span className="lbl">{b.icon} {b.title}</span>
            </button>
          ))}
        </div>

        <motion.div
          className="lb3d-stage"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 60) go(active + (info.offset.x < 0 ? 1 : -1)); }}
        >
          {boards.map((b, i) => {
            let off = i - active;
            if (off > boards.length / 2) off -= boards.length;
            if (off < -boards.length / 2) off += boards.length;
            const isActive = off === 0;
            const pose = isActive
              ? { x: '0%', rotateY: 0, scale: 1, opacity: 1, z: 0 }
              : { x: `${off * 64}%`, rotateY: off * -34, scale: 0.8, opacity: 0.6, z: -160 };
            return (
              <motion.div
                key={b.key}
                className={`lb3d-card${isActive ? ' is-active' : ''}`}
                animate={pose}
                transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                style={{ zIndex: 10 - Math.abs(off) }}
                // tap a side board to bring it to the middle (a drag/swipe doesn't count as a tap)
                onClick={() => { if (!isActive) go(i); }}
                role={isActive ? undefined : 'button'}
                tabIndex={isActive ? -1 : 0}
                aria-label={isActive ? undefined : `Show ${b.title}`}
                onKeyDown={(e) => { if (!isActive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(i); } }}
              >
                {!isActive && <span className={`lb3d-peek ${off > 0 ? 'r' : 'l'}`} aria-hidden="true">{b.icon} <b>{b.title}</b> · Tap to view</span>}
                <Board board={b} rows={rowsFor(b.key)} run={isActive && inView} />
                {isActive && b.key !== 'schools' && (
                  me ? (
                    <div className="lb3d-me"><span className="r">#{me.rank}</span><span className="av" style={{ background: me.color ?? '#fff' }} />You<span className="p">{fmt(points)}</span></div>
                  ) : (
                    <div className="lb3d-me"><span className="r">?</span>Where do you rank?<button className="btn sm yellow" onClick={(e) => { e.stopPropagation(); openJoin(); }}>Join free</button></div>
                  )
                )}
                {isActive && b.key === 'schools' && (
                  me?.school
                    ? <div className="lb3d-me"><span className="r">#{me.school.rank ?? '–'}</span>🏫 {me.school.name}<span className="p">your school</span></div>
                    : <div className="lb3d-me">Is your school here?<Link className="btn sm yellow" href="/school/login" onClick={(e) => e.stopPropagation()}>Add your school</Link></div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        <div className="lb3d-dots" aria-hidden="true">
          {boards.map((b, i) => <button key={b.key} className={i === active ? 'on' : ''} onClick={() => go(i)} tabIndex={-1} />)}
        </div>
        </div>
      </div>
    </section>
  );
}

function Board({ board, rows, run }: { board: (typeof BOARDS)[number]; rows: LeaderRow[]; run: boolean }) {
  const podium = [rows[1], rows[0], rows[2]]; // 2nd, 1st, 3rd
  const heights = [96, 136, 72];
  const rest = rows.slice(3);
  const school = board.key === 'schools';

  return (
    <div className="lb3d-board">
      <div className="lb3d-head">
        <span className="ico" aria-hidden="true">{board.icon}</span>
        <div><h3>{board.title}</h3><p>{board.blurb}</p></div>
      </div>

      {rows.length === 0 ? (
        <div className="lb3d-empty">No points yet in this range. Be the first! 🚀</div>
      ) : (
        <>
          <div className="lb3d-podium">
            {podium.map((r, i) => (
              <div key={i} className={`slot p${i}`}>
                {r && (
                  <>
                    <motion.div className="who" animate={run ? { y: [0, -6, 0] } : { y: 0 }} transition={{ duration: 2.4 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}>
                      <span className="ball" style={{ background: school ? '#FFFFFF' : r.color ?? '#FFD400' }}>{school ? '🏫' : r.name.replace('@', '').slice(0, 1).toUpperCase()}</span>
                      <b title={r.name}>{r.name}</b>
                      <small><CountUp value={r.points} run={run} /> pts</small>
                    </motion.div>
                    <motion.div className="block" initial={{ height: 0 }} animate={{ height: run ? heights[i] : heights[i] * 0.6 }} transition={{ type: 'spring', stiffness: 120, damping: 14, delay: run ? 0.15 * i : 0 }}>
                      <span className="face top" /><span className="face side" />
                      <span className="num">{r.rank}</span>
                    </motion.div>
                  </>
                )}
              </div>
            ))}
          </div>

          <ol className="lb3d-rows">
            <AnimatePresence>
              {rest.map((r, i) => (
                <motion.li key={r.id ?? r.name} initial={{ opacity: 0, x: 40, rotateX: -40 }} animate={{ opacity: 1, x: 0, rotateX: 0 }} transition={{ delay: run ? 0.25 + i * 0.06 : 0 }} whileHover={{ x: 6, scale: 1.015 }}>
                  <span className="r">{r.rank}</span>
                  {school ? <span className="av sch">🏫</span> : <span className="av" style={{ background: r.color ?? '#ddd' }} />}
                  <span className="nm">{r.name}{school ? r.active ? <small>{r.active} active · {fmt(r.perStudent ?? 0)} avg</small> : null : r.school ? <small>{r.school}</small> : null}</span>
                  <span className="p"><CountUp value={r.points} run={run} /></span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </>
      )}
    </div>
  );
}
