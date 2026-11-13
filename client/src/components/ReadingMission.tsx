'use client';

import { usePoints } from './PointsProvider';

// "Read 3 stories today" box: guests see a Join button, students see their progress.
export default function ReadingMission() {
  const { me, openJoin } = usePoints();

  if (!me) {
    return (
      <div className="mission">
        <div className="dots3"><i /><i /><i /></div>
        Read 3 stories today for <b>+20 pts</b> and keep your streak.
        <button className="btn sm white" style={{ marginLeft: 'auto' }} onClick={() => openJoin('Join to track your Reading Mission and streak.')}>
          Join to track
        </button>
      </div>
    );
  }

  const { done, target } = me.mission;
  return (
    <div className="mission">
      <div className="dots3">{Array.from({ length: target }).map((_, i) => <i key={i} className={i < done ? 'done' : ''} />)}</div>
      {done >= target
        ? <>Reading Mission complete 🎉 Come back tomorrow{me.streak ? ` for day ${me.streak + 1} of your streak` : ''}.</>
        : <>Reading Mission: {done} of {target} stories today, {target - done} more for <b>+20 pts</b>{me.streak ? <> · 🔥 {me.streak}-day streak</> : null}</>}
    </div>
  );
}
