const test = require('node:test');
const assert = require('node:assert');
const { formatStory, basicFormat, cleanStory } = require('./storyFormatter');

const ISHAQ = `Ishaq asked: What if electric cars could become more affordable for ordinary people?

He designed an electric-vehicle concept aimed at making EV technology more affordable and accessible. Without a formal automotive design school or giant laboratory, he taught himself through online research, technical drawing, 3D modelling and his experience as a vehicle mechanic.

The Katsina State indigene's design attracted international attention, including recognition from International Art Magazine, Japan.`;

test('without an API key, the basic formatter still makes title + blocks', async () => {
    const { story, source } = await formatStory(ISHAQ, { env: {} });
    assert.strictEqual(source, 'basic');
    assert.ok(story.title.startsWith('Ishaq asked'));
    assert.strictEqual(story.body.length, 3); // nothing dropped: the opening question stays in the story
    assert.ok(story.body.join(' ').includes('International Art Magazine, Japan'), 'keeps the facts');
    assert.ok(story.readMins >= 1);
});

test('basic formatter: headings and bullets', () => {
    const s = basicFormat('Big News Today\n\nFirst paragraph here. It has facts.\n\nWhat happens next\n\nMore words follow here.\n\n- one\n- two');
    assert.strictEqual(s.title, 'Big News Today');
    assert.deepStrictEqual(s.body, ['First paragraph here. It has facts.', '## What happens next', 'More words follow here.', '- one', '- two']);
});

test('too short / too long text is refused', async () => {
    await assert.rejects(formatStory('hi', { env: {} }), /full article/);
    await assert.rejects(formatStory('x'.repeat(20001), { env: {} }), /too long/);
});

test('with a key, Claude is called with the tool and the result is cleaned', async () => {
    let sent;
    const fakeFetch = async (url, opts) => {
        sent = JSON.parse(opts.body);
        assert.strictEqual(opts.headers['x-api-key'], 'test-key');
        return { ok: true, json: async () => ({ content: [{ type: 'tool_use', name: 'nextgen_story', input: {
            title: '  Ishaq Designed an EV  ', dek: 'No car school. Big idea.', section: 'stars', tags: ['EV', 'innovation'],
            body: ['Ishaq asked one big question.', '', '## How', '- Online research'], eli10: ['Simple.'],
            vocab: [{ word: 'Concept', definition: 'An early idea.', nextgen: 'Draft 1.' }, { word: '' }], notes: 'Full name?',
        } }] }) };
    };
    const { story, source } = await formatStory(ISHAQ, {
        env: { ANTHROPIC_API_KEY: 'test-key' }, fetchImpl: fakeFetch,
        sections: [{ key: 'stars', label: 'NEXTGEN STARS' }], vocab: [{ word: 'Manifesto' }],
    });
    assert.strictEqual(source, 'ai');
    assert.strictEqual(sent.tool_choice.name, 'nextgen_story');
    assert.match(sent.messages[0].content, /CATEGORY KEYS: stars \(NEXTGEN STARS\)/);
    assert.match(sent.messages[0].content, /EXISTING VOCAB VAULT WORDS: Manifesto/);
    assert.match(sent.system, /Use ONLY facts that are in the source text/);
    assert.strictEqual(story.title, 'Ishaq Designed an EV');
    assert.strictEqual(story.sectionLabel, 'NEXTGEN STARS');
    assert.deepStrictEqual(story.body, ['Ishaq asked one big question.', '## How', '- Online research']);
    assert.strictEqual(story.vocab.length, 1);
    assert.strictEqual(story.notes, 'Full name?');
});

test('an unknown section from the AI is dropped', () => {
    assert.strictEqual(cleanStory({ title: 't', section: 'made-up', body: ['x'] }, [{ key: 'stars', label: 'S' }]).section, '');
});

test('AI errors come back as a readable message', async () => {
    const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) });
    await assert.rejects(formatStory(ISHAQ, { env: { ANTHROPIC_API_KEY: 'bad' }, fetchImpl: fakeFetch }), /invalid x-api-key/);
});

