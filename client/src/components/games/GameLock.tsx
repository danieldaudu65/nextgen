'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePoints } from '../PointsProvider';
import { naira, period, useSiteSettings } from '@/lib/useSiteSettings';

/*
 * Games are for students with access (Admin → Settings → Access):
 *   - from a subscribed school (their join code), or
 *   - a package they paid for themselves (students not in a NextGen school).
 * Everyone else sees the games blurred behind this card.
 */
export default function GameLock({ children }: { children: ReactNode }) {
  const { me, openJoin } = usePoints();
  const { settings } = useSiteSettings();
  const open = !settings.access.requireAccessForPoints || Boolean(me?.access?.active);
  if (open) return <>{children}</>;

  const cheapest = [...settings.personalPlans].sort((a, b) => a.price - b.price)[0];
  return (
    <div className="game-lock">
      <div className="game-lock-games" aria-hidden="true" inert>{children}</div>
      <motion.div className="game-lock-card" initial={{ opacity: 0, y: 30, rotateX: 20 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }} viewport={{ once: true }}>
        <div className="gate-emoji" aria-hidden="true">🎮🔒</div>
        <h3>{me ? 'Unlock the games' : 'Join to play'}</h3>
        <p>
          {me
            ? <>Games, quizzes and debates are for NextGen members. Got a code from your school? Use it. School not on NextGen yet? Pick a package{cheapest ? <>, from <b>{naira(cheapest.price)}/{period(cheapest.days)}</b></> : null}.</>
            : <>Create a free account, then use your school&apos;s code. If your school isn&apos;t on NextGen, you can get a package for yourself.</>}
        </p>
        <div className="gate-actions">
          {me
            ? <Link className="btn dark" href="/get-access?back=/%23arcade">Use a code or get a package</Link>
            : <><button className="btn dark" onClick={() => openJoin('Join, then use your school code or pick a package to play.')}>Join free</button><button className="btn white" onClick={() => openJoin(undefined, { mode: 'login' })}>Log in</button></>}
        </div>
      </motion.div>
    </div>
  );
}
