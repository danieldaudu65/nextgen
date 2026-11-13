'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { schoolApi, type SchoolInfo, type SchoolPayment } from '@/lib/schoolApi';
import type { SchoolPlan as Plan } from '@/lib/types';
import { ApiError } from '@/lib/api';
import { naira } from '@/lib/useSiteSettings';
import Tilt from './Tilt';

export default function SchoolPlan({ school, say }: { school: SchoolInfo; say: (t: string, bad?: boolean) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [demo, setDemo] = useState(false);
  const [history, setHistory] = useState<SchoolPayment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    schoolApi.plans().then((r) => { setPlans(r.plans); setDemo(r.demo); }).catch(() => null);
    schoolApi.payments().then(setHistory).catch(() => null);
  }, []);

  const buy = async (p: Plan) => {
    setBusy(p.id);
    try { location.href = (await schoolApi.pay(p.id)).url; }
    catch (e) { say(e instanceof ApiError ? e.message : 'Could not start the payment', true); setBusy(null); }
  };
  const until = school.plan.until ? new Date(school.plan.until).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="sch-grid">
      <section className="sch-panel wide">
        <div className="panel-h"><h3>Your plan</h3>{demo && <span className="tag">Demo payments (no real money)</span>}</div>
        <p className="plan-now">
          {school.plan.active
            ? <>✅ <b>{plans.find((p) => p.id === school.plan.id)?.name ?? 'Active plan'}</b>: {school.plan.seats} seats, until {until}. {school.codes.used} used, {school.codes.left} left to give.</>
            : <>No active plan. Pick one below: every seat is one student with full access (points, quick checks, games, leaderboard).</>}
        </p>
        <div className="plan-grid">
          {plans.map((p, i) => {
            const current = school.plan.active && school.plan.id === p.id;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 30, rotateX: 20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: i * 0.08 }}>
                <Tilt className={`plan-card${i === 1 ? ' hot' : ''}${current ? ' current' : ''}`}>
                  {i === 1 && <span className="ribbon">Most schools</span>}
                  <h4>{p.name}</h4>
                  <div className="price">{naira(p.price)}</div>
                  <ul className="ticks"><li>{p.seats} student seats</li><li>{p.days >= 365 ? `${Math.round(p.days / 365)} year` : `${p.days} days`}</li><li>{naira(p.seats ? p.price / p.seats : 0)} per student</li><li>Dashboard, codes, class league</li></ul>
                  <button className="sch-btn" disabled={busy !== null} onClick={() => buy(p)}>{busy === p.id ? 'Opening Paystack…' : current ? 'Renew' : 'Choose plan'}</button>
                </Tilt>
              </motion.div>
            );
          })}
        </div>
        <p className="sch-fine">Payments go through Paystack (card, bank transfer, USSD). Renewing adds the new time to what you have left.</p>
      </section>

      <section className="sch-panel wide">
        <div className="panel-h"><h3>Payment history</h3></div>
        {history.length === 0 ? <div className="chart-empty">No payments yet.</div> : (
          <div className="sch-table-wrap">
            <table className="sch-table">
              <thead><tr><th>Date</th><th>Plan</th><th>Seats</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
              <tbody>{history.map((h) => (
                <tr key={h.reference}><td>{new Date(h.paidAt ?? h.createdAt).toLocaleDateString('en-NG')}</td><td>{plans.find((p) => p.id === h.plan)?.name ?? h.plan}</td><td>{h.seats}</td><td>{naira(h.amount)}</td><td><span className={`tag ${h.status}`}>{h.status}</span>{h.provider !== 'paystack' ? <small> ({h.provider})</small> : null}</td><td><code>{h.reference}</code></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