test('uses Gemini (free tier) when only GEMINI_API_KEY is set', async () => {
    let seen;
    const fakeFetch = async (url, opts) => {
        seen = { url, opts: JSON.parse(opts.body), key: opts.headers['x-goog-api-key'] };
        const story = { title: 'Ishaq Built a Cheaper EV', dek: 'Self-taught.', section: 'stars', tags: ['EV'], body: ['Ishaq asked a big question.', '## How'], eli10: ['Simple version.'], notes: '' };
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(story) }] } }] }) };
    };
    const r = await formatStory('Ishaq asked: what if electric cars could be cheaper for ordinary people? He designed one.', {
        sections: [{ key: 'stars', label: 'Rising Stars' }], env: { GEMINI_API_KEY: 'g-key' }, fetchImpl: fakeFetch,
    });
    assert.equal(r.source, 'ai');
    assert.equal(r.story.title, 'Ishaq Built a Cheaper EV');
    assert.equal(r.story.sectionLabel, 'Rising Stars');
    assert.match(seen.url, /gemini-flash-latest:generateContent$/);
    assert.equal(seen.key, 'g-key');
    assert.equal(seen.opts.generationConfig.responseSchema.type, 'OBJECT');
    assert.equal(seen.opts.generationConfig.responseSchema.properties.body.items.type, 'STRING');
});

test('Gemini free limit gives a friendly message', async () => {
    const fakeFetch = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'quota' } }) });
    await assert.rejects(
        formatStory('Ishaq asked: what if electric cars could be cheaper for ordinary people? He designed one.', { env: { GEMINI_API_KEY: 'k' }, fetchImpl: fakeFetch }),
        (e) => e.status === 429 && /free AI limit/.test(e.message),
    );
});

test('uses Groq (free tier) when GROQ_API_KEY is set, before Gemini', async () => {
    let seen;
    const fakeFetch = async (url, opts) => {
        seen = { url, body: JSON.parse(opts.body), auth: opts.headers.authorization };
        const story = { title: 'Ishaq Built a Cheaper EV', dek: 'Self-taught.', section: 'stars', tags: ['EV'], body: ['Ishaq asked a big question.'], eli10: ['Simple.'], vocab: [], notes: '' };
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(story) } }] }) };
    };
    const r = await formatStory('Ishaq asked: what if electric cars could be cheaper for ordinary people? He designed one.', {
        sections: [{ key: 'stars', label: 'Rising Stars' }], env: { GROQ_API_KEY: 'gq', GEMINI_API_KEY: 'g' }, fetchImpl: fakeFetch,
    });
    assert.equal(r.source, 'ai');
    assert.equal(r.story.sectionLabel, 'Rising Stars');
    assert.equal(seen.url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(seen.auth, 'Bearer gq');
    assert.equal(seen.body.model, 'llama-3.3-70b-versatile');
    assert.deepEqual(seen.body.response_format, { type: 'json_object' });
    assert.match(seen.body.messages[0].content, /ONE JSON object/);
});

test('Groq: falls back to another free model when one is unavailable', async () => {
    const tried = [];
    const fakeFetch = async (url, opts) => {
        const { model } = JSON.parse(opts.body); tried.push(model);
        if (model === 'llama-3.3-70b-versatile') return { ok: false, status: 404, json: async () => ({ error: { message: 'The model does not exist or you do not have access to it.', code: 'model_not_found' } }) };
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'T', dek: 'D', body: ['Hello there.'], eli10: ['Hi.'] }) } }] }) };
    };
    const r = await formatStory('Ishaq asked: what if electric cars could be cheaper for ordinary people? He designed one.', { env: { GROQ_API_KEY: 'k' }, fetchImpl: fakeFetch });
    assert.equal(r.source, 'ai');
    assert.deepEqual(tried.slice(0, 2), ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b']);
});

