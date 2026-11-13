'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePoints } from '@/components/PointsProvider';
import { api } from '@/lib/api';

// /join?code=K7MP2QXA  — the link a school sends its students. Opens "Join" with the code filled in.
function JoinPageInner() {
  const params = useSearchParams();
  const code = (params?.get('code') ?? '').toUpperCase();
  const { me, openJoin } = usePoints();
  const router = useRouter();
  const [school, setSchool] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!code) { openJoin(); return; }
    api.checkCode(code).then((r) => {
      if (r.valid) { setSchool(r.school?.name ?? null); openJoin(`${r.school?.name ?? 'Your school'} invited you to NextGen.`, { code }); }
      else setProblem(r.message);
    }).catch(() => setProblem("Can't reach NextGen right now. Try again in a bit."));
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (me) router.push('/'); }, [me, router]);

  return (
    <section className="sec join-page">
      <div className="wrap join-in">
        <span className="tagbar">JOIN NEXTGEN</span>
        <h1 className="display">{school ? <>Welcome, {school} reader.</> : 'Tap in. Level up.'}</h1>
        <p className="sub">{problem ?? 'Read the stories, answer the quick checks, play the games and push your school up the leaderboard.'}</p>
        <button className="btn dark" onClick={() => openJoin(undefined, { code: problem ? undefined : code || undefined })}>{problem ? 'Join without a code' : 'Open the join form'}</button>
      </div>
    </section>
  );
}

// useSearchParams needs a Suspense boundary for `next build`
export default function JoinPage() {
  return <Suspense fallback={null}><JoinPageInner /></Suspense>;
}
