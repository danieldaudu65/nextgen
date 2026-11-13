'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { Me } from '@/lib/types';
import { naira, useSiteSettings } from '@/lib/useSiteSettings';

// No access yet: use a school code, or pay for yourself
export default function AccessCard({ back, onRedeemed, onClose, showPay = true }: { back: string; onRedeemed: (user: Me) => void; onClose?: () => void; showPay?: boolean }) {
  const { settings } = useSiteSettings();
  const cheapest = [...settings.personalPlans].sort((a, b) => a.price - b.price)[0];
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const redeem = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.redeem(code);
      onRedeemed(r.user);
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'Could not check the code');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="access-card">
      <div className="gate-emoji" aria-hidden="true">🔓</div>
      <h3>Unlock points &amp; games</h3>
      <p>Reading is free. Games, quick checks, points and the leaderboard need NextGen access: a code from your school, or a package if your school isn&apos;t on NextGen.</p>
      <form className="access-code" onSubmit={redeem}>
        <label>School code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7MP2QXA" maxLength={16} required /></label>
        <button className="btn dark" disabled={busy || code.length < 4}>{busy ? 'Checking…' : 'Use code'}</button>
      </form>
      {err && <div className="modal-err">{err}</div>}
      {showPay && <><div className="access-or"><span>or</span></div>
      <Link className="btn yellow" href={`/get-access?back=${encodeURIComponent(back)}`}>Not in a NextGen school? See packages{cheapest ? ` · from ${naira(cheapest.price)}` : ''}</Link></>}
      {onClose && <button className="gate-skip" onClick={onClose}>Keep reading without points</button>}
    </div>
  );
}
