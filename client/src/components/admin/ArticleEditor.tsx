'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, can, type AdminArticle, type AdminEditionRow, type ArticleStatus } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import type { Edition, SectionCard, VocabWord } from '@/lib/types';
import ArticleBody from '../article/ArticleBody';
import StatusBadge from './StatusBadge';
import { useAdmin } from './AdminShell';
import AnimatedSelect from '@/components/AnimatedSelect';
import AdminIcon from './AdminIcon';
import SmartImage from '../SmartImage';
import type { ImageFit } from '@/lib/types';

const FITS: { value: ImageFit; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Fills the box when the shape is close, shows the whole picture when it is very different' },
  { value: 'cover', label: 'Fill the box', hint: 'Always fills the box. Edges may be cropped around the focus point' },
  { value: 'contain', label: 'Whole picture', hint: 'Never crops. Empty space is filled with a soft blur of the picture' },
];
// The boxes the main picture appears in on the site, for the preview row
const SPOTS = [
  { label: 'Homepage card', ratio: '16 / 9' },
  { label: 'Story header', ratio: '21 / 9' },
  { label: 'Homepage hero', ratio: '2.2 / 1', hero: true },
  { label: 'Phone card', ratio: '4 / 3' },
];

type Form = {
  title: string; slug: string; edition: string; section: string; sectionLabel: string; pages: string;
  dek: string; image: string; imagePosition: string; imageFit: ImageFit; homepageFeatured: boolean; author: string; readMins: number; points: number;
  gallery: { image: string; caption: string }[];
  body: string; eli10: string; gameLabel: string; gameHref: string; tags: string; reviewNote: string;
  // the quick-check question shown after the reading time
  qPrompt: string; qOptions: string[]; qAnswer: number; qExplain: string;
};

const EMPTY: Form = {
  title: '', slug: '', edition: '', section: '', sectionLabel: '', pages: '', dek: '', image: '', imagePosition: '', imageFit: 'auto', homepageFeatured: false, gallery: [],
  author: 'NextGen Team', readMins: 3, points: 10, body: '', eli10: '', gameLabel: '', gameHref: '', tags: '', reviewNote: '',
  qPrompt: '', qOptions: ['', '', '', ''], qAnswer: 0, qExplain: '',
};

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
// One line in the box = one block on the page
const toBlocks = (text: string) => text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
const fromBlocks = (blocks: string[] = []) => blocks.join('\n');
// ~200 words a minute for teens
const estimateMins = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200));

function toForm(a: AdminArticle): Form {
  return {
    title: a.title, slug: a.slug, edition: a.edition, section: a.section, sectionLabel: a.sectionLabel, pages: a.pages ?? '',
    dek: a.dek ?? '', image: a.image ?? '', imagePosition: a.imagePosition ?? '', imageFit: a.imageFit ?? 'auto', homepageFeatured: a.homepageFeatured ?? false, gallery: (a.gallery ?? []).map((item) => ({ image: item.image, caption: item.caption ?? '' })), author: a.author ?? 'NextGen Team',
    readMins: a.readMins, points: a.points, body: fromBlocks(a.body), eli10: fromBlocks(a.eli10),
    gameLabel: a.game?.label ?? '', gameHref: a.game?.href ?? '', tags: (a.tags ?? []).join(', '), reviewNote: a.reviewNote ?? '',
    qPrompt: a.question?.prompt ?? '', qOptions: [0, 1, 2, 3].map((i) => a.question?.options?.[i] ?? ''), qAnswer: a.question?.answer ?? 0, qExplain: a.question?.explain ?? '',
  };
}

function toPayload(f: Form) {
  return {
    title: f.title.trim(), slug: f.slug.trim(), edition: f.edition, section: f.section, sectionLabel: f.sectionLabel,
    // null (not undefined) so removing a picture or page number is saved too
    pages: f.pages || null, dek: f.dek, image: f.image || null, imagePosition: f.imagePosition || null, imageFit: f.imageFit, homepageFeatured: f.homepageFeatured, gallery: f.gallery,
    author: f.author, readMins: Number(f.readMins) || 3, points: Number(f.points) || 10,
    body: toBlocks(f.body), eli10: toBlocks(f.eli10),
    game: f.gameLabel && f.gameHref ? { label: f.gameLabel, href: f.gameHref } : undefined,
    tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), reviewNote: f.reviewNote || null,
    // empty options are dropped; the answer index follows the right option
    question: questionPayload(f),
  };
}

function questionPayload(f: Form) {
  const kept = f.qOptions.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
  const answer = kept.findIndex((x) => x.i === f.qAnswer);
  if (!f.qPrompt.trim() || kept.length < 2 || answer < 0) return { prompt: '', options: [], answer: 0, explain: '' };
  return { prompt: f.qPrompt.trim(), options: kept.map((x) => x.o), answer, explain: f.qExplain.trim() };
}

