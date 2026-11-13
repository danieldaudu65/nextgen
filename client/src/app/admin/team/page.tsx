'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { adminApi, can, type AdminUser, type Role } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminShell';
import AnimatedSelect from '@/components/AnimatedSelect';

const ROLE_HELP: Record<Role, string> = {
  writer: 'Writes stories and sends them for review',
  editor: 'Publishes stories, manages editions and schools',
  superadmin: 'Everything, plus the team',
};

export default function AdminTeam() {
  const { admin, toast } = useAdmin();
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'writer' as Role });

  const load = () => adminApi.team().then(setRows).catch(() => setRows([]));
  useEffect(() => { if (can(admin, 'superadmin')) load(); }, [admin]);

  if (!can(admin, 'superadmin')) return <div className="admin-page"><p className="muted">Only superadmins can manage the team.</p></div>;

  const act = async (fn: () => Promise<{ message: string }>) => {
    try { toast((await fn()).message); load(); } catch (err) { toast(err instanceof ApiError ? err.message : 'Something went wrong', true); }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    act(() => adminApi.addMember(form)).then(() => setForm({ name: '', email: '', password: '', role: 'writer' }));
  };

  return (
    <div className="admin-page">
      <header className="admin-head"><div><span className="admin-eyebrow">People</span><h1 className="display">Team</h1><p className="muted">Writers draft, editors publish, superadmins manage the team.</p></div></header>

      <div className="admin-card flush">
        {!rows ? <p className="muted pad">Loading…</p> : (
          <table className="admin-table plain">
            <thead><tr><th>Name</th><th>Role</th><th>Last login</th><th></th></tr></thead>
            <tbody>
              {rows.map((m) => {
                const me = m.id === admin?.id;
                return (
                  <tr key={m.id} className={m.active ? '' : 'off'}>
                    <td><div className="story-cell"><span className={`admin-avatar role-${m.role}`}>{m.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span><div><b>{m.name}{me ? ' (you)' : ''}</b><small>{m.email}</small></div></div></td>
                    <td>
                      <AnimatedSelect label={`Role for ${m.name}`} value={m.role} disabled={me} onChange={(value) => act(() => adminApi.updateMember(m.id, { role: value as Role }))} options={[{ value: 'writer', label: 'Writer' }, { value: 'editor', label: 'Editor' }, { value: 'superadmin', label: 'Superadmin' }]} />
                    </td>
                    <td>{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString('en-NG') : 'Never'}</td>
                    <td className="row-actions">
                      {!me && (
                        <button className="btn sm white" onClick={() => act(() => adminApi.updateMember(m.id, { active: !m.active }))}>
                          {m.active ? 'Disable' : 'Enable'}
                        </button>
                      )}{' '}
                      <button className="btn sm white" onClick={() => {
                        const pw = window.prompt(`New password for ${m.name} (8+ characters)`);
                        if (pw) act(() => adminApi.updateMember(m.id, { password: pw }));
                      }}>Reset password</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <form className="admin-card form-grid" onSubmit={add}>
        <div className="panel-head span2"><span className="panel-no">+</span><div><h2>Add a team member</h2><p>They log in at /admin/login with this email and password.</p></div></div>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Starting password<input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required /></label>
        <label>Role
          <AnimatedSelect label="Team member role" value={form.role} onChange={(value) => setForm({ ...form, role: value as Role })} options={[{ value: 'writer', label: 'Writer' }, { value: 'editor', label: 'Editor' }, { value: 'superadmin', label: 'Superadmin' }]} />
          <small className="muted">{ROLE_HELP[form.role]}</small>
        </label>
        <button className="btn dark" type="submit">Add to team</button>
        <p className="muted">Share the starting password with them privately. They can ask you to reset it any time.</p>
      </form>
    </div>
  );
}
