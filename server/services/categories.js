/*
 * ============================================================
 * Site categories = the edition SECTIONS
 * ============================================================
 * The categories are the sections the paper already uses: THE BIG NEWS,
 * MONEY MATTERS, TECH PULSE, POP CULTURE, NEXTGEN STARS, SMARTTOONS,
 * CRACK THIS, VOCAB VAULT, DEBATE. A category's slug IS the section key
 * ("tech"), so a story is in a category when its section is that key.
 *
 * Every section added to an edition becomes a category automatically
 * (syncFromSections). In Admin → Categories you can rename, describe,
 * colour, reorder and hide them, or add one (it then shows in the story
 * editor's section list too). `sections` can pull in extra section keys,
 * `link` sends the card somewhere else (CRACK THIS → the games).
 * ============================================================
 */

const ICONS = ['news', 'music', 'campus', 'wallet', 'briefcase', 'ball', 'chat', 'scales', 'check', 'star', 'bolt', 'game', 'globe', 'heart', 'book', 'tech'];

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// How the known sections look as categories (names, Gen Z lines, colours, icons, links)
const KNOWN = {
    'big-news': { name: 'The Big News', desc: 'The news that matters, explained without big grammar.', accent: '#FFD400', icon: 'news' },
    money: { name: 'Money Matters', desc: 'Spending, saving and side hustles. Who ate your money?', accent: '#16A34A', icon: 'wallet' },
    tech: { name: 'Tech Pulse', desc: "AI, apps and gadgets: what's new and what it means for you.", accent: '#2563EB', icon: 'tech' },
    pop: { name: 'Pop Culture', desc: "Music, fashion, film and the culture everyone's talking about.", accent: '#DB2777', icon: 'music' },
    stars: { name: 'NextGen Stars', desc: 'Young Nigerians doing extraordinary things. Meet them.', accent: '#FF8A00', icon: 'star' },
    toons: { name: 'SmartToons', desc: 'Comics that explain big ideas, panel by panel.', accent: '#7C3AED', icon: 'chat' },
    crack: { name: 'Crack This', desc: 'Crosswords, word searches and brain games. Crack it, win points.', accent: '#E11D2A', icon: 'game', link: '/#arcade' },
    vocab: { name: 'Vocab Vault', desc: "New words, explained like you're 10.", accent: '#0EA5E9', icon: 'book', link: '/#vocab' },
    debate: { name: 'Debate', desc: 'Pick a side, say why, earn points.', accent: '#C2410C', icon: 'scales', link: '/#arcade' },
};

// "NEXTGEN STARS" → "Nextgen Stars" (known sections use the names above)
const titleCase = (label) => String(label || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bNextgen\b/g, 'NextGen').trim();

// An edition section → a category
function fromSection(sec, order = 0) {
    const key = slugify(sec.key);
    const k = KNOWN[key] || {};
    return {
        slug: key,
        name: k.name || titleCase(sec.label) || key,
        desc: k.desc || String(sec.genz || '').slice(0, 160),
        accent: k.accent || '#FFD400',
        icon: k.icon || 'news',
        sections: [],
        link: k.link || '',
        order,
        active: true,
    };
}

// The starter list (the October 2026 sections), used before anything is saved
const DEFAULT_CATEGORIES = Object.freeze(Object.keys(KNOWN).map((key, i) => fromSection({ key, label: KNOWN[key].name }, i)));

// Categories an earlier version saved (copied from the old website): removed if nobody edited them
const OLD_STARTERS = ['news', 'culture-trends', 'campus-school-life', 'money-life-skills', 'career-opportunities', 'sports', 'opinion-voices', 'myth-vs-fact', 'fact-check'];

const HEX = /^#[0-9a-f]{6}$/i;

