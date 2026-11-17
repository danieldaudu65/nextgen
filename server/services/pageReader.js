// ===============================
// Turn photos of a printed article into a NextGen story
// ===============================
// storyFromPages(pages, { sections, vocab }) → { story, source, design, transcript }
//
// pages: 1–4 photos of ONE article, in order: [{ data: base64 (no "data:" prefix), type: 'image/jpeg' }]
//
// Two steps, so a story from photos comes out exactly like a pasted one:
//  1. READ  (an AI that can see pictures) copies every word off the photos in reading order and notes the design:
//           the main colour, small icons next to headings, and where the printed pictures are.
//  2. WRITE the copied text goes through the same formatter as "Paste your article" (services/storyFormatter.js),
//           so the voice, length and layout rules are the same for every story.
// The colour is snapped to the nearest site category colour and only the site's own icons are kept,
// so stories from photos still look like the rest of NextGen. Nothing is saved here.
//
// Reading needs one of: ANTHROPIC_API_KEY (best), GEMINI_API_KEY (free tier) or GROQ_API_KEY (free, weaker at reading).
// ===============================

const { formatStory, toGeminiSchema, geminiWithFallback, GEMINI_BUSY, salvageJson } = require('./storyFormatter');

const MAX_PAGES = 4;
const MAX_B64 = 4_500_000; // per photo (about 3.3 MB of picture); the admin page shrinks photos well below this
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Icons the site can draw (client/src/components/iconSprite.ts) and what they stand for
const ICONS = {
    ballot: 'voting, elections, choices', piggy: 'money, saving', bulb: 'ideas, tips', robot: 'AI, tech',
    trophy: 'winning, awards', puzzle: 'games, problems', book: 'reading, learning', mega: 'news, announcements',
    shades: 'cool, style, pop culture', bolt: 'energy, fast facts', flame: 'trending, hot', star: 'stars, highlights', ear: 'listening, music',
};
// Site colours (the category colours). The page colour is snapped to the nearest one.
const PALETTE = ['#FFD400', '#16A34A', '#2563EB', '#DB2777', '#FF8A00', '#7C3AED', '#E11D2A', '#0EA5E9', '#C2410C'];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function snapColour(hex) {
    if (!/^#?[0-9a-f]{6}$/i.test(String(hex || '').trim())) return null;
    const h = `#${String(hex).trim().replace('#', '').toUpperCase()}`;
    const [r, g, b] = rgb(h);
    // near-black, near-white and greys are not a design colour
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 40 || min > 225 || max - min < 28) return null;
    let best = null, bestD = Infinity;
    for (const p of PALETTE) {
        const [pr, pg, pb] = rgb(p);
        // weighted distance, closer to how people see colour
        const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
        if (d < bestD) { bestD = d; best = p; }
    }
    return best;
}

