'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { adminApi, can, type AdminCategory, type CategoryInput, type SectionOption } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import { CATEGORY_ICONS, type CategoryIcon as IconName } from '@/lib/categories';
import { useAdmin } from '@/components/admin/AdminShell';
import AdminIcon from '@/components/admin/AdminIcon';
import CategoryIcon from '@/components/CategoryIcon';

const SWATCHES = ['#FFD400', '#FF8A00', '#FFA52B', '#D97706', '#C2410C', '#E11D2A', '#F87171', '#16A34A', '#2563EB', '#7C3AED', '#DB2777', '#0EA5E9'];
const EMPTY: Required<CategoryInput> = { name: '', desc: '', accent: '#FFD400', icon: 'news', sections: [], link: '', active: true };
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Admin → Categories: the edition sections (THE BIG NEWS, TECH PULSE…) as they show on the website:
// homepage "Explore", the top menu and /category pages.
export default function AdminCategories() {
  const { admin, toast } = useAdmin();
  const editor = can(admin, 'editor');
  const [rows, setRows] = useState<AdminCategory[] | null>(null);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Required<CategoryInput>>(EMPTY);
  const [customKey, setCustomKey] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.categories().then((r) => { setRows(r.categories); setSections(r.sections); }).catch(() => setRows([]));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e: unknown, msg: string) => toast(e instanceof ApiError ? e.message : msg, true);

  const openEdit = (c: AdminCategory | null) => {
    setEditId(c ? c.id : 'new');
    setForm(c ? { name: c.name, desc: c.desc, accent: c.accent, icon: c.icon, sections: c.sections, link: c.link ?? '', active: c.active } : EMPTY);
    setCustomKey('');
  };
  const set = <K extends keyof CategoryInput>(k: K, v: Required<CategoryInput>[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSection = (key: string) => set('sections', form.sections.includes(key) ? form.sections.filter((k) => k !== key) : [...form.sections, key]);

  const save = async () => {
    if (!form.name.trim()) return toast('Give the category a name', true);
    setBusy(true);
    try {
      const r = editId === 'new' ? await adminApi.createCategory(form) : await adminApi.updateCategory(String(editId), form);
      toast(r.message); setEditId(null); load();
    } catch (e) { fail(e, 'Could not save the category'); } finally { setBusy(false); }
  };

  const quick = async (c: AdminCategory, data: CategoryInput) => {
    try { toast((await adminApi.updateCategory(c.id, data)).message); load(); } catch (e) { fail(e, 'Could not save'); }
  };

  const move = async (i: number, dir: -1 | 1) => {
    if (!rows) return;
    const next = [...rows];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    try { await adminApi.orderCategories(next.map((c) => c.id)); } catch (e) { fail(e, 'Could not save the order'); load(); }
  };

  const remove = async (c: AdminCategory) => {
    if (!window.confirm(`Delete “${c.name}”? Its stories stay; they just won't be listed under it.`)) return;
    try { toast((await adminApi.deleteCategory(c.id)).message); if (editId === c.id) setEditId(null); load(); } catch (e) { fail(e, 'Could not delete'); }
  };

  // Sections already used by another category (shown as a hint, still allowed)
  const takenBy = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((c) => { if (c.id !== editId) c.sections.forEach((s) => m.set(s, c.name)); });
    return m;
  }, [rows, editId]);

  const ownKey = editId === 'new' ? slug(form.name) : rows?.find((c) => c.id === editId)?.slug;
  const allSections = useMemo(() => {
    const list = sections.filter((s) => s.key !== ownKey);
    form.sections.forEach((k) => { if (!list.some((s) => s.key === k)) list.push({ key: k, label: k, stories: 0 }); });
    return list;
  }, [sections, form.sections, ownKey]);

  return (
    <div className="admin-page wide">
      <header className="admin-head">
        <div>
          <span className="admin-eyebrow">Website</span>
          <h1 className="display">Categories</h1>
          <p className="muted">Your categories are your sections: The Big News, Money Matters, Tech Pulse, Pop Culture, NextGen Stars and the rest. Every section you add to an edition shows up here, and a category you add here can be picked as a story’s section. They show on the homepage (“Explore”), in the top menu and on each category page.</p>
        </div>
        {editor && <button className="btn" onClick={() => openEdit(null)}><AdminIcon name="plus" size={16} />New category</button>}
      </header>

      <div className="catadm-layout">
        <section className="admin-card flush">
          <div className="card-head pad"><h2>On the website</h2><span className="muted">{rows ? `${rows.filter((c) => c.active).length} showing · ${rows.length} total` : ''}</span></div>
          {!rows ? <p className="muted pad">Loading…</p> : rows.length === 0 ? <p className="muted pad">No categories yet. Add the first one.</p> : (
            <ol className="catadm-list">
              {rows.map((c, i) => (
                <li key={c.id} className={`${c.active ? '' : 'off'}${editId === c.id ? ' editing' : ''}`} style={{ '--cat-accent': c.accent } as CSSProperties}>
                  <span className="catadm-icon"><CategoryIcon name={c.icon} size={22} /></span>
                  <span className="catadm-main">
                    <b>{c.name}{!c.active && <em> · hidden</em>}</b>
                    <small>section key: {c.slug} · {c.stories} {c.stories === 1 ? 'story' : 'stories'}{c.link ? ` · opens ${c.link}` : ''}{c.sections.length ? ` · also: ${c.sections.join(', ')}` : ''}</small>
                  </span>
                  {editor && (
                    <span className="catadm-actions">
                      <button className="btn sm white icon" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><AdminIcon name="up" size={15} /></button>
                      <button className="btn sm white icon" aria-label={`Move ${c.name} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><AdminIcon name="down" size={15} /></button>
                      <button className="btn sm white" onClick={() => quick(c, { active: !c.active })}>{c.active ? 'Hide' : 'Show'}</button>
                      <button className="btn sm" onClick={() => openEdit(c)}>Edit</button>
                      {!c.locked && <button className="btn sm danger icon" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}><AdminIcon name="trash" size={15} /></button>}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="admin-card catadm-form">
          {!editId ? (
            <div className="catadm-hint">
              <AdminIcon name="grid" size={28} />
              <h2>Pick a category to edit</h2>
              <p className="muted">Or add a new one. Changes show on the website within a few seconds.</p>
            </div>
          ) : (
            <fieldset disabled={!editor || busy}>
              <div className="card-head"><h2>{editId === 'new' ? 'New category' : `Edit “${rows?.find((c) => c.id === editId)?.name ?? ''}”`}</h2></div>

              <div className="cat-card catadm-preview" style={{ '--cat-accent': form.accent } as CSSProperties} aria-label="Preview">
                <span className="cat-card-icon"><CategoryIcon name={form.icon} /></span>
                <span className="cat-card-name">{form.name || 'Category name'}</span>
                <span className="cat-card-desc">{form.desc || 'A short line about what readers will find here.'}</span>
              </div>

              <label>Name<input value={form.name} maxLength={40} onChange={(e) => set('name', e.target.value)} placeholder="Sports Corner" /></label>
              <small className="muted">{editId === 'new' ? <>Section key: <b>{slug(form.name) || '…'}</b> (stories use this; it stays the same if you rename)</> : <>Section key: <b>{rows?.find((c) => c.id === editId)?.slug}</b> (stays the same when you rename)</>}</small>
              <label>Short description<textarea rows={2} maxLength={160} value={form.desc} onChange={(e) => set('desc', e.target.value)} placeholder="AI, apps and gadgets: what's new and what it means for you." /></label>

              <div className="catadm-field">
                <span className="catadm-label">Colour</span>
                <div className="catadm-swatches">
                  {SWATCHES.map((hex) => <button type="button" key={hex} className={form.accent.toUpperCase() === hex ? 'on' : ''} style={{ background: hex }} aria-label={`Colour ${hex}`} onClick={() => set('accent', hex)} />)}
                  <label className="catadm-custom" title="Pick any colour"><input type="color" value={form.accent} onChange={(e) => set('accent', e.target.value.toUpperCase())} aria-label="Custom colour" /></label>
                </div>
              </div>

              <div className="catadm-field">
                <span className="catadm-label">Icon</span>
                <div className="catadm-icons">
                  {CATEGORY_ICONS.map((ic: IconName) => <button type="button" key={ic} className={form.icon === ic ? 'on' : ''} aria-label={`Icon ${ic}`} onClick={() => set('icon', ic)}><CategoryIcon name={ic} size={20} /></button>)}
                </div>
              </div>

              <div className="catadm-field">
                <span className="catadm-label">Also include stories from (optional)</span>
                <small className="muted">Stories in this section are already here. Tick another section to show its stories here too.</small>
                <div className="catadm-sections">
                  {allSections.length === 0 && <span className="muted">No sections yet. Add them in Editions.</span>}
                  {allSections.map((s) => (
                    <button type="button" key={s.key} className={form.sections.includes(s.key) ? 'on' : ''} onClick={() => toggleSection(s.key)} title={takenBy.get(s.key) ? `Also in ${takenBy.get(s.key)}` : undefined}>
                      {form.sections.includes(s.key) && <AdminIcon name="check" size={13} />}{s.label}<small>{s.stories ? ` · ${s.stories}` : ''}{takenBy.get(s.key) ? ` · in ${takenBy.get(s.key)}` : ''}</small>
                    </button>
                  ))}
                </div>
                <div className="catadm-addkey">
                  <input value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="Other section key, e.g. sports-corner" aria-label="Other section key"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const k = slug(customKey); if (k && !form.sections.includes(k)) set('sections', [...form.sections, k]); setCustomKey(''); } }} />
                  <button type="button" className="btn sm white" onClick={() => { const k = slug(customKey); if (k && !form.sections.includes(k)) set('sections', [...form.sections, k]); setCustomKey(''); }}>Add</button>
                </div>
              </div>

              <label>Card opens (optional)<input value={form.link} maxLength={200} onChange={(e) => set('link', e.target.value)} placeholder="/#arcade" /></label>
              <small className="muted">Leave empty to open its category page with the stories. For game sections like Crack This, use /#arcade.</small>

              <label className={`switch-row${form.active ? ' on' : ''}`}>
                <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
                <span className="switch-ui" aria-hidden="true" />
                <span><b>Show on the website</b><small>Hidden categories keep their settings but leave the homepage and menu.</small></span>
              </label>

              <div className="catadm-buttons">
                <button className="btn" onClick={save}>{busy ? 'Saving…' : editId === 'new' ? 'Add category' : 'Save changes'}</button>
                <button className="btn white" onClick={() => setEditId(null)}>Cancel</button>
              </div>
            </fieldset>
          )}
        </aside>
      </div>
    </div>
  );
}
