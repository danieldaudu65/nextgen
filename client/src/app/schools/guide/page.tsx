'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { naira, period, useSiteSettings } from '@/lib/useSiteSettings';

/*
 * School Guide: how NextGen works for schools, written like documentation.
 * Every number here (plans, seats, prices, reading time, points, packages, leaderboard range)
 * comes live from Admin → Settings, so the guide never goes out of date.
 */

const SECTIONS = [
  { id: 'what', title: 'What your school gets' },
  { id: 'setup', title: 'Set up in 5 minutes' },
  { id: 'plans', title: 'Plans & pricing' },
  { id: 'codes', title: 'Student codes' },
  { id: 'joining', title: 'How students join' },
  { id: 'devices', title: 'One student, one device' },
  { id: 'reading', title: 'The reading check' },
  { id: 'leaderboards', title: 'Leaderboards' },
  { id: 'dashboard', title: 'Your dashboard' },
  { id: 'profile', title: 'Your Showcase profile' },
  { id: 'payments', title: 'Payments & renewals' },
  { id: 'no-school', title: 'Students without a school' },
  { id: 'faq', title: 'FAQ' },
];

const RANGE: Record<string, string> = { volume: 'per volume (resets with every new issue)', edition: 'per edition (the whole year adds up)', week: 'weekly (resets every Monday)', all: 'all time' };

