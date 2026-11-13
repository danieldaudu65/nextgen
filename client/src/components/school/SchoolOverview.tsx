'use client';

import { useEffect, useState } from 'react';
import { animate, motion } from 'framer-motion';
import { schoolApi, type SchoolInfo, type SchoolOverview as Data } from '@/lib/schoolApi';
import { HBarChart, LineChart } from '../charts/BarChart';
import Tilt from './Tilt';

const fmt = (n: number) => n.toLocaleString('en-NG');

function Count({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => { const c = animate(0, to, { duration: 1, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) }); return () => c.stop(); }, [to]);
  return <>{fmt(n)}</>;
}

// 3D ring: seats used / total
function SeatsRing({ used, total }: { used: number; total: number }) {
  const r = 70, c = 2 * Math.PI * r;
  const pct = total ? Math.min(1, used / total) : 0;
  return (
    <motion.div className="seat-ring" initial={{ rotateX: 50, opacity: 0, z: 60 }} animate={{ rotateX: 12, opacity: 1, z: 60 }} transition={{ type: 'spring', stiffness: 90, damping: 14 }}>
      <svg viewBox="0 0 180 180">
        <defs><linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff9a8" /><stop offset="1" stopColor="#FFD400" /></linearGradient></defs>
        <circle cx="90" cy="90" r={r} className="ring-bg" />
        <motion.circle cx="90" cy="90" r={r} className="ring-fg" stroke="url(#ringG)" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1.4, ease: 'easeOut' }} />
      </svg>
      <div className="ring-txt"><b><Count to={used} /></b><span>of {fmt(total)} seats</span></div>
    </motion.div>
  );
}

export default function SchoolOverview({ school, go }: { school: SchoolInfo; go: (t: 'codes' | 'students' | 'plan') => void }) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { schoolApi.overview().then(setD).catch(() => setD(null)); }, []);
  if (!d) return <div className="sch-loading small"><div className="spinner" /></div>;

  const acc = d.quiz.answered ? Math.round((d.quiz.correct / d.quiz.answered) * 100) : 0;
  const until = school.plan.until ? new Date(school.plan.until).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const stats = [
    { label: 'Students', value: school.studentCount, icon: '👩🏾‍🎓', hint: `${d.activeThisWeek} active this week` },
    { label: 'School points', value: school.points, icon: '⚡', hint: `#${d.nationalRank} in Nigeria` },
    { label: 'Quick checks right', value: acc, icon: '🧠', hint: `${fmt(d.quiz.correct)} of ${fmt(d.quiz.answered)} answered`, suffix: '%' },
    { label: 'Codes ready', value: school.codes.unused, icon: '🎟️', hint: `${school.codes.left} seats left to give` },
  ];

  return (
    <div className="sch-grid">
      <Tilt className="sch-hero">
        <div className="hero-txt">
          <span className="chip">NATIONAL RANK</span>
          <div className="big-rank">#{d.nationalRank}</div>
          <p>{school.plan.active ? <>Plan active{until ? ` until ${until}` : ''}. Keep the streaks going!</> : <>No plan yet. Your students can read, but can&apos;t earn points.</>}</p>
          <div className="hero-btns">
            <button className="sch-btn" onClick={() => go('codes')}>Create codes</button>
            <button className="sch-ghost" onClick={() => go('students')}>See students</button>
          </div>
        </div>
        <SeatsRing used={school.codes.used} total={school.plan.seats} />
      </Tilt>

      <div className="sch-stats">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 24, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.08 * i }}>
            <Tilt className="sch-stat">
              <span className="ico">{s.icon}</span>
              <b><Count to={s.value} />{s.suffix ?? ''}</b>
              <span className="lbl">{s.label}</span>
              <small>{s.hint}</small>
            </Tilt>
          </motion.div>
        ))}
      </div>

      <section className="sch-panel wide">
        <div className="panel-h"><h3>Points, last 14 days</h3><small>Reading vs games &amp; quizzes</small></div>
        <LineChart data={d.chart} series={[{ key: 'reading', label: 'Reading', color: 'var(--chart-1)' }, { key: 'games', label: 'Games & quizzes', color: 'var(--chart-2)' }]} />
      </section>

      <section className="sch-panel">
        <div className="panel-h"><h3>Class vs class</h3><small>Average points per student</small></div>
        <HBarChart rows={d.classes.map((c) => ({ label: c.className, value: c.average, sub: `${c.students} students` }))} />
      </section>

      <section className="sch-panel">
        <div className="panel-h"><h3>Star students</h3><small>Most points</small></div>
        {d.topStudents.length ? (
          <ol className="stars">
            {d.topStudents.map((s, i) => (
              <motion.li key={s.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.07 * i }}>
                <span className={`medal m${i}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
                <span className="av" style={{ background: s.color ?? '#FFD400' }}>{s.name.slice(0, 1)}</span>
                <span className="nm">{s.name}<small>@{s.handle}{s.className ? ` · ${s.className}` : ''}{s.streak ? ` · 🔥${s.streak}` : ''}</small></span>
                <b>{fmt(s.points)}</b>
              </motion.li>
            ))}
          </ol>
        ) : <div className="chart-empty">No students yet. Create codes and share them.</div>}
      </section>

      <section className="sch-panel">
        <div className="panel-h"><h3>Most-read stories</h3><small>By your students, last 14 days</small></div>
        <HBarChart rows={d.topStories.map((s) => ({ label: s.title ?? s.slug, value: s.reads }))} color="var(--chart-2)" />
      </section>
    </div>
  );
}
