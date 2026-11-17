/*
 * ============================================================
 * Site settings (Admin → Settings), with safe defaults
 * ============================================================
 * One document in the "settings" collection. Anything missing or
 * invalid falls back to DEFAULTS, so the site always works.
 * ============================================================
 */

const DEFAULTS = Object.freeze({
    leaderboard: {
        range: 'volume',          // volume | edition (whole year) | week | all
        size: 10,                 // rows per board
        boards: { readers: true, players: true, schools: true },
        schoolRanking: 'total',   // total | average (points per student, fair to small schools)
        showOnHome: true,
    },
    reading: {
        mode: 'fixed',            // fixed = readSeconds for every story | story = the story's read time
        readSeconds: 120,         // 2 minutes
        questionSeconds: 60,      // 1 minute to answer
        retries: 1,               // extra tries after a wrong / timed-out answer
        readPoints: 5,
        questionPoints: 5,
    },
    home: {
        heroMax: 5,               // how many "Show in the homepage hero" stories rotate at the top
        heroSeconds: 7,           // seconds each story stays before the next one slides in
        // The Big News section: the story (slug) for the big card, top right and bottom right.
        // '' = that spot shows the newest Big News story not already used.
        bigNews: ['', '', ''],
        // "Fresh stories" on the homepage: the story (slug) for the 1st, 2nd and 3rd card.
        // '' = that card shows the newest published story not already used.
        fresh: ['', '', ''],
    },
    access: {
        // Games, quizzes, debates and points only for students with access:
        // a seat from a subscribed school, or a package they paid for themselves.
        requireAccessForPoints: true,
    },
    // Packages for students who are NOT with a subscribed school (they pay for themselves)
    personalPlans: [
        { id: 'monthly', name: 'Monthly', price: 500, days: 30 },
        { id: 'term', name: 'Term', price: 1200, days: 120 },
        { id: 'yearly', name: 'Yearly', price: 3000, days: 365 },
    ],
    schoolPlans: [
        { id: 'starter', name: 'Starter', seats: 50, price: 150000, days: 365 },
        { id: 'standard', name: 'Standard', seats: 100, price: 300000, days: 365 },
        { id: 'premium', name: 'Premium', seats: 250, price: 650000, days: 365 },
    ],
});

const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
const num = (v, min, max, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(max, Math.max(min, Math.round(Number(v)))) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

// Plans/packages: up to 8, each with a name, price and length (+ seats for schools)
function cleanPlans(list, { seats }) {
    return list
        .filter((p) => p && String(p.name || '').trim())
        .slice(0, 8)
        .map((p, i) => ({
            id: String(p.id || `plan-${i + 1}`).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30),
            name: String(p.name).trim().slice(0, 40),
            ...(seats ? { seats: num(p.seats, 1, 100000, 100) } : {}),
            price: num(p.price, 0, 1_000_000_000, 0),
            days: num(p.days, 1, 3650, 365),
        }));
}

// Story spots (slugs): exactly `n`, each a slug or '' (automatic), no story twice
function cleanSlots(list, n) {
    const seen = new Set();
    return Array.from({ length: n }, (_, i) => {
        const v = Array.isArray(list) ? String(list[i] ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120) : '';
        if (!v || seen.has(v)) return '';
        seen.add(v);
        return v;
    });
}

// Pure: saved (possibly partial / messy) settings → complete, valid settings
function mergeSettings(saved = {}) {
    const D = DEFAULTS;
    const lb = saved.leaderboard || {};
    const rd = saved.reading || {};
    const ac = saved.access || {};
    const hm = saved.home || {};
    const plans = Array.isArray(saved.schoolPlans) && saved.schoolPlans.length ? saved.schoolPlans : D.schoolPlans;
    return {
        leaderboard: {
            range: pick(lb.range, ['volume', 'edition', 'week', 'all'], D.leaderboard.range),
            size: num(lb.size, 3, 50, D.leaderboard.size),
            boards: {
                readers: bool(lb.boards?.readers, true),
                players: bool(lb.boards?.players, true),
                schools: bool(lb.boards?.schools, true),
            },
            schoolRanking: pick(lb.schoolRanking, ['total', 'average'], D.leaderboard.schoolRanking),
            showOnHome: bool(lb.showOnHome, true),
        },
        reading: {
            mode: pick(rd.mode, ['fixed', 'story'], D.reading.mode),
            readSeconds: num(rd.readSeconds, 15, 1800, D.reading.readSeconds),
            questionSeconds: num(rd.questionSeconds, 10, 600, D.reading.questionSeconds),
            retries: num(rd.retries, 0, 5, D.reading.retries),
            readPoints: num(rd.readPoints, 0, 100, D.reading.readPoints),
            questionPoints: num(rd.questionPoints, 0, 100, D.reading.questionPoints),
        },
        home: {
            heroMax: num(hm.heroMax, 1, 10, D.home.heroMax),
            heroSeconds: num(hm.heroSeconds, 3, 30, D.home.heroSeconds),
            bigNews: cleanSlots(hm.bigNews, 3),
            fresh: cleanSlots(hm.fresh, 3),
        },
        access: {
            requireAccessForPoints: bool(ac.requireAccessForPoints, D.access.requireAccessForPoints),
        },
        personalPlans: cleanPlans(
            Array.isArray(saved.personalPlans) && saved.personalPlans.length ? saved.personalPlans
                // older settings had one price: keep it as a single package
                : ac.personalPrice !== undefined ? [{ id: 'yearly', name: 'Yearly', price: ac.personalPrice, days: ac.personalDays || 365 }]
                    : D.personalPlans,
            { seats: false }
        ),
        schoolPlans: cleanPlans(plans, { seats: true }),
    };
}

// Seconds a reader must spend on a story before the reading points + question
function readSecondsFor(settings, readMins = 3) {
    const r = settings.reading;
    return r.mode === 'story' ? Math.max(15, Math.round((Number(readMins) || 3) * 60)) : r.readSeconds;
}

// What the public website may know (no prices hidden, nothing secret here)
function publicSettings(s) {
    return { leaderboard: s.leaderboard, reading: s.reading, home: s.home, access: s.access, personalPlans: s.personalPlans, schoolPlans: s.schoolPlans };
}

// ---------- database (cached for 30s) ----------
let cache = null;
let cachedAt = 0;
async function getSettings() {
    if (cache && Date.now() - cachedAt < 30_000) return cache;
    const model = require('../models/settings');
    const doc = await model.findOne({ key: 'main' }).lean();
    cache = mergeSettings(doc?.data || {});
    cachedAt = Date.now();
    return cache;
}
async function saveSettings(data, adminId) {
    const model = require('../models/settings');
    const clean = mergeSettings(data);
    await model.updateOne({ key: 'main' }, { $set: { data: clean, updatedBy: adminId } }, { upsert: true });
    cache = clean;
    cachedAt = Date.now();
    return clean;
}

module.exports = { DEFAULTS, mergeSettings, readSecondsFor, publicSettings, getSettings, saveSettings };
