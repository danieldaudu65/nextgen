'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { adminApi, can, type AdminNomination, type NominationStatus } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminShell';

const TABS: { key: '' | NominationStatus; label: string }[] = [
  { key: 'new', label: 'New' }, { key: 'shortlisted', label: 'Shortlisted' }, { key: 'featured', label: 'Featured' }, { key: 'declined', label: 'Declined' }, { key: '', label: 'All' },
];
const when = (d: string) => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

// Admin → Nominations: read, shortlist, feature (shows on /nominate) or decline
export default function AdminNominations() {
  const { admin, toast } = useAdmin();
  const [status, setStatus] = useState<'' | NominationStatus>('new');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AdminNomination[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [blurb, setBlurb] = useState('');
  const [note, setNote] = useState('');
  const editor = can(admin, 'editor');

  const load = () => adminApi.nominations({ status, q }).then((r) => { setRows(r.nominations); setCounts(r.counts); }).catch(() => setRows([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [status, q]);

  const open = rows?.find((n) => n.id === openId) ?? null;
  useEffect(() => { setBlurb(open?.featureBlurb ?? ''); setNote(open?.adminNote ?? ''); }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id: string, data: Parameters<typeof adminApi.updateNomination>[1]) => {
    try { toast((await adminApi.updateNomination(id, data)).message); load(); } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not save', true); }
  };

  return (
    <div className="admin-page">
      <header className="admin-head"><div><span className="admin-eyebrow">Community</span><h1 className="display">Nominations</h1><p className="muted">Stars nominated on the Nominate a Star page. Feature one to show it on the Hall of Stars.</p></div></header>

      <div className="admin-toolbar">
        <div className="admin-tabs" role="tablist">
          {TABS.map((t) => <button key={t.key || 'all'} className={status === t.key ? 'on' : ''} onClick={() => setStatus(t.key)}>{t.label}{t.key && counts[t.key] ? ` (${counts[t.key]})` : ''}</button>)}
        </div>
        <label className="admin-search"><input placeholder="Search name, school, headline…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search nominations" /></label>
      </div>

      <div className="nom-layout">
        <div className="admin-card flush nom-list">
          {!rows ? <p className="muted pad">Loading…</p> : rows.length === 0 ? <p className="muted pad">No nominations here.</p> : rows.map((n) => (
            <button key={n.id} className={`nom-row${openId === n.id ? ' on' : ''}`} onClick={() => setOpenId(n.id)}>
              {n.photo ? <img src={n.photo} alt="" /> : <span className="nom-ph">{n.nomineeName.slice(0, 1)}</span>}
              <span className="nom-txt"><b>{n.nomineeName}{n.nomineeAge ? `, ${n.nomineeAge}` : ''}</b><small>{n.headline}</small><small className="muted">{n.category} · {[n.schoolName, n.state].filter(Boolean).join(', ') || 'No school given'} · {when(n.createdAt)}</small></span>
              <span className={`status status-${n.status === 'featured' ? 'published' : n.status === 'shortlisted' ? 'review' : n.status === 'declined' ? 'draft' : 'review'}`}>{n.status}</span>
            </button>
          ))}
        </div>

        <aside className="admin-card nom-detail">
          {!open ? <p className="muted">Choose a nomination to read it.</p> : (
            <>
              <div className="nom-head">
                {open.photo ? <img src={open.photo} alt="" /> : <span className="nom-ph big">{open.nomineeName.slice(0, 1)}</span>}
                <div><h2>{open.nomineeName}{open.nomineeAge ? `, ${open.nomineeAge}` : ''}</h2><p className="muted">{open.category} · {[open.schoolName, open.city, open.state].filter(Boolean).join(', ')}</p></div>
              </div>
              <h3>{open.headline}</h3>
              <p className="nom-story">{open.story}</p>
              {open.links.length > 0 && <div className="nom-links">{open.links.map((l) => <a key={l} href={l} target="_blank" rel="noreferrer">{l.replace(/^https?:\/\//, '').slice(0, 50)} ↗</a>)}</div>}
              <div className="nom-by">
                <b>Nominated by {open.nominatorName}</b>{open.relationship ? ` (${open.relationship})` : ''}
                <span>{[open.nominatorEmail, open.nominatorPhone].filter(Boolean).join(' · ')}</span>
                <span>{open.consent ? '✓ Parent/guardian consent given' : '⚠ No consent'}</span>
              </div>
              {editor && (
                <>
                  <label>Short public line (shown when featured)<input value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={240} placeholder="Turning scrap into power ☀️" /></label>
                  <label>Team note (private)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></label>
                  <div className="nom-acts">
                    <button className="btn sm" onClick={() => act(open.id, { status: 'featured', featureBlurb: blurb, adminNote: note })}>🌟 Feature</button>
                    <button className="btn sm white" onClick={() => act(open.id, { status: 'shortlisted', featureBlurb: blurb, adminNote: note })}>Shortlist</button>
                    <button className="btn sm white" onClick={() => act(open.id, { status: 'declined', adminNote: note })}>Decline</button>
                    {open.status !== 'new' && <button className="btn sm white" onClick={() => act(open.id, { status: 'new' })}>Back to new</button>}
                    {can(admin, 'superadmin') && <button className="btn sm danger" onClick={async () => { if (!window.confirm(`Delete the nomination for ${open.nomineeName}?`)) return; try { toast((await adminApi.deleteNomination(open.id)).message); setOpenId(null); load(); } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not delete', true); } }}>Delete</button>}
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
