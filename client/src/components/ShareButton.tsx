'use client';

import { useState } from 'react';

// "Inspired? Share their story": uses the phone's share sheet, or copies the link on desktop
export default function ShareButton({ path, title, children }: { path: string; title: string; children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); setDone(true); window.setTimeout(() => setDone(false), 2200); }
    } catch { /* closed the share sheet */ }
  };
  return (
    <button type="button" className="stars-share" onClick={share}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
      {done ? 'Link copied. Send it to someone!' : children}
    </button>
  );
}
