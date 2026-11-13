'use client';

import { useState } from 'react';
import { usePoints } from '../PointsProvider';

export default function PromiseChecker({ questions, edition }: { questions: string[]; edition: string }) {
  const { completeGame } = usePoints();
  const [promise, setPromise] = useState('If you vote for me, I will create one million jobs!');
  const [checked, setChecked] = useState<boolean[]>(() => questions.map((_, i) => i === 0));
  const [awarded, setAwarded] = useState(false);

  const n = checked.filter(Boolean).length;
  const total = questions.length;
  const verdict =
    n === 0 ? 'Tick what the promise actually answers.'
      : n < 3 ? `${n}/${total}: just a promise 📢`
        : n < total - 1 ? `${n}/${total}: getting there 🤔`
          : `${n}/${total}: now THAT is a plan ✅`;

  const toggle = (i: number) => {
    const next = checked.map((c, k) => (k === i ? !c : c));
    setChecked(next);
    if (next.every(Boolean) && !awarded) { setAwarded(true); completeGame('promise', edition, 20, 'Promise Checker'); }
  };

  return (
    <div className="game">
      <div className="gh"><h3>Promise Checker</h3><span className="reward">+20 pts</span></div>
      <div className="hint">A promise is easy. A plan shows seriousness. Paste any promise and check it.</div>
      <div className="pc-input">
        <input value={promise} onChange={(e) => setPromise(e.target.value)} aria-label="Promise to check" />
      </div>
      <div className="checks">
        {questions.map((q, i) => (
          <label key={q}>
            <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} />
            {q}
          </label>
        ))}
      </div>
      <div className="meter"><i style={{ width: `${(n / total) * 100}%` }} /></div>
      <div className="verdict">{verdict}</div>
    </div>
  );
}
