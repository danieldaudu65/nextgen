'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { naira } from '@/lib/useSiteSettings';

// DEMO checkout (only when the server has no PAYSTACK_SECRET_KEY). Lets you test the whole flow without money.
function DemoCheckoutInner() {
  const reference = useSearchParams()?.get('reference') ?? '';
  const [p, setP] = useState<{ kind: string; amount: number; seats: number; days: number; email?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.demoPayment(reference).then((r) => setP(r.payment)).catch(() => setErr('Payment not found, or the server is using real Paystack.')); }, [reference]);

  const finish = async (outcome: 'paid' | 'failed') => {
    setBusy(true);
    await api.finishDemoPayment(reference, outcome).catch(() => null);
    location.href = `/pay/callback?reference=${encodeURIComponent(reference)}`;
  };

  return (
    <section className="sec pay-result">
      <div className="wrap pay-card demo-checkout">
        <span className="tagbar">DEMO CHECKOUT · NO REAL MONEY</span>
        {err && <p className="modal-err">{err}</p>}
        {p && (
          <>
            <h2>{naira(p.amount)}</h2>
            <p>{p.kind === 'school' ? `School plan: ${p.seats} student seats for ${p.days} days` : `Personal access for ${p.days} days`}{p.email ? ` · receipt to ${p.email}` : ''}</p>
            <div className="gate-actions">
              <button className="btn dark" disabled={busy} onClick={() => finish('paid')}>✓ Pay (demo)</button>
              <button className="btn white" disabled={busy} onClick={() => finish('failed')}>✕ Fail payment</button>
            </div>
            <p className="fine">Add PAYSTACK_SECRET_KEY to server/.env to use the real Paystack checkout.</p>
          </>
        )}
      </div>
    </section>
  );
}

// useSearchParams needs a Suspense boundary for `next build`
export default function DemoCheckout() {
  return <Suspense fallback={null}><DemoCheckoutInner /></Suspense>;
}
