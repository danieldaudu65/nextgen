'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { schoolApi, type SchoolCode, type SchoolInfo } from '@/lib/schoolApi';
import { ApiError } from '@/lib/api';

const STATUS = [{ key: '', label: 'All' }, { key: 'unused', label: 'Not used yet' }, { key: 'used', label: 'Used' }, { key: 'revoked', label: 'Cancelled' }] as const;

export default function SchoolCodes({ school, say, onChange, go }: { school: SchoolInfo; say: (t: string, bad?: boolean) => void; onChange: () => void; go: (t: 'plan') => void }) {
  const [codes, setCodes] = useState<SchoolCode[] | null>(null);
  const [base, setBase] = useState('');
  const [status, setStatus] = useState<string>('');
  const [count, setCount] = useState(10);
  const [cls, setCls] = useState('');
  const [names, setNames] = useState('');
  const [byName, setByName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const load = (s = status) => schoolApi.codes(s).then((r) => { setCodes(r.codes); setBase(r.joinBase); }).catch(() => setCodes([]));
  useEffect(() => { load(status); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = (c: string) => `${base}${c}`;
  const copy = async (text: string, what = 'Copied') => { try { await navigator.clipboard.writeText(text); say(`${what} ✓`); } catch { say('Could not copy. Select and copy it by hand.', true); } };

  const make = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await schoolApi.makeCodes(byName ? { labels: names, className: cls } : { count, className: cls });
      say(r.message);
      setFresh(new Set(r.codes.map((c) => c.id)));
      setNames('');
      await load(status);
      onChange();
    } catch (err) {
      say(err instanceof ApiError ? err.message : 'Could not create codes', true);
    } finally {
      setBusy(false);
    }
  };

  const unused = (codes ?? []).filter((c) => c.status === 'unused');
  const csv = () => {
    const rows = [['code', 'join link', 'status', 'name', 'class', 'student'], ...(codes ?? []).map((c) => [c.code, link(c.code), c.status, c.label ?? '', c.className ?? '', c.student ? `${c.student.name} (@${c.student.handle})` : ''])];
    const blob = new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${school.name.replace(/[^a-z0-9]+/gi, '-')}-nextgen-codes.csv`;
    a.click();
  };

  return (
    <div className="sch-grid">
      <section className="sch-panel">
        <div className="panel-h"><h3>Create codes</h3><small>{school.codes.left} of {school.plan.seats} seats left</small></div>
        {!school.plan.active ? (
          <div className="chart-empty">You need an active plan to create codes. <button className="sch-btn sm" onClick={() => go('plan')}>See plans</button></div>
        ) : (
          <form className="code-form" onSubmit={make}>
            <div className="seg">
              <button type="button" className={!byName ? 'on' : ''} onClick={() => setByName(false)}>How many</button>
              <button type="button" className={byName ? 'on' : ''} onClick={() => setByName(true)}>One per name</button>
            </div>
            {byName
              ? <label>Student names <small>(one per line, optional but handy)</small><textarea rows={5} value={names} onChange={(e) => setNames(e.target.value)} placeholder={'Amaka Obi\nTobi Bello\nZainab Musa'} /></label>
              : <label>Number of codes<input type="number" min={1} max={Math.max(1, school.codes.left)} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>}
            <label>Class <small>(optional)</small><input value={cls} onChange={(e) => setCls(e.target.value)} placeholder="SS2" maxLength={20} /></label>
            <button className="sch-btn" disabled={busy || school.codes.left < 1}>{busy ? 'Creating…' : 'Create codes'}</button>
            <p className="sch-fine">Each code works for <b>one</b> student account, on <b>one</b> device. Send the link (the code is inside it) or the code itself.</p>
          </form>
        )}
      </section>

      <section className="sch-panel wide">
        <div className="panel-h">
          <h3>Your codes</h3>
          <div className="sch-filters">
            <div className="seg">{STATUS.map((s) => <button key={s.key} className={status === s.key ? 'on' : ''} onClick={() => setStatus(s.key)}>{s.label}</button>)}</div>
            <button className="sch-ghost sm" onClick={() => copy(unused.map((c) => `${c.label ? `${c.label}: ` : ''}${link(c.code)}`).join('\n'), `${unused.length} links copied`)} disabled={!unused.length}>Copy unused links</button>
            <button className="sch-ghost sm" onClick={csv} disabled={!codes?.length}>Download CSV</button>
          </div>
        </div>
        {!codes ? <div className="sch-loading small"><div className="spinner" /></div> : codes.length === 0 ? <div className="chart-empty">No codes here yet.</div> : (
          <div className="code-grid">
            <AnimatePresence>
              {codes.map((c, i) => (
                <motion.div key={c.id} className={`code-card is-${c.status}${fresh.has(c.id) ? ' is-new' : ''}`} layout initial={{ opacity: 0, rotateY: -70, scale: 0.9 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} transition={{ delay: Math.min(i, 20) * 0.025, type: 'spring', stiffness: 220, damping: 20 }} whileHover={{ y: -4, rotateX: 6 }}>
                  <div className="code-top"><code>{c.code}</code><span className={`tag ${c.status}`}>{c.status === 'unused' ? 'Ready' : c.status === 'used' ? 'Used' : 'Cancelled'}</span></div>
                  <small>{c.student ? <>👤 {c.student.name} · @{c.student.handle}</> : c.label ? <>For {c.label}</> : 'Anyone with the code'}{c.className ? ` · ${c.className}` : ''}</small>
                  {c.status === 'unused' && (
                    <div className="code-acts">
                      <button onClick={() => copy(link(c.code), 'Join link copied')}>Copy link</button>
                      <a href={`https://wa.me/?text=${encodeURIComponent(`Join ${school.name} on PUNCH NextGen: ${link(c.code)}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                      <button className="danger" onClick={async () => { if (!window.confirm(`Cancel code ${c.code}?`)) return; try { say((await schoolApi.revoke(c.id)).message); load(); onChange(); } catch (e) { say(e instanceof ApiError ? e.message : 'Could not cancel', true); } }}>Cancel</button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