// Keep ":icon:" at the start of a heading only for icons the site has (at most 4); drop any others
function cleanIcons(blocks) {
    let used = 0;
    return (blocks || []).map((b) => {
        const s = String(b);
        const m = s.match(/^(#{2,3}) +:([a-z]+): */);
        if (!m) return s;
        const rest = s.slice(m[0].length);
        if (ICONS[m[2]] && used < 4) { used += 1; return `${m[1]} :${m[2]}: ${rest}`; }
        return `${m[1]} ${rest}`;
    });
}

function cleanPictures(list, pageCount) {
    const out = [];
    let cover = false;
    for (const p of Array.isArray(list) ? list : []) {
        const photo = Math.round(Number(p?.photo));
        const box = (Array.isArray(p?.box) ? p.box : []).map(Number);
        if (!(photo >= 1 && photo <= pageCount) || box.length !== 4 || box.some((n) => !Number.isFinite(n))) continue;
        let [x, y, w, h] = box;
        // some models answer in percent
        if ([x, y, w, h].some((n) => n > 1.5)) [x, y, w, h] = [x, y, w, h].map((n) => n / 100);
        x = Math.min(Math.max(x, 0), 1); y = Math.min(Math.max(y, 0), 1);
        w = Math.min(w, 1 - x); h = Math.min(h, 1 - y);
        if (w < 0.06 || h < 0.06) continue; // too small to be a real picture
        let role = ['cover', 'profile', 'inline'].includes(p?.role) ? p.role : 'inline';
        if (role === 'cover') { if (cover) role = 'inline'; cover = true; }
        const name = role === 'profile' ? String(p?.name || '').trim().slice(0, 80) : '';
        if (role === 'profile' && !name) role = 'inline';
        out.push({ photo, box: [x, y, w, h].map((n) => Math.round(n * 1000) / 1000), caption: String(p?.caption || '').trim().slice(0, 160), role, name });
        if (out.length >= 8) break;
    }
    // no cover marked? the biggest picture becomes it
    if (!cover && out.length) {
        const big = out.filter((p) => p.role === 'inline').sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
        if (big) big.role = 'cover';
    }
    return out;
}

// ---------- step 1: read the photos ----------
// Each photo is read in its own call, all at the same time: much faster than one big call, and each answer is
// small enough for the free AI limits. The pages are then put in order (by the section numbers printed on them
// when there are any, otherwise the order they were added) and joined into one article.
const READ_SYSTEM = `You read ONE photo of a printed PUNCH NextGen magazine page. It is one of up to ${MAX_PAGES} photos that together hold ONE article. Do two jobs.

JOB 1, COPY THE TEXT into "text", exactly as printed:
- Every word of the article on this photo, in reading order. Follow the columns and boxes the way a reader would.
- Keep names, ages, numbers, dates and spellings exactly. Do not fix, shorten, add or rewrite anything.
- Leave out page furniture: page numbers, running headers and footers, the magazine name or logo, website and social links, adverts, photo credits.
- Mark the layout: "## " before a section heading (keep its printed number, for example "## 4. The NextGen Promise Checker"). "> " before a pull quote, slogan or boxed highlight line. "- " before a bullet or list item. A blank line between paragraphs.
- A short profile of a person (name, age, what they do) becomes one line "@profile Full Name | Age | Thing · Thing" (leave out the age if it is not printed), followed by their text.
- If a section heading has a small icon or emoji printed next to it that matches one of these, start the heading with its token, for example "## :bulb: Smart moves". Icons: ${Object.entries(ICONS).map(([k, v]) => `:${k}: (${v})`).join(', ')}.
- If you cannot read a word, write [unclear] and say where in "notes".

JOB 2, THE DESIGN:
- "first_number": if the sections on this page are numbered (1, 2, 3…), the smallest section number on this page; otherwise 0.
- "title": the main headline of the whole article if it is printed on this photo, otherwise "".
- "accent": the main bold colour of the design (headings, numbers, boxes, banners) as #RRGGBB. Not skin tones or colours inside photos, not black, white or paper.
- "pictures": the photos and illustrations printed as part of the article (not small icons, logos or adverts), up to 6. For each: "box" [left, top, width, height] as fractions from 0 to 1 of the photo, "caption" (a few words on what it shows), "role": "cover" for the main or biggest picture, "profile" with "name" when it is the portrait of a person who has a profile, otherwise "inline".
- "notes": anything the editor should check (unclear words, text cut off at the edge of the photo). Empty if nothing.`;

const READ_TOOL = {
    name: 'read_pages',
    description: 'Return the text and design read from the photo.',
    input_schema: {
        type: 'object',
        properties: {
            first_number: { type: 'integer', description: 'Smallest section number on this page, or 0' },
            title: { type: 'string' },
            text: { type: 'string', description: 'The text on this photo, copied exactly, with the layout marks' },
            accent: { type: 'string', description: '#RRGGBB' },
            pictures: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        box: { type: 'array', items: { type: 'number' } },
                        caption: { type: 'string' },
                        role: { type: 'string', enum: ['cover', 'profile', 'inline'] },
                        name: { type: 'string' },
                    },
                    required: ['box', 'role'],
                },
            },
            notes: { type: 'string' },
        },
        required: ['text'],
    },
};
const READ_JSON_SHAPE = 'Reply with ONE JSON object only, no other text: {"first_number": number, "title": string, "text": string, "accent": "#RRGGBB", "pictures": [{"box": [left, top, width, height], "caption": string, "role": "cover"|"profile"|"inline", "name": string}], "notes": string}';

