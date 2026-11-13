// ===============================
// Turn a pasted article into a NextGen story
// ===============================
// formatStory(text, { sections, vocab }) → { story, source, notes }
//
// With ANTHROPIC_API_KEY in .env, Claude rewrites the article in the NextGen
// voice and layout: title, summary, headings, bullets, callouts, vocab words and
// the "Explain like I'm 10" version, keeping every fact and adding none.
// Without a key, a simple formatter splits the text into title + paragraphs
// so the editor still saves typing.
// ===============================

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_INPUT = 20000; // characters

const { validQuestion } = require('./readCheck');
const clean = (s, max = 2000) => String(s ?? '').replace(/\s+$/g, '').trim().slice(0, max);
const words = (blocks) => blocks.join(' ').split(/\s+/).filter(Boolean).length;
const minsFor = (blocks) => Math.min(30, Math.max(1, Math.round(words(blocks) / 200) || 1));

// ---------- the rules Claude follows ----------
const SYSTEM = `You format stories for PUNCH NextGen, a newspaper for Nigerian teenagers (ages 12–18).

VOICE: friendly, clear and confident, with a light Gen Z and Nigerian flavour ("no cap", "wahala", "eating up", "main-character energy") used sparingly. Short sentences. Never rude, never political opinion.

FACT RULES (most important):
- Use ONLY facts that are in the source text. Never add names, ages, numbers, dates, places, quotes, awards, schools or claims that are not in the source.
- Keep every important fact from the source, with the same names, spellings and numbers.
- You MAY add short, general explanations of ideas a teen might not know (for example what a prototype or an electric vehicle is) and friendly framing lines, but never new facts about the people or events.
- If the source is unclear about something, leave it out instead of guessing.
- Put anything the editor should double-check (a missing full name, an unclear date) in "notes".

STORY FORMAT ("body" and "eli10" are lists of blocks, one block per item):
- "plain text" = a paragraph (2–4 sentences)
- "## Heading" = section heading, "### Subheading" = smaller heading
- "> text" = yellow callout box for the key line or lesson (1–3 per story)
- "- text" = bullet point (consecutive bullets form one list), "1. text" = numbered step
- **bold** for key facts, ==highlight== for one standout phrase, [[word]] marks a Vocab Vault word
- If the source spotlights several people (a list of stars, winners, creators), give each one a profile: a block "@profile Full Name | Age | Category · Category" (leave out the age if the source has none), then a "### catchy headline" block, then 1–2 paragraphs about them. End the group of profiles with a "---" block.
- Do not invent picture links. Do not use "@photos" or "![...]()" blocks.

LENGTH AND STRUCTURE (match the house style exactly):
- "body" must be 450–700 words and 20–35 blocks, EVEN WHEN THE SOURCE IS SHORT. A short source does not mean a short story.
- Make it longer by explaining and adding context, never by inventing facts: explain the ideas, terms, awards, industries or places in the story (what Nollywood is, what an award like that means, how a skill is learned), why it matters to a Nigerian teen, and practical tips a reader can use. These general explanations are allowed; new facts about the people or events are not.
- Every story has, in this order:
  1. A hook: 2–3 short opening blocks that pull the reader in (a question, a bold key fact).
  2. At least 4 "## " sections with fun, specific headings (not just "Introduction" or "Conclusion").
  3. At least one bullet list of 3–5 "- " items with **bold** starts.
  4. 2–3 "> " callout lines spread through the story.
  5. A practical section for readers (how they can start, what they can learn, what to watch for).
  6. A final "## The NextGen lesson" section: one short paragraph, then one closing "> " line.
- Paragraphs are 2–4 sentences. Use **bold** on key facts and one ==highlight==. A few emojis are fine (not every line).

ELI10: the same story for a 10-year-old in 4–8 short blocks, same facts, simple words.

VOCAB: up to 4 words from the body that a teen may not know. Mark each in the body as [[word]] (exact same spelling as "word"). Give a one-sentence definition and a fun NextGen line. Reuse words from the existing Vocab Vault list when they appear.

QUESTION: one multiple-choice question that proves the reader read the story: about a key fact IN THE SOURCE (a name, a number, what happened), 4 short options, exactly one right, the other three believable but wrong. Give the index (0–3) of the right option in "answer" and a one-line "explain".

SECTION: pick the best matching category key from the list given, or "" if none fits.`;

