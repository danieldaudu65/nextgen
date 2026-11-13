'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminApi, type DashboardCharts } from '@/lib/adminApi';
import { HBarChart, LineChart } from '../charts/BarChart';

const RANGES = [7, 14, 30, 90];
const VIEWS = [
  { key: 'points', label: 'Points by activity' },
  { key: 'reads', label: 'Reads & quick checks' },
  { key: 'signups', label: 'New students' },
  { key: 'revenue', label: 'Revenue' },
] as const;
const naira = (n: number) => `₦${n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : Math.round(n)}`;

// Dashboard → "Charts": animated bar charts of what readers are doing
export default function DashCharts() {
  const [days, setDays] = useState(14);
  const [view, setView] = useState<(typeof VIEWS)[number]['key']>('points');
  const [d, setD] = useState<DashboardCharts | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setD(null); adminApi.charts(days).then(setD).catch(() => setFailed(true)); }, [days]);

  if (failed) return <div className="admin-card admin-empty"><b>Couldn&apos;t load the charts</b><p className="muted">Check that the server is running.</p></div>;
  if (!d) return <div className="admin-skeleton" />;

  const sum = (k: keyof DashboardCharts['daily'][number]) => d.daily.reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const points = sum('reading') + sum('quiz') + sum('games') + sum('debate') + sum('streak');
  const answered = sum('answered');
  const kpis = [
    { label: 'Stories read', value: sum('reads').toLocaleString('en-NG') },
    { label: 'Points earned', value: points.toLocaleString('en-NG') },
    { label: 'Quick checks right', value: answered ? `${Math.round((sum('correct') / answered) * 100)}%` : '–' },
    { label: 'New students', value: sum('signups').toLocaleString('en-NG') },
    { label: 'Revenue', value: naira(sum('revenue')) },
    { label: 'With access', value: `${(d.access.school + d.access.personal).toLocaleString('en-NG')}`, hint: `${d.access.school} school · ${d.access.personal} own` },
  ];

  return (
    <div className="dash-charts">
      <div className="dc-bar">
        <div className="admin-tabs" role="tablist">
          {VIEWS.map((v) => <button key={v.key} className={view === v.key ? 'on' : ''} onClick={() => setView(v.key)}>{v.label}</button>)}
        </div>
        <div className="admin-tabs">
          {RANGES.map((r) => <button key={r} className={days === r ? 'on' : ''} onClick={() => setDays(r)}>{r} days</button>)}
        </div>
      </div>

      <div className="dc-kpis">
        {kpis.map((k, i) => (
          <motion.div key={k.label} className="dc-kpi" initial={{ opacity: 0, y: 20, rotateX: -25 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: i * 0.05 }}>
            <b>{k.value}</b><span>{k.label}</span>{k.hint && <small>{k.hint}</small>}
          </motion.div>
        ))}
      </div>

      <motion.section key={view} className="admin-card dc-main" initial={{ opacity: 0, rotateX: 8, y: 16 }} animate={{ opacity: 1, rotateX: 0, y: 0 }}>
        <div className="card-head"><h2>{VIEWS.find((v) => v.key === view)?.label}</h2><span className="muted">last {days} days</span></div>
        {view === 'points' && <LineChart data={d.daily} series={[
          { key: 'reading', label: 'Reading + questions', color: 'var(--chart-1)' },
          { key: 'quiz', label: 'Quizzes', color: 'var(--chart-2)' },
          { key: 'games', label: 'Games', color: 'var(--chart-3)' },
          { key: 'debate', label: 'Debates', color: 'var(--chart-4)' },
          { key: 'streak', label: 'Streak bonus', color: 'var(--chart-5)' },
        ]} height={300} />}
        {view === 'reads' && <LineChart data={d.daily.map((r) => ({ ...r, missed: Math.max(0, r.answered - r.correct), unanswered: Math.max(0, r.reads - r.answered) }))} series={[
          { key: 'correct', label: 'Read + answered right', color: 'var(--chart-1)' },
          { key: 'missed', label: 'Answered wrong', color: 'var(--chart-4)' },
          { key: 'unanswered', label: 'Read, no answer', color: 'var(--chart-2)' },
        ]} height={300} />}
        {view === 'signups' && <LineChart data={d.daily} series={[{ key: 'signups', label: 'New students', color: 'var(--chart-3)' }]} height={300} />}
        {view === 'revenue' && <LineChart data={d.daily} series={[{ key: 'revenue', label: 'Paid (₦)', color: 'var(--chart-5)' }]} height={300} format={naira} />}
      </motion.section>

      <div className="dash-grid">
        <section className="admin-card"><div className="card-head"><h2>Top stories</h2><span className="muted">reads</span></div><HBarChart rows={d.topStories.map((s) => ({ label: s.title ?? s.slug, value: s.reads }))} /></section>
        <section className="admin-card"><div className="card-head"><h2>Top schools</h2><span className="muted">points</span></div><HBarChart rows={d.topSchools.map((s) => ({ label: s.name ?? 'School', value: s.points }))} color="var(--chart-2)" /></section>
      </div>
      <p className="muted dc-codes">School codes: {d.codes.used} used · {d.codes.unused} ready · {d.codes.revoked} cancelled</p>
    </div>
  );
}