const intro = (i, n) => `This is photo ${i} of ${n} of one printed article. Copy its text and describe its design.`;

function withTimeout(ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}
const parseJson = (out) => {
    try { return JSON.parse(String(out).replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('The AI reply was not readable. Try again.'); }
};
const serviceError = (status, msg) => {
    const e = new Error(status === 429 ? 'The AI limit is used up for now. Wait a minute and try again.' : `The AI service said: ${msg}`);
    e.status = status === 429 ? 429 : 502;
    e.retry = status === 429 || status >= 500;
    return e;
};
// A timed-out call says "This operation was aborted": give the editor something useful instead
const slowError = () => {
    const e = new Error('The AI took too long to read the photos. Try again; if it keeps happening, read 1 or 2 photos at a time.');
    e.status = 504; e.retry = true;
    return e;
};
async function guarded(fn) {
    try { return await fn(); } catch (err) {
        if (err?.name === 'AbortError' || /aborted/i.test(String(err?.message))) throw slowError();
        if (err?.name === 'TypeError' && /fetch/i.test(String(err?.message))) { const e = new Error('Could not reach the AI service. Check the internet connection of the server.'); e.status = 502; e.retry = true; throw e; }
        throw err;
    }
}

async function readWithClaude(page, i, n, { apiKey, model, fetchImpl, timeoutMs }) {
    const t = withTimeout(timeoutMs);
    try {
        return await guarded(async () => {
            const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
                method: 'POST', signal: t.signal,
                headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({
                    model, max_tokens: 6000, system: READ_SYSTEM, tools: [READ_TOOL], tool_choice: { type: 'tool', name: READ_TOOL.name },
                    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: page.type, data: page.data } }, { type: 'text', text: intro(i, n) }] }],
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw serviceError(res.status, data?.error?.message || `status ${res.status}`);
            const call = (data.content || []).find((c) => c.type === 'tool_use' && c.name === READ_TOOL.name);
            if (!call) throw new Error('The AI could not read the photos. Try again.');
            return call.input;
        });
    } finally { t.done(); }
}

async function readWithGemini(page, i, n, opts) {
    return geminiWithFallback((model) => readWithGeminiOnce(page, i, n, { ...opts, model }), opts.model, opts);
}
async function readWithGeminiOnce(page, i, n, { apiKey, model, fetchImpl, timeoutMs }) {
    const t = withTimeout(timeoutMs);
    try {
        return await guarded(async () => {
            const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST', signal: t.signal,
                headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: READ_SYSTEM }] },
                    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: page.type, data: page.data } }, { text: intro(i, n) }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: toGeminiSchema(READ_TOOL.input_schema) },
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.error?.message || `status ${res.status}`;
                const e = serviceError(res.status, msg);
                // busy (503), over the limit (429) or a retired model (404): try another Gemini model
                e.busy = res.status === 503 || /high demand|overloaded/i.test(msg);
                e.missing = res.status === 404 || /no longer available|not found|is not supported|does not exist/i.test(msg);
                e.tryNext = e.busy || e.missing || res.status === 429;
                if (e.busy) e.message = GEMINI_BUSY;
                throw e;
            }
            const out = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
            if (!out) throw new Error('The AI could not read the photos. Try again.');
            return parseJson(out);
        });
    } finally { t.done(); }
}

