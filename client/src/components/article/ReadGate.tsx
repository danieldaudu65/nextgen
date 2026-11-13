'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import type { Me, QuestionState, StoryQuestion } from '@/lib/types';
import { useReadingTracker, type ReadResult } from '@/lib/useReadingTracker';
import { readSecondsFor, useSiteSettings } from '@/lib/useSiteSettings';
import { usePoints } from '../PointsProvider';
import AccessCard from '../AccessCard';

/*
 * The reading check on every story
 * ─────────────────────────────────
 * 1. A small timer shows how long until the reading points (Admin → Settings, default 2 min).
 * 2. Time reached → "+5 points" pop-up (guests must join / log in to claim it).
 * 3. Then the story question takes over the screen with a countdown (default 60s).
 *    Scrolling, clicking and the back button are blocked until they answer.
 * 4. Right → +5 more. Wrong / time up → they keep the reading points and get one retry later.
 */

type Phase = 'reading' | 'claim' | 'access' | 'earned' | 'question' | 'result' | 'done';
type Result = { correct: boolean; timeout?: boolean; triesLeft: number; answer: number | null; explain: string; awarded: number };

const LETTERS = ['A', 'B', 'C', 'D'];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

export default function ReadGate({ bodyRef, article, onDepth }: {
  bodyRef: RefObject<HTMLElement | null>;
  article: { slug: string; edition: string; readMins: number; hasQuestion?: boolean };
  onDepth?: (d: number) => void;
}) {
  const { me, setMe, award, openJoin } = usePoints();
  const { settings } = useSiteSettings();
  const need = readSecondsFor(settings, article.readMins);
  const rp = settings.reading;

  const [phase, setPhase] = useState<Phase>('reading');
  const [qState, setQState] = useState<QuestionState | null>(null);
  const [question, setQuestion] = useState<StoryQuestion | null>(null);
  const [left, setLeft] = useState(rp.questionSeconds);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const deadline = useRef(0);
  const reachedHere = useRef(false); // the timer finished during THIS visit (not a page revisit)


  // ---------- open the question (starts the server timer) ----------
  const openQuestion = useCallback(async () => {
    if (!article.hasQuestion) { setPhase('done'); return; }
    setBusy(true);
    try {
      const r = await api.startQuestion(article.slug);
      setQState(r.state);
      if (!r.question) { setPhase('done'); setNote(r.message ?? null); return; }
      setQuestion(r.question);
      const secs = r.state.secondsLeft ?? r.seconds ?? rp.questionSeconds;
      deadline.current = Date.now() + secs * 1000;
      setLeft(secs);
      setPicked(null);
      setResult(null);
      setPhase('question');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NO_ACCESS') setPhase('access');
      else { setNote(err instanceof ApiError ? err.message : 'Could not load the question. Check your connection.'); setPhase('done'); }
    } finally {
      setBusy(false);
    }
  }, [article.hasQuestion, article.slug, rp.questionSeconds]);

  // ---------- server replies to the reading heartbeat ----------
  const onUpdate = useCallback((r: ReadResult) => {
    const earnedPts = r.earned.reduce((n, e) => n + e.points, 0);
    award(0, undefined, r.user);
    setQState(r.question);
    if (!r.completed) return;
    if (r.locked) { setPhase('access'); return; }
    if (earnedPts > 0) {
      r.earned.forEach((e, i) => setTimeout(() => award(e.points, e.label, r.user), i * 1400));
      setPhase('earned');
      setTimeout(() => (r.question && ['ready', 'open'].includes(r.question.status) ? openQuestion() : setPhase('done')), 2300);
      return;
    }
    // Refreshed in the middle of the question: carry on with the same timer
    if (r.question?.status === 'open') { openQuestion(); return; }
    // Just finished reading now (points were already given earlier, e.g. after getting access)
    if (reachedHere.current && r.question?.status === 'ready' && (r.question.attempts ?? 0) === 0) { openQuestion(); return; }
    setPhase('done');
  }, [award, openQuestion]);

  const { depth, active, send } = useReadingTracker(bodyRef, {
    edition: article.edition, article: article.slug, send: Boolean(me), needSeconds: need, onUpdate,
  });
  useEffect(() => { onDepth?.(depth); }, [depth, onDepth]);

  // Guests: time reached → must join / log in to claim (and to answer)
  useEffect(() => {
    if (active >= need) reachedHere.current = true;
    if (active >= need && !me && phase === 'reading') setPhase('claim');
  }, [active, need, me, phase]);
  // Logged in from the claim card → the tracker sends the time read so far, the server decides
  useEffect(() => { if (me && phase === 'claim') setPhase('reading'); }, [me, phase]);

  // ---------- countdown ----------
  useEffect(() => {
    if (phase !== 'question') return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) {
        clearInterval(t);
        setResult({ correct: false, timeout: true, triesLeft: qState?.triesLeft ?? 0, answer: null, explain: '', awarded: 0 });
        setPhase('result');
      }
    }, 250);
    return () => clearInterval(t);
  }, [phase, qState?.triesLeft]);

  const answer = async (choice: number) => {
    if (busy || picked !== null) return;
    setPicked(choice);
    setBusy(true);
    try {
      const r = await api.answerQuestion(article.slug, choice);
      setResult({ correct: r.correct, triesLeft: r.triesLeft, answer: r.answer, explain: r.explain, awarded: r.awarded });
      if (r.awarded) award(r.awarded, 'Question right', r.user); else award(0, undefined, r.user);
      setTimeout(() => setPhase('result'), 650);
    } catch (err) {
      setResult({ correct: false, timeout: true, triesLeft: qState?.triesLeft ?? 0, answer: null, explain: err instanceof ApiError ? err.message : '', awarded: 0 });
      setPhase('result');
    } finally {
      setBusy(false);
    }
  };

  // ---------- lock the page while the claim card / question is open ----------
  const blocking = phase === 'claim' || phase === 'earned' || phase === 'question';
  useEffect(() => {
    if (!blocking) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    history.pushState({ ngLock: true }, '');
    const onPop = () => { history.pushState({ ngLock: true }, ''); setShake((n) => n + 1); };
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    addEventListener('popstate', onPop);
    addEventListener('beforeunload', onLeave);
    return () => {
      html.style.overflow = prev;
      removeEventListener('popstate', onPop);
      removeEventListener('beforeunload', onLeave);
    };
  }, [blocking]);

  const redeemed = (user: Me) => { setMe(user); setPhase('reading'); send(true); };

  const pct = Math.min(1, active / need);
  const ring = 2 * Math.PI * 16;

  return (
    <>
      {/* Small timer while reading */}
      <AnimatePresence>
        {phase === 'reading' && pct < 1 && (
          <motion.div className="read-timer" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} title="Keep reading to earn points">
            <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" className="t-bg" /><circle cx="20" cy="20" r="16" className="t-fg" strokeDasharray={ring} strokeDashoffset={ring * (1 - pct)} /></svg>
            <span><b>{mmss(Math.max(0, need - active))}</b> to +{rp.readPoints} pts</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Try the question again later (one retry) */}
      {phase === 'done' && article.hasQuestion && qState?.status === 'ready' && (qState.attempts ?? 0) > 0 && (
        <motion.button className="retry-pill" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={openQuestion} disabled={busy}>
          🔁 Try the question again <small>({qState.triesLeft} {qState.triesLeft === 1 ? 'try' : 'tries'} left)</small>
        </motion.button>
      )}
      {phase === 'done' && note && <div className="gate-note" role="status">{note}</div>}

      <AnimatePresence>
        {(blocking || phase === 'result' || phase === 'access') && (
          <motion.div className="gate-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true">
            <motion.div
              key={`${phase}-${shake}`}
              className={`gate-card is-${phase}`}
              initial={{ opacity: 0, rotateX: 28, y: 50, scale: 0.92 }}
              animate={shake && blocking ? { opacity: 1, rotateX: 0, y: 0, scale: 1, x: [0, -14, 12, -8, 6, 0] } : { opacity: 1, rotateX: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              {phase === 'claim' && (
                <>
                  <div className="gate-coin" aria-hidden="true">+{rp.readPoints}</div>
                  <h3>You read it! {rp.readPoints} points are waiting 🎉</h3>
                  <p>Join or log in to claim them{article.hasQuestion ? <>, then answer one quick question for <b>+{rp.questionPoints} more</b></> : null}.</p>
                  <div className="gate-actions">
                    <button className="btn dark" onClick={() => openJoin('Join to claim your reading points and answer the question.')}>Join free</button>
                    <button className="btn white" onClick={() => openJoin('Log in to claim your reading points.', { mode: 'login' })}>Log in</button>
                  </div>
                  <button className="gate-skip" onClick={() => setPhase('done')}>Skip and lose the points</button>
                </>
              )}

              {phase === 'earned' && (
                <>
                  <motion.div className="gate-coin big" aria-hidden="true" initial={{ rotateY: 0 }} animate={{ rotateY: 720 }} transition={{ duration: 1.4, ease: 'easeOut' }}>+{rp.readPoints}</motion.div>
                  <h3>Story read! +{rp.readPoints} points ⚡</h3>
                  {article.hasQuestion && <p>Get ready… one question for <b>+{rp.questionPoints} more</b>. You&apos;ll have {rp.questionSeconds} seconds.</p>}
                  <Burst />
                </>
              )}

              {phase === 'question' && question && (
                <>
                  <div className="gate-q-head">
                    <span className="tagbar">QUICK CHECK · +{rp.questionPoints} PTS</span>
                    <Countdown left={left} total={rp.questionSeconds} />
                  </div>
                  <h3 className="gate-q">{question.prompt}</h3>
                  <div className="gate-options">
                    {question.options.map((o, i) => (
                      <motion.button
                        key={i}
                        className={`gate-opt${picked === i ? ' picked' : ''}`}
                        onClick={() => answer(i)}
                        disabled={busy || picked !== null}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 * i }}
                        whileHover={{ y: -3, rotateX: 6 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <i>{LETTERS[i]}</i><span>{o}</span>
                      </motion.button>
                    ))}
                  </div>
                  <p className="gate-fine">Answer to carry on. {qState && qState.triesLeft > 0 ? `If you miss it you get ${qState.triesLeft} more ${qState.triesLeft === 1 ? 'try' : 'tries'} later.` : 'This is your last try.'}</p>
                </>
              )}

              {phase === 'result' && result && (
                <>
                  {result.correct ? (
                    <>
                      <div className="gate-coin big" aria-hidden="true">+{result.awarded || rp.questionPoints}</div>
                      <h3>Correct! You really read it 🧠</h3>
                      {result.explain && <p>{result.explain}</p>}
                      <Burst />
                    </>
                  ) : (
                    <>
                      <div className="gate-emoji" aria-hidden="true">{result.timeout ? '⏰' : '😅'}</div>
                      <h3>{result.timeout ? "Time's up!" : 'Not quite.'}</h3>
                      <p>
                        You keep your {rp.readPoints} reading points.{' '}
                        {result.triesLeft > 0 ? <>Read it again and try once more for <b>+{rp.questionPoints}</b>.</> : <>No more tries on this story.</>}
                      </p>
                      {result.answer !== null && question && <p className="gate-answer">The answer: <b>{question.options[result.answer]}</b>{result.explain ? `. ${result.explain}` : ''}</p>}
                    </>
                  )}
                  <div className="gate-actions">
                    <button className="btn dark" onClick={() => { setPhase('done'); if (!result.correct) setQState((s) => (s ? { ...s, status: result.triesLeft > 0 ? 'ready' : 'out', attempts: Math.max(1, s.attempts), triesLeft: result.triesLeft } : s)); }}>
                      {result.correct ? 'Keep reading' : result.triesLeft > 0 ? 'Read again' : 'OK'}
                    </button>
                  </div>
                </>
              )}

              {phase === 'access' && <AccessCard back={`/articles/${article.slug}`} onRedeemed={redeemed} onClose={() => setPhase('done')} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// 60s ring that turns red near the end
function Countdown({ left, total }: { left: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className={`gate-count${left <= 10 ? ' hot' : ''}`} aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r={r} className="t-bg" /><circle cx="26" cy="26" r={r} className="t-fg" strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} /></svg>
      <b>{left}</b>
    </div>
  );
}

// little confetti burst
function Burst() {
  return (
    <div className="burst" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return <motion.i key={i} initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(a) * 130, y: Math.sin(a) * 90 - 30, opacity: 0, scale: 0.4, rotate: 200 }} transition={{ duration: 1.1, ease: 'easeOut' }} style={{ background: ['#FFD400', '#0A0A0A', '#e0457b', '#2f7de1'][i % 4] }} />;
      })}
    </div>
  );
}