export default function SchoolGuide() {
  const { settings: s } = useSiteSettings();
  const [active, setActive] = useState('what');

  // highlight the section being read
  useEffect(() => {
    const els = SECTIONS.map((x) => document.getElementById(x.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (seen) setActive(seen.target.id);
    }, { rootMargin: '-20% 0px -70% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const r = s.reading;
  const mins = r.mode === 'fixed' ? `${Math.round((r.readSeconds / 60) * 10) / 10} minute${r.readSeconds === 60 ? '' : 's'}` : "the story's read time";
  const plans = s.schoolPlans;
  const cheapest = plans.length ? [...plans].sort((a, b) => a.price / a.seats - b.price / b.seats)[0] : null;

  return (
    <section className="sec guide">
      <div className="wrap">
        <header className="guide-head">
          <span className="tagbar">SCHOOL GUIDE</span>
          <h1 className="display">NextGen for schools.</h1>
          <p className="sub">Everything a head teacher or NextGen coordinator needs: plans, codes, the dashboard and how students earn points.</p>
          <div className="guide-cta">
            <Link className="btn dark" href="/school/login">Set up your school</Link>
            <Link className="btn white" href="/schools">See the School Showcase</Link>
          </div>
        </header>

        <div className="guide-layout">
          <nav className="guide-toc" aria-label="On this page">
            <b>On this page</b>
            {SECTIONS.map((x) => <a key={x.id} href={`#${x.id}`} className={active === x.id ? 'on' : ''}>{x.title}</a>)}
          </nav>

          <article className="guide-body">
            <Sec id="what" title="What your school gets">
              <p>NextGen is PUNCH&apos;s newspaper for teenagers, made interactive. With a school plan, every student you give a code to can:</p>
              <ul className="ticks">
                <li>Earn <b>{r.readPoints} points</b> for reading a story and <b>{r.questionPoints} more</b> for its quick-check question</li>
                <li>Play every game, quiz and debate</li>
                <li>Climb the national leaderboard, and push your school up <b>Top Schools</b></li>
              </ul>
              <p>You get a dashboard to see who is reading, compare classes and manage codes.</p>
            </Sec>

            <Sec id="setup" title="Set up in 5 minutes">
              <ol className="steps">
                <li><b>Create your school account</b> at <Link href="/school/login">School login → Set up a school</Link>. You need the school name, your name and an email.</li>
                <li><b>Pick a plan</b> on the Plan tab and pay with Paystack (card, transfer or USSD).</li>
                <li><b>Create codes</b> on the Codes tab: one per student. Type a number, or paste a list of names.</li>
                <li><b>Share them</b>: send each student their join link (WhatsApp works), or print the codes from the CSV.</li>
                <li><b>Watch the dashboard</b> fill up as your students read and play.</li>
              </ol>
            </Sec>

            <Sec id="plans" title="Plans & pricing">
              <p>Each plan gives you a number of <b>seats</b>. One seat = one student code = one student with full access.</p>
              {plans.length ? (
                <div className="guide-plans">
                  {plans.map((p) => (
                    <div key={p.id} className="guide-plan">
                      <h4>{p.name}</h4>
                      <div className="gp-price">{naira(p.price)}</div>
                      <span>{p.seats} students · {p.days >= 365 ? `${Math.round(p.days / 365)} year` : `${p.days} days`}</span>
                      <small>{naira(p.seats ? p.price / p.seats : 0)} per student</small>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">Plans will show here soon.</p>}
              {cheapest && <Note>Best value per student: <b>{cheapest.name}</b> at {naira(cheapest.price / cheapest.seats)} each.</Note>}
              <p>Need more students than a plan offers, or a free pilot? Contact NextGen: the team can set up a custom plan for your school.</p>
            </Sec>

            <Sec id="codes" title="Student codes">
              <ul>
                <li>Codes look like <code>K7MP2QXA</code>. They avoid letters that look alike (no 0/O or 1/I).</li>
                <li>Each code works <b>once</b>: it creates one student account.</li>
                <li>You can only create as many codes as you have seats. Cancelling an <b>unused</b> code frees its seat.</li>
                <li>Add a class (SS1, JSS3…) when you create codes, so your class league works.</li>
                <li><b>Copy unused links</b> gives you every unused join link at once; <b>Download CSV</b> gives you a sheet to print.</li>
              </ul>
            </Sec>

            <Sec id="joining" title="How students join">
              <ol className="steps">
                <li>The student opens their <b>join link</b> (it looks like <code>…/join?code=K7MP2QXA</code>). The code is already filled in and they see your school&apos;s name.</li>
                <li>They choose a name, a handle and a password. No email or phone number is needed.</li>
                <li>Done: they have full access, and every point they earn also counts for your school.</li>
              </ol>
              <p>Already have a NextGen account? They can type the code in the <b>Use code</b> box when the site asks for access.</p>
            </Sec>

            <Sec id="devices" title="One student, one device">
              <p>To stop one code being shared around, an account made with a school code is <b>locked to the first phone or computer</b> it logs in on.</p>
              <Note>New phone? Open <b>Students</b> on your dashboard and press <b>Unlock device</b>. The student can then log in on the new one.</Note>
              <p>Students who leave: press <b>Remove</b>. They lose school access, and their seat is free for someone else.</p>
            </Sec>

            <Sec id="reading" title="The reading check">
              <p>Every story checks that it was really read:</p>
              <ol className="steps">
                <li>After <b>{mins}</b> on a story, the student gets <b>+{r.readPoints} points</b>.</li>
                <li>A quick question about the story appears, with <b>{r.questionSeconds} seconds</b> to answer. The page is locked until they do.</li>
                <li>Right answer: <b>+{r.questionPoints} more</b>. Wrong or too slow: they keep the reading points{r.retries ? <> and get <b>{r.retries} more {r.retries === 1 ? 'try' : 'tries'}</b> later</> : null}.</li>
              </ol>
              <p>Your dashboard shows how many quick checks your students get right.</p>
            </Sec>

            <Sec id="leaderboards" title="Leaderboards">
              <p>There are three national boards: <b>Top Readers</b> (reading + quick checks), <b>Top Players</b> (every point) and <b>Top Schools</b>.</p>
              <p>Right now the boards count points <b>{RANGE[s.leaderboard.range]}</b>, and schools are ranked by <b>{s.leaderboard.schoolRanking === 'average' ? 'average points per active student (fair to small schools)' : 'total points'}</b>.</p>
              <p>Inside your dashboard, <b>Class vs class</b> compares the average points of each class.</p>
            </Sec>

            <Sec id="dashboard" title="Your dashboard">
              <div className="guide-tabs">
                <div><b>◎ Overview</b><p>National rank, seats used, points per day, class vs class, star students, most-read stories.</p></div>
                <div><b>☺ Students</b><p>Search, filter by class, see points, streaks and last activity. Unlock devices, remove students.</p></div>
                <div><b>⌗ Codes</b><p>Create, copy, share on WhatsApp, download CSV, cancel unused codes.</p></div>
                <div><b>★ Plan</b><p>Your plan, seats and end date. Buy or renew, and see your payment history.</p></div>
                <div><b>✎ Profile</b><p>Logo, motto, about and website for your School Showcase page.</p></div>
              </div>
            </Sec>

            <Sec id="profile" title="Your Showcase profile">
              <p>Every school appears on the <Link href="/schools">School Showcase</Link> with its rank, top 5 readers and details. Fill in the <b>Profile</b> tab to add your logo, motto, a short story about your school and your website.</p>
              <p>Prefer not to be listed? Switch off <b>Show on the School Showcase</b> in Profile.</p>
            </Sec>

            <Sec id="payments" title="Payments & renewals">
              <ul>
                <li>Payments go through <b>Paystack</b>: card, bank transfer or USSD. The receipt goes to your account email.</li>
                <li>Renewing early <b>adds</b> the new time to what you have left. Nothing is lost.</li>
                <li>When a plan ends, students keep their accounts and can still read, but stop earning points until you renew.</li>
              </ul>
            </Sec>

            <Sec id="no-school" title="Students without a school">
              <p>Students whose school is not on NextGen can still sign up and read for free. To play and earn points they buy a package:</p>
              {s.personalPlans.length ? (
                <div className="guide-plans small">
                  {s.personalPlans.map((p) => <div key={p.id} className="guide-plan"><h4>{p.name}</h4><div className="gp-price">{naira(p.price)}</div><span>per {period(p.days)}</span></div>)}
                </div>
              ) : null}
              <p>When their school joins, their code gives them access through the school instead.</p>
            </Sec>

            <Sec id="faq" title="FAQ">
              <Faq q="Do students need an email or phone number?">No. Just a name, a handle and a password. We keep student data to a minimum.</Faq>
              <Faq q="A student lost their code. What do I do?">Open Codes, find it (search the student&apos;s name if you used names), and send the link again. If it was never used, you can also cancel it and create a new one.</Faq>
              <Faq q="Can one code be used by two students?">No. A code makes one account, and that account is locked to one device.</Faq>
              <Faq q="Can we have more than one dashboard login?">Right now each school has one login. Ask NextGen if you need more.</Faq>
              <Faq q="How do I get the official PUNCH NextGen print edition?">Contact the NextGen team; the website and the print edition go together.</Faq>
            </Sec>
          </article>
        </div>
      </div>
    </section>
  );
}

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <motion.section id={id} className="guide-sec" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}>
      <h2><a href={`#${id}`}>{title}</a></h2>
      {children}
    </motion.section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div className="guide-note"><span aria-hidden="true">💡</span><div>{children}</div></div>;
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return <details className="guide-faq"><summary>{q}</summary><p>{children}</p></details>;
}
