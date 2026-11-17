// The Big News section on the homepage: which story goes in which spot.
// slots (Admin → Stories → "The Big News on the homepage") = [big card, top right, bottom right];
// an empty spot takes the newest Big News story that is not already used. Stories that are no
// longer published simply drop out, and their spot fills with the newest one.
export function orderBigNews<T extends { slug: string }>(newestFirst: T[], slots: string[] = []): T[] {
  const bySlug = new Map(newestFirst.map((s) => [s.slug, s]));
  const pinned = slots.slice(0, 3).map((slug) => (slug ? bySlug.get(slug) ?? null : null));
  const used = new Set(pinned.filter(Boolean).map((s) => s!.slug));
  const rest = newestFirst.filter((s) => !used.has(s.slug));
  const out: T[] = [];
  for (let i = 0; i < 3; i++) {
    const s = pinned[i] ?? rest.shift();
    if (s) out.push(s);
  }
  // the others follow (they only count for "See all Big News")
  return [...out, ...rest];
}
