'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import type { NominationForm, Star } from '@/lib/types';

/*
 * Nominate a Star
 *  1. A spinning 3D wall of past NextGen Stars (stories) + nominees the team featured (desktop);
 *     a simple swipe row on phones.
 *  2. A 3-step nomination form: the star → what they did → about you.
 */

const FALLBACK_CATS = ['Academics', 'Sports', 'Arts & Music', 'Tech & Innovation', 'Leadership', 'Business', 'Community', 'Other'];
const FALLBACK_REL = ['Teacher', 'Parent / guardian', 'Friend', 'Classmate', 'Myself', 'Other'];
const EMPTY: NominationForm = { nomineeName: '', nomineeAge: '', category: '', schoolName: '', city: '', state: '', photo: '', headline: '', story: '', links: '', nominatorName: '', relationship: '', nominatorEmail: '', nominatorPhone: '', consent: false };
const STEPS = ['The star', 'What they did', 'About you'];

export default function NominatePage() {
  const [stars, setStars] = useState<Star[] | null>(null);
  const [cats, setCats] = useState(FALLBACK_CATS);
  const [rels, setRels] = useState(FALLBACK_REL);
  const [open, setOpen] = useState<Star | null>(null);

  useEffect(() => {
    api.stars().then((r) => { setStars(r.stars); setCats(r.categories); setRels(r.relationships); }).catch(() => setStars([]));
  }, []);

  return (
    <div className="nominate">
      <section className="nm-hero">
        <div className="wrap">
          <span className="tagbar">NEXTGEN STARS</span>
          <h1 className="display">Know a young legend?<br /><span>Nominate a star.</span></h1>
          <p className="sub">Top of the class, building robots, winning medals, helping their community… If a young Nigerian is doing something amazing, tell us. They could be the next NextGen Star.</p>
          <a className="btn dark" href="#nominate-form">Nominate now ↓</a>
        </div>
      </section>

      <section className="sec nm-wall-sec">
        <div className="wrap">
          <div className="sec-head">
            <div><span className="tagbar">HALL OF STARS</span><h2 className="display">Stars we&apos;ve celebrated.</h2></div>
            <p className="sub">Tap a star to read their story.</p>
          </div>
        </div>
        {stars === null ? <div className="nm-wall-loading"><div className="spinner" /></div> : <StarWall stars={stars} onOpen={setOpen} />}
      </section>

      <section className="sec nm-how">
        <div className="wrap nm-how-grid">
          {[['📝', 'Tell us', 'Fill the form below. It takes about 3 minutes.'], ['🔎', 'We check', 'The NextGen team reads every nomination and may contact you.'], ['🌟', 'They shine', 'Chosen stars are featured in NextGen, online and in print.']].map(([i, t, d], k) => (
            <motion.div key={t} className="nm-how-card" initial={{ opacity: 0, y: 30, rotateX: 25 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }} viewport={{ once: true }} transition={{ delay: k * 0.1 }}>
              <span className="ic">{i}</span><b>{t}</b><p>{d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="sec" id="nominate-form">
        <div className="wrap"><NominateForm cats={cats} rels={rels} /></div>
      </section>

      <AnimatePresence>
        {open && (
          <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
            <motion.div className="modal nm-star-modal" initial={{ scale: 0.85, rotateY: -25, opacity: 0 }} animate={{ scale: 1, rotateY: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <button type="button" className="modal-x" onClick={() => setOpen(null)} aria-label="Close">×</button>
              {open.photo ? <img src={open.photo} alt="" className="nm-star-img" /> : <div className="nm-star-img empty">🌟</div>}
              {open.category && <span className="chip">{open.category.toUpperCase()}</span>}
              <h3 className="display">{open.name}{open.age ? <small> · {open.age}</small> : null}</h3>
              {(open.school || open.place) && <p className="muted">{[open.school, open.place].filter(Boolean).join(' · ')}</p>}
              {open.headline && <p><b>{open.headline}</b></p>}
              {open.blurb && <p>{open.blurb}</p>}
              {open.href && <Link className="btn dark" href={open.href}>Read the full story →</Link>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Desktop: cards on a slowly spinning 3D ring (pauses on hover). Phones: a swipe row.
function StarWall({ stars, onOpen }: { stars: Star[]; onOpen: (s: Star) => void }) {
  const list = stars.length ? stars : [];
  if (!list.length) return <p className="wrap nm-empty">Our first stars are coming soon. Be the one who nominates them 👇</p>;
  // the ring needs enough cards to look round
  const ring = list.length >= 6 ? list : Array.from({ length: Math.ceil(6 / list.length) * list.length }, (_, i) => list[i % list.length]);
  const n = ring.length;
  const radius = Math.round(150 / Math.tan(Math.PI / n)) + 40;

  return (
    <>
      <div className="nm-ring-stage" aria-label="Stars we've celebrated">
        <div className="nm-ring" style={{ ['--r' as string]: `${radius}px`, animationDuration: `${Math.max(30, n * 5)}s` }}>
          {ring.map((s, i) => (
            <button key={`${s.id}-${i}`} className="nm-card" style={{ transform: `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)` }} onClick={() => onOpen(s)}>
              <StarFace s={s} />
            </button>
          ))}
        </div>
        <div className="nm-floor" aria-hidden="true" />
      </div>
      <div className="nm-row" aria-label="Stars we've celebrated">
        {list.map((s) => <button key={s.id} className="nm-card flat" onClick={() => onOpen(s)}><StarFace s={s} /></button>)}
      </div>
    </>
  );
}

function StarFace({ s }: { s: Star }) {
  return (
    <>
      {s.photo ? <img src={s.photo} alt="" style={s.imagePosition ? { objectPosition: s.imagePosition } : undefined} /> : <span className="nm-noimg">🌟</span>}
      <span className="nm-cap">
        {s.category && <i>{s.category}</i>}
        <b>{s.name}</b>
        {s.headline && <small>{s.headline}</small>}
      </span>
    </>
  );
}

function NominateForm({ cats, rels }: { cats: string[]; rels: string[] }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<NominationForm>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof NominationForm>(k: K, v: NominationForm[K]) => { setErr(null); setF((x) => ({ ...x, [k]: v })); };

  // simple checks per step (the server checks everything again)
  const stepError = (i: number) => {
    if (i === 0) {
      if (f.nomineeName.trim().length < 2) return "Who is the star? Add their name.";
      if (!f.category) return 'Pick a category.';
      if (f.nomineeAge && (Number(f.nomineeAge) < 5 || Number(f.nomineeAge) > 30)) return 'Age should be between 5 and 30.';
    }
    if (i === 1) {
      if (f.headline.trim().length < 8) return 'Add a one-line headline.';
      if (f.story.trim().length < 60) return 'Tell us a bit more (at least a few sentences).';
    }
    if (i === 2) {
      if (f.nominatorName.trim().length < 2) return 'Add your name.';
      if (!f.nominatorEmail.trim() && !f.nominatorPhone.trim()) return 'Add an email or phone number so we can reach you.';
      if (!f.consent) return "Tick the consent box.";
    }
    return null;
  };
  const next = () => { const e = stepError(step); setErr(e); if (!e) setStep(step + 1); };

  const upload = async (file?: File) => {
    if (!file) return;
    setUpBusy(true);
    setErr(null);
    try { set('photo', await api.nominationPhoto(file)); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Photo upload failed'); } finally { setUpBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step < 2) return next();
    const e2 = stepError(2);
    if (e2) { setErr(e2); return; }
    setBusy(true);
    setErr(null);
    try { setDone((await api.nominate(f)).message); } catch (error) { setErr(error instanceof ApiError ? error.message : 'Could not send. Try again.'); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <motion.div className="nm-form nm-done" initial={{ scale: 0.9, opacity: 0, rotateX: 20 }} animate={{ scale: 1, opacity: 1, rotateX: 0 }}>
        <div className="gate-emoji">🌟</div>
        <h2 className="display">Nomination sent!</h2>
        <p>{done}</p>
        <button className="btn dark" onClick={() => { setF(EMPTY); setStep(0); setDone(null); }}>Nominate someone else</button>
      </motion.div>
    );
  }

  const storyLeft = 3000 - f.story.length;
  return (
    <form className="nm-form" onSubmit={submit}>
      <div className="nm-form-head">
        <span className="tagbar">NOMINATION FORM</span>
        <h2 className="display">Tell us about your star.</h2>
      </div>
      <ol className="nm-steps">
        {STEPS.map((t, i) => (
          <li key={t} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <button type="button" onClick={() => { if (i < step) setStep(i); }} disabled={i > step}><span>{i < step ? '✓' : i + 1}</span>{t}</button>
          </li>
        ))}
      </ol>
      <div className="nm-bar"><motion.i animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>

      <AnimatePresence mode="wait">
        <motion.div key={step} className="nm-fields" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
          {step === 0 && (
            <>
              <div className="nm-row2">
                <label>Star&apos;s full name *<input value={f.nomineeName} onChange={(e) => set('nomineeName', e.target.value)} maxLength={80} placeholder="Ada Okafor" /></label>
                <label>Age<input type="number" min={5} max={30} value={f.nomineeAge} onChange={(e) => set('nomineeAge', e.target.value)} placeholder="15" /></label>
              </div>
              <div className="nm-label">Category *</div>
              <div className="nm-chips" role="radiogroup" aria-label="Category">
                {cats.map((c) => <button type="button" key={c} role="radio" aria-checked={f.category === c} className={f.category === c ? 'on' : ''} onClick={() => set('category', c)}>{c}</button>)}
              </div>
              <label>School<input value={f.schoolName} onChange={(e) => set('schoolName', e.target.value)} maxLength={120} placeholder="King's College" /></label>
              <div className="nm-row2">
                <label>City / town<input value={f.city} onChange={(e) => set('city', e.target.value)} maxLength={60} placeholder="Lagos" /></label>
                <label>State<input value={f.state} onChange={(e) => set('state', e.target.value)} maxLength={60} placeholder="Lagos" /></label>
              </div>
              <div className="nm-photo">
                {f.photo ? <img src={f.photo} alt="" /> : <span className="nm-photo-empty">📷</span>}
                <div>
                  <b>A photo of the star</b> <small>(optional, JPG or PNG)</small>
                  <div className="nm-photo-btns">
                    <button type="button" className="btn sm white" onClick={() => fileRef.current?.click()} disabled={upBusy}>{upBusy ? 'Uploading…' : f.photo ? 'Change photo' : 'Upload photo'}</button>
                    {f.photo && <button type="button" className="btn sm white" onClick={() => set('photo', '')}>Remove</button>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
                </div>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <label>Headline: what did they do, in one line? *<input value={f.headline} onChange={(e) => set('headline', e.target.value)} maxLength={140} placeholder="Built a solar phone charger from scrap parts" /></label>
              <label>Their story *<small>What did they achieve? When? Why does it matter? Include names, numbers and dates you know.</small>
                <textarea rows={8} value={f.story} onChange={(e) => set('story', e.target.value)} maxLength={3000} />
                <small className={storyLeft < 200 ? 'warn' : ''}>{f.story.trim().length < 60 ? `${60 - f.story.trim().length} more characters needed` : `${storyLeft} characters left`}</small>
              </label>
              <label>Links <small>(optional: news, videos, social posts; one per line)</small><textarea rows={3} value={f.links} onChange={(e) => set('links', e.target.value)} placeholder="https://…" /></label>
            </>
          )}
          {step === 2 && (
            <>
              <div className="nm-row2">
                <label>Your name *<input value={f.nominatorName} onChange={(e) => set('nominatorName', e.target.value)} maxLength={80} /></label>
                <label>You are their…<select value={f.relationship} onChange={(e) => set('relationship', e.target.value)}><option value="">Choose</option>{rels.map((r) => <option key={r}>{r}</option>)}</select></label>
              </div>
              <div className="nm-row2">
                <label>Email<input type="email" value={f.nominatorEmail} onChange={(e) => set('nominatorEmail', e.target.value)} maxLength={120} /></label>
                <label>Phone<input value={f.nominatorPhone} onChange={(e) => set('nominatorPhone', e.target.value)} maxLength={30} /></label>
              </div>
              <p className="nm-fine">We only use your contact details to ask about this nomination. They are never shown on the site.</p>
              <label className="nm-consent"><input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /><span>The star&apos;s <b>parent or guardian</b> (or the star, if 18 or older) agrees to this nomination, and to NextGen contacting them and possibly featuring the star&apos;s name, photo and story. *</span></label>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {err && <div className="modal-err" role="alert">{err}</div>}
      <div className="nm-nav">
        {step > 0 && <button type="button" className="btn white" onClick={() => { setErr(null); setStep(step - 1); }}>← Back</button>}
        {step < 2 ? <button type="button" className="btn dark" onClick={next}>Next →</button> : <button type="submit" className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send nomination 🌟'}</button>}
      </div>
    </form>
  );
}
