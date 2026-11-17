'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePoints } from '../PointsProvider';
import { worldApi, type WorldGame, type WorldStars } from '@/lib/worldApi';
import { WORLD_LEVELS, starsArray } from './worldLevels';

// Stars per level for one edition. Students: saved on the server. Guests: kept in this browser.
const KEY = (slug: string) => `ng-world:${slug}`;
function readLocal(slug: string): number[] {
  try { return starsArray(JSON.parse(localStorage.getItem(KEY(slug)) || 'null')); } catch { return starsArray(null); }
}
function writeLocal(slug: string, stars: number[]){
  try { localStorage.setItem(KEY(slug), JSON.stringify(Object.fromEntries(WORLD_LEVELS.map((l, i) => [l.key, stars[i]])))); } catch { /* storage blocked */ }
}

export function useWorldProgress(slug: string){
  const { me } = usePoints();
  const [stars, setStarsState] = useState<number[] | null>(null);
  const ref = useRef<number[] | null>(null);
  const setStars = useCallback((s: number[]) => { ref.current = s; setStarsState(s); }, []);
  const loggedIn = Boolean(me);

  useEffect(() => {
    let live = true;
    if (!loggedIn){ setStars(readLocal(slug)); return; }
    worldApi.progress(slug)
      .then((d) => { if (live) setStars(d.stars ? starsArray(d.stars) : readLocal(slug)); })
      .catch(() => { if (live) setStars(readLocal(slug)); });
    return () => { live = false; };
  }, [slug, loggedIn, setStars]);

  /** Keep the best stars for a level (the Boss is saved by the server when it checks the answers) */
  const save = useCallback(async (game: WorldGame, got: number) => {
    const i = WORLD_LEVELS.findIndex((l) => l.key === game);
    const next = (ref.current ?? starsArray(null)).slice(); next[i] = Math.max(next[i], got); setStars(next);
    if (!loggedIn){ writeLocal(slug, next); return; }
    if (game === 'boss') return;
    try { const r = await worldApi.saveResult(slug, game, got); setStars(starsArray(r.stars)); } catch { /* keep what we show; it saves next time */ }
  }, [slug, loggedIn, setStars]);

  /** Stars straight from a server answer (the Boss) */
  const setFromServer = useCallback((s: WorldStars | null) => { if (s) setStars(starsArray(s)); }, [setStars]);

  return { stars, save, setFromServer };
}