const SYSTEM_WITH_EXAMPLE = SYSTEM + "\n\nEXAMPLE of the house style (learn the FORMAT, LENGTH and VOICE only; never reuse its facts in other stories).\nSOURCE:\n\"\"\"\nIshaq asked: What if electric cars could become more affordable for ordinary people?\n\nHe designed an electric-vehicle concept aimed at making EV technology more affordable and accessible. Without a formal automotive design school or giant laboratory, he taught himself through online research, technical drawing, 3D modelling and his experience as a vehicle mechanic.\n\nThe Katsina State indigene's design attracted international attention, including recognition from International Art Magazine, Japan.\n\"\"\"\nRESULT:\n{\"title\": \"Ishaq Designed an EV for Everyday People\", \"dek\": \"No car design school. No giant lab. Just research, sketches and serious grit. ⚡🔧\", \"section\": \"stars\", \"tags\": [\"innovation\", \"electric cars\", \"self-taught\", \"Katsina\"], \"body\": [\"Ishaq asked one big question: **what if electric cars could become more affordable for ordinary people?**\", \"Most people would ask that question and move on. Ishaq didn't. He decided to do something about it.\", \"He designed an [[electric vehicle]] [[concept]] aimed at making EV technology cheaper and easier for everyday people to get.\", \"## First, what even is an EV?\", \"An electric vehicle, or EV, is a car that runs on electricity instead of petrol or diesel. Instead of a fuel tank, it has a big **battery**. Instead of an engine that burns fuel, it uses an **electric motor** to turn the wheels. You charge it, a bit like charging your phone.\", \"EVs are quiet, they do not release smoke from an exhaust pipe, and they have fewer moving parts than petrol cars. So why is everyone not driving one?\", \"## The big problem: price\", \"For many people, EVs are still too expensive. The battery is one of the most expensive parts of the whole car. Add the cost of new technology, and the price tag can be out of reach for most families.\", \"That is the problem Ishaq set out to tackle. An EV only changes the world if ordinary people can actually afford one.\", \"> An invention is cool. An invention people can afford is life-changing.\", \"## How he pulled it off\", \"No formal automotive design school. No giant laboratory. Ishaq taught himself, using:\", \"- **Online research** to learn how EVs work\", \"- **Technical drawing** to sketch out his ideas\", \"- **[[3D modelling]]** to bring the design to life on screen\", \"- **His experience as a vehicle mechanic**, the hands-on knowledge no textbook gives you\", \"Each skill plays a different role. Research tells you what is possible. Technical drawing turns an idea into exact shapes and measurements. 3D modelling lets you see the design from every side before anything is built. And working as a mechanic teaches you how real cars are put together, what breaks, and what is hard to fix.\", \"> Self-taught, no big lab, and still built something the world noticed. That's the energy. 💪\", \"## The world noticed\", \"The Katsina State [[indigene]]'s design attracted ==international attention==, including recognition from **International Art Magazine, Japan**.\", \"Think about that: a design that started with research, sketches and a mechanic's know-how ended up being noticed on the other side of the world. 🌍🇯🇵\", \"## Want to build like Ishaq?\", \"You do not have to wait for the perfect school, the perfect lab or the perfect moment. You can start small, right now:\", \"- **Get curious.** Pick something you use every day and ask: how does this work? How could it be better or cheaper?\", \"- **Learn online.** Videos, articles and free courses can teach you almost anything, if you are consistent.\", \"- **Draw your ideas.** A pencil and paper are enough to start. Sketch it out, label the parts, improve it.\", \"- **Try free 3D tools.** Beginner-friendly apps like Tinkercad let you build 3D models in your browser.\", \"- **Learn with your hands.** Fixing, building and taking things apart (safely, and with permission! 😅) teaches you things no book can.\", \"## The NextGen lesson\", \"You don't need perfect conditions to start. Ask a big question, learn with what you have, and build.\", \"> Big question. Small start. Keep going. 🚗⚡\"], \"eli10\": [\"Electric cars are cool, but they cost a lot of money. 💸 Ishaq wondered: what if more people could afford one?\", \"An electric car runs on a big battery instead of petrol. You charge it, like a phone!\", \"So Ishaq designed his own idea for a cheaper electric car.\", \"He didn't go to a special car school. He learned by reading online, drawing, making 3D models on a computer, and fixing cars as a mechanic.\", \"> His design was so good that a magazine in Japan noticed it! 🇯🇵\", \"The lesson: you can start learning and building with what you already have.\"], \"vocab\": [{\"word\": \"Electric vehicle\", \"definition\": \"A car that runs on a battery instead of petrol or diesel.\", \"nextgen\": \"No fuel queue wahala.\"}, {\"word\": \"Concept\", \"definition\": \"An early design idea, not a finished product yet.\", \"nextgen\": \"The first draft of a big idea.\"}, {\"word\": \"3D modelling\", \"definition\": \"Building an object on a computer so you can see it from every side.\", \"nextgen\": \"Like sculpting, but on a screen.\"}, {\"word\": \"Indigene\", \"definition\": \"A person who comes from a particular state or place.\", \"nextgen\": \"Where your roots dey.\"}], \"question\": {\"prompt\": \"Which magazine recognised Ishaq's EV design?\", \"options\": [\"Forbes Africa\", \"International Art Magazine, Japan\", \"Car and Driver\", \"TIME Magazine\"], \"answer\": 1, \"explain\": \"The story says International Art Magazine, Japan recognised his design.\"}, \"notes\": \"The source gives only the first name Ishaq. Add his full name if you have it.\"}";