export default function ArticleEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { admin, toast } = useAdmin();
  const [form, setForm] = useState<Form>(EMPTY);
  const [meta, setMeta] = useState<{ status: ArticleStatus; createdBy: string; createdById: string | null } | null>(null);
  const [editions, setEditions] = useState<AdminEditionRow[]>([]);
  const [sections, setSections] = useState<SectionCard[]>([]);
  const [sectionsError, setSectionsError] = useState('');
  const [vocab, setVocab] = useState<VocabWord[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [previewEli, setPreviewEli] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);
  const [storage, setStorage] = useState<'cloudinary' | 'local' | null>(null);
  // "Paste your article" formatter
  const [pasteText, setPasteText] = useState('');
  // open by default on a new story; afterwards the editor decides (it stays open after formatting so the result shows)
  const [pasteOpen, setPasteOpen] = useState(!id);
  const [formatting, setFormatting] = useState(false);
  const [formatted, setFormatted] = useState<{ source: 'ai' | 'basic'; notes: string; vocab: VocabWord[] } | null>(null);
  const [dragging, setDragging] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const inlineImageRef = useRef<HTMLInputElement>(null);
  const inlineSelection = useRef({ start: 0, end: 0 });

  // Load the story (when editing) + the list of editions
  useEffect(() => {
    adminApi.editions().then((list) => {
      setEditions(list);
      if (!id) {
        const current = list.find((e) => e.status === 'current') ?? list[0];
        if (current) setForm((f) => ({ ...f, edition: f.edition || current.slug }));
      }
    }).catch(() => {});
    if (id) {
      adminApi.article(id).then((a) => {
        setForm(toForm(a));
        setMeta({ status: a.status, createdBy: a.createdBy, createdById: a.createdById });
        setLoaded(true);
      }).catch(() => { toast('Story not found', true); router.replace('/admin/articles'); });
    }
  }, [id, router, toast]);

  // Where uploads go (Cloudinary or this server's folder)
  useEffect(() => { adminApi.uploadStatus().then(setStorage).catch(() => setStorage(null)); }, []);
  // Homepage hero spots: how many are taken by other stories
  const [heroInfo, setHeroInfo] = useState<{ max: number; others: number } | null>(null);
  useEffect(() => {
    adminApi.homepageHero().then((h) => setHeroInfo({ max: h.max, others: h.articles.filter((a) => a.state === 'live' && a.id !== id).length })).catch(() => setHeroInfo(null));
  }, [id]);

  // Site categories (Admin → Categories) = sections too; offered in the Section list after the edition's own
  const [siteCats, setSiteCats] = useState<{ key: string; label: string }[]>([]);
  useEffect(() => {
    adminApi.categories().then((r) => setSiteCats(r.categories.filter((c) => c.active && !c.link).map((c) => ({ key: c.slug, label: c.name.toUpperCase() })))).catch(() => setSiteCats([]));
  }, []);
  const sectionOptions = [...sections.map((s) => ({ key: s.key, label: s.label })), ...siteCats.filter((c) => !sections.some((s) => s.key === c.key))];

  // When the edition changes, load its sections (for the dropdown) and vocab (for the preview)
  useEffect(() => {
    if (!form.edition) return;
    setSectionsError('');
    adminApi.edition(form.edition).then((e) => {
      setSections(e.sections ?? []); setVocab(e.vocab ?? []);
      if (!e.sections?.length) setSectionsError('This edition has no categories yet. Add categories in the edition settings first.');
    }).catch(() => { setSections([]); setSectionsError('Could not load this edition’s categories. Refresh and try again.'); });
  }, [form.edition]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Send the pasted article to the server and fill the form with the result
  const formatPasted = async () => {
    const hasContent = form.title.trim() || form.body.trim();
    if (hasContent && !window.confirm('Replace the title, summary, story and kids version with the formatted article?')) return;
    setFormatting(true);
    try {
      const { story, source } = await adminApi.formatArticle(pasteText, form.edition || undefined);
      setForm((f) => ({
        ...f,
        title: story.title || f.title,
        slug: slugTouched ? f.slug : slugify(story.title || f.title),
        dek: story.dek || f.dek,
        ...(story.section ? { section: story.section, sectionLabel: story.sectionLabel } : {}),
        body: fromBlocks(story.body),
        eli10: story.eli10.length ? fromBlocks(story.eli10) : f.eli10,
        tags: story.tags.length ? story.tags.join(', ') : f.tags,
        readMins: story.readMins || f.readMins,
        // same game button and points as our other stories, unless already set
        ...(story.game && !f.gameLabel && !f.gameHref ? { gameLabel: story.game.label, gameHref: story.game.href } : {}),
        ...(story.points && !f.points ? { points: story.points } : {}),
        ...(story.question ? { qPrompt: story.question.prompt, qOptions: [0, 1, 2, 3].map((i) => story.question?.options[i] ?? ''), qAnswer: story.question.answer, qExplain: story.question.explain ?? '' } : {}),
      }));
      const known = new Set(vocab.map((v) => v.word.toLowerCase()));
      const fresh = story.vocab.filter((v) => !known.has(v.word.toLowerCase()));
      setFormatted({ source, notes: story.notes, vocab: fresh });
      // [[words]] only light up when they are in the volume's Vocab Vault, so editors get them added straight away
      if (fresh.length && form.edition && can(admin, 'editor')) await addSuggestedVocab(fresh);
      toast(source === 'ai' ? 'Formatted. Check it over before you save ✨' : 'Split into title and paragraphs. Add an AI key for full formatting');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not format the article', true);
    } finally {
      setFormatting(false);
    }
  };

  // Add the formatter's suggested words to this volume's Vocab Vault (editors)
  const addSuggestedVocab = async (words?: VocabWord[]) => {
    const list = words ?? formatted?.vocab ?? [];
    if (!list.length || !form.edition) return;
    try {
      const ed = await adminApi.edition(form.edition);
      const have = new Set((ed.vocab ?? []).map((v) => v.word.toLowerCase()));
      const added = list.filter((v) => !have.has(v.word.toLowerCase()));
      const next = [...(ed.vocab ?? []), ...added];
      await adminApi.updateEdition(form.edition, { vocab: next } as Partial<Edition>);
      setVocab(next);
      setFormatted((f) => (f ? { ...f, vocab: [] } : f));
      toast(`${added.length} word${added.length === 1 ? '' : 's'} added to the Vocab Vault`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not add the words', true);
    }
  };

  const onTitle = (v: string) => setForm((f) => ({ ...f, title: v, slug: slugTouched ? f.slug : slugify(v) }));

  const onSection = (key: string) => {
    const s = sections.find((x) => x.key === key);
    const c = siteCats.find((x) => x.key === key);
    setForm((f) => ({ ...f, section: key, sectionLabel: s?.label ?? c?.label ?? f.sectionLabel, pages: f.pages || s?.pages || '' }));
  };

  const wrapSelection = (before: string, after = before) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e);
    const content = selected || 'text';
    const next = `${value.slice(0, s)}${before}${content}${after}${value.slice(e)}`;
    set('body', next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + content.length); });
  };

  // Apply a block style to the current line or every selected line.
  const prefixLines = (prefix: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const start = value.lastIndexOf('\n', s - 1) + 1;
    const endAt = value.indexOf('\n', e);
    const end = endAt < 0 ? value.length : endAt;
    const block = value.slice(start, end).split('\n').map((line) => `${prefix}${line.replace(/^(?:#{1,3} |[-*] |\d+\. |> ?)/, '')}`).join('\n');
    set('body', `${value.slice(0, start)}${block}${value.slice(end)}`);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start, start + block.length); });
  };

  const insertLink = () => {
    const url = window.prompt('Paste a web link');
    if (!url?.trim()) return;
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const label = value.slice(s, e) || 'link text';
    const markdown = `[${label}](${url.trim()})`;
    set('body', `${value.slice(0, s)}${markdown}${value.slice(e)}`);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + 1, s + 1 + label.length); });
  };

  const chooseInlineImage = () => {
    const el = bodyRef.current;
    if (el) inlineSelection.current = { start: el.selectionStart, end: el.selectionEnd };
    inlineImageRef.current?.click();
  };

  const uploadInlineImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await adminApi.uploadImage(file);
      const alt = window.prompt('Add a short image description (optional)', '') ?? '';
      const block = `![${alt.replace(/\]/g, '')}](${url})`;
      const { start, end } = inlineSelection.current;
      const before = form.body.slice(0, start);
      const after = form.body.slice(end);
      const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
      const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
      const insertion = `${prefix}${block}${suffix}`;
      set('body', `${before}${insertion}${after}`);
      const caret = start + insertion.length;
      requestAnimationFrame(() => { bodyRef.current?.focus(); bodyRef.current?.setSelectionRange(caret, caret); });
      toast('Image added to story');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Image upload failed', true);
    } finally {
      setUploading(false);
      if (inlineImageRef.current) inlineImageRef.current.value = '';
    }
  };

  // Magazine layouts: "@photos" (overlapping pair / grid) and "@profile" (name banner card)
  const layoutRef = useRef<HTMLInputElement>(null);
  const layoutMode = useRef<'photos' | 'profile'>('photos');
  const chooseLayoutPhotos = (mode: 'photos' | 'profile') => {
    const el = bodyRef.current;
    if (el) inlineSelection.current = { start: el.selectionStart, end: el.selectionEnd };
    layoutMode.current = mode;
    layoutRef.current?.click();
  };

  const uploadLayoutPhotos = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, layoutMode.current === 'profile' ? 2 : 6);
    if (!picked.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of picked) urls.push(await adminApi.uploadImage(file));
      const block = layoutMode.current === 'profile'
        ? `@profile Full Name | Age | Category · Category | ${urls.join(' | ')}\n### A short, catchy headline about them\nWrite two or three lines about this person.`
        : `@photos ${urls.join(' | ')} | Caption (optional)`;
      const { start, end } = inlineSelection.current;
      let caret = 0;
      // read the newest body (the writer may have typed while photos uploaded)
      setForm((f) => {
        const before = f.body.slice(0, start);
        const after = f.body.slice(end);
        const prefix = before && !before.endsWith('\n') ? '\n' : '';
        const suffix = after && !after.startsWith('\n') ? '\n' : '';
        caret = before.length + prefix.length + block.length;
        return { ...f, body: `${before}${prefix}${block}${suffix}${after}` };
      });
      // caret goes after the block, so the next insert lands below it instead of replacing it
      inlineSelection.current = { start: caret, end: caret };
      requestAnimationFrame(() => { bodyRef.current?.focus(); bodyRef.current?.setSelectionRange(caret, caret); inlineSelection.current = { start: caret, end: caret }; });
      toast(layoutMode.current === 'profile' ? 'Profile added. Replace the name, age and text' : 'Photos added to the story');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Image upload failed', true);
    } finally {
      setUploading(false);
      if (layoutRef.current) layoutRef.current.value = '';
    }
  };

  const insert = (mark: string) => {
    if (mark === '[[') { wrapSelection('[[', ']]'); return; }
    prefixLines(mark);
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      set('image', await adminApi.uploadImage(file));
      toast('Image uploaded');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Upload failed', true);
    } finally {
      setUploading(false);
    }
  };

  const uploadGallery = async (files?: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map(async (file) => ({ image: await adminApi.uploadImage(file), caption: '' })));
      setForm((f) => ({ ...f, gallery: [...f.gallery, ...uploaded] }));
      toast(`${uploaded.length} supporting image${uploaded.length === 1 ? '' : 's'} uploaded`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Supporting image upload failed', true);
    } finally {
      setUploading(false);
    }
  };

  const moveGallery = (index: number, delta: number) => setForm((f) => {
    const target = index + delta;
    if (target < 0 || target >= f.gallery.length) return f;
    const gallery = [...f.gallery];
    [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
    return { ...f, gallery };
  });

  const insertStoryOutline = () => {
    const outline = '## What happened\n\n## Why it matters\n\n## What happens next';
    const next = form.body.trim() ? `${form.body.trim()}\n\n${outline}\n` : `${outline}\n`;
    set('body', next);
    requestAnimationFrame(() => { bodyRef.current?.focus(); bodyRef.current?.setSelectionRange(next.length, next.length); });
  };

  const save = async (status?: ArticleStatus) => {
    if (!form.title.trim() || !form.edition || !form.section) return toast('Add a title, edition and section first', true);
    setBusy(true);
    try {
      const payload = { ...toPayload(form), ...(status ? { status } : {}) };
      const res = id ? await adminApi.updateArticle(id, payload) : await adminApi.createArticle(payload);
      const words = { draft: 'Saved as draft', review: 'Sent to an editor for review', published: 'Published 🎉' } as const;
      toast(status ? words[status] : res.message);
      setMeta((m) => ({ status: res.article.status, createdBy: m?.createdBy ?? admin?.name ?? '', createdById: m?.createdById ?? admin?.id ?? null }));
      if (!id) router.replace(`/admin/articles/${res.article.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm('Delete this story for good?')) return;
    try {
      await adminApi.deleteArticle(id);
      toast('Story deleted');
      router.replace('/admin/articles');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete', true);
    }
  };

  const isEditor = can(admin, 'editor');
  const status = meta?.status ?? 'draft';
  const mine = !id || meta?.createdById === admin?.id;
  const locked = !isEditor && (status === 'published' || !mine);
  const words = useMemo(() => form.body.split(/\s+/).filter(Boolean).length, [form.body]);
  const previewBlocks = toBlocks(previewEli && form.eli10.trim() ? form.eli10 : form.body);

  if (!loaded) return <div className="admin-page wide"><div className="admin-skeleton" /><div className="admin-skeleton short" /></div>;

  const editionName = (e: AdminEditionRow) => (e.volumeNumber ? `${e.year ? `${e.year} · ` : ''}Vol ${e.volumeNumber} · ${e.month}` : `${e.month} · special issue`) + (e.title ? ` — ${e.title}` : '');
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = Array.from(e.dataTransfer.files as FileList).find((f: File) => f.type.startsWith('image/'));
    if (file && !locked) upload(file);
  };
  // "40% 25%" → [40, 25] for the focus dot
  const focusPoint = (() => {
    const m = form.imagePosition.match(/^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/);
    return m ? [Number(m[1]), Number(m[2])] : null;
  })();
  const checks = [
    { ok: Boolean(form.title.trim()), label: 'Title' },
    { ok: Boolean(form.section), label: 'Section' },
    { ok: Boolean(form.image), label: 'Main picture' },
    { ok: toBlocks(form.body).length > 0, label: 'Story text' },
    { ok: Boolean(form.dek.trim()), label: 'Summary' },
  ];

  return (
    <div className="admin-page wide">
      {/* Sticky title + actions */}
      <header className="admin-head editor-head">
        <div>
          <Link href="/admin/articles" className="back">← All stories</Link>
          <h1 className="display">{id ? 'Edit story' : 'New story'}</h1>
          {meta && <p className="muted"><StatusBadge status={status} /> by {meta.createdBy}</p>}
        </div>
        <div className="admin-actions">
          {status === 'published' && <a className="btn sm white" href={`/articles/${form.slug}`} target="_blank" rel="noreferrer"><AdminIcon name="eye" size={16} />View live</a>}
          {!locked && <button className="btn sm white" disabled={busy || uploading} onClick={() => save(status === 'published' ? undefined : 'draft')}>{status === 'published' ? 'Save changes' : 'Save draft'}</button>}
          {!isEditor && !locked && status !== 'review' && <button className="btn sm" disabled={busy || uploading} onClick={() => save('review')}>Send for review</button>}
          {isEditor && status !== 'published' && <button className="btn sm dark" disabled={busy || uploading} onClick={() => save('published')}>Publish</button>}
          {isEditor && status === 'published' && <button className="btn sm white" disabled={busy || uploading} onClick={() => save('draft')}>Unpublish</button>}
          {id && (isEditor || (mine && status === 'draft')) && <button className="btn sm danger" onClick={remove} aria-label="Delete story"><AdminIcon name="trash" size={16} /></button>}
        </div>
      </header>

      {locked && <div className="admin-note">You can view this story but not edit it. {status === 'published' ? 'It is published, so only editors can change it.' : 'Only the writer or an editor can edit it.'}</div>}
      {form.reviewNote && !isEditor && <div className="admin-note">✍️ Editor&apos;s note: {form.reviewNote}</div>}

      <div className="editor">
        <fieldset className="editor-form" disabled={locked}>

          {/* 0. Paste a normal article and let the system lay it out */}
          <details className="editor-panel paste-panel" open={pasteOpen} onToggle={(e) => setPasteOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="panel-head">
              <span className="panel-no">✨</span>
              <div><h2>Paste your article</h2><p>Paste the plain article and the system lays it out the NextGen way: title, summary, headings, callouts, vocab words and the kids version. Facts stay the same.</p></div>
            </summary>
            <textarea className="paste-box" rows={9} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'Paste the article here, just as it was written…\n\nTip: choose the Volume first (step 1) so the right section can be picked.'} />
            <div className="paste-actions">
              <button type="button" className="btn dark" disabled={formatting || pasteText.trim().length < 40} onClick={formatPasted}>{formatting ? 'Formatting… (can take ~30s)' : '✨ Format for NextGen'}</button>
              <small className="muted">{pasteText.trim() ? `${pasteText.trim().split(/\s+/).length} words` : 'Nothing is saved until you press Save or Publish.'}</small>
            </div>
            {formatted && (
              <div className={`paste-result ${formatted.source}`}>
                <b>{formatted.source === 'ai' ? 'Done. Read it through and check the facts before publishing.' : 'Basic formatting only.'}</b>
                {formatted.source === 'basic' && <p>The text was split into a title and paragraphs. For the full NextGen formatting, add a free <code>GROQ_API_KEY</code> (or <code>GEMINI_API_KEY</code> / <code>ANTHROPIC_API_KEY</code>) to <code>server/.env</code> and restart the server.</p>}
                {formatted.notes && <p><b>Please check:</b> {formatted.notes}</p>}
                {formatted.vocab.length > 0 && (
                  <div className="paste-vocab">
                    <span>Suggested Vocab Vault words: {formatted.vocab.map((v) => <i key={v.word} title={v.definition}>{v.word}</i>)}</span>
                    {isEditor && form.edition
                      ? <button type="button" className="btn sm white" onClick={() => addSuggestedVocab()}>Add to this volume</button>
                      : <small className="muted">An editor can add these in the volume&apos;s Vocab Vault.</small>}
                  </div>
                )}
              </div>
            )}
          </details>

          {/* 1. Basics */}
          <section className="editor-panel">
            <div className="panel-head"><span className="panel-no">1</span><div><h2>The basics</h2><p>Title, link and where the story lives.</p></div></div>
            <label>Title<input className="title-input" value={form.title} onChange={(e) => onTitle(e.target.value)} placeholder="The ₦10K Money Mystery" /></label>
            <label>Link
              <div className="slug"><span>/articles/</span><input value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} /></div>
            </label>
            <label>One-line summary (under the title)<input value={form.dek} onChange={(e) => set('dek', e.target.value)} placeholder="₦10K on Monday. ₦650 by Friday. Who ate your money?" /></label>
            <div className="row3 volume-row">
              <label>Volume
                <AnimatedSelect label="Volume" value={form.edition} onChange={(value) => setForm((f) => ({ ...f, edition: value, section: '', sectionLabel: '', pages: '' }))} options={editions.map((e) => ({ value: e.slug, label: editionName(e) }))} placeholder="Choose a year and volume" />
              </label>
              <label>Section
                <AnimatedSelect label="Section" value={form.section} onChange={onSection} options={[{ value: '', label: 'Pick a category' }, ...sectionOptions.map((s) => ({ value: s.key, label: s.label }))]} placeholder="Choose a category" />
              </label>
              <label>Print pages<input value={form.pages} onChange={(e) => set('pages', e.target.value)} placeholder="p.7" /></label>
            </div>
            {sectionsError && !sectionOptions.length && <p className="admin-note" role="status">{sectionsError} {form.edition && <Link href={`/admin/editions/${form.edition}`}>Open the volume →</Link>}</p>}
          </section>

          {/* 2. Pictures */}
          <section className="editor-panel">
            <div className="panel-head">
              <span className="panel-no">2</span>
              <div><h2>Pictures</h2><p>The main picture shows on cards, the homepage and the top of the story.</p></div>
              {storage && (
                <span className={`storage-pill ${storage}`} title={storage === 'cloudinary' ? 'Uploads go to Cloudinary' : 'Uploads are saved in the server/uploads folder. Add the CLOUDINARY_ keys before going live.'}>
                  <AdminIcon name={storage === 'cloudinary' ? 'cloud' : 'warn'} size={15} />{storage === 'cloudinary' ? 'Cloudinary' : 'Saved on server'}
                </span>
              )}
            </div>

            <div
              className={`dropzone${form.image ? ' has-image' : ''}${dragging ? ' dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (!locked) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {form.image ? (
                <>
                  {/* Whole picture; click it to choose what stays in view when it is cropped */}
                  <div className="focus-stage">
                    <img className="focus-stage-bg" src={form.image} alt="" aria-hidden="true" />
                    <span className="focus-picker">
                      <img
                        src={form.image}
                        alt="Main picture. Click to set the focus point"
                        onClick={(e) => {
                          if (locked) return;
                          const r = e.currentTarget.getBoundingClientRect();
                          const x = Math.round(((e.clientX - r.left) / r.width) * 100);
                          const y = Math.round(((e.clientY - r.top) / r.height) * 100);
                          set('imagePosition', `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`);
                        }}
                      />
                      {focusPoint && <i className="focus-dot" style={{ left: `${focusPoint[0]}%`, top: `${focusPoint[1]}%` }} aria-hidden="true" />}
                    </span>
                  </div>
                  <div className="dropzone-actions">
                    <label className="btn sm white file"><AdminIcon name="upload" size={16} />{uploading ? 'Uploading…' : 'Replace'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => upload(e.target.files?.[0])} hidden disabled={uploading} /></label>
                    <button type="button" className="btn sm white" onClick={() => setForm((f) => ({ ...f, image: '', imagePosition: '', imageFit: 'auto' }))}><AdminIcon name="trash" size={16} />Remove</button>
                  </div>
                </>
              ) : (
                <label className="dropzone-empty">
                  <span className="dropzone-ico"><AdminIcon name="image" size={28} /></span>
                  <b>{uploading ? 'Uploading…' : 'Drop a picture here, or click to upload'}</b>
                  <small>JPG, PNG, WEBP or GIF · up to 5 MB</small>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => upload(e.target.files?.[0])} hidden disabled={uploading} />
                </label>
              )}
            </div>
            <label>…or paste an image link<input id="article-main-image" value={form.image} onChange={(e) => set('image', e.target.value)} placeholder="https://…" /></label>

            {form.image && (
              <div className="fit-panel">
                <div className="fit-head">
                  <div>
                    <b>How the picture fits</b>
                    <small>{form.imagePosition ? <>Focus point set. <button type="button" className="link-btn" onClick={() => set('imagePosition', '')}>Reset to centre</button></> : 'Tip: click the picture above to choose what stays in view when it is cropped.'}</small>
                  </div>
                  <div className="fit-options" role="radiogroup" aria-label="How the picture fits">
                    {FITS.map((f) => (
                      <button key={f.value} type="button" role="radio" aria-checked={form.imageFit === f.value} title={f.hint} className={form.imageFit === f.value ? 'on' : ''} onClick={() => set('imageFit', f.value)}>{f.label}</button>
                    ))}
                  </div>
                </div>
                <div className="fit-spots">
                  {SPOTS.map((spot) => (
                    <figure key={spot.label} className={`fit-spot${spot.hero ? ' is-hero' : ''}`}>
                      <div style={{ aspectRatio: spot.ratio }}>
                        <SmartImage src={form.image} position={form.imagePosition} fit={form.imageFit} align={spot.hero ? 'right center' : 'center'} tolerance={spot.hero ? 0.5 : 0.45} />
                      </div>
                      <figcaption>{spot.label}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}

            <div className="gallery-upload">
              <div><b>Supporting images</b><span className="muted"> · optional, shown with the story</span></div>
              <div className="gallery-buttons">
                <label className="btn sm white file"><AdminIcon name="plus" size={16} />{uploading ? 'Uploading…' : 'Add images'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => uploadGallery(e.target.files)} hidden disabled={uploading} /></label>
                <button type="button" className="btn sm white" onClick={() => setForm((f) => ({ ...f, gallery: [...f.gallery, { image: '', caption: '' }] }))}>Add image link</button>
              </div>
            </div>
            {form.gallery.map((item, index) => <div className="gallery-editor-item" key={index}>
              {item.image ? <img src={item.image} alt="" /> : <span className="gallery-placeholder"><AdminIcon name="image" size={18} /></span>}
              <input aria-label={`Image URL for supporting image ${index + 1}`} value={item.image} onChange={(e) => setForm((f) => ({ ...f, gallery: f.gallery.map((x, i) => i === index ? { ...x, image: e.target.value } : x) }))} placeholder="Paste image URL" />
              <input aria-label={`Caption for supporting image ${index + 1}`} value={item.caption} onChange={(e) => setForm((f) => ({ ...f, gallery: f.gallery.map((x, i) => i === index ? { ...x, caption: e.target.value } : x) }))} placeholder="Image caption (optional)" />
              <div className="gallery-order"><button type="button" aria-label="Move image up" disabled={index === 0} onClick={() => moveGallery(index, -1)}>↑</button><button type="button" aria-label="Move image down" disabled={index === form.gallery.length - 1} onClick={() => moveGallery(index, 1)}>↓</button></div>
              <button type="button" className="btn sm danger" onClick={() => setForm((f) => ({ ...f, gallery: f.gallery.filter((_, i) => i !== index) }))} aria-label={`Remove supporting image ${index + 1}`}><AdminIcon name="trash" size={15} /></button>
            </div>)}
          </section>

          {/* 3. Story */}
          <section className="editor-panel">
            <div className="panel-head"><span className="panel-no">3</span><div><h2>The story</h2><p>One line = one block. Use the toolbar for headings, lists and vocab words.</p></div></div>
            <div className="story-composer">
              <span className="label-row"><label htmlFor="article-body">Story</label><small>{words} words · about {estimateMins(form.body)} min</small></span>
              <details className="story-format-guide">
                <summary>Recommended article format</summary>
                <p><b>1. Lead:</b> Say what happened, who it affects, and the key fact.</p>
                <p><b>2. Context:</b> Explain what readers need to know in short, clear paragraphs.</p>
                <p><b>3. Why it matters:</b> Connect the story to young people or their community.</p>
                <p><b>4. Next step:</b> Say what happens next or what readers can do.</p>
                <p><b>Magazine layouts:</b> <code>@photos link | link | caption</code> shows two photos overlapping. <code>@profile Name | 14 | Acting · Young Star | link | link</code> makes a profile card; the lines under it (a <code>###</code> headline and text) belong to it. Profiles one after another sit side by side. End a group with <code>---</code>.</p>
                <button type="button" className="btn sm white" onClick={insertStoryOutline}>Insert the story headings</button>
              </details>
              <div className="editor-ribbon" role="toolbar" aria-label="Story formatting">
                <div className="ribbon-group"><button type="button" title="Section heading" onClick={() => insert('## ')}><b>H2</b><span>Heading</span></button><button type="button" title="Subheading" onClick={() => insert('### ')}><b>H3</b><span>Subhead</span></button></div>
                <div className="ribbon-group"><button type="button" title="Bold (Ctrl+B)" onClick={() => wrapSelection('**')}><b>B</b></button><button type="button" title="Italic (Ctrl+I)" onClick={() => wrapSelection('*')}><i>I</i></button><button type="button" title="Strikethrough" onClick={() => wrapSelection('~~')}><s>S</s></button><button type="button" title="Highlight" onClick={() => wrapSelection('==')}><mark>H</mark></button></div>
                <div className="ribbon-group"><button type="button" title="Bulleted list" onClick={() => insert('- ')}>• List</button><button type="button" title="Numbered list" onClick={() => insert('1. ')}>1. List</button><button type="button" title="Yellow callout box" onClick={() => insert('> ')}>❝ Callout</button></div>
                <div className="ribbon-group"><button type="button" title="Add link" onClick={insertLink}>↗ Link</button><button type="button" title="Mark a Vocab Vault word" onClick={() => insert('[[')}>✦ Vocab</button><button type="button" title="Insert image in story" disabled={uploading} onClick={chooseInlineImage}>{uploading ? '…' : '▧ Image'}</button></div>
                <div className="ribbon-group"><button type="button" title="Two photos overlapping, like the magazine (pick 2 photos, or 3+ for a grid)" disabled={uploading} onClick={() => chooseLayoutPhotos('photos')}>◩ Photos</button><button type="button" title="Profile card: 2 photos, name banner, age, tags and text (pick 1 or 2 photos)" disabled={uploading} onClick={() => chooseLayoutPhotos('profile')}>☺ Profile</button></div>
              </div>
              <textarea id="article-body" className="writing-canvas" ref={bodyRef} rows={16} value={form.body} disabled={uploading} onChange={(e) => set('body', e.target.value)}
                onKeyDown={(e) => { if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); wrapSelection('**'); } else if (e.ctrlKey && e.key.toLowerCase() === 'i') { e.preventDefault(); wrapSelection('*'); } else if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); insertLink(); } }}
                placeholder={'Start writing your story…\n\nUse the toolbar to add headings, lists, links and vocab words.'} />
              <input ref={inlineImageRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => uploadInlineImage(e.target.files?.[0])} />
              <input ref={layoutRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => uploadLayoutPhotos(e.target.files)} />
              <span className="writing-hint">Tip: select text to format it · Ctrl+B bold · Ctrl+I italic · Ctrl+K link</span>
            </div>
            <label>&quot;Explain like I&apos;m 10&quot; version (optional)
              <textarea rows={5} value={form.eli10} onChange={(e) => set('eli10', e.target.value)} placeholder="Same story in very simple words. Same format." />
            </label>
          </section>

          {/* Quick-check question (after the reading time) */}
          <section className="editor-panel question-panel">
            <div className="panel-head"><span className="panel-no">?</span><div><h2>Quick-check question</h2><p>Shown after the reading time with a timer. Proves they read it. Tap the letter of the right answer.</p></div></div>
            <label>Question<input value={form.qPrompt} onChange={(e) => set('qPrompt', e.target.value)} placeholder="Which magazine recognised Ishaq's design?" maxLength={300} /></label>
            <div className="q-options">
              {form.qOptions.map((o, i) => (
                <div key={i} className="q-opt">
                  <button type="button" className={`q-radio${form.qAnswer === i ? ' on' : ''}`} onClick={() => set('qAnswer', i)} aria-pressed={form.qAnswer === i} aria-label={`Option ${'ABCD'[i]} is right`}>{form.qAnswer === i ? '✓' : 'ABCD'[i]}</button>
                  <input value={o} onChange={(e) => set('qOptions', form.qOptions.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i < 2 ? `Option ${'ABCD'[i]}` : `Option ${'ABCD'[i]} (optional)`} maxLength={160} aria-label={`Option ${'ABCD'[i]}`} />
                </div>
              ))}
            </div>
            <label>Why it&apos;s right <small>(optional, shown after they answer)</small><input value={form.qExplain} onChange={(e) => set('qExplain', e.target.value)} maxLength={300} /></label>
            <p className="q-hint">{form.qPrompt.trim() && form.qOptions.filter((o) => o.trim()).length >= 2 && form.qOptions[form.qAnswer]?.trim() ? '✓ Ready. Readers get this question after the reading time.' : 'No question yet: readers only get the reading points. The paste formatter can write one for you.'}</p>
          </section>

          {/* 4. Extras */}
          <section className="editor-panel">
            <div className="panel-head"><span className="panel-no">4</span><div><h2>Points, game &amp; tags</h2><p>What readers earn and where they go next.</p></div></div>
            <div className="row3">
              <label>Read time (min)<input type="number" min={1} max={30} value={form.readMins} onChange={(e) => set('readMins', Number(e.target.value))} /></label>
              <label>Points<input type="number" min={0} max={100} value={form.points} onChange={(e) => set('points', Number(e.target.value))} /></label>
              <label>Author<input value={form.author} onChange={(e) => set('author', e.target.value)} /></label>
            </div>
            <div className="row2">
              <label>Game button text<input value={form.gameLabel} onChange={(e) => set('gameLabel', e.target.value)} placeholder="Play the ₦10K Money Mystery" /></label>
              <label>Game link<input value={form.gameHref} onChange={(e) => set('gameHref', e.target.value)} placeholder="/#arcade" /></label>
            </div>
            <label>Tags (comma separated)<input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="money, saving" /></label>
          </section>

          {/* 5. Publishing */}
          <section className="editor-panel">
            <div className="panel-head"><span className="panel-no">5</span><div><h2>Publishing</h2><p>Homepage spot and notes.</p></div></div>
            <label className={`switch-row${form.homepageFeatured ? ' on' : ''}`}>
              <input type="checkbox" checked={form.homepageFeatured} onChange={(e) => set('homepageFeatured', e.target.checked)} />
              <span className="switch-ui" aria-hidden="true" />
              <span><b>Show in the homepage hero</b><small>
                {heroInfo ? `${Math.min(heroInfo.max, heroInfo.others + (form.homepageFeatured ? 1 : 0))} of ${heroInfo.max} spots used. ` : ''}
                Published stories with a picture rotate at the top of the homepage, newest switched on first.
                {form.homepageFeatured && !form.image ? ' Add a picture so it can show.' : ''}
                {form.homepageFeatured && heroInfo && heroInfo.others >= heroInfo.max ? ' All spots are full: this story goes first and the oldest one waits.' : ''}
              </small></span>
            </label>
            {isEditor && <label>Note to the writer (optional)<input value={form.reviewNote} onChange={(e) => set('reviewNote', e.target.value)} placeholder="Shorten the intro, add a source for the numbers" /></label>}
            <ul className="ready-list" aria-label="Ready to publish?">
              {checks.map((c) => <li key={c.label} className={c.ok ? 'ok' : ''}><AdminIcon name={c.ok ? 'check' : 'warn'} size={15} />{c.label}</li>)}
            </ul>
          </section>
        </fieldset>

        <aside className="editor-preview">
          <div className="preview-bar">
            <span className="preview-dots" aria-hidden="true"><i /><i /><i /></span>
            <b>Live preview</b>
            <label className="mini-toggle"><input type="checkbox" checked={previewEli} onChange={(e) => setPreviewEli(e.target.checked)} /> ELI10</label>
          </div>
          <div className="preview-page">
            {form.sectionLabel && <span className="chip">{form.sectionLabel}</span>}
            <h2 className="display">{form.title || 'Your title'}</h2>
            {form.dek && <p className="dek">{form.dek}</p>}
            {form.image && <div className="preview-img"><SmartImage src={form.image} position={form.imagePosition} fit={form.imageFit} tolerance={0.4} /></div>}
            {previewBlocks.length ? <ArticleBody blocks={previewBlocks} vocab={vocab} open={open} setOpen={setOpen} /> : <p className="muted">Start writing and the story shows up here.</p>}
            {!previewEli && form.gallery.filter((item) => item.image).map((item, index) => <figure className="preview-gallery-item" key={`${index}-${item.image}`}><img src={item.image} alt={item.caption} />{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}
          </div>
        </aside>
      </div>
    </div>
  );
}
