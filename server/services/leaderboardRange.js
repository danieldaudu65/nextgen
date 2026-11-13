/*
 * Which points count on the leaderboard (Admin → Settings → Leaderboard range)
 *   volume  → points earned in the current volume (one issue)
 *   edition → points earned across the current yearly edition (all its volumes)
 *   week    → points since Monday 00:00 Lagos
 *   all     → every point ever
 * Pure: give it the settings, the editions and "now"; get back a Mongo $match + a label.
 */
const { startOfWeek } = require('../utils/dates');

function rangeMatch(range, editions = [], now = new Date()) {
    const current = editions.find((e) => e.status === 'current') || null;
    if (range === 'all') return { match: {}, label: 'All time' };
    if (range === 'week') return { match: { createdAt: { $gte: startOfWeek(now) } }, label: 'This week' };
    if (!current) return { match: {}, label: 'All time' };
    if (range === 'edition') {
        const year = current.year || Number(String(current.month || '').match(/20\d{2}/)?.[0]);
        const slugs = editions.filter((e) => (e.year || Number(String(e.month || '').match(/20\d{2}/)?.[0])) === year).map((e) => e.slug);
        return { match: forVolumes(slugs.length ? slugs : [current.slug]), label: year ? `${year} edition` : 'This edition' };
    }
    return { match: forVolumes([current.slug]), label: current.volume || current.title || current.month || 'This volume' };
}

// Points saved before the "edition" field existed have the volume at the start of "ref"
// ("oct-2026:story-slug", "oct-2026" for games), so they still count for their volume.
const esc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function forVolumes(slugs) {
    return {
        $or: [
            { edition: slugs.length === 1 ? slugs[0] : { $in: slugs } },
            { edition: null, ref: { $regex: `^(${slugs.map(esc).join('|')})(:|$)` } },
        ],
    };
}

module.exports = { rangeMatch };
