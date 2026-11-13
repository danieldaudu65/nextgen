'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { adminApi, can, type AdminSchool } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminShell';

export default function AdminSchools() {
  const { admin, toast } = useAdmin();
  const [rows, setRows] = useState<AdminSchool[] | null>(null);
  const [q, setQ] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', state: '' });
  const editor = can(admin, 'editor');
  const boss = can(admin, 'superadmin');
  const [plans, setPlans] = useState<{ id: string; name: string; seats: number }[]>([]);
  useEffect(() => { adminApi.settings().then((r) => setPlans(r.settings.schoolPlans)).catch(() => null); }, []);
  const planLabel = (s: AdminSchool) => {
    const active = s.accessUntil && new Date(s.accessUntil) > new Date();
    if (!active) return <span className="status status-draft">No plan</span>;
    return <span className="plan-cell"><span className="status status-published">{plans.find((p) => p.id === s.plan)?.name ?? s.plan ?? 'Plan'} · {s.seats} seats</span><small>until {new Date(s.accessUntil as string).toLocaleDateString('en-NG')}</small></span>;
  };
  // Give a plan by hand (paid by transfer, a free pilot, …)
  const grant = (s: AdminSchool) => {
    const list = plans.map((p, i) => `${i + 1}. ${p.name} (${p.seats} seats)`).join('\n');
    const pick = window.prompt(`Give ${s.name} a plan (no payment taken). Type a number:\n${list}`, '2');
    const plan = plans[Number(pick) - 1];
    if (plan) act(() => adminApi.grantPlan(s.id, { planId: plan.id }));
  };

  const load = () => adminApi.schools({ q, verified: onlyNew ? '0' : undefined }).then(setRows).catch(() => setRows([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, onlyNew]);

  const act = async (fn: () => Promise<{ message: string }>) => {
    try { toast((await fn()).message); load(); } catch (err) { toast(err instanceof ApiError ? err.message : 'Something went wrong', true); }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    act(() => adminApi.createSchool({ ...form, verified: true })).then(() => setForm({ name: '', city: '', state: '' }));
  };

  return (
    <div className="admin-page">
      <header className="admin-head"><div><span className="admin-eyebrow">Community</span><h1 className="display">Schools</h1><p className="muted">{rows ? `${rows.length} school${rows.length === 1 ? '' : 's'} · ${rows.filter((s) => !s.verified).length} waiting to be verified` : 'Loading…'}</p></div></header>

      <div className="admin-filters">
        <label className="admin-search"><input placeholder="Search schools…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search schools" /></label>
        <label className="mini-toggle chip-toggle"><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Only not verified</label>
      </div>

      <div className="admin-card flush">
        {!rows ? <p className="muted pad">Loading…</p> : rows.length === 0 ? <p className="muted pad">No schools found.</p> : (
          <table className="admin-table plain">
            <thead><tr><th>School</th><th>Students</th><th>Points</th><th>Plan</th><th>Verified</th>{editor && <th></th>}</tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><div className="story-cell"><span className="school-badge">{s.name.slice(0, 1).toUpperCase()}</span><div><b>{s.name}</b><small>{[s.city, s.state].filter(Boolean).join(', ')}{s.sample ? ' · sample' : ''}</small></div></div></td>
                  <td>{s.studentCount}</td>
                  <td>{s.points.toLocaleString('en-NG')}</td>
                  <td>{planLabel(s)}</td>
                  <td>{s.verified ? <span className="status status-published">Verified</span> : <span className="status status-review">To verify</span>}</td>
                  {editor && (
                    <td className="row-actions">
                      <button className="btn sm white" onClick={() => act(() => adminApi.updateSchool(s.id, { verified: !s.verified }))}>
                        {s.verified ? 'Unverify' : 'Verify'}
                      </button>{' '}
                      {boss && <><button className="btn sm white" onClick={() => grant(s)}>Give plan</button>{' '}</>}
                      {can(admin, 'superadmin') && s.studentCount === 0 && (
                        <button className="btn sm danger" onClick={() => window.confirm(`Delete ${s.name}?`) && act(() => adminApi.deleteSchool(s.id))}>Delete</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editor && (
        <form className="admin-card form-grid" onSubmit={add}>
          <div className="panel-head span2"><span className="panel-no">+</span><div><h2>Add a school</h2><p>Students pick their school when they join.</p></div></div>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label>State<input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
          <button className="btn dark" type="submit">Add school</button>
        </form>
      )}
    </div>
  );
}
