'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import type { Showcase, ShowcaseSchool } from '@/lib/types';
import AnimatedSelect from '@/components/AnimatedSelect';
import Tilt from '@/components/school/Tilt';
import { fmt } from '@/components/PointsProvider';

const TYPES: Record<string, string> = { public: 'Public school', private: 'Private school', mission: 'Mission school', federal: 'Federal school', other: 'School' };

// School Showcase: every school on NextGen, its details and its top 5 readers
export default function SchoolShowcase() {
  const [data, setData] = useState<Showcase | null>(null);
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api.showcase({ q, state, page }).then((d) => {
        setFailed(false);
        setData((prev) => (page > 1 && prev ? { ...d, schools: [...prev.schools, ...d.schools] } : d));
      }).catch(() => setFailed(true));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, state, page]);

  return (
    <section className="sec showcase">
      <div className="wrap">
        <div className="sc-hero">
          <div>
            <span className="tagbar">SCHOOL SHOWCASE</span>
            <h1 className="display">Every school.<br />Every star reader.</h1>
            <p className="sub">See how schools across Nigeria are reading, playing and climbing. Each school&apos;s top 5 readers, its story and its rank.</p>
          </div>
          <div className="sc-cta">
            <b>{data ? fmt(data.total) : '–'}</b><span>schools on NextGen</span>
            <Link className="btn" href="/schools/guide">How it works for schools</Link>
            <Link className="btn white" href="/school/login">Add your school</Link>
          </div>
        </div>

        <div className="sc-filters">
          <input type="search" placeholder="Search a school or city…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search schools" />
          <div className="sc-state">
            <AnimatedSelect label="State" value={state} onChange={(v) => { setState(v); setPage(1); }} options={[{ value: '', label: 'All states' }, ...(data?.states ?? []).map((s) => ({ value: s, label: s }))]} />
          </div>
        </div>

        {failed && <p className="sc-empty">Can&apos;t load schools right now. Try again in a bit.</p>}
        {!data && !failed && <div className="sc-grid">{[0, 1, 2].map((i) => <div key={i} className="sc-card skeleton" />)}</div>}
        {data && data.schools.length === 0 && <p className="sc-empty">No schools found{q ? ` for “${q}”` : ''}.</p>}
        {data && data.schools.length > 0 && (
          <div className="sc-grid">
            {data.schools.map((s, i) => <SchoolCard key={s.id} s={s} i={i} />)}
          </div>
        )}
        {data && data.page < data.pages && (
          <div className="sc-more"><button className="btn white" onClick={() => setPage((p) => p + 1)}>Show more schools</button></div>
        )}
      </div>
    </section>
  );
}

function SchoolCard({ s, i }: { s: ShowcaseSchool; i: number }) {
  const [open, setOpen] = useState(false);
  const facts = [s.founded ? `Since ${s.founded}` : null, s.schoolType ? TYPES[s.schoolType] : null, `${fmt(s.studentCount)} readers`].filter(Boolean);
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ delay: (i % 3) * 0.06 }}>
      <Tilt className="sc-card" max={6}>
        <div className="sc-top">
          <span className={`sc-rank${s.rank <= 3 ? ` r${s.rank}` : ''}`}>#{s.rank}</span>
          {s.logo ? <img className="sc-logo" src={s.logo} alt="" /> : <span className="sc-logo initial" aria-hidden="true">{s.name.slice(0, 1)}</span>}
          <div className="sc-id">
            <h3>{s.name}</h3>
            <small>{[s.city, s.state].filter(Boolean).join(', ')}</small>
            <div className="sc-badges">
              {s.verified && <span className="sc-badge ok">✓ Verified</span>}
              {s.member && <span className="sc-badge">NextGen school</span>}
            </div>
          </div>
        </div>
        {s.motto && <p className="sc-motto">“{s.motto}”</p>}
        {s.about && <p className={`sc-about${open ? ' open' : ''}`}>{s.about}</p>}
        {s.about && s.about.length > 140 && <button className="sc-more-btn" onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read more'}</button>}
        <div className="sc-facts">{facts.map((f) => <span key={f}>{f}</span>)}<span className="pts">⚡ {fmt(s.points)} pts</span></div>
        {s.website && <a className="sc-web" href={s.website} target="_blank" rel="noreferrer">{s.website.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗</a>}

        <div className="sc-board">
          <h4>Top 5 readers</h4>
          {s.top.length === 0 ? <p className="sc-none">No readers yet. The first one gets the crown 👑</p> : (
            <ol>
              {s.top.map((t, k) => (
                <li key={t.handle}>
                  <span className={`r r${k + 1}`}>{k < 3 ? ['🥇', '🥈', '🥉'][k] : k + 1}</span>
                  <span className="av" style={{ background: t.color ?? '#FFD400' }}>{t.name.slice(0, 1)}</span>
                  <span className="nm">{t.name}<small>{t.handle}{t.className ? ` · ${t.className}` : ''}</small></span>
                  <b>{fmt(t.points)}</b>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Tilt>
    </motion.div>
  );
}
