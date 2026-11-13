'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { schoolApi, type SchoolStudent } from '@/lib/schoolApi';
import { ApiError } from '@/lib/api';

const ago = (day?: string) => {
  if (!day) return 'Never';
  const d = Math.round((Date.now() - new Date(`${day}T12:00:00`).getTime()) / 864e5);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};

export default function SchoolStudents({ say, onChange }: { say: (t: string, bad?: boolean) => void; onChange: () => void }) {
  const [list, setList] = useState<SchoolStudent[] | null>(null);
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const load = () => schoolApi.students().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const classes = useMemo(() => [...new Set((list ?? []).map((s) => s.className).filter(Boolean))].sort() as string[], [list]);
  const shown = (list ?? []).filter((s) => (!cls || s.className === cls) && (!q || `${s.name} ${s.handle}`.toLowerCase().includes(q.toLowerCase())));

  const act = async (fn: () => Promise<{ message: string }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try { const r = await fn(); say(r.message); load(); onChange(); } catch (e) { say(e instanceof ApiError ? e.message : 'Something went wrong', true); }
  };

  return (
    <section className="sch-panel">
      <div className="panel-h">
        <h3>Students <small>({list?.length ?? '…'})</small></h3>
        <div className="sch-filters">
          <input type="search" placeholder="Search name or handle" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class">
            <option value="">All classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {!list ? <div className="sch-loading small"><div className="spinner" /></div> : shown.length === 0 ? (
        <div className="chart-empty">{list.length ? 'Nobody matches that search.' : 'No students yet. Share codes from the Codes tab.'}</div>
      ) : (
        <div className="sch-table-wrap">
          <table className="sch-table">
            <thead><tr><th>Student</th><th>Class</th><th>Points</th><th>Streak</th><th>Last active</th><th>Device</th><th /></tr></thead>
            <tbody>
              <AnimatePresence>
                {shown.map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
                    <td><span className="who"><span className="av" style={{ background: s.color ?? '#FFD400' }}>{s.name.slice(0, 1)}</span><span>{s.name}<small>@{s.handle}{s.code ? ` · ${s.code}` : ''}</small></span></span></td>
                    <td>{s.className ?? '–'}</td>
                    <td><b>{s.points.toLocaleString('en-NG')}</b></td>
                    <td>{s.streak ? `🔥 ${s.streak}` : '–'}</td>
                    <td>{ago(s.lastActiveDay)}</td>
                    <td>{s.code ? (s.deviceLocked ? <span className="tag lock">🔒 Locked</span> : <span className="tag">Not set</span>) : <span className="tag">No code</span>}</td>
                    <td className="acts">
                      {s.deviceLocked && <button className="sch-ghost sm" onClick={() => act(() => schoolApi.unlock(s.id))} title="New phone? Unlock so they can log in on it">Unlock device</button>}
                      <button className="sch-ghost sm danger" onClick={() => act(() => schoolApi.remove(s.id), `Remove ${s.name} from your school? Their seat becomes free and they lose school access.`)}>Remove</button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