test('Groq: bad key stops at once with a clear message, and shows the real error otherwise', async () => {
    let calls = 0;
    const bad = async () => { calls++; return { ok: false, status: 401, json: async () => ({ error: { message: 'Invalid API Key', code: 'invalid_api_key' } }) }; };
    await assert.rejects(formatStory('Ishaq asked: what if electric cars could be cheaper for ordinary people? He designed one.', { env: { GROQ_API_KEY: '"k"' }, fetchImpl: bad }), /did not accept the key/);
    assert.equal(calls, 1);
    const other = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'json_validate_failed' } }) });
    await assert.rejects(formatStory('Ishaq asked: what if electric cars could be cheaper for ordinary people? He designed one.', { env: { GROQ_API_KEY: 'k' }, fetchImpl: other }), /Groq \(llama-3.3-70b-versatile\) said: json_validate_failed/);
});

test('a too-short AI story gets a second pass to reach the house length', async () => {
    const prompts = [];
    const long = Array.from({ length: 30 }, (_, i) => `Block ${i} explains one more idea about the story in plain words for teens.`);
    const fakeFetch = async (url, opts) => {
        const b = JSON.parse(opts.body); prompts.push(b.messages[1].content);
        const body = prompts.length === 1 ? ['Short draft.'] : long;
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'T', dek: 'D', body, eli10: ['Hi.'] }) } }] }) };
    };
    const r = await formatStory('Darasimi Nadi, 14, acted in Obara’M and Aburo and was nominated at the AMVCA.', { env: { GROQ_API_KEY: 'k' }, fetchImpl: fakeFetch });
    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /FIRST DRAFT/);
    assert.equal(r.story.body.length, 30);
});

test('the prompt carries the house-style example and structure rules', () => {
    const { SYSTEM } = require('./storyFormatter');
    assert.match(SYSTEM, /450–700 words/);
    assert.doesNotMatch(SYSTEM, /Short sources make short stories/);
});

test('normaliseBlocks fixes the markup an AI often gets slightly wrong', () => {
    const { normaliseBlocks } = require('./storyFormatter');
    assert.deepEqual(normaliseBlocks(['# Big title\nFirst para.', '* one', '• two', '>quote', '**Why it matters**', '####Deep', '2) step']),
        ['## Big title', 'First para.', '- one', '- two', '> quote', '## Why it matters', '### Deep', '2. step']);
    assert.deepEqual(normaliseBlocks('Line one\n\nLine two'), ['Line one', 'Line two']);
});

test('markVocab marks the first plain mention, never headings', () => {
    const { markVocab } = require('./storyFormatter');
    const out = markVocab(['## Nollywood dreams', 'She acts in Nollywood films. Nollywood is big.', 'The AMVCA is an award.'], ['Nollywood', 'AMVCA', 'budget']);
    assert.deepEqual(out, ['## Nollywood dreams', 'She acts in [[Nollywood]] films. Nollywood is big.', 'The [[AMVCA]] is an award.']);
});

test('styleGaps lists what a plain draft is missing; a full story passes', () => {
    const { styleGaps } = require('./storyFormatter');
    const gaps = styleGaps({ body: ['Just one plain paragraph.'], eli10: [] });
    assert.ok(gaps.length >= 7);
    const para = 'This paragraph explains one more idea about the story in clear, friendly words for teens who read NextGen. '.repeat(3);
    const full = { body: ['Hook with **bold** and ==shine== and [[Nollywood]].', '## One', para, '## Two', para, '- **a** x', '- **b** y', '- **c** z', '> callout', '## Three', para, para, para, para, '## The NextGen lesson', para, '> end'], eli10: ['a', 'b', 'c', 'd'], question: { prompt: 'Q?', options: ['a', 'b', 'c', 'd'], answer: 1 } };
    assert.deepEqual(styleGaps(full), []);
});

test('formatted stories carry the arcade game button and points like the others', async () => {
    const fakeFetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'T', dek: 'D', body: ['Hi there friend.'], eli10: ['Hi.'] }) } }] }) });
    const r = await formatStory('Darasimi Nadi, 14, acted in Obara’M and Aburo and was nominated at the AMVCA.', { env: { GROQ_API_KEY: 'k' }, fetchImpl: fakeFetch });
    assert.deepEqual(r.story.game, { label: 'Play in the NextGen Arcade', href: '/#arcade' });
    assert.equal(r.story.points, 10);
});
