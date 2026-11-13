'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import type { Edition } from '@/lib/types';
import type { SectionCard, VocabWord } from '@/lib/types';
import { useAdmin } from '@/components/admin/AdminShell';
import AnimatedSelect from '@/components/AnimatedSelect';

// Simple edition fields and the structured category manager are edited here;
// advanced game data remains available as JSON below.
const BASIC = [
  ['title', 'Volume title'], ['cover', 'Cover image link'],
  ['tagline', 'Tagline'], ['headlineAccent', 'Headline accent (e.g. Loading…)'], ['electionDate', 'Countdown date (ISO)'],
] as const;
const MONTHS = [
  ['january', 'January'], ['february', 'February'], ['march', 'March'], ['april', 'April'], ['may', 'May'], ['june', 'June'],
  ['july', 'July'], ['august', 'August'], ['september', 'September'], ['october', 'October'], ['november', 'November'], ['december', 'December'],
] as const;
const monthLabel = (month?: string) => MONTHS.find(([value]) => value === month)?.[1] ?? 'Special issue';

const ADVANCED = [
  ['ticker', 'News ticker'],
  ['quiz', 'Superpower quiz (answer = index of the right option, starting at 0)'],
  ['money', '₦10K Money Mystery'],
  ['sort', 'Cheat Code or Study Buddy cards'],
  ['promiseQuestions', 'Promise Checker questions'],
  ['wordSearch', 'Word search'],
] as const;

type EditionDoc = Edition & Record<string, unknown>;

