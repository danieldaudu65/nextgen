'use client';

import { useState, type ReactNode } from 'react';
import type { Edition } from '@/lib/types';
import { Icon } from '../Icon';
import { fmt, usePoints } from '../PointsProvider';

// Only shows when the volume has Money game data (start balance + items)
export default function MoneyGame({ money, edition }: { money?: Edition['money'] | null; edition: string }) {
  if (!money || !(Number(money.start) > 0) || !Array.isArray(money.items) || money.items.length === 0) return null;
  return <MoneyGameInner money={money} edition={edition} />;
}

function MoneyGameInner({ money, edition }: { money: Edition['money']; edition: string }) {
  const { completeGame } = usePoints();
  const [bal, setBal] = useState(money.start);
  const [jar, setJar] = useState(0);
  const [buys, setBuys] = useState(0);
  const [msg, setMsg] = useState<ReactNode>(null);
  const [won, setWon] = useState(false);

  const day = Math.min(4, Math.floor(buys / 2));
  const state = bal <= 1000 ? 'broke' : bal < 4000 ? 'low' : '';

  const buy = (price: number) => {
    const next = bal - price;
    setBal(next);
    setBuys((b) => b + 1);
    if (next <= 1000 && jar === 0) {
      setMsg(<><span className="bub">&quot;Mummy…&quot; 😭</span> Broke by Friday. Your money didn&apos;t disappear. You spent it in tiny pieces.</>);
    } else if (next <= 1000 && jar > 0) {
      setMsg(<><span className="bub">Still standing 💪</span> You saved ₦{fmt(jar)} first. That&apos;s the NextGen money move.</>);
      if (!won) { completeGame('money', edition, 40, 'Money Mover'); setWon(true); }
    } else {
      setMsg(`Little-spend effect: small buys add up. Spent so far: ₦${fmt(money.start - next - jar)}`);
    }
  };

  const save = () => {
    setBal((b) => b - money.save);
    setJar(money.save);
    setMsg('🐷 Nice. Saved first. Now plan the rest.');
  };

  const reset = () => { setBal(money.start); setJar(0); setBuys(0); setMsg(null); };

  return (
    <div className="game span2">
      <div className="gh"><h3>The ₦10K Money Mystery</h3><span className="reward">+40 pts</span></div>
      <div className="hint">Tap what you&apos;d buy this week. Can you make it to Friday? Tip: save first. SAVE → PLAN → SPEND. In that order.</div>
      <div className="money-grid">
        <div>
          <div className={`balance ${state}`}>
            <small>ACCOUNT BALANCE</small>
            <b>₦{fmt(bal)}</b>
            <div className="days">
              {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d, i) => <span key={d} className={i <= day ? 'on' : ''}>{d}</span>)}
            </div>
          </div>
          <div className="jar">
            <Icon name="piggy" />
            <div>
              Savings jar: ₦{fmt(jar)}
              <br />
              <button className="btn sm white" style={{ marginTop: 6 }} onClick={save} disabled={jar > 0 || bal < money.save}>
                Save ₦{fmt(money.save)} first
              </button>
            </div>
          </div>
        </div>
        <div>
          <div className="buys">
            {money.items.map((it) => (
              <button key={it.label} className="buy" onClick={() => buy(it.price)} disabled={it.price > bal}>
                {it.label}<span>-₦{fmt(it.price)}</span>
              </button>
            ))}
          </div>
          <div className="moneymsg" style={{ marginTop: 12 }}>{msg}</div>
          <button className="btn sm white" onClick={reset}>↺ Start the week again</button>
        </div>
      </div>
    </div>
  );
}
