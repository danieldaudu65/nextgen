'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Me } from '@/lib/types';
import { api } from '@/lib/api';
import JoinModal from './JoinModal';
import AccessCard from './AccessCard';

type Session = {
  me: Me | null;            // signed-in student, or null for guests
  points: number;           // what the nav shows
  /** Show points. Guests get a local "preview" score; signed-in students get the server's total. */
  award: (n: number, label?: string, fresh?: Me) => void;
  /** Ask the server to record a finished game (no-op for guests). */
  completeGame: (game: string, edition: string, guestPoints: number, label: string) => Promise<void>;
  setMe: (me: Me | null) => void;
  openJoin: (reason?: string, opts?: { mode?: 'join' | 'login'; code?: string }) => void;
  /** Logged in but no school seat / personal plan: show how to get access */
  noAccess: () => void;
  logout: () => void;
};

const Ctx = createContext<Session | null>(null);

export function PointsProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [guestPoints, setGuestPoints] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [join, setJoin] = useState<{ open: boolean; reason?: string; mode?: 'join' | 'login'; code?: string }>({ open: false });
  const [access, setAccess] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Restore the session on load (the login cookie is sent automatically)
  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const award = useCallback(
    (n: number, label?: string, fresh?: Me) => {
      if (fresh) setMe(fresh);
      else if (!me) setGuestPoints((p) => p + n);
      if (n > 0) showToast(`${label ? label + ' · ' : ''}+${n} pts ⚡${me || fresh ? '' : ' (join to save)'}`);
    },
    [me, showToast],
  );

  const completeGame = useCallback(
    async (game: string, edition: string, pts: number, label: string) => {
      if (!me) return award(pts, label);
      try {
        const r = await api.completeGame(game, edition);
        if (r.locked) { setMe(r.user); setAccess(true); return; }
        award(r.awarded, label, r.user);
        if (!r.awarded) showToast('Already counted for this edition 😉');
      } catch {
        showToast("Couldn't save that one. Check your connection.");
      }
    },
    [me, award, showToast],
  );

  const logout = () => { api.logout().catch(() => {}); setMe(null); };

  return (
    <Ctx.Provider
      value={{
        me,
        points: me ? me.points : guestPoints,
        award,
        completeGame,
        setMe,
        openJoin: (reason, opts) => setJoin({ open: true, reason, ...opts }),
        noAccess: () => setAccess(true),
        logout,
      }}
    >
      {children}
      {access && me && (
        <div className="modal-back" onClick={() => setAccess(false)}>
          <div className="modal access-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-x" onClick={() => setAccess(false)} aria-label="Close">×</button>
            <AccessCard back={typeof location !== 'undefined' ? location.pathname : '/'} onRedeemed={(m) => { setMe(m); setAccess(false); showToast('Access unlocked 🎉 Points are on!'); }} />
          </div>
        </div>
      )}
      {join.open && (
        <JoinModal
          reason={join.reason}
          initialMode={join.mode}
          code={join.code}
          onClose={() => setJoin({ open: false })}
          onDone={(m) => { setMe(m); setJoin({ open: false }); showToast(`Welcome, ${m.name}! 🎉`); }}
        />
      )}
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </Ctx.Provider>
  );
}

export function usePoints() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePoints must be used inside <PointsProvider>');
  return ctx;
}

// Safe with missing numbers (a volume without game data must not crash the page)
export const fmt = (n?: number | null) => (Number(n) || 0).toLocaleString('en-NG');
