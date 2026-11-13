'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import type { SiteSettings } from './types';

// Same defaults as the server (server/services/settings.js), used until the real ones load
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  leaderboard: { range: 'volume', size: 10, boards: { readers: true, players: true, schools: true }, schoolRanking: 'total', showOnHome: true },
  reading: { mode: 'fixed', readSeconds: 120, questionSeconds: 60, retries: 1, readPoints: 5, questionPoints: 5 },
  home: { heroMax: 5, heroSeconds: 7 },
  access: { requireAccessForPoints: true },
  personalPlans: [],
  schoolPlans: [],
};

let cache: Promise<{ settings: SiteSettings; demoPayments: boolean }> | null = null;

export function useSiteSettings() {
  const [data, setData] = useState<{ settings: SiteSettings; demoPayments: boolean }>({ settings: DEFAULT_SITE_SETTINGS, demoPayments: false });
  useEffect(() => {
    cache ??= api.siteSettings().catch(() => ({ settings: DEFAULT_SITE_SETTINGS, demoPayments: false }));
    let live = true;
    cache.then((d) => { if (live) setData(d); });
    return () => { live = false; };
  }, []);
  return data;
}

// Seconds a reader must spend on a story (matches the server)
export const readSecondsFor = (s: SiteSettings, readMins = 3) =>
  s.reading.mode === 'story' ? Math.max(15, Math.round((readMins || 3) * 60)) : s.reading.readSeconds;

export const naira = (n: number) => `₦${Math.round(Number(n) || 0).toLocaleString('en-NG')}`;
// 30 → "month", 365 → "year", 120 → "120 days"
export const period = (days: number) => (days === 7 ? 'week' : days >= 28 && days <= 31 ? 'month' : days === 365 ? 'year' : `${days} days`);
