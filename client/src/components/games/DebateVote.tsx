'use client';

import { useEffect, useState } from 'react';
import type { Debate } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { fmt, usePoints } from '../PointsProvider';

export default function DebateVote({ debate: initial }: { debate: Debate }) {
  const { me, award, openJoin, noAccess } = usePoints();
  const [debate, setDebate] = useState(initial);
  const [voted, setVoted] = useState<'A' | 'B' | null>(initial.mySide ?? null);
  const [note, setNote] = useState<string | null>(null);
  const offline = debate.id.startsWith('offline');

  // After login, find out if this student already voted
  useEffect(() => {
    if (!me || offline) return;
    api.currentDebate().then((d) => { if (d.mySide) { setVoted(d.mySide); setDebate(d); } }).catch(() => {});
  }, [me, offline]);

  const total = debate.votesA + debate.votesB;
  const pa = total ? Math.round((debate.votesA / total) * 100) : 50;

  const vote = async (side: 'A' | 'B') => {
    if (voted) return;
    if (offline) {
      setVoted(side);
      setDebate((d) => ({ ...d, votesA: d.votesA + (side === 'A' ? 1 : 0), votesB: d.votesB + (side === 'B' ? 1 : 0) }));
      return award(20, 'Voice heard');
    }
    if (!me) return openJoin('Join to vote. One vote per student keeps it fair.');
    try {
      const res = await api.vote(debate.id, side);
      setVoted(side);
      setDebate(res.debate);
      if (res.locked) noAccess();
      else award(res.awarded, 'Voice heard', await api.me());
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setNote(err.message);
      else setNote("Couldn't send your vote. Try again.");
    }
  };

  return (
    <div className="game" style={{ gridColumn: '1/-1', minHeight: 0 }}>
      <div className="gh"><h3>Debate of the Week</h3><span className="reward">+20 pts</span></div>
      <div className="debate">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {debate.imageA ? <img src={debate.imageA} alt="" /> : <span />}
        <div className="debq">{debate.question}</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {debate.imageB ? <img src={debate.imageB} alt="" /> : <span />}
      </div>
      <div className="teams">
        <button className={`team a${voted === 'A' ? ' picked' : ''}`} onClick={() => vote('A')}><b>{debate.teamA.label}</b>{debate.teamA.pitch}</button>
        <button className={`team b${voted === 'B' ? ' picked' : ''}`} onClick={() => vote('B')}><b>{debate.teamB.label}</b>{debate.teamB.pitch}</button>
      </div>
      <div className="split">
        <div className="a" style={{ width: `${pa}%` }}>Team A {pa}%</div>
        <div className="b">{100 - pa}% Team B</div>
      </div>
      <div className="hint">
        {fmt(total)} votes · {note ?? (voted ? `You're on Team ${voted}.` : 'Tap a team to vote')}
      </div>
    </div>
  );
}
