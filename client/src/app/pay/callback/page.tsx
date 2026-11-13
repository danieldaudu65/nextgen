'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { usePoints } from '@/components/PointsProvider';
import { api } from '@/lib/api';

// Paystack sends people back here: /pay/callback?reference=...
function PayCallbackInner() {
  const params = useSearchParams();
  const reference = params?.get('reference') || params?.get('trxref') || '';
  const { setMe } = usePoints();
  const [state, setState] = useState<{ status: 'checking' | 'paid' | 'pending' | 'failed' | 'error'; kind?: string }>({ status: 'checking' });

  useEffect(() => {
    if (!reference) { setState({ status: 'error' }); return; }
    let tries = 0;
    const check = () => api.verifyPayment(reference).then((r) => {
      if (r.user) setMe(r.user);
      if (r.payment.status === 'pending' && tries++ < 5) { setTimeout(check, 2500); setState({ status: 'pending', kind: r.payment.kind }); return; }
      setState({ status: r.payment.status, kind: r.payment.kind });
    }).catch(() => setState({ status: 'error' }));
    check();
  }, [reference, setMe]);

  const school = state.kind === 'school';
  return (
    <section className="sec pay-result">
      <motion.div className={`wrap pay-card is-${state.status}`} initial={{ opacity: 0, rotateX: 20, y: 30 }} animate={{ opacity: 1, rotateX: 0, y: 0 }}>
        {state.status === 'checking' && <><div className="spinner" /><h2>Checking your payment…</h2></>}
        {state.status === 'pending' && <><div className="spinner" /><h2>Waiting for Paystack…</h2><p>This can take a few seconds.</p></>}
        {state.status === 'paid' && <><div className="gate-emoji">🎉</div><h2>Payment received!</h2><p>{school ? 'Your seats are ready. Create codes for your students on the dashboard.' : 'Your access is on. Go earn those points.'}</p><Link className="btn dark" href={school ? '/school' : '/'}>{school ? 'Open the school dashboard' : 'Start reading'}</Link></>}
        {state.status === 'failed' && <><div className="gate-emoji">😕</div><h2>The payment didn&apos;t go through</h2><p>No money was taken. You can try again.</p><Link className="btn dark" href={school ? '/school' : '/get-access'}>Try again</Link></>}
        {state.status === 'error' && <><div className="gate-emoji">🤔</div><h2>We couldn&apos;t find that payment</h2><p>If money left your account, contact NextGen with reference <code>{reference || 'unknown'}</code>.</p></>}
        {reference && <p className="fine">Reference: {reference}</p>}
      </motion.div>
    </section>
  );
}

// useSearchParams needs a Suspense boundary for `next build`
export default function PayCallback() {
  return <Suspense fallback={null}><PayCallbackInner /></Suspense>;
}
