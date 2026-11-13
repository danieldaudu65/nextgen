'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Me, School } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import AnimatedSelect from '@/components/AnimatedSelect';

export default function JoinModal({ reason, onClose, onDone, initialMode = 'join', code: linkCode }: {
  reason?: string; onClose: () => void; onDone: (me: Me) => void; initialMode?: 'join' | 'login'; code?: string;
}) {
  const [mode, setMode] = useState<'join' | 'login'>(initialMode);
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState({ name: '', handle: '', password: '', schoolId: '', className: '', code: linkCode ?? '' });
  // A school code (from the join link, or typed): shows which school you're joining
  const [codeInfo, setCodeInfo] = useState<{ valid: boolean; message: string | null; school: { name: string; city?: string } | null } | null>(null);
  const [showCode, setShowCode] = useState(Boolean(linkCode));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.schools().then(setSchools).catch(() => setSchools([]));
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);

  // check the code as they type (or straight away when it came in the link)
  useEffect(() => {
    const c = form.code.replace(/[^A-Za-z0-9]/g, '');
    if (c.length < 6) { setCodeInfo(null); return; }
    const t = setTimeout(() => api.checkCode(c).then(setCodeInfo).catch(() => setCodeInfo(null)), 350);
    return () => clearTimeout(t);
  }, [form.code]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me =
        mode === 'join'
          ? await api.register({ ...form, code: form.code || undefined, schoolId: form.code ? undefined : form.schoolId || undefined, className: form.className || undefined })
          : await api.login({ handle: form.handle, password: form.password });
      onDone(me);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach NextGen right now. Try again in a bit.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label={mode === 'join' ? 'Join NextGen' : 'Log in'}>
        <button type="button" className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <span className="tagbar">{mode === 'join' ? 'JOIN FREE' : 'WELCOME BACK'}</span>
        <h3 className="display">{mode === 'join' ? 'Tap in. Level up.' : 'Log in'}</h3>
        <p className="modal-sub">{reason ?? 'Save your points, keep your streak, and put your school on the leaderboard.'}</p>

        {mode === 'join' && (
          <label>Your name<input value={form.name} onChange={set('name')} required maxLength={40} placeholder="Amaka" /></label>
        )}
        <label>Handle<input value={form.handle} onChange={set('handle')} required placeholder="amaka.reads" pattern="@?[A-Za-z0-9._]{3,20}" title="3–20 letters, numbers, dots or underscores" /></label>
        <label>Password<input type="password" value={form.password} onChange={set('password')} required minLength={6} /></label>
        {mode === 'join' && linkCode && codeInfo?.valid && (
          <div className="code-badge">🏫 Joining <b>{codeInfo.school?.name}</b> with code <code>{form.code}</code>. Your school gives you full access.</div>
        )}
        {mode === 'join' && (!linkCode || (codeInfo && !codeInfo.valid)) && (
          showCode ? (
            <label>School code <small>(from your school)</small>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="K7MP2QXA" maxLength={16} />
              {codeInfo && <small className={codeInfo.valid ? 'code-ok' : 'code-bad'}>{codeInfo.valid ? `✓ ${codeInfo.school?.name}${codeInfo.school?.city ? `, ${codeInfo.school.city}` : ''}` : codeInfo.message}</small>}
            </label>
          ) : (
            <button type="button" className="code-toggle" onClick={() => setShowCode(true)}>Have a school code? Add it</button>
          )
        )}
        {mode === 'join' && (
          <div className="modal-row">
            {form.code && codeInfo?.valid ? <label>School<input value={codeInfo.school?.name ?? ''} readOnly /></label> : <label>School<AnimatedSelect label="School" value={form.schoolId} onChange={(value) => setForm({ ...form, schoolId: value })} options={[{ value: '', label: 'Pick your school' }, ...schools.map((s) => ({ value: s.id, label: `${s.name}${s.city ? `, ${s.city}` : ''}` }))]} placeholder="Pick your school" /></label>}
            <label>Class<input value={form.className} onChange={set('className')} placeholder="SS2" maxLength={20} /></label>
          </div>
        )}

        {error && <div className="modal-err">{error}</div>}
        <button className="btn dark" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? 'One sec…' : mode === 'join' ? 'Create my account' : 'Log in'}
        </button>
        <p className="modal-switch">
          {mode === 'join' ? 'Already joined?' : 'New here?'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'join' ? 'login' : 'join'); setError(null); }}>
            {mode === 'join' ? 'Log in' : 'Join free'}
          </button>
        </p>
        {mode === 'join' && <p className="modal-fine">We only ask for a name, a handle and your school. No email, no phone number.{form.code ? ' Accounts made with a school code work on this device only.' : ''}</p>}
      </form>
    </div>
  );
}
