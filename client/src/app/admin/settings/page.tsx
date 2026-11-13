'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminApi, can } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import type { LeaderRange, SiteSettings } from '@/lib/types';
import { useAdmin } from '@/components/admin/AdminShell';
import AnimatedSelect from '@/components/AnimatedSelect';

const RANGES: { value: LeaderRange; label: string; hint: string; icon: string }[] = [
  { value: 'volume', label: 'Per volume', hint: 'Resets with every new volume (issue)', icon: '📰' },
  { value: 'edition', label: 'Per edition', hint: 'The whole year: all 4 volumes add up', icon: '📚' },
  { value: 'week', label: 'Weekly', hint: 'Resets every Monday', icon: '🗓️' },
  { value: 'all', label: 'All time', hint: 'Never resets', icon: '♾️' },
];

// Admin → Settings: leaderboard, reading check, access, school plans
export default function SettingsPage() {
  const { admin, toast } = useAdmin();
  const [s, setS] = useState<SiteSettings | null>(null);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const boss = can(admin, 'superadmin');

  useEffect(() => { adminApi.settings().then((r) => { setS(r.settings); setDemo(r.payments.demo); }).catch(() => toast('Could not load settings', true)); }, [toast]);
  if (!s) return <div className="admin-page"><div className="admin-skeleton" /></div>;

  const up = <K extends keyof SiteSettings>(k: K, v: Partial<SiteSettings[K]>) => setS({ ...s, [k]: { ...(s[k] as object), ...v } } as SiteSettings);
  const num = (v: string) => Number(v) || 0;
  const save = async () => {
    setBusy(true);
    try { const r = await adminApi.saveSettings(s); setS(r.settings); toast('Settings saved ✓'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Could not save', true); }
    finally { setBusy(false); }
  };
  const plans = s.schoolPlans;
  const setPkg = (i: number, v: Partial<SiteSettings['personalPlans'][number]>) => setS({ ...s, personalPlans: s.personalPlans.map((p, j) => (j === i ? { ...p, ...v } : p)) });
  const setPlan = (i: number, v: Partial<SiteSettings['schoolPlans'][number]>) => setS({ ...s, schoolPlans: plans.map((p, j) => (j === i ? { ...p, ...v } : p)) });

  return (
    <div className="admin-page settings-page">
      <div className="admin-head">
        <div><h1 className="display">Settings</h1><p className="muted">Leaderboards, the reading check, access and school plans.{!boss && ' Only superadmins can change these.'}</p></div>
        {boss && <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>}
      </div>

      <fieldset disabled={!boss} className="settings-grid">
        <section className="admin-card">
          <div className="card-head"><h2>Leaderboard range</h2><span className="muted">which points count</span></div>
          <div className="range-cards">
            {RANGES.map((r) => (
              <motion.button key={r.value} type="button" className={`range-card${s.leaderboard.range === r.value ? ' on' : ''}`} onClick={() => up('leaderboard', { range: r.value })} whileHover={{ y: -4, rotateX: 8 }} whileTap={{ scale: 0.97 }}>
                <span className="ri">{r.icon}</span><b>{r.label}</b><small>{r.hint}</small>
              </motion.button>
            ))}
          </div>
          <div className="row3">
            <label>Rows per board<input type="number" min={3} max={50} value={s.leaderboard.size} onChange={(e) => up('leaderboard', { size: num(e.target.value) })} /></label>
            <label>Rank schools by
              <AnimatedSelect label="Rank schools by" value={s.leaderboard.schoolRanking} onChange={(v) => up('leaderboard', { schoolRanking: v as 'total' | 'average' })} options={[{ value: 'total', label: 'Total points' }, { value: 'average', label: 'Average per student' }]} />
            </label>
            <label className="check"><input type="checkbox" checked={s.leaderboard.showOnHome} onChange={(e) => up('leaderboard', { showOnHome: e.target.checked })} /> Show on the homepage</label>
          </div>
          <div className="checks">
            {(['readers', 'players', 'schools'] as const).map((b) => (
              <label key={b} className="check"><input type="checkbox" checked={s.leaderboard.boards[b]} onChange={(e) => up('leaderboard', { boards: { ...s.leaderboard.boards, [b]: e.target.checked } })} /> {b === 'readers' ? 'Top Readers (reading + questions)' : b === 'players' ? 'Top Players (every point)' : 'Top Schools'}</label>
            ))}
          </div>
        </section>

        <section className="admin-card" id="homepage">
          <div className="card-head"><h2>Homepage hero</h2><span className="muted">the rotating stories at the top</span></div>
          <div className="row2">
            <label>Stories in the hero<input type="number" min={1} max={10} value={s.home?.heroMax ?? 5} onChange={(e) => up('home', { heroMax: num(e.target.value) })} /><small className="muted">The newest {s.home?.heroMax ?? 5} switched on in Stories (★) show, as 01 / {String(s.home?.heroMax ?? 5).padStart(2, '0')}.</small></label>
            <label>Seconds per story<input type="number" min={3} max={30} value={s.home?.heroSeconds ?? 7} onChange={(e) => up('home', { heroSeconds: num(e.target.value) })} /><small className="muted">Then it slides to the next one. Hovering pauses it.</small></label>
          </div>
        </section>

        <section className="admin-card">
          <div className="card-head"><h2>Reading check</h2><span className="muted">every story</span></div>
          <div className="row2">
            <label>Reading time
              <AnimatedSelect label="Reading time" value={s.reading.mode} onChange={(v) => up('reading', { mode: v as 'fixed' | 'story' })} options={[{ value: 'fixed', label: 'Same for every story' }, { value: 'story', label: "The story's read time" }]} />
            </label>
            {s.reading.mode === 'fixed' && <label>Seconds before points<input type="number" min={15} max={1800} value={s.reading.readSeconds} onChange={(e) => up('reading', { readSeconds: num(e.target.value) })} /><small className="muted">{Math.round(s.reading.readSeconds / 6) / 10} min</small></label>}
          </div>
          <div className="row3">
            <label>Reading points<input type="number" min={0} max={100} value={s.reading.readPoints} onChange={(e) => up('reading', { readPoints: num(e.target.value) })} /></label>
            <label>Question points<input type="number" min={0} max={100} value={s.reading.questionPoints} onChange={(e) => up('reading', { questionPoints: num(e.target.value) })} /></label>
            <label>Seconds to answer<input type="number" min={10} max={600} value={s.reading.questionSeconds} onChange={(e) => up('reading', { questionSeconds: num(e.target.value) })} /></label>
          </div>
          <label>Retries after a wrong answer or time-out<input type="number" min={0} max={5} value={s.reading.retries} onChange={(e) => up('reading', { retries: num(e.target.value) })} /></label>
        </section>

        <section className="admin-card">
          <div className="card-head"><h2>Access</h2>{demo ? <span className="storage-pill local">Payments in DEMO mode (no PAYSTACK_SECRET_KEY)</span> : <span className="storage-pill cloudinary">Paystack live</span>}</div>
          <label className="check"><input type="checkbox" checked={s.access.requireAccessForPoints} onChange={(e) => up('access', { requireAccessForPoints: e.target.checked })} /> Games, quick checks &amp; points only with access (a school code or a student package)</label>
          <p className="muted">Students from a subscribed school get access with their code. Everyone else buys one of the packages below.</p>
        </section>

        <section className="admin-card">
          <div className="card-head"><h2>Student packages</h2><span className="muted">for students not in a NextGen school</span></div>
          <div className="plan-rows">
            {s.personalPlans.map((p, i) => (
              <div key={i} className="plan-row pkg-row">
                <label className="pr-name">Name<input value={p.name} onChange={(e) => setPkg(i, { name: e.target.value })} /></label>
                <label>Price (₦)<input type="number" min={0} value={p.price} onChange={(e) => setPkg(i, { price: num(e.target.value) })} /></label>
                <label>Days<input type="number" min={1} value={p.days} onChange={(e) => setPkg(i, { days: num(e.target.value) })} /></label>
                <button type="button" className="btn sm danger" onClick={() => setS({ ...s, personalPlans: s.personalPlans.filter((_, j) => j !== i) })} disabled={s.personalPlans.length < 2}>Remove</button>
              </div>
            ))}
          </div>
          {s.personalPlans.length < 8 && <button type="button" className="btn sm white" onClick={() => setS({ ...s, personalPlans: [...s.personalPlans, { id: `pkg-${Date.now().toString(36)}`, name: 'New package', price: 1000, days: 30 }] })}>+ Add a package</button>}
        </section>

        <section className="admin-card">
          <div className="card-head"><h2>School plans</h2><span className="muted">what schools can buy</span></div>
          <div className="plan-rows">
            {plans.map((p, i) => (
              <div key={i} className="plan-row">
                <label className="pr-name">Name<input value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} /></label>
                <label>Seats<input type="number" min={1} value={p.seats} onChange={(e) => setPlan(i, { seats: num(e.target.value) })} /></label>
                <label>Price (₦)<input type="number" min={0} value={p.price} onChange={(e) => setPlan(i, { price: num(e.target.value) })} /></label>
                <label>Days<input type="number" min={1} value={p.days} onChange={(e) => setPlan(i, { days: num(e.target.value) })} /></label>
                <button type="button" className="btn sm danger" onClick={() => setS({ ...s, schoolPlans: plans.filter((_, j) => j !== i) })} disabled={plans.length < 2}>Remove</button>
              </div>
            ))}
          </div>
          {plans.length < 8 && <button type="button" className="btn sm white" onClick={() => setS({ ...s, schoolPlans: [...plans, { id: `plan-${Date.now().toString(36)}`, name: 'New plan', seats: 100, price: 300000, days: 365 }] })}>+ Add a plan</button>}
        </section>
      </fieldset>
    </div>
  );
}
