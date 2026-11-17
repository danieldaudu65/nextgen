/*
 * ============================================================
 * NextGen World: the levels on each edition's island
 * ============================================================
 * Every edition is an island with 7 levels, played in this order.
 * A level opens when the one before it has at least 1 star.
 * The Boss (level 7) is built here from the edition's own words
 * and quiz, and checked here, so its answers never reach the browser.
 * ============================================================
 */

// The order of the levels on the road. 'boss' is always last.
const LEVEL_KEYS = ['money', 'quiz', 'debate', 'sort', 'promise', 'wordsearch', 'boss'];
const BOSS_SIZE = 5;

// Same seed = same order, so the Boss asks the same questions every time for one edition
function seeded(seedText){
    let s = 0;
    for (const ch of String(seedText)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
    return () => (s = (s * 48271) % 2147483647) / 2147483647;
}
function shuffle(list, rnd){
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

/**
 * The Boss questions for one edition, WITH answers (server only).
 * Words from the Vocab Vault ("What does X mean?") plus the edition's quiz.
 * @returns [{ id, question, options, answer }]
 */
function bossQuestions(ed){
    const rnd = seeded(ed?.slug || 'edition');
    const vocab = (ed?.vocab || []).filter((v) => v && v.word && v.definition);
    const out = [];
    // up to 4 word questions, each with 3 wrong definitions taken from other words
    for (const v of shuffle(vocab, rnd).slice(0, Math.min(4, vocab.length))){
        const others = shuffle(vocab.filter((o) => o.word !== v.word), rnd).slice(0, 3).map((o) => o.definition);
        if (others.length < 2) continue;
        const options = shuffle([v.definition, ...others], rnd);
        out.push({ id: `word:${v.word}`, question: `What does “${v.word}” mean?`, options, answer: options.indexOf(v.definition) });
    }
    // fill up with the edition's quiz questions
    for (const q of shuffle(ed?.quiz || [], rnd)){
        if (out.length >= BOSS_SIZE) break;
        if (!q || !Array.isArray(q.options) || typeof q.answer !== 'number') continue;
        out.push({ id: `quiz:${q.id}`, question: q.question, options: q.options, answer: q.answer });
    }
    return out.slice(0, BOSS_SIZE);
}

// What the browser gets: no answers
const publicBoss = (ed) => bossQuestions(ed).map(({ answer, ...q }) => q);

// 3 right = 1 star (you beat the Boss), 4 = 2 stars, all = 3 stars
function bossStars(right, total){
    if (!total || right < 3) return 0;
    if (right >= total) return 3;
    return right >= total - 1 ? 2 : 1;
}

/** Check the Boss answers. answers = [{ id, choice }] */
function checkBoss(ed, answers){
    const qs = bossQuestions(ed);
    const given = new Map((Array.isArray(answers) ? answers : []).map((a) => [String(a?.id), a?.choice]));
    const results = qs.map((q) => ({ id: q.id, answer: q.answer, correct: given.get(q.id) === q.answer }));
    const right = results.filter((r) => r.correct).length;
    return { results, right, total: qs.length, stars: bossStars(right, qs.length) };
}

/** Clean a stars object from the database or the browser: { money: 0..3, ... } */
function cleanStars(raw){
    const out = {};
    for (const k of LEVEL_KEYS){
        const n = Math.round(Number(raw?.[k]) || 0);
        out[k] = Math.max(0, Math.min(3, n));
    }
    return out;
}

/** The level the student is on: the first one without a star (7 = island cleared) */
function currentLevel(stars){
    const s = cleanStars(stars);
    const i = LEVEL_KEYS.findIndex((k) => s[k] === 0);
    return i < 0 ? LEVEL_KEYS.length : i;
}

/** Can this level be played? Only if every level before it has a star. */
function isOpen(stars, game){
    const i = LEVEL_KEYS.indexOf(game);
    return i >= 0 && i <= currentLevel(stars);
}

module.exports = { LEVEL_KEYS, bossQuestions, publicBoss, checkBoss, bossStars, cleanStars, currentLevel, isOpen };
