'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { usePoints } from '@/components/PointsProvider';
import AccessCard from '@/components/AccessCard';
import { api, ApiError } from '@/lib/api';
import { naira, period, useSiteSettings } from '@/lib/useSiteSettings';

// Get NextGen access: a school code, or pay for yourself (Paystack)
function GetAccessPageInner() {
  const back = useSearchParams()?.get('back') || '/';
  const { me, setMe, openJoin } = usePoints();
  const { settings, demoPayments } = useSiteSettings();
  const [email, setEmail] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.payPersonal(plan?.id ?? '', email);
      location.href = r.url;
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'Could not start the payment');
      setBusy(false);
    }
  };

  const active = me?.access?.active;
  const plans = settings.personalPlans;
  // middle package highlighted by default (usually the best value)
  const plan = plans.find((p) => p.id === planId) ?? plans[Math.min(1, plans.length - 1)];
  return (
    <section className="sec access-page">
      <div className="wrap">
        <span className="tagbar">NEXTGEN ACCESS</span>
        <h1 className="display">Points. Games. Leaderboard.</h1>
        <p className="sub">Reading NextGen is free for everyone. To play the games, answer the quick checks and earn points, you need access: free with a code if your school is on NextGen, or a package if it isn&apos;t.</p>

        {active ? (
          <motion.div className="access-done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <h3>You&apos;re in 🎉</h3>
            <p>{me?.access?.type === 'school' ? `Your school gives you access` : 'Your package is active'}{me?.access?.until ? ` until ${new Date(me.access.until).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.</p>
            <Link className="btn dark" href={back}>Back to reading</Link>
          </motion.div>
        ) : (
          <div className="access-grid">
            <motion.div className="access-tile" initial={{ opacity: 0, y: 30, rotateX: 18 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} whileHover={{ y: -6, rotateX: 4 }}>
              <span className="chip">FROM YOUR SCHOOL</span>
              {me ? <AccessCard back={back} onRedeemed={(m) => setMe(m)} showPay={false} /> : (
                <>
                  <h3>Got a school code?</h3>
                  <p>If your school is on NextGen, they&apos;ll give you a code or a join link.</p>
                  <button className="btn dark" onClick={() => openJoin('Join with your school code.')}>Join with a code</button>
                </>
              )}
            </motion.div>
            <motion.div className="access-tile is-pay" initial={{ opacity: 0, y: 30, rotateX: 18 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.1 }} whileHover={{ y: -6, rotateX: 4 }}>
              <span className="chip">NOT IN A NEXTGEN SCHOOL?</span>
              <h3>Pick a package</h3>
              <div className="pkg-list" role="radiogroup" aria-label="Packages">
                {plans.map((p) => (
                  <motion.button key={p.id} type="button" role="radio" aria-checked={plan?.id === p.id} className={`pkg${plan?.id === p.id ? ' on' : ''}`} onClick={() => setPlanId(p.id)} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
                    <b>{p.name}</b><span className="pkg-price">{naira(p.price)}<small>/{period(p.days)}</small></span>
                  </motion.button>
                ))}
              </div>
              <ul className="ticks"><li>All games, quizzes and debates</li><li>Points for every story + quick check</li><li>Your name on the leaderboard</li></ul>
              {me ? (
                <form onSubmit={pay} className="pay-form">
                  <label>Email for the receipt <small>(a parent&apos;s is fine)</small><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="parent@email.com" /></label>
                  {err && <div className="modal-err">{err}</div>}
                  <button className="btn yellow" disabled={busy || !plan}>{busy ? 'Opening checkout…' : plan ? `Pay ${naira(plan.price)} with Paystack` : 'No packages yet'}</button>
                  {demoPayments && <p className="fine">Demo mode: no real money is taken.</p>}
                </form>
              ) : (
                <button className="btn yellow" onClick={() => openJoin('Join first, then pick your package.')}>Join, then pay</button>
              )}
            </motion.div>
          </div>
        )}
        <p className="fine center">Are you a school? <Link href="/school/login">Set up your school</Link> and give every student access.</p>
      </div>
    </section>
  );
}

// useSearchParams needs a Suspense boundary for `next build`
export default function GetAccessPage() {
  return <Suspense fallback={null}><GetAccessPageInner /></Suspense>;
}
