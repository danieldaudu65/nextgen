'use client';

import { useState } from 'react';
import type { QuizQuestion } from '@/lib/types';
import { api } from '@/lib/api';
import { usePoints } from '../PointsProvider';

export default function QuizGame({ slug, questions = [] }: { slug: string; questions?: QuizQuestion[] }) {
  const { me, award, noAccess } = usePoints();
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!questions.length) return null;
  const q = questions[qi];

  const choose = async (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    setError(null);
    try {
      if (typeof q.answer === 'number') {
        // offline data: check locally, guest-style points
        setAnswer(q.answer);
        if (i === q.answer) award(10, 'Correct');
        return;
      }
      const res = await api.checkQuiz(slug, q.id, i);
      setAnswer(res.answer);
      if (res.correct) {
        if (me && res.locked) noAccess();
        else if (me && res.awarded) award(res.awarded, 'Correct', await api.me());
        else if (!me) award(10, 'Correct');
      }
    } catch {
      setError('Could not check that one. Check your connection.');
      setPicked(null);
    }
  };

  const next = () => { setQi((qi + 1) % questions.length); setPicked(null); setAnswer(null); };

  return (
    <div className="game">
      <div className="gh"><h3>Superpower Challenge</h3><span className="reward">+30 pts</span></div>
      <div className="qtext">{q.question}</div>
      <div className="opts">
        {q.options.map((o, i) => {
          const cls = answer === null ? '' : i === answer ? ' right' : i === picked ? ' wrong' : '';
          return (
            <button key={o} className={`opt${cls}`} onClick={() => choose(i)}>
              <span className="k">{'ABCD'[i]}</span>{o}
            </button>
          );
        })}
      </div>
      {error && <div className="hint">{error}</div>}
      <div className="qfoot">
        <span>Question {qi + 1} of {questions.length}</span>
        {answer !== null && <button className="btn sm" onClick={next}>Next →</button>}
      </div>
    </div>
  );
}