export default function EditEdition() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useAdmin();
  const [ed, setEd] = useState<EditionDoc | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryBlurb, setCategoryBlurb] = useState('');
  const [newWord, setNewWord] = useState<VocabWord>({ word: '', category: '', definition: '', nextgen: '' });
  const [wordFilter, setWordFilter] = useState('');
  const [json, setJson] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.edition(slug).then((e) => {
      const monthText = String(e.month || '').toLowerCase();
      const issueMonth = e.issueMonth ?? (MONTHS.map(([m]) => m).find((m) => monthText.includes(m)) as Edition['issueMonth'] | undefined) ?? 'other';
      const inferredYear = Number(String(e.month || slug).match(/20\d{2}/)?.[0]) || undefined;
      const monthVolume = ({ march: 1, june: 2, september: 3, december: 4 } as const)[issueMonth as 'march' | 'june' | 'september' | 'december'];
      setEd({ ...e, year: e.year ?? inferredYear, issueMonth, volumeNumber: e.volumeNumber ?? monthVolume } as EditionDoc);
      setJson(Object.fromEntries(ADVANCED.map(([k]) => [k, JSON.stringify((e as EditionDoc)[k] ?? null, null, 2)])));
    }).catch(() => toast('Edition not found', true));
  }, [slug, toast]);

  if (!ed) return <div className="admin-page"><p className="muted">Loading…</p></div>;

  const setJsonField = (k: string, v: string) => {
    setJson((j) => ({ ...j, [k]: v }));
    try { JSON.parse(v); setBad((b) => ({ ...b, [k]: false })); } catch { setBad((b) => ({ ...b, [k]: true })); }
  };

  const addCategory = () => {
    const label = categoryName.trim();
    if (!label) return toast('Enter a category name first', true);
    const baseKey = label.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `category-${Date.now()}`;
    const keys = new Set((ed.sections ?? []).map((section) => section.key));
    let key = baseKey;
    let suffix = 2;
    while (keys.has(key)) key = `${baseKey}-${suffix++}`;
    const category: SectionCard = { key, label: label.toUpperCase(), title: label, blurb: categoryBlurb.trim(), pages: '', variant: 'default', featured: false, href: '/#edition' };
    setEd({ ...ed, sections: [...(ed.sections ?? []), category] });
    setCategoryName('');
    setCategoryBlurb('');
  };

  const updateCategory = (index: number, updates: Partial<SectionCard>) => {
    setEd({ ...ed, sections: (ed.sections ?? []).map((section, i) => i === index ? { ...section, ...updates } : section) });
  };

  const removeCategory = (index: number) => {
    setEd({ ...ed, sections: (ed.sections ?? []).filter((_, i) => i !== index) });
  };

  // ---------- Vocab Vault ----------
  const vocabList: VocabWord[] = ed.vocab ?? [];
  const addWord = () => {
    const word = newWord.word.trim();
    if (!word || !newWord.definition.trim()) return toast('Add the word and its meaning first', true);
    if (vocabList.some((v) => v.word.toLowerCase() === word.toLowerCase())) return toast(`"${word}" is already in the Vocab Vault`, true);
    setEd({ ...ed, vocab: [...vocabList, { ...newWord, word, definition: newWord.definition.trim(), nextgen: newWord.nextgen.trim(), category: newWord.category.trim() || 'Words' }] });
    setNewWord({ word: '', category: newWord.category, definition: '', nextgen: '' });
  };
  const updateWord = (index: number, updates: Partial<VocabWord>) => setEd({ ...ed, vocab: vocabList.map((v, i) => (i === index ? { ...v, ...updates } : v)) });
  const removeWord = (index: number) => setEd({ ...ed, vocab: vocabList.filter((_, i) => i !== index) });

  const save = async () => {
    if (Object.values(bad).some(Boolean)) return toast('Fix the red JSON boxes first', true);
    setBusy(true);
    try {
      const data: Record<string, unknown> = {};
      BASIC.forEach(([k]) => { data[k] = ed[k]; });
      data.year = ed.year ?? null;
      data.volumeNumber = ed.volumeNumber;
      data.issueMonth = ed.issueMonth;
      data.month = ed.month;
      data.volume = ed.volume;
      data.status = ed.status;
      data.lede = ed.lede;
      data.headline = ed.headline;
      data.sections = ed.sections ?? [];
      data.vocab = (ed.vocab ?? []).filter((v) => v.word.trim());
      ADVANCED.forEach(([k]) => { data[k] = JSON.parse(json[k] || 'null'); });
      await adminApi.updateEdition(slug, data as Partial<Edition>);
      toast(ed.status === 'current' ? 'Saved. This edition is now on the homepage.' : 'Edition saved');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-head editor-head">
        <div>
          <Link href="/admin/editions" className="back">← All editions</Link>
          <h1 className="display">{ed.year ? `${ed.year} · ` : ''}Volume {ed.volumeNumber ?? 'Special'}</h1>
        </div>
        <div className="admin-actions">
          <Link className="btn sm white" href={`/admin/articles?edition=${slug}`}>Stories</Link>
          <button className="btn sm dark" onClick={save} disabled={busy}>Save edition</button>
        </div>
      </header>

      <section className="admin-card">
      <div className="panel-head"><span className="panel-no">1</span><div><h2>Volume details</h2><p>What readers see on the homepage when this volume is live.</p></div></div>
      <div className="form-grid">
        <label>Status
          <AnimatedSelect label="Volume status" value={ed.status} onChange={(value) => setEd({ ...ed, status: value as Edition['status'] })} options={[{ value: 'upcoming', label: 'Coming soon' }, { value: 'current', label: 'On homepage (only one at a time)' }, { value: 'archive', label: 'Archive' }]} />
        </label>
        <label>Year edition<input type="number" min="2000" max="2200" value={ed.year ?? ''} onChange={(e) => {
          const year = e.target.value ? Number(e.target.value) : undefined;
          setEd({ ...ed, year, month: `${monthLabel(ed.issueMonth)} ${year ?? ''}`.trim() });
        }} /></label>
        <label>Volume<AnimatedSelect label="Volume number" value={String(ed.volumeNumber ?? '')} onChange={(value) => {
          const volumeNumber = value ? Number(value) as 1 | 2 | 3 | 4 : undefined;
          setEd({ ...ed, volumeNumber, volume: volumeNumber ? `Volume ${volumeNumber}` : '' });
        }} options={[{ value: '', label: 'No volume number' }, { value: '1', label: 'Volume 1' }, { value: '2', label: 'Volume 2' }, { value: '3', label: 'Volume 3' }, { value: '4', label: 'Volume 4' }]} /></label>
        <label>Release month<AnimatedSelect label="Release month" value={ed.issueMonth ?? 'other'} onChange={(value) => {
          const issueMonth = value as NonNullable<Edition['issueMonth']>;
          setEd({ ...ed, issueMonth, month: `${monthLabel(issueMonth)} ${ed.year ?? ''}`.trim() });
        }} options={[...MONTHS.map(([value, label]) => ({ value, label })), { value: 'other', label: 'Other / special' }]} /></label>
        {BASIC.map(([k, label]) => (
          <label key={k}>{label}<input value={String(ed[k] ?? '')} onChange={(e) => setEd({ ...ed, [k]: e.target.value })} /></label>
        ))}
        <label>Hero headline (two words, comma separated)
          <input value={(ed.headline ?? []).join(', ')} onChange={(e) => setEd({ ...ed, headline: e.target.value.split(',').map((s) => s.trim()) })} />
        </label>
        <label className="span2">Intro text<textarea rows={3} value={ed.lede ?? ''} onChange={(e) => setEd({ ...ed, lede: e.target.value })} /></label>
      </div>
      </section>

      <section className="admin-card category-manager">
        <div className="category-manager-head">
          <div className="panel-head"><span className="panel-no">2</span><div><h2>Categories</h2><p>These appear as category choices when you create a story in this volume.</p></div></div>
          <span className="category-count">{ed.sections?.length ?? 0} total</span>
        </div>
        <div className="category-create form-grid">
          <label>Category name<input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="The Big News" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} /></label>
          <label>Short description (optional)<input value={categoryBlurb} onChange={(e) => setCategoryBlurb(e.target.value)} placeholder="The stories shaping the day" /></label>
          <button className="btn dark" type="button" onClick={addCategory}>Add category</button>
        </div>
        {!ed.sections?.length ? <p className="admin-note">No categories yet. Add one here to make it available in the article form.</p> :
          <div className="category-list">{ed.sections.map((section, index) => <article className="category-item" key={section.key}>
            <div className="category-key">{section.key}</div>
            <label>Display name<input value={section.label} onChange={(e) => updateCategory(index, { label: e.target.value, title: e.target.value })} /></label>
            <label>Pages (optional)<input value={section.pages ?? ''} onChange={(e) => updateCategory(index, { pages: e.target.value })} placeholder="p. 2–3" /></label>
            <label className="category-description">Description (optional)<input value={section.blurb ?? ''} onChange={(e) => updateCategory(index, { blurb: e.target.value })} /></label>
            <button className="btn sm danger" type="button" onClick={() => removeCategory(index)} aria-label={`Remove ${section.label}`}>Remove</button>
          </article>)}</div>}
      </section>

      <section className="admin-card category-manager">
        <div className="category-manager-head">
          <div className="panel-head"><span className="panel-no">3</span><div><h2>Vocab Vault</h2><p>Words readers can tap in stories. Mark them in a story with [[word]].</p></div></div>
          <span className="category-count">{vocabList.length} words</span>
        </div>
        <div className="category-create vocab-create">
          <label>Word<input value={newWord.word} onChange={(e) => setNewWord({ ...newWord, word: e.target.value })} placeholder="Manifesto" /></label>
          <label>Group<input value={newWord.category} onChange={(e) => setNewWord({ ...newWord, category: e.target.value })} placeholder="Election words" /></label>
          <label className="wide">Meaning<input value={newWord.definition} onChange={(e) => setNewWord({ ...newWord, definition: e.target.value })} placeholder="A plan a candidate shares before an election" /></label>
          <label className="wide">NextGen line (optional)<input value={newWord.nextgen} onChange={(e) => setNewWord({ ...newWord, nextgen: e.target.value })} placeholder="Their government TO-DO list." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord(); } }} /></label>
          <button className="btn dark" type="button" onClick={addWord}>Add word</button>
        </div>
        {vocabList.length > 6 && <label className="admin-search vocab-search"><input value={wordFilter} onChange={(e) => setWordFilter(e.target.value)} placeholder="Find a word…" aria-label="Find a word" /></label>}
        {!vocabList.length ? <p className="admin-note">No words yet. Words you add here get a tap-for-meaning pop-up in every story of this volume.</p> :
          <div className="category-list">{vocabList.map((v, index) => (!wordFilter || v.word.toLowerCase().includes(wordFilter.toLowerCase())) && <article className="category-item vocab-item" key={`${v.word}-${index}`}>
            <label>Word<input value={v.word} onChange={(e) => updateWord(index, { word: e.target.value })} /></label>
            <label>Group<input value={v.category ?? ''} onChange={(e) => updateWord(index, { category: e.target.value })} /></label>
            <label className="wide">Meaning<input value={v.definition ?? ''} onChange={(e) => updateWord(index, { definition: e.target.value })} /></label>
            <label className="wide">NextGen line<input value={v.nextgen ?? ''} onChange={(e) => updateWord(index, { nextgen: e.target.value })} /></label>
            <label>Also matches<input value={(v.aliases ?? []).join(', ')} onChange={(e) => updateWord(index, { aliases: e.target.value.split(',').map((a) => a.trim()).filter(Boolean) })} placeholder="EV, EVs" /></label>
            <button className="btn sm danger" type="button" onClick={() => removeWord(index)} aria-label={`Remove ${v.word}`}>Remove</button>
          </article>)}</div>}
      </section>

      <h2 className="admin-subhead">Games &amp; extras <small className="muted">advanced · JSON</small></h2>
      {ADVANCED.map(([k, label]) => (
        <details key={k} className="admin-card json-box">
          <summary>{label}{bad[k] && <span className="bad"> · not valid JSON</span>}</summary>
          <textarea className={bad[k] ? 'bad' : ''} rows={12} spellCheck={false} value={json[k] ?? ''} onChange={(e) => setJsonField(k, e.target.value)} />
        </details>
      ))}
    </div>
  );
}
