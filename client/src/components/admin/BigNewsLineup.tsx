'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { adminApi, type BigNewsStory } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import { orderBigNews } from '@/lib/bigNews';
import AdminIcon from './AdminIcon';

// Stories → the homepage line-ups. Pick the story for each of the 3 spots; a spot left on "Newest"
// takes the newest story that is not already used, so the section is never empty.
//   kind="big-news" (default): "The Big News on the homepage", Big News stories only (big card, top right, bottom right)
//   kind="fresh": "Fresh stories on the homepage", any published story (1st, 2nd, 3rd card)
const KINDS = {
  'big-news': {
    title: 'The Big News on the homepage', spots: ['Big card', 'Top right', 'Bottom right'], anchor: '/#big-news',
    what: 'Big News story', load: () => adminApi.bigNewsLineup(), save: (s: string[]) => adminApi.saveBigNewsLineup(s),
    empty: 'No published Big News stories yet. Publish a story in the Big News section and it shows here.',
    others: ' · the others are under "See all Big News"',
  },
  fresh: {
    title: 'Fresh stories on the homepage', spots: ['1st card', '2nd card', '3rd card'], anchor: '/#edition',
    what: 'story', load: () => adminApi.freshLineup(), save: (s: string[]) => adminApi.saveFreshLineup(s),
    empty: 'No published stories yet. Publish a story and it shows here.',
    others: ' · the others are on the "More stories" page',
  },
} as const;

export default function BigNewsLineup({ kind = 'big-news', editor, toast, refresh = 0 }: { kind?: keyof typeof KINDS; editor: boolean; toast: (msg: string, bad?: boolean) => void; refresh?: number }) {
  const K = KINDS[kind];
  const SPOTS = K.spots;
  const [stories, setStories] = useState<BigNewsStory[] | null>(null);
  const [saved, setSaved] = useState<string[]>(['', '', '']);
  const [slots, setSlots] = useState<string[]>(['', '', '']);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    K.load()
      .then((d) => { setStories(d.stories); setSaved(d.slots); setSlots(d.slots); })
      .catch(() => setStories([]));
  }, [refresh, K]);

  // what each spot will really show (empty spots filled with the newest unused story)
  const shown = useMemo(() => orderBigNews(stories ?? [], slots).slice(0, 3), [stories, slots]);
  const changed = slots.some((s, i) => s !== saved[i]);

  if (!stories) return null;

  const setSpot = (i: number, slug: string) => setSlots((cur) => {
    const next = [...cur];
    // a story can only be in one spot: if it was in another, that one goes back to "Newest"
    const was = next.indexOf(slug);
    if (slug && was >= 0 && was !== i) next[was] = '';
    next[i] = slug;
    return next;
  });
  // swap two spots (what the spot shows right now moves with it, so "Newest" spots stay predictable)
  const swap = (i: number, j: number) => setSlots(() => {
    const next = shown.map((s) => s?.slug ?? '');
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const save = async (next = slots) => {
    setBusy(true);
    try {
      const r = await K.save(next);
      setSaved(r.slots); setSlots(r.slots);
      toast(r.message);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save the line-up', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`admin-card bnl bnl-${kind}`}>
      <div className="card-head">
        <div>
          <h2>{K.title}</h2>
          <p className="muted">Choose the story for each spot. A spot left on <b>Newest</b> shows the newest {K.what} not already used.</p>
        </div>
        <Link className="btn sm white" href={K.anchor} target="_blank">See it on the homepage</Link>
      </div>

      {stories.length === 0 ? (
        <p className="muted hl-empty">{K.empty}</p>
      ) : (
        <>
          <div className="bnl-grid">
            {SPOTS.map((label, i) => {
              const s = shown[i];
              const auto = !slots[i];
              return (
                <div key={label} className={`bnl-spot bnl-spot-${i}${s ? '' : ' empty'}`}>
                  <div className="bnl-top">
                    <span className="bnl-label">{label}</span>
                    {auto && s && <span className="bnl-auto">Newest</span>}
                  </div>
                  <div className="bnl-thumb">{s?.image ? <img src={s.image} alt="" /> : <AdminIcon name="image" size={22} />}</div>
                  <b className="bnl-title">{s ? s.title : 'Nothing to show yet'}</b>
                  {editor && (
                    <div className="bnl-actions">
                      <select aria-label={`Story for the ${label.toLowerCase()}`} value={slots[i]} onChange={(e) => setSpot(i, e.target.value)}>
                        <option value="">Newest (automatic)</option>
                        {stories.map((st) => <option key={st.slug} value={st.slug}>{st.title}</option>)}
                      </select>
                      <span className="bnl-move">
                        {i > 0 && <button type="button" className="btn sm white" title={`Swap with the ${SPOTS[i - 1].toLowerCase()}`} onClick={() => swap(i, i - 1)}>↑</button>}
                        {i < SPOTS.length - 1 && <button type="button" className="btn sm white" title={`Swap with the ${SPOTS[i + 1].toLowerCase()}`} onClick={() => swap(i, i + 1)}>↓</button>}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {editor ? (
            <div className="bnl-foot">
              <button type="button" className="btn dark" disabled={busy || !changed} onClick={() => save()}>{busy ? 'Saving…' : changed ? 'Save line-up' : 'Saved'}</button>
              <button type="button" className="btn sm white" disabled={busy || slots.every((s) => !s)} onClick={() => save(['', '', ''])}>Back to newest first</button>
              <small className="muted">{stories.length} published {kind === 'fresh' ? '' : 'Big News '}{stories.length === 1 ? 'story' : 'stories'}{stories.length > 3 ? K.others : ''}</small>
            </div>
          ) : (
            <p className="muted bnl-foot">Only editors can change the line-up.</p>
          )}
        </>
      )}
    </section>
  );
}