// Groq's free models that can see pictures, best first
// (Groq retired llama-4-maverick in March 2026 and llama-4-scout in July 2026; Qwen 3.6 is its model that can see now)
const GROQ_VISION = ['qwen/qwen3.6-27b'];
async function readWithGroq(page, i, n, { apiKey, model, fetchImpl, timeoutMs }) {
    let last;
    for (const m of [...new Set([model, ...GROQ_VISION].filter(Boolean))]) {
        const t = withTimeout(timeoutMs);
        try {
            return await guarded(async () => {
                const res = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST', signal: t.signal,
                    headers: { 'content-type': 'application/json', authorization: `Bearer ${String(apiKey).trim().replace(/^["']|["']$/g, '')}` },
                    body: JSON.stringify({
                        model: m, temperature: 0.1, max_completion_tokens: 8000, response_format: { type: 'json_object' },
                        messages: [
                            { role: 'system', content: `${READ_SYSTEM}\n\n${READ_JSON_SHAPE}` },
                            { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${page.type};base64,${page.data}` } }, { type: 'text', text: intro(i, n) }] },
                        ],
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    // a reply that failed Groq's JSON check is often still usable
                    const salvaged = salvageJson(data?.error?.failed_generation);
                    if (salvaged) return salvaged;
                    const raw = data?.error?.message || `status ${res.status}`;
                    const missing = res.status === 404 || /does not exist|model_not_found/i.test(raw + (data?.error?.code || ''));
                    const e = serviceError(res.status, /failed to generate json/i.test(raw) ? 'a broken reply. Press Read again; it usually works on the second try.'
                        : missing ? `Groq no longer has the model ${m}. Set GROQ_VISION_MODEL in server/.env to a current Groq model that can read pictures.` : raw);
                    e.nextModel = res.status !== 401 && res.status !== 429;
                    e.missing = missing;
                    // another AI service may still read the photo
                    e.tryNext = missing || res.status === 413 || res.status === 400;
                    if (/failed to generate json/i.test(raw)) e.retry = true;
                    throw e;
                }
                return parseJson(data.choices?.[0]?.message?.content || '');
            });
        } catch (err) {
            // keep the most useful error: "model retired" only when nothing better happened
            if (!last || last.missing || !err.missing) last = err;
            if (!err.nextModel) throw err; // only a model problem is worth trying the next model for
        } finally { t.done(); }
    }
    throw last || new Error('The AI could not read the photos. Try again.');
}

function checkPages(pages) {
    const bad = (msg) => { const e = new Error(msg); e.status = 400; return e; };
    if (!Array.isArray(pages) || !pages.length) throw bad('Add at least one photo of the article.');
    if (pages.length > MAX_PAGES) throw bad(`Up to ${MAX_PAGES} photos per story.`);
    return pages.map((p, i) => {
        // a page from a PDF made from the design file: its exact text (and its pictures and colour), nothing to read
        if (typeof p?.text === 'string' && p.text.trim().length >= 20) {
            return { text: p.text.replace(/\r/g, '').trim().slice(0, 20000), accent: p.accent, pictures: p.pictures };
        }
        const type = String(p?.type || '').toLowerCase();
        const data = String(p?.data || '').replace(/^data:[^,]+,/, '').replace(/\s/g, '');
        if (!TYPES.has(type)) throw bad(`Photo ${i + 1} must be a JPG, PNG or WEBP picture.`);
        if (data.length < 1000 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw bad(`Photo ${i + 1} could not be read. Pick it again.`);
        if (data.length > MAX_B64) throw bad(`Photo ${i + 1} is too big. Use a smaller photo (under 3 MB).`);
        return { type, data };
    });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// "## 4. The NextGen Promise Checker" or "4 The NextGen…" at the start of a page → 4 (to put PDF pages in order too)
function firstNumber(text) {
    const m = String(text).match(/^##\s*(\d{1,2})[.)]?\s+\S/m);
    return m ? Number(m[1]) : 0;
}
// One photo with one AI service: one more try when it was slow or over its limit
// (a busy Gemini model has already been retried and swapped for another model inside readWithGemini)
async function readOne(read, page, i, n) {
    try { return await read(page, i, n); } catch (err) {
        if (!err.retry || err.busy) throw err;
        await wait(err.status === 429 ? 4000 : 800);
        return read(page, i, n);
    }
}

// The AI services there are keys for, in the SAME order as the story writer (storyFormatter.js):
// Claude, then Groq, then Gemini. PHOTO_AI=claude|groq|gemini in .env puts one first.
function readersFor(env, fetchImpl, timeoutMs, waitMs) {
    const all = {
        claude: env.ANTHROPIC_API_KEY && { name: 'Claude', read: (p, i, n) => readWithClaude(p, i, n, { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', fetchImpl, timeoutMs }) },
        groq: env.GROQ_API_KEY && { name: 'Groq', read: (p, i, n) => readWithGroq(p, i, n, { apiKey: env.GROQ_API_KEY, model: env.GROQ_VISION_MODEL, fetchImpl, timeoutMs }) },
        gemini: env.GEMINI_API_KEY && { name: 'Gemini', read: (p, i, n) => readWithGemini(p, i, n, { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_VISION_MODEL || env.GEMINI_MODEL || 'gemini-flash-latest', fetchImpl, timeoutMs, waitMs }) },
    };
    const first = String(env.PHOTO_AI || '').trim().toLowerCase();
    const order = [first, 'claude', 'groq', 'gemini'].filter((k, i, a) => all[k] && a.indexOf(k) === i);
    return order.map((k) => all[k]);
}

// The most used design colour across the pages (the first page wins a tie)
function mainColour(list) {
    const count = new Map();
    list.filter(Boolean).forEach((c) => count.set(c, (count.get(c) || 0) + 1));
    let best = null, n = 0;
    for (const [c, k] of count) if (k > n) { best = c; n = k; }
    return best;
}

/** Step 1 only: copy the text and design off the photos. */
async function readPages(pagesIn, { env = process.env, fetchImpl = fetch, timeoutMs = 150000, waitMs = 2500 } = {}) {
    const pages = checkPages(pagesIn);
    const readers = readersFor(env, fetchImpl, timeoutMs, waitMs);
    const needsAI = pages.some((p) => !p.text);
    if (needsAI && !readers.length) { const e = new Error('Reading photos needs an AI key. Add ANTHROPIC_API_KEY, GEMINI_API_KEY (free) or GROQ_API_KEY (free) to server/.env and restart the server.'); e.status = 400; throw e; }
    // a service that is busy, slow or over its limit hands the photo to the next service there is a key for
    const read = async (p, i, n) => {
        // the PDF already has the words: use them as they are (no AI, so no limits or busy errors)
        if (p.text) return { text: p.text, accent: p.accent, pictures: Array.isArray(p.pictures) ? p.pictures : [], first_number: firstNumber(p.text), _by: 'the PDF text' };
        // every service that was tried and what it said, so a backup's error never hides the first one's
        const tried = [];
        let first;
        for (const r of readers) {
            try { return { ...(await readOne(r.read, p, i, n)), _by: r.name }; } catch (err) {
                first = first || err;
                tried.push(`${r.name}: ${String(err.message).replace(/^\(\w+\)\s*/, '')}`);
                console.warn(`[pageReader] photo ${i} with ${r.name} failed:`, err.message);
                if (!(err.retry || err.busy || err.tryNext)) break;
            }
        }
        const e = new Error(`${n > 1 ? `Photo ${i}` : 'The photo'} could not be read. ${tried.join(' · ')}`);
        e.status = first?.status || 502;
        throw e;
    };

    const n = pages.length;
    // Claude reads all photos at once. The free services (Groq, Gemini) get them one by one, so a burst of
    // photos does not hit their per-minute limits.
    let raws;
    if (!readers.length || readers[0].name === 'Claude') raws = await Promise.all(pages.map((p, k) => read(p, k + 1, n)));
    else {
        raws = [];
        for (let k = 0; k < n; k++) raws.push(await read(pages[k], k + 1, n));
    }

    // Put the pages in order: by the printed section numbers when every page has a different one, else as added
    let order = raws.map((r, k) => ({ r, photo: k + 1, num: Math.round(Number(r?.first_number)) || 0 }));
    const nums = order.map((o) => o.num);
    const byNumber = n > 1 && nums.every((x) => x > 0) && new Set(nums).size === n;
    if (byNumber) order = [...order].sort((a, b) => a.num - b.num);
    const reordered = byNumber && order.some((o, k) => o.photo !== k + 1);

    const title = String(order.map((o) => o.r?.title).find((t) => String(t || '').trim()) || '').trim().slice(0, 140);
    const text = order.map((o) => String(o.r?.text || '').replace(/\r/g, '').trim()).filter(Boolean).join('\n\n').slice(0, 20000);
    const full = title && !text.toLowerCase().startsWith(title.toLowerCase()) ? `${title}\n\n${text}` : text;
    if (full.replace(/\[unclear\]/g, '').trim().length < 40) {
        const e = new Error('Could not read enough text from the photos. Take them closer, flat and in good light, then try again.'); e.status = 422; throw e;
    }

    // Pictures keep the number of the photo they are on (in the order the editor added the photos)
    const pictures = cleanPictures(order.flatMap((o) => (Array.isArray(o.r?.pictures) ? o.r.pictures : []).map((pic) => ({ ...pic, photo: o.photo }))), n);
    // only one main picture: the biggest marked "cover", the others become normal pictures
    const covers = pictures.filter((pic) => pic.role === 'cover').sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
    covers.slice(1).forEach((pic) => { pic.role = 'inline'; });

    const rawColours = order.map((o) => (/^#[0-9a-f]{6}$/i.test(String(o.r?.accent || '').trim()) ? String(o.r.accent).trim().toUpperCase() : null));
    const accent = mainColour(rawColours.map(snapColour));
    const notes = [
        reordered ? `The photos were put in section order (${order.map((o) => `photo ${o.photo}`).join(', ')}).` : '',
        ...order.map((o) => (String(o.r?.notes || '').trim() ? `${n > 1 ? `Photo ${o.photo}: ` : ''}${String(o.r.notes).trim()}` : '')),
    ].filter(Boolean).join(' ').slice(0, 800);

    return {
        text: full,
        accentRaw: rawColours.find((c, k) => c && snapColour(c) === accent) || null,
        accent,
        pictures: pictures.slice(0, 8),
        order: order.map((o) => o.photo),
        // which AI read the photos, for example "Groq" or "Groq, Gemini" when one was busy
        readBy: [...new Set(order.map((o) => o.r?._by).filter(Boolean))].join(', '),
        notes,
    };
}

const PHOTO_RULES = `THIS SOURCE WAS COPIED FROM PHOTOS OF THE PRINTED PAGE.
- Keep every "@profile" line from the source, for the same people, with the same name, age and tags.
- If a source heading starts with an icon token such as ":bulb:", start your matching heading with the same token (for example "## :bulb: Your heading"). Use only tokens that are in the source, at most 4.
- "[unclear]" marks a word that could not be read: do not guess it; leave that detail out and mention it in "notes".`;

/** Both steps: photos → finished story in the house style, plus the design to apply. */
async function storyFromPages(pages, { sections = [], vocab = [], env = process.env, fetchImpl = fetch } = {}) {
    const read = await readPages(pages, { env, fetchImpl });
    // the article from several photos is long: give the writing step more time than a normal paste
    const { story, source } = await formatStory(read.text, { sections, vocab, env, fetchImpl, extraRules: PHOTO_RULES, timeoutMs: 150000 });
    story.body = cleanIcons(story.body);
    story.notes = [read.notes, story.notes].filter(Boolean).join(' ').slice(0, 1200);
    return {
        story,
        source,
        design: { accent: read.accent, accentRaw: read.accentRaw, pictures: read.pictures, order: read.order, readBy: read.readBy },
        transcript: read.text,
    };
}

module.exports = { storyFromPages, readPages, snapColour, cleanIcons, cleanPictures, checkPages, ICONS, PALETTE, MAX_PAGES };
