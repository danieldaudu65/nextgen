'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from './api';
import type { Me, QuestionState } from './types';

const IDLE_AFTER = 30;   // seconds without scroll/touch/keys = not reading
const HEARTBEAT = 10;    // send progress every 10s

export type ReadResult = { earned: { label: string; points: number }[]; user: Me; completed: boolean; question: QuestionState | null; locked: boolean };

/**
 * Measures how much of a story someone actually reads:
 *  - active seconds: tab visible AND they touched/scrolled/typed in the last 30s
 *  - scroll depth: how far down the article they have reached (0 → 1)
 * Everyone gets the timer (so guests see "+5 waiting"). Logged-in students also send a
 * heartbeat to the API, which decides when the story counts as read. When someone logs in
 * part-way, the next heartbeat carries `startedAt`, so the time they already read still counts.
 */
export function useReadingTracker(
  ref: RefObject<HTMLElement | null>,
  opts: { edition: string; article: string; send: boolean; needSeconds: number; onUpdate: (r: ReadResult) => void },
) {
  const [depth, setDepth] = useState(0);
  const [active, setActive] = useState(0);
  const state = useRef({ active: 0, depth: 0, lastInput: Date.now(), lastSent: -1, done: false, startedAt: new Date().toISOString(), busy: false });
  const cb = useRef(opts.onUpdate);
  cb.current = opts.onUpdate;
  const need = useRef(opts.needSeconds);
  need.current = opts.needSeconds;

  // force: send again after the story was done (e.g. the student just got access and is owed the points)
  const send = useCallback((force = false) => {
    const s = state.current;
    if (force) s.done = false;
    if (s.busy || s.done) return;
    s.busy = true;
    s.lastSent = s.active;
    api
      .readingProgress({ edition: opts.edition, article: opts.article, activeSeconds: s.active, scrollDepth: s.depth, startedAt: s.startedAt })
      .then((r) => {
        if (r.progress.completed) s.done = true;
        cb.current({ earned: r.earned, user: r.user, completed: r.progress.completed, question: r.question, locked: r.locked });
      })
      .catch(() => {})
      .finally(() => { s.busy = false; });
  }, [opts.edition, opts.article]);

  // A heartbeat as soon as the student is known (page open, or just logged in): gets the question state
  useEffect(() => { if (opts.send) send(true); }, [opts.send, send]);

  useEffect(() => {
    const s = state.current;
    const poke = () => { s.lastInput = Date.now(); };

    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const seen = Math.min(r.height, Math.max(0, innerHeight - r.top)); // px of article that has entered the screen
      const d = r.height ? Math.min(1, seen / r.height) : 0;
      if (d > s.depth) { s.depth = d; setDepth(d); }
    };

    const onScroll = () => { poke(); measure(); };
    addEventListener('scroll', onScroll, { passive: true });
    ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove'].forEach((ev) => addEventListener(ev, poke, { passive: true }));
    measure();

    const tick = setInterval(() => {
      const reading = document.visibilityState === 'visible' && (Date.now() - s.lastInput) / 1000 < IDLE_AFTER;
      if (reading && !s.done) { s.active += 1; setActive(s.active); }
      if (!opts.send || s.done) return;
      const reached = s.active >= need.current && s.lastSent < need.current;
      if (reading && (reached || s.active - s.lastSent >= HEARTBEAT)) send();
    }, 1000);

    return () => {
      clearInterval(tick);
      removeEventListener('scroll', onScroll);
      ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove'].forEach((ev) => removeEventListener(ev, poke));
    };
  }, [ref, opts.send, send]);

  return { depth, active, send };
}