const TOOL = {
    name: 'nextgen_story',
    description: 'Return the formatted NextGen story.',
    input_schema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Catchy headline, under 70 characters' },
            dek: { type: 'string', description: 'One-line summary under the title, under 140 characters' },
            section: { type: 'string', description: 'One of the category keys given, or ""' },
            tags: { type: 'array', items: { type: 'string' }, description: '3–6 short tags' },
            body: { type: 'array', items: { type: 'string' } },
            eli10: { type: 'array', items: { type: 'string' } },
            vocab: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: { word: { type: 'string' }, definition: { type: 'string' }, nextgen: { type: 'string' } },
                    required: ['word', 'definition'],
                },
            },
            question: {
                type: 'object',
                description: 'Check question about a fact in the story',
                properties: {
                    prompt: { type: 'string' },
                    options: { type: 'array', items: { type: 'string' }, description: 'Exactly 4 options' },
                    answer: { type: 'integer', description: 'Index 0–3 of the right option' },
                    explain: { type: 'string' },
                },
                required: ['prompt', 'options', 'answer'],
            },
            notes: { type: 'string', description: 'Things the editor should check. Empty if nothing.' },
        },
        required: ['title', 'dek', 'body', 'eli10'],
    },
};

// ---------- tidy the AI's blocks into our exact format ----------
function normaliseBlocks(input) {
    const raw = Array.isArray(input) ? input : typeof input === 'string' ? [input] : [];
    const out = [];
    for (const item of raw) {
        for (let line of String(item ?? '').split(/\n+/)) {
            line = line.trim();
            if (!line) continue;
            line = line
                .replace(/^#{4,}\s*/, '### ')
                .replace(/^#\s+/, '## ')
                .replace(/^(#{2,3})(?=[^#\s])/, '$1 ')
                .replace(/^[*•●▪]\s+/, '- ')
                .replace(/^>(?=\S)/, '> ')
                .replace(/^(\d+)[).]\s*/, '$1. ');
            // a short line that is only **bold** works as a heading
            const boldOnly = line.match(/^\*\*([^*]{2,70})\*\*:?$/);
            if (boldOnly) line = `## ${boldOnly[1].trim()}`;
            out.push(line);
        }
    }
    return out;
}

// Mark the first plain mention of each vocab word as [[word]] (never inside headings or profile lines)
function markVocab(body, words) {
    const list = [...new Set(words.map((w) => String(w || '').trim()).filter((w) => w.length > 1))];
    const has = (w) => body.some((b) => b.toLowerCase().includes(`[[${w.toLowerCase()}]]`));
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return list.reduce((blocks, word) => {
        if (has(word)) return blocks;
        const re = new RegExp(`(^|[^\\w\\[])(${esc(word)})(?![\\w\\]])`, 'i');
        let done = false;
        return blocks.map((b) => {
            if (done || /^(#{2,3} |@|---|!\[)/.test(b) || !re.test(b)) return b;
            done = true;
            return b.replace(re, (m, pre, w) => `${pre}[[${w}]]`);
        });
    }, body);
}

// What a finished NextGen story must have; returns what is missing
function styleGaps(story) {
    const b = story.body || [];
    const count = (re) => b.filter((x) => re.test(x)).length;
    const gaps = [];
    const w = words(b);
    if (w < MIN_WORDS) gaps.push(`it is only ${w} words; it needs 450–700`);
    if (count(/^## /) < 4) gaps.push('it needs at least 4 "## " section headings');
    if (count(/^- /) < 3) gaps.push('it needs a bullet list of 3–5 "- " items with **bold** starts');
    if (count(/^> /) < 2) gaps.push('it needs 2–3 "> " callout lines');
    if (!b.some((x) => /\*\*[^*]+\*\*/.test(x))) gaps.push('it needs **bold** on key facts');
    if (!b.some((x) => /==[^=]+==/.test(x))) gaps.push('it needs one ==highlight==');
    if (!b.some((x) => /\[\[[^\]]+\]\]/.test(x))) gaps.push('it needs 2–4 [[vocab]] words');
    if (!b.some((x) => /^## .*NextGen lesson/i.test(x))) gaps.push('it must end with a "## The NextGen lesson" section and a closing "> " line');
    if ((story.eli10 || []).length < 4) gaps.push('"eli10" needs 4–8 short blocks');
    if (!story.question) gaps.push('it needs a "question" with a prompt, 4 options and the index of the right one');
    return gaps;
}

// ---------- make whatever comes back safe to use ----------
function cleanStory(raw, sections = [], vaultWords = []) {
    const keys = new Map(sections.map((s) => [s.key, s.label]));
    const list = (a, max, len) => (Array.isArray(a) ? a : []).map((x) => clean(x, len)).filter(Boolean).slice(0, max);
    const vocabIn = (Array.isArray(raw?.vocab) ? raw.vocab : []).filter((v) => v && clean(v.word) && clean(v.definition)).slice(0, 6);
    const body = markVocab(normaliseBlocks(raw?.body).map((x) => clean(x, 3000)).filter(Boolean).slice(0, 150), [...vocabIn.map((v) => v.word), ...vaultWords]);
    const section = keys.has(raw?.section) ? raw.section : '';
    return {
        title: clean(raw?.title, 140),
        dek: clean(raw?.dek, 240),
        section,
        sectionLabel: section ? keys.get(section) : '',
        tags: list(raw?.tags, 8, 40),
        body,
        eli10: normaliseBlocks(raw?.eli10).map((x) => clean(x, 1500)).filter(Boolean).slice(0, 30),
        readMins: minsFor(body),
        vocab: vocabIn
            .map((v) => ({ word: clean(v.word, 60), definition: clean(v.definition, 300), nextgen: clean(v.nextgen, 200), category: 'Words' })),
        question: validQuestion(raw?.question),
        notes: clean(raw?.notes, 800),
        // same game button as our other stories
        game: { label: 'Play in the NextGen Arcade', href: '/#arcade' },
        points: 10,
    };
}

// ---------- no AI: tidy the pasted text into blocks ----------
function basicFormat(text) {
    const paras = String(text).replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    let title = '';
    if (paras.length > 1 && paras[0].length <= 120 && !/[.!?]$/.test(paras[0].split('\n')[0])) title = paras.shift().split('\n')[0];
    const body = [];
    paras.forEach((p) => {
        const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
        const bullets = lines.every((l) => /^([-*•]|\d+[.)])\s+/.test(l));
        if (bullets) { lines.forEach((l) => body.push(/^\d/.test(l) ? l.replace(/^(\d+)[.)]\s+/, '$1. ') : `- ${l.replace(/^[-*•]\s+/, '')}`)); return; }
        const joined = lines.join(' ');
        // a short line with no full stop, before more text, reads as a heading
        if (joined.length <= 70 && !/[.!?,;:]$/.test(joined) && lines.length === 1) body.push(`## ${joined}`);
        else body.push(joined);
    });
    if (!title) {
        const first = body.find((b) => !b.startsWith('#')) || '';
        title = first.split(/(?<=[.!?])\s/)[0].slice(0, 90);
    }
    const firstPara = body.find((b) => !/^(#|-|\d+\.)/.test(b)) || '';
    const dek = firstPara.split(/(?<=[.!?])\s/)[0].slice(0, 160);
    return { title, dek, section: '', sectionLabel: '', tags: [], body, eli10: [], readMins: minsFor(body), vocab: [], notes: '' };
}

function buildPrompt(text, sections, vocab, extra = '') {
    return [
        `CATEGORY KEYS: ${sections.length ? sections.map((s) => `${s.key} (${s.label})`).join(', ') : 'none'}`,
        `EXISTING VOCAB VAULT WORDS: ${vocab.length ? vocab.map((v) => v.word).join(', ') : 'none'}`,
        '',
        'SOURCE ARTICLE:',
        '"""',
        text,
        '"""',
    ].join('\n') + (extra ? `\n\n${extra}` : '');
}

async function askClaude(text, { sections, vocab, apiKey, model, extra = '', fetchImpl = fetch, timeoutMs = 90000 }) {
    const context = buildPrompt(text, sections, vocab, extra);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetchImpl(API_URL, {
            method: 'POST',
            signal: ctrl.signal,
            headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
                model,
                max_tokens: 8000,
                system: SYSTEM_WITH_EXAMPLE,
                tools: [TOOL],
                tool_choice: { type: 'tool', name: TOOL.name },
                messages: [{ role: 'user', content: context }],
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data?.error?.message || `status ${res.status}`;
            throw new Error(`The AI service said: ${msg}`);
        }
        const call = (data.content || []).find((c) => c.type === 'tool_use' && c.name === TOOL.name);
        if (!call) throw new Error('The AI did not return a story. Try again.');
        return call.input;
    } finally {
        clearTimeout(timer);
    }
}

// ---------- Groq (free tier, no card: console.groq.com/keys) ----------
const MIN_WORDS = 380;
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';
// Groq uses the OpenAI chat format. JSON mode guarantees valid JSON; the shape is described in the prompt.
const GROQ_SHAPE = [
    'Reply with ONE JSON object only, no other text, in exactly this shape:',
    '{"title": string, "dek": string, "section": string (one of the category keys or ""), "tags": [string],',
    ' "body": [string, one block per item], "eli10": [string], "vocab": [{"word": string, "definition": string, "nextgen": string}],',
    ' "question": {"prompt": string, "options": [4 strings], "answer": number 0-3, "explain": string},',
    ' "notes": string (things the editor should check, or "")}',
].join('\n');

// Free models to try, in order, when one can't be used (retired, blocked for the account, over its limit)
const GROQ_FALLBACKS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];

function groqError(status, data, model) {
    const raw = data?.error?.message || `status ${status}`;
    const code = data?.error?.code || data?.error?.type || '';
    let msg;
    if (status === 401 || code === 'invalid_api_key') msg = 'Groq did not accept the key. Copy GROQ_API_KEY again from console.groq.com/keys (no quotes or spaces) and restart the server.';
    else if (status === 429 || code === 'rate_limit_exceeded') msg = 'The free Groq limit is used up for now. Wait a minute and try again (shorter articles use less).';
    else if (status === 413) msg = 'That article is too long for the free Groq limit. Paste it in two parts.';
    else msg = `Groq (${model}) said: ${raw}`;
    const e = new Error(msg);
    e.status = status === 429 ? 429 : status === 413 ? 400 : 502;
    // can another model help?
    e.tryNext = status === 404 || status === 403 || status === 429 || status === 413 || /model/i.test(code) || /model/i.test(raw);
    if (status === 401) e.tryNext = false;
    return e;
}

async function askGroqOnce(text, { sections, vocab, apiKey, model, extra = '', fetchImpl = fetch, timeoutMs = 90000 }) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            signal: ctrl.signal,
            headers: { 'content-type': 'application/json', authorization: `Bearer ${String(apiKey).trim().replace(/^["']|["']$/g, '')}` },
            body: JSON.stringify({
                model,
                temperature: 0.4,
                max_tokens: 3500,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: `${SYSTEM_WITH_EXAMPLE}\n\n${GROQ_SHAPE}` },
                    { role: 'user', content: buildPrompt(text, sections, vocab, extra) },
                ],
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.warn(`[storyFormatter] Groq ${model} → ${res.status}:`, JSON.stringify(data?.error || data));
            throw groqError(res.status, data, model);
        }
        const out = data.choices?.[0]?.message?.content || '';
        if (!out) throw new Error('The AI did not return a story. Try again.');
        try {
            return JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, ''));
        } catch {
            throw new Error('The AI reply was not readable. Try again.');
        }
    } finally {
        clearTimeout(timer);
    }
}

async function askGroq(text, opts) {
    const models = [...new Set([opts.model, ...GROQ_FALLBACKS].filter(Boolean))];
    let last;
    for (const model of models) {
        try {
            return await askGroqOnce(text, { ...opts, model });
        } catch (err) {
            last = err;
            if (!err.tryNext) throw err;
        }
    }
    throw last;
}

// ---------- Google Gemini (has a free tier: aistudio.google.com/apikey) ----------
const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
// Gemini wants the OpenAPI flavour of the schema: upper-case types, no "description" on the root
function toGeminiSchema(node) {
    if (Array.isArray(node)) return node.map(toGeminiSchema);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
        if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
        else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toGeminiSchema(pv)]));
        else out[k] = toGeminiSchema(v);
    }
    return out;
}