// Body from the admin form → safe category fields (or { error })
function cleanCategory(body = {}, { partial = false } = {}) {
    const out = {};
    if (!partial || body.name !== undefined) {
        const name = String(body.name || '').trim().slice(0, 40);
        if (!name) return { error: 'Give the category a name' };
        out.name = name;
    }
    // The slug is the section key: set once (from the name) and kept when the name changes
    if (!partial || body.slug !== undefined) {
        const slug = slugify(body.slug || body.name);
        if (!slug) return { error: 'Give the category a link name' };
        out.slug = slug;
    }
    if (!partial || body.desc !== undefined) out.desc = String(body.desc || '').trim().slice(0, 160);
    if (!partial || body.accent !== undefined) out.accent = HEX.test(String(body.accent || '')) ? String(body.accent).toUpperCase() : '#FFD400';
    if (!partial || body.icon !== undefined) out.icon = ICONS.includes(body.icon) ? body.icon : 'news';
    if (!partial || body.sections !== undefined) {
        out.sections = [...new Set((Array.isArray(body.sections) ? body.sections : String(body.sections || '').split(','))
            .map((s) => slugify(s)).filter(Boolean))].slice(0, 30);
    }
    if (!partial || body.link !== undefined) {
        const link = String(body.link || '').trim().slice(0, 200);
        out.link = /^(\/|#|https?:\/\/)/.test(link) ? link : '';
    }
    if (!partial || body.active !== undefined) out.active = body.active === undefined ? true : Boolean(body.active);
    if (body.order !== undefined && Number.isFinite(Number(body.order))) out.order = Math.max(0, Math.min(999, Math.round(Number(body.order))));
    return out;
}

// Does this story (section key + label) belong to the category?
function inCategory(category, section, sectionLabel) {
    if (!category) return false;
    const key = slugify(section);
    const label = slugify(sectionLabel);
    return Boolean(
        (key && (key === category.slug || (category.sections || []).includes(key)))
        || (label && (label === category.slug || label === slugify(category.name)))
    );
}

// Mongo filter for the stories of one category
function articleFilter(category) {
    const keys = [...new Set([category.slug, ...(category.sections || [])])];
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const labelRx = new RegExp(`^${escape(category.name).replace(/\s*&\s*/g, '\\s*(?:&|and)\\s*').replace(/\s+/g, '\\s+')}$`, 'i');
    return { $or: [{ section: { $in: keys } }, { sectionLabel: labelRx }] };
}

// What the public site sees
const publicCategory = (c) => ({
    slug: c.slug, name: c.name, desc: c.desc || '', accent: c.accent || '#FFD400', icon: c.icon || 'news',
    sections: c.sections || [], link: c.link || '', order: c.order ?? 0,
});

// Make sure every edition section is a category (new sections get added at the end, shown).
// Also removes the old copied starter categories nobody edited. Runs at most once a minute.
let syncedAt = 0;
async function syncFromSections({ force = false } = {}) {
    if (!force && Date.now() - syncedAt < 60_000) return 0;
    syncedAt = Date.now();
    const model = require('../models/category');
    const edition = require('../models/edition');
    await model.deleteMany({ slug: { $in: OLD_STARTERS }, updatedBy: null });
    const [have, editions] = await Promise.all([
        model.find({}, 'slug order').lean(),
        edition.find({}, 'sections.key sections.label sections.genz').sort({ createdAt: 1 }).lean(),
    ]);
    const known = new Set(have.map((c) => c.slug));
    let order = have.reduce((n, c) => Math.max(n, (c.order ?? 0) + 1), 0);
    const add = [];
    // the known sections first, in paper order, then anything else editions use
    const seen = new Set();
    const all = [...Object.keys(KNOWN).map((key) => ({ key, label: KNOWN[key].name })), ...editions.flatMap((e) => e.sections || [])];
    const used = new Set(editions.flatMap((e) => (e.sections || []).map((s) => slugify(s.key))));
    for (const sec of all) {
        const key = slugify(sec.key);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (known.has(key)) continue;
        if (!KNOWN[key] && !used.has(key)) continue;
        add.push(fromSection(sec, order++));
    }
    if (add.length) await model.insertMany(add, { ordered: false }).catch(() => {});
    return add.length;
}

// Sorted list (active only unless includeHidden)
async function listCategories({ includeHidden = false } = {}) {
    const model = require('../models/category');
    await syncFromSections();
    return model.find(includeHidden ? {} : { active: true }).sort({ order: 1, name: 1 }).lean();
}

module.exports = { ICONS, KNOWN, DEFAULT_CATEGORIES, OLD_STARTERS, slugify, titleCase, fromSection, cleanCategory, inCategory, articleFilter, publicCategory, listCategories, syncFromSections };
