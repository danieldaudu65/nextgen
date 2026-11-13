'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminShell';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';

export default function AdminLogin() {
  const router = useRouter();
  const { setAdmin } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setAdmin(await adminApi.login(email, password));
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <section className="login-art" aria-hidden="true">
        <div className="login-brand"><Logo onDark size="lg" /><span>Newsroom</span></div>
        <div className="login-stage">
          <div className="login-card c1"><span className="chip">THE BIG NEWS</span><b>Nigeria 2027 Loading…</b><i /><i /><i className="short" /></div>
          <div className="login-card c2"><span className="chip">MONEY MATTERS</span><b>The ₦10K Money Mystery</b><i /><i className="short" /></div>
          <div className="login-card c3"><span className="chip">NEXTGEN STARS</span><b>3 Stars. 3 Lessons.</b><i /><i /></div>
          <span className="login-sticker s1"><Icon name="mega" size={46} /></span>
          <span className="login-sticker s2"><Icon name="star" size={40} /></span>
        </div>
        <p>Write it. Review it. Publish it. The NextGen newsroom in one place.</p>
      </section>

      <section className="login-side">
        <form className="login-form" onSubmit={submit}>
          <span className="tagbar">NEXTGEN TEAM</span>
          <h1 className="display">Welcome back</h1>
          <p className="muted">Log in to write and publish stories.</p>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" placeholder="you@punchng.com" /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" /></label>
          {error && <div className="modal-err" role="alert">{error}</div>}
          <button className="btn dark login-submit" type="submit" disabled={busy}>
            {busy ? 'One sec…' : 'Log in →'}
          </button>
          <p className="modal-fine">No account? Ask a NextGen superadmin to add you.</p>
        </form>
      </section>
    </div>
  );
}
