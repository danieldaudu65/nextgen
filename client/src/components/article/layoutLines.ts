// Special story lines for magazine-style picture layouts.
// They are normal story lines, so writers can type them or use the editor's Layout buttons.
//
//   @profile Darasimi Nadi | 14 | Acting · Young Star | /pic-1.jpg | /pic-2.jpg
//   ### Fourteen and already collecting Nollywood receipts!
//   Darasimi Nadi may be one of the youngest faces on our list…
//
//   → a profile card: two overlapping photos, a yellow name banner with the age,
//     the tags, then every line under it until the next @profile, "## ", "> " or "---".
//     Profiles that follow each other sit side by side (2 per row, 1 on phones).
//
//   @photos /pic-1.jpg | /pic-2.jpg | Optional caption
//   → two photos overlapping like the print magazine (3 or more → a photo grid).

export interface Profile { name: string; age?: string; tags?: string; images: string[] }
export interface Photos { images: string[]; caption?: string }

export const isImageUrl = (s: string) => /^(https?:\/\/|\/)\S+$/i.test(s.trim());

const parts = (s: string) => s.split('|').map((p) => p.trim()).filter(Boolean);

/** "@profile Name | 14 | Tags | url | url" → Profile (order after the name does not matter) */
export function parseProfile(line: string): Profile | null {
  const m = line.match(/^@profile\s+(.+)$/i);
  if (!m) return null;
  const [name, ...rest] = parts(m[1]);
  if (!name) return null;
  const p: Profile = { name, images: [] };
  rest.forEach((x) => {
    if (isImageUrl(x)) p.images.push(x);
    else if (/^\d{1,3}$/.test(x) && !p.age) p.age = x;
    else p.tags = p.tags ? `${p.tags} · ${x}` : x;
  });
  return p;
}

/** "@photos url | url | caption" → Photos */
export function parsePhotos(line: string): Photos | null {
  const m = line.match(/^@photos\s+(.+)$/i);
  if (!m) return null;
  const all = parts(m[1]);
  const images = all.filter(isImageUrl);
  if (!images.length) return null;
  const caption = all.filter((x) => !isImageUrl(x)).join(' · ');
  return { images, ...(caption ? { caption } : {}) };
}

/** A line that ends the text belonging to a profile */
const endsProfile = (b: string) => /^@profile\s/i.test(b) || b.startsWith('## ') || b.startsWith('> ') || b.trim() === '---' || /^@photos\s/i.test(b);

export type Segment =
  | { kind: 'blocks'; blocks: string[] }
  | { kind: 'profiles'; items: { profile: Profile; blocks: string[] }[] };

/** Splits story lines into normal runs and groups of profile cards */
export function segment(blocks: string[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < blocks.length) {
    const profile = parseProfile(blocks[i]);
    if (!profile) {
      const last = out[out.length - 1];
      if (blocks[i].trim() !== '---' || last?.kind !== 'profiles') {
        if (last?.kind === 'blocks') last.blocks.push(blocks[i]); else out.push({ kind: 'blocks', blocks: [blocks[i]] });
      }
      i++;
      continue;
    }
    const items: { profile: Profile; blocks: string[] }[] = [];
    while (i < blocks.length) {
      const p = parseProfile(blocks[i]);
      if (!p) break;
      i++;
      const own: string[] = [];
      while (i < blocks.length && !endsProfile(blocks[i])) own.push(blocks[i++]);
      items.push({ profile: p, blocks: own });
    }
    out.push({ kind: 'profiles', items });
  }
  return out;
}

/** Every picture used by layout lines (for checks and previews) */
export function layoutImages(blocks: string[]): string[] {
  return blocks.flatMap((b) => parseProfile(b)?.images ?? parsePhotos(b)?.images ?? []);
}
