'use client';

/*
 * The 7 levels of NextGen World. Each one plays a game from the edition and
 * calls onDone(stars, { line }) at the end. Points come from the same server
 * routes as before (games/complete, quiz check, debate vote); the Boss uses
 * /user_world/:slug/boss.
 */
import { useEffect, useRef, useState } from 'react';
import type { Debate, Edition } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { worldApi, type BossQuestion } from '@/lib/worldApi';
import { fmt, usePoints } from '../PointsProvider';
import { SND } from './engine/sound';
import { PROMISE_CARDS } from './worldLevels';

export type LevelDone = (stars: number, info: { line: string }) => void;
interface GameProps { edition: Edition; debate: Debate | null; onDone: LevelDone }

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const later = (fn: () => void, ms: number, list: number[]) => { list.push(window.setTimeout(fn, ms)); };
function useTimers(){ const t = useRef<number[]>([]); useEffect(() => () => t.current.forEach(clearTimeout), []); return t.current; }
const Prog = ({ n, i }: { n: number; i: number }) => <div className="wg-prog">{Array.from({ length: n }, (_, k) => <i key={k} className={k < i ? 'on' : ''} />)}</div>;

// ---------- 1. Money ----------
export function MoneyLevel({ edition, onDone }: GameProps){
  const M = edition.money;
  const { completeGame } = usePoints();
  const timers = useTimers();
  const [bal, setBal] = useState(M.start), [jar, setJar] = useState(0), [buys, setBuys] = useState<number[]>([]);
  const [msg, setMsg] = useState('Tip: SAVE → PLAN → SPEND. In that order.'), [over, setOver] = useState(false);
  const save = () => { SND.coin(); setBal((b) => b - M.save); setJar(M.save); setMsg('🐷 Nice. Saved first. Now plan the rest.'); };
  const buy = (k: number) => {
    const it = M.items[k], nb = bal - it.price, nbuys = [...buys, k];
    SND.buy(); setBal(nb); setBuys(nbuys);
    setMsg(`${it.label} on ${DAYS[nbuys.length - 1]}. Spent so far: ₦${fmt(M.start - nb - jar)}`);
    const broke = nb < 1000 && nbuys.length < 5;
    if (nbuys.length >= 5 || broke){
      setOver(true);
      const stars = broke ? (jar ? 1 : 0) : jar ? (nb >= 1000 ? 3 : 2) : 1;
      if (stars) completeGame('money', edition.slug, 40, 'Money Mover');
      later(() => onDone(stars, { line: broke ? `"Mummy…" 😭 Almost broke by ${DAYS[nbuys.length - 1]}.${jar ? ' Good thing you saved first!' : ' Your money went in tiny pieces.'}` : `You made it to Friday with ₦${fmt(nb)} left${jar ? ` and ₦${fmt(jar)} saved` : ', but nothing saved'}.` }), 900, timers);
    }
  };
  return (
    <div>
      <p className="wg-q">You have ₦{fmt(M.start)} for the week. Tap what you buy, one thing a day. Can you make it to Friday with money left?</p>
      <div className="wg-money">
        <div className="wg-box"><small>ACCOUNT BALANCE</small><b className={`wg-bal${bal <= 2000 ? ' low' : ''}`}>₦{fmt(bal)}</b>
          <div className="wg-days">{['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d, k) => <span key={d} className={k < buys.length ? 'on' : ''}>{d}</span>)}</div></div>
        <div className="wg-box wg-jar"><span aria-hidden="true">🐷</span><div><small>SAVINGS JAR</small><b>₦{fmt(jar)}</b>
          <button type="button" className="wg-yel sm" onClick={save} disabled={over || jar > 0 || buys.length > 0 || bal < M.save}>Save ₦{fmt(M.save)} first</button></div></div>
      </div>
      <div className="wg-buys">{M.items.map((it, k) => (
        <button type="button" key={it.label} className={`wg-buy${buys.includes(k) ? ' bought' : ''}`} onClick={() => buy(k)} disabled={over || it.price > bal}>{it.label}<span>-₦{fmt(it.price)}</span></button>
      ))}</div>
      <div className="wg-msg" role="status">{msg}</div>
    </div>
  );
}

// ---------- 2. Quiz (the server checks every answer) ----------
export function QuizLevel({ edition, onDone }: GameProps){
  const qs = edition.quiz ?? [];
  const { me, award, noAccess } = usePoints();
  const timers = useTimers();
  const [qi, setQi] = useState(0), [picked, setPicked] = useState<number | null>(null), [answer, setAnswer] = useState<number | null>(null);
  const [right, setRight] = useState(0), [note, setNote] = useState('');
  const q = qs[qi];
  if (!q) return <p className="wg-q">No quiz in this edition yet.</p>;
  const choose = async (i: number) => {
    if (picked !== null) return; setPicked(i); setNote('');
    try {
      const res = await api.checkQuiz(edition.slug, q.id, i);
      setAnswer(res.answer);
      const r = right + (res.correct ? 1 : 0); setRight(r);
      if (res.correct){ SND.right(); setNote('✅ Correct!');
        if (me && res.locked) noAccess(); else if (me && res.awarded) award(res.awarded, 'Correct', await api.me()); else if (!me) award(10, 'Correct');
      } else { SND.wrong(); setNote('❌ Not this time.'); }
      later(() => {
        if (qi + 1 < qs.length){ setQi(qi + 1); setPicked(null); setAnswer(null); setNote(''); }
        else onDone(Math.min(3, r === qs.length ? 3 : r), { line: `You got ${r} of ${qs.length} right.` });
      }, 1100, timers);
    } catch { setPicked(null); setNote("Couldn't check that one. Check your connection."); }
  };
  return (
    <div>
      <Prog n={qs.length} i={qi} />
      <p className="wg-q">{q.question}</p>
      {q.options.map((o, i) => {
        const cls = answer === null ? '' : i === answer ? ' right' : i === picked ? ' wrong' : '';
        return <button type="button" key={o} className={`wg-opt${cls}`} onClick={() => choose(i)} disabled={picked !== null}><span className="k">{'ABCD'[i]}</span>{o}</button>;
      })}
      <div className="wg-msg" role="status">{note}</div>
    </div>
  );
}

// ---------- 3. Debate ----------
export function DebateLevel({ debate, onDone }: GameProps){
  const { me, award, openJoin, noAccess } = usePoints();
  const [d, setD] = useState(debate), [side, setSide] = useState<'A' | 'B' | null>(debate?.mySide ?? null), [note, setNote] = useState('');
  if (!d) return <p className="wg-q">No debate this week. Check back soon!</p>;
  const offline = d.id.startsWith('offline');
  const total = d.votesA + d.votesB, pa = total ? Math.round(d.votesA / total * 100) : 50;
  const vote = async (s: 'A' | 'B') => {
    if (side) return;
    if (!offline && !me) return openJoin('Join to vote. One vote per student keeps it fair.');
    SND.vote();
    if (offline){ setSide(s); setD({ ...d, votesA: d.votesA + (s === 'A' ? 1 : 0), votesB: d.votesB + (s === 'B' ? 1 : 0) }); award(20, 'Voice heard'); return; }
    try {
      const res = await api.vote(d.id, s); setSide(s); setD(res.debate);
      if (res.locked) noAccess(); else award(res.awarded, 'Voice heard', await api.me());
    } catch (err){
      if (err instanceof ApiError && err.status === 409){ setSide(s); setNote('You already voted on this one.'); } else setNote("Couldn't send your vote. Try again.");
    }
  };
  const reasons = side === 'A' ? ['Plans show they are serious', 'I want to know the cost', 'Promises are easy to break'] : ['Big dreams inspire people', 'Details can come later', 'We need bold ideas'];
  return (
    <div>
      <p className="wg-q">{d.question}</p>
      <div className="wg-teams">
        <button type="button" className={`wg-team a${side === 'A' ? ' pick' : ''}`} onClick={() => vote('A')}><b>{d.teamA.label}</b>{d.teamA.pitch}</button>
        <button type="button" className={`wg-team b${side === 'B' ? ' pick' : ''}`} onClick={() => vote('B')}><b>{d.teamB.label}</b>{d.teamB.pitch}</button>
      </div>
      <div className="wg-split"><div className="a" style={{ width: `${pa}%` }}>A {pa}%</div><div className="b">{100 - pa}% B</div></div>
      <div className="wg-msg" role="status">{note || (side ? `🗳️ You're on Team ${side}. ${fmt(total)} students have voted.` : 'Tap a team to vote.')}</div>
      {side && (
        <div><p className="wg-q" style={{ marginTop: 16 }}>Why? Pick your reason for 3 stars</p>
          <div className="wg-chips">{reasons.map((r) => <button type="button" key={r} className="wg-chip" onClick={() => onDone(3, { line: `You voted Team ${side}: "${r}".` })}>{r}</button>)}
            <button type="button" className="wg-chip" onClick={() => onDone(2, { line: `You voted Team ${side}.` })}>Skip</button></div></div>
      )}
    </div>
  );
}

// ---------- 4 + 5. Two-button sorting (AI prompts, and promise or plan) ----------
function SortCards({ cards, left, right, onEnd }: { cards: { text: string; answer: string; why?: string }[]; left: [string, string]; right: [string, string]; onEnd: (right: number) => void }){
  const timers = useTimers();
  const [i, setI] = useState(0), [score, setScore] = useState(0), [fly, setFly] = useState(''), [note, setNote] = useState('');
  const c = cards[i];
  const pick = (v: string) => {
    if (fly || !c) return;
    const ok = v === c.answer, s = score + (ok ? 1 : 0);
    SND.swipe(); setTimeout(ok ? SND.right : SND.wrong, 120);
    setNote(`${ok ? '✅' : '❌'} ${c.why ?? (ok ? 'Correct!' : 'Not this one.')}`); setFly(v === left[0] ? 'l' : 'r'); setScore(s);
    later(() => { setFly(''); if (i + 1 < cards.length) setI(i + 1); else onEnd(s); }, c.why ? 1400 : 700, timers);
  };
  if (!c) return null;
  return (
    <div>
      <Prog n={cards.length} i={i} />
      <div className={`wg-card ${fly}`}>{c.text}</div>
      <div className="wg-sbtns">
        <button type="button" className="no" onClick={() => pick(left[0])}>{left[1]}</button>
        <button type="button" className="yes" onClick={() => pick(right[0])}>{right[1]}</button>
      </div>
      <div className="wg-msg" role="status">{note}</div>
    </div>
  );
}
const starsFor = (r: number, n: number) => (r >= n ? 3 : r >= n - 1 ? 2 : r >= n - 2 ? 1 : 0);

export function SortLevel({ edition, onDone }: GameProps){
  const { completeGame } = usePoints();
  const cards = (edition.sort ?? []).map((s) => ({ text: s.text, answer: s.answer }));
  if (!cards.length) return <p className="wg-q">No prompts in this edition yet.</p>;
  return (
    <div><p className="wg-q">Is this AI prompt a Cheat Code (skips the learning) or a Study Buddy (helps you learn)?</p>
      <SortCards cards={cards} left={['cheat', '🚫 Cheat Code']} right={['buddy', '🤝 Study Buddy']} onEnd={(r) => {
        const st = starsFor(r, cards.length); if (st) completeGame('sort', edition.slug, 25, 'AI Smart');
        onDone(st, { line: `You sorted ${r} of ${cards.length} prompts right.` });
      }} /></div>
  );
}

export function PromiseLevel({ edition, onDone }: GameProps){
  const { completeGame } = usePoints();
  return (
    <div><p className="wg-q">Just a promise, or a real plan?</p>
      <SortCards cards={PROMISE_CARDS.map((p) => ({ text: p.text, answer: p.answer, why: p.why }))} left={['promise', '📢 Just a promise']} right={['plan', '📋 Real plan']} onEnd={(r) => {
        const st = starsFor(r, PROMISE_CARDS.length); if (st) completeGame('promise', edition.slug, 20, 'Promise Checker');
        onDone(st, { line: `You spotted ${r} of ${PROMISE_CARDS.length}. A plan answers: what, how, how much, when.` });
      }} /></div>
  );
}

// ---------- 6. Word search ----------
export function WordsLevel({ edition, onDone }: GameProps){
  const W = edition.wordSearch;
  const { completeGame } = usePoints();
  const [hits, setHits] = useState<string[]>([]), [got, setGot] = useState<Set<string>>(new Set()), [found, setFound] = useState<Set<string>>(new Set()), [sec, setSec] = useState(0);
  const done = useRef(false);
  useEffect(() => { const t = window.setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t); }, []);
  if (!W?.grid?.length) return <p className="wg-q">No word search in this edition yet.</p>;
  const sorted = (s: string) => [...s].sort().join('');
  const end = (f: Set<string>) => {
    if (done.current) return; done.current = true;
    const st = f.size === W.words.length ? (sec <= 90 ? 3 : 2) : f.size >= 5 ? 1 : 0;
    if (st) completeGame('wordsearch', edition.slug, 30, 'Democracy Detective');
    onDone(st, { line: `You found ${f.size} of ${W.words.length} words in ${sec}s.` });
  };
  const tap = (k: string) => {
    if (got.has(k)) return;
    const next = hits.includes(k) ? hits.filter((x) => x !== k) : [...hits, k]; SND.letter(next.length);
    const word = next.map((x) => { const [r, c] = x.split(',').map(Number); return W.grid[r][c]; }).join('');
    const match = W.words.find((w) => !found.has(w) && w.length === next.length && sorted(w) === sorted(word));
    if (match){
      SND.found(); const g = new Set(got); next.forEach((x) => g.add(x)); const f = new Set(found); f.add(match);
      setGot(g); setFound(f); setHits([]); if (f.size === W.words.length) setTimeout(() => end(f), 500);
    } else setHits(next.length > 9 ? [] : next);
  };
  return (
    <div>
      <div className="wg-timer"><span>Tap the letters of each word, in order</span><b>{sec}s</b></div>
      <div className="wg-ws">{W.grid.map((row, r) => [...row].map((ch, c) => { const k = `${r},${c}`; return <button type="button" key={k} className={got.has(k) ? 'got' : hits.includes(k) ? 'hit' : ''} onClick={() => tap(k)}>{ch}</button>; }))}</div>
      <div className="wg-wl">{W.words.map((w) => <span key={w} className={found.has(w) ? 'got' : ''}>{w}</span>)}</div>
      <div className="wg-btns"><button type="button" className="wg-ghost" onClick={() => end(found)}>I&apos;m done</button></div>
    </div>
  );
}

// ---------- 7. The Boss ----------
export function BossLevel({ edition, onDone, onServer }: GameProps & { onServer: (r: Awaited<ReturnType<typeof worldApi.checkBoss>>) => void }){
  const { me, award, noAccess } = usePoints();
  const timers = useTimers();
  const [qs, setQs] = useState<BossQuestion[] | null>(null), [err, setErr] = useState('');
  const [started, setStarted] = useState(false), [qi, setQi] = useState(0), [picked, setPicked] = useState<number | null>(null), [answer, setAnswer] = useState<number | null>(null);
  const [left, setLeft] = useState(100), [hits, setHits] = useState(0), [hitAnim, setHitAnim] = useState(0), [note, setNote] = useState('');
  const answers = useRef<{ id: string; choice: number }[]>([]);
  const lastSec = useRef(99);
  useEffect(() => { worldApi.boss(edition.slug).then(setQs).catch(() => setErr("Couldn't load the Boss. Check your connection.")); }, [edition.slug]);
  const q = qs?.[qi];
  const pick = async (i: number) => {
    if (!q || picked !== null) return; setPicked(i);
    answers.current.push({ id: q.id, choice: i });
    const last = qi + 1 >= (qs?.length ?? 0);
    try {
      const r = await worldApi.checkBoss(edition.slug, answers.current, last);
      const mine = r.results.find((x) => x.id === q.id);
      setAnswer(mine?.answer ?? null);
      if (mine?.correct){ SND.hit(); setHits((h) => h + 1); setHitAnim(Date.now()); setNote('💥 Hit! The Boss is losing HP.'); } else { SND.wrong(); setNote(i < 0 ? '⏰ Too slow!' : '❌ Missed!'); }
      if (last){
        onServer(r);
        if (r.user){ if (r.locked) noAccess(); else award(r.awarded, 'Boss beaten', r.user); } else if (!me && r.stars) award(100, 'Boss beaten');
        later(() => onDone(r.stars, { line: r.stars ? `You beat the Boss with ${r.right} of ${r.total} hits!` : `The Boss survived. You got ${r.right} of ${r.total}. You need 3 hits to win.` }), 1200, timers);
      } else later(() => { setQi(qi + 1); setPicked(null); setAnswer(null); setNote(''); setLeft(100); lastSec.current = 99; }, 1100, timers);
    } catch { setErr("Couldn't reach the Boss. Check your connection."); }
  };
  // 12 seconds per question
  useEffect(() => {
    if (!started || picked !== null) return;
    const t = window.setInterval(() => setLeft((l) => {
      const n = l - 100 / 120; const s = Math.ceil(n * .12);
      if (s <= 4 && s !== lastSec.current){ lastSec.current = s; SND.tick(); }
      return n;
    }), 100);
    return () => clearInterval(t);
  }, [started, picked, qi]);
  useEffect(() => { if (started && left <= 0 && picked === null) pick(-1); });
  if (err) return <p className="wg-q">{err}</p>;
  if (!qs) return <p className="wg-q">Loading the Boss…</p>;
  if (!qs.length) return <p className="wg-q">This edition has no Boss questions yet.</p>;
  if (!started) return (
    <div className="wg-res"><div className="wg-boss-face" aria-hidden="true">👑</div><h3>Boss fight!</h3><p>{qs.length} questions from this edition. 12 seconds each. Every right answer hits the Boss.</p>
      <div className="wg-btns"><button type="button" className="wg-yel" onClick={() => { SND.hit(); setStarted(true); }}>Fight ▶</button></div></div>
  );
  return (
    <div>
      <div className="wg-boss"><div key={hitAnim} className={`wg-boss-face${hitAnim ? ' hit' : ''}`} aria-hidden="true">👑</div>
        <div className="wg-hp"><i style={{ width: `${Math.max(0, 100 - hits * (100 / qs.length))}%` }} /></div><small>BOSS HP</small></div>
      <div className="wg-tbar"><i style={{ width: `${Math.max(0, left)}%` }} /></div>
      <Prog n={qs.length} i={qi} />
      <p className="wg-q">{q?.question}</p>
      {q?.options.map((o, i) => {
        const cls = answer === null ? '' : i === answer ? ' right' : i === picked ? ' wrong' : '';
        return <button type="button" key={o} className={`wg-opt${cls}`} onClick={() => pick(i)} disabled={picked !== null}><span className="k">{'ABCD'[i]}</span>{o}</button>;
      })}
      <div className="wg-msg" role="status">{note}</div>
    </div>
  );
}
