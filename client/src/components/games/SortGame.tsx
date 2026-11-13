'use client';

import { useState } from 'react';
import type { SortCard } from '@/lib/types';
import { usePoints } from '../PointsProvider';

export default function SortGame({ cards, image, edition }: { cards: SortCard[]; image?: string; edition: string }) {
  const { completeGame } = usePoints();
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('');
  const [fly, setFly] = useState<'cheat' | 'buddy' | null>(null);
  const [done, setDone] = useState(false);

  if (!cards.length) return null;

  const pick = (v: 'cheat' | 'buddy') => {
    if (fly || done) return;
    const ok = v === cards[i].answer;
    const nextScore = score + (ok ? 1 : 0);
    setMsg(ok ? '✅ Correct!' : cards[i].answer === 'cheat' ? '❌ That one skips the learning.' : '❌ That one actually helps you learn.');
    setFly(v);
    setTimeout(() => {
      setFly(null);
      if (i + 1 >= cards.length) {
        setDone(true);
        completeGame('sort', edition, 25, 'AI Smart');
        setTimeout(() => { setDone(false); setI(0); setScore(0); setMsg(''); }, 2600);
      } else {
        setI(i + 1);
      }
      setScore(nextScore);
    }, 280);
  };

  const style = fly
    ? { transform: `translateX(${fly === 'cheat' ? -30 : 30}px) rotate(${fly === 'cheat' ? -6 : 6}deg)`, opacity: 0 }
    : undefined;

  return (
    <div className="game">
      <div className="gh"><h3>Cheat Code or Study Buddy?</h3><span className="reward">+25 pts</span></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img className="ai-art" src={image} alt="" />}
      <div className="sortcard" style={style}>
        {done ? `You got ${score}/${cards.length}. Good prompts help you learn better!` : cards[i].text}
      </div>
      <div className="sortbtns">
        <button className="sb-cheat" onClick={() => pick('cheat')}>🚫 Cheat Code</button>
        <button className="sb-buddy" onClick={() => pick('buddy')}>🤝 Study Buddy</button>
      </div>
      <div className="hint" style={{ fontWeight: 700, minHeight: 18 }}>{msg}</div>
    </div>
  );
}