async function askGemini(text, { sections, vocab, apiKey, model, extra = '', fetchImpl = fetch, timeoutMs = 90000 }) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const res = await fetchImpl(url, {
            method: 'POST',
            signal: ctrl.signal,
            headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_WITH_EXAMPLE }] },
                contents: [{ role: 'user', parts: [{ text: buildPrompt(text, sections, vocab, extra) }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 8192,
                    responseMimeType: 'application/json',
                    responseSchema: toGeminiSchema(TOOL.input_schema),
                },
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data?.error?.message || `status ${res.status}`;
            const e = new Error(res.status === 429
                ? 'The free AI limit is used up for now. Wait a minute (or until tomorrow) and try again.'
                : `The AI service said: ${msg}`);
            e.status = res.status === 429 ? 429 : 502;
            throw e;
        }
        const out = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
        if (!out) throw new Error('The AI did not return a story. Try again.');
        try {
            return JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, ''));
        } catch {
            throw new Error('The AI reply was not readable. Try again.');
        }
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Format pasted text. Falls back to the simple formatter when no API key is set.
 * Throws for empty or overlong input, and when the AI call fails.
 */
async function formatStory(text, { sections = [], vocab = [], env = process.env, fetchImpl } = {}) {
    const source = String(text || '').trim();
    if (source.length < 40) { const e = new Error('Paste the full article (at least a few sentences).'); e.status = 400; throw e; }
    if (source.length > MAX_INPUT) { const e = new Error(`That is too long. Paste up to ${MAX_INPUT.toLocaleString()} characters at a time.`); e.status = 400; throw e; }

    // Claude first if its key is set, then Groq (free), then Gemini (free), otherwise the basic split
    let ask;
    if (env.ANTHROPIC_API_KEY) ask = (extra) => askClaude(source, { sections, vocab, apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || DEFAULT_MODEL, extra, fetchImpl });
    else if (env.GROQ_API_KEY) ask = (extra) => askGroq(source, { sections, vocab, apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL || GROQ_DEFAULT_MODEL, extra, fetchImpl });
    else if (env.GEMINI_API_KEY) ask = (extra) => askGemini(source, { sections, vocab, apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL, extra, fetchImpl });
    else return { story: { ...basicFormat(source) }, source: 'basic' };

    const vault = vocab.map((v) => v.word);
    let raw = await ask('');
    let story = cleanStory(raw, sections, vault);
    // Not in the house style yet? One more pass that lists exactly what is missing (same facts).
    const gaps = styleGaps(story);
    if (gaps.length) {
        const note = `YOUR FIRST DRAFT (below) IS NOT IN THE NEXTGEN HOUSE STYLE YET:\n- ${gaps.join('\n- ')}\nRewrite it to fix every point, like the example. Keep every fact; add explanation, context and reader tips, never new facts. Reply with the full story in the same JSON shape.\nFIRST DRAFT:\n${JSON.stringify(raw)}`;
        try {
            const second = cleanStory(await ask(note), sections, vault);
            if (second.body.length && styleGaps(second).length <= gaps.length) story = second;
        } catch {
            /* keep the first draft if the second try fails (for example the free limit) */
        }
    }
    if (!story.body.length) throw new Error('The AI returned an empty story. Try again.');
    return { story, source: 'ai' };
}

module.exports = { formatStory, basicFormat, cleanStory, normaliseBlocks, markVocab, styleGaps, toGeminiSchema, SYSTEM, TOOL };
