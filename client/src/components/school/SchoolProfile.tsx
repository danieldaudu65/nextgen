'use client';

/* eslint-disable @next/next/no-img-element */
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { schoolApi, type SchoolInfo } from '@/lib/schoolApi';
import { ApiError } from '@/lib/api';

// Profile tab: what the School Showcase shows about this school
export default function SchoolProfile({ school, say, onSaved }: { school: SchoolInfo; say: (t: string, bad?: boolean) => void; onSaved: () => void }) {
  const p = school.profile;
  const [f, setF] = useState({
    logo: p?.logo ?? '', motto: p?.motto ?? '', about: p?.about ?? '', website: p?.website ?? '',
    founded: p?.founded ? String(p.founded) : '', schoolType: p?.schoolType ?? '', showOnShowcase: p?.showOnShowcase ?? true,
    city: school.city ?? '', state: school.state ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });

  const upload = async (fl?: File) => {
    if (!fl) return;
    setUp(true);
    try { set('logo', await schoolApi.uploadLogo(fl)); } catch (e) { say(e instanceof ApiError ? e.message : 'Upload failed', true); } finally { setUp(false); if (file.current) file.current.value = ''; }
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await schoolApi.saveProfile({ ...f, founded: f.founded ? Number(f.founded) : null, schoolType: f.schoolType || null, logo: f.logo || null });
      say(r.message);
      onSaved();
    } catch (err) { say(err instanceof ApiError ? err.message : 'Could not save', true); } finally { setBusy(false); }
  };

  return (
    <div className="sch-grid">
      <form className="sch-panel" onSubmit={save}>
        <div className="panel-h"><h3>Your Showcase profile</h3><Link className="sch-ghost sm" href="/schools" target="_blank">See the Showcase ↗</Link></div>
        <div className="profile-form">
          <div className="logo-row">
            {f.logo ? <img src={f.logo} alt="" className="logo-prev" /> : <span className="logo-prev empty">{school.name.slice(0, 1)}</span>}
            <div>
              <b>School logo</b><small>Square works best. JPG/PNG under 3 MB.</small>
              <div className="code-acts" style={{ marginTop: 8 }}>
                <button type="button" onClick={() => file.current?.click()} disabled={up}>{up ? 'Uploading…' : f.logo ? 'Change logo' : 'Upload logo'}</button>
                {f.logo && <button type="button" onClick={() => set('logo', '')}>Remove</button>}
              </div>
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
            </div>
          </div>
          <label>Motto<input value={f.motto} onChange={(e) => set('motto', e.target.value)} maxLength={120} placeholder="Knowledge is light" /></label>
          <label>About your school <small>({1200 - f.about.length} characters left)</small><textarea rows={5} value={f.about} onChange={(e) => set('about', e.target.value)} maxLength={1200} placeholder="What makes your school special? Clubs, wins, history…" /></label>
          <div className="row2">
            <label>City<input value={f.city} onChange={(e) => set('city', e.target.value)} maxLength={60} /></label>
            <label>State<input value={f.state} onChange={(e) => set('state', e.target.value)} maxLength={60} /></label>
          </div>
          <div className="row2">
            <label>Founded (year)<input type="number" min={1800} max={new Date().getFullYear()} value={f.founded} onChange={(e) => set('founded', e.target.value)} /></label>
            <label>Type<select value={f.schoolType} onChange={(e) => set('schoolType', e.target.value)}><option value="">Choose</option><option value="public">Public</option><option value="private">Private</option><option value="mission">Mission</option><option value="federal">Federal</option><option value="other">Other</option></select></label>
          </div>
          <label>Website<input value={f.website} onChange={(e) => set('website', e.target.value)} maxLength={200} placeholder="www.myschool.edu.ng" /></label>
          <label className="check-row"><input type="checkbox" checked={f.showOnShowcase} onChange={(e) => set('showOnShowcase', e.target.checked)} /> Show on the School Showcase</label>
          <button className="sch-btn" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </div>
      </form>
      <section className="sch-panel">
        <div className="panel-h"><h3>Preview</h3></div>
        <div className="profile-preview">
          {f.logo ? <img src={f.logo} alt="" /> : <span className="empty">{school.name.slice(0, 1)}</span>}
          <b>{school.name}</b>
          <small>{[f.city, f.state].filter(Boolean).join(', ')}</small>
          {f.motto && <i>“{f.motto}”</i>}
          {f.about && <p>{f.about.slice(0, 220)}{f.about.length > 220 ? '…' : ''}</p>}
          {!f.showOnShowcase && <span className="tag revoked">Hidden from the Showcase</span>}
        </div>
      </section>
    </div>
  );
}
