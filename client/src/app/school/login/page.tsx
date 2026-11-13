'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { schoolApi } from '@/lib/schoolApi';
import { ApiError } from '@/lib/api';

// School login + "set up your school"
export default function SchoolLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ email: '', password: '', schoolName: '', city: '', state: '', name: '', phone: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'login') await schoolApi.login(f.email, f.password);
      else await schoolApi.register({ schoolName: f.schoolName, city: f.city, state: f.state, name: f.name, email: f.email, phone: f.phone, password: f.password });
      router.push('/school');
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : "Can't reach NextGen right now.");
      setBusy(false);
    }
  };

  return (
    <div className="sch-login">
      <div className="sch-login-art" aria-hidden="true">
        <Logo onDark />
        <h1>Bring NextGen<br />to your school.</h1>
        <p>Give every student access with one code each. Watch reading grow, class by class.</p>
        <div className="sch-float">
          {['📖 Reading +38%', '🏆 #4 in Lagos', '🔥 112 streaks', '🧠 81% quick checks'].map((t, i) => (
            <motion.span key={t} style={{ left: `${8 + (i % 2) * 44}%`, top: `${10 + i * 21}%` }} animate={{ y: [0, -14, 0], rotateZ: [i % 2 ? 3 : -3, i % 2 ? -2 : 2, i % 2 ? 3 : -3] }} transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}>{t}</motion.span>
          ))}
        </div>
      </div>
      <div className="sch-login-form">
        <motion.form onSubmit={submit} className="sch-card" initial={{ opacity: 0, rotateY: -18, x: 30 }} animate={{ opacity: 1, rotateY: 0, x: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 20 }}>
          <div className="sch-tabs">
            {(['login', 'register'] as const).map((m) => (
              <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setErr(null); }}>
                {mode === m && <motion.span layoutId="sch-login-tab" className="pill" />}
                <span>{m === 'login' ? 'Log in' : 'Set up a school'}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={mode} className="sch-fields" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {mode === 'register' && (
                <>
                  <label>School name<input value={f.schoolName} onChange={set('schoolName')} required placeholder="King's College" /></label>
                  <div className="row2"><label>City<input value={f.city} onChange={set('city')} placeholder="Lagos" /></label><label>State<input value={f.state} onChange={set('state')} placeholder="Lagos" /></label></div>
                  <div className="row2"><label>Your name<input value={f.name} onChange={set('name')} required placeholder="Mrs Adeyemi" /></label><label>Phone<input value={f.phone} onChange={set('phone')} placeholder="0803…" /></label></div>
                </>
              )}
              <label>Email<input type="email" value={f.email} onChange={set('email')} required placeholder="nextgen@school.edu.ng" /></label>
              <label>Password<input type="password" value={f.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} /></label>
            </motion.div>
          </AnimatePresence>
          {err && <div className="sch-err">{err}</div>}
          <button className="sch-btn" disabled={busy}>{busy ? 'One sec…' : mode === 'login' ? 'Log in' : 'Create school account'}</button>
          <p className="sch-fine">Students don&apos;t log in here. They join on the <Link href="/">NextGen website</Link> with the code you give them.</p>
        </motion.form>
      </div>
    </div>
  );
}
