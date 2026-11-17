const test = require('node:test');
const assert = require('node:assert');
const { storyFromPages, readPages, snapColour, cleanIcons, cleanPictures, checkPages } = require('./pageReader');

const photo = (n = 1) => ({ type: 'image/jpeg', data: 'A'.repeat(2000 + n) });
const transcript = `The ₦10K Money Mystery

## :piggy: Where did it go?

Tolu, 15, had ₦10,000 on Monday and ₦650 by Friday. She tracked every naira for a week and found snacks and data took the most.

@profile Tolu Adebayo | 15 | Saver · Student

> Small spends add up fast.

- Write down what you spend
- Set a weekly limit`;

// Fake AI services: calls with a photo read it, the others write the story.
// pagesOut[i] = what the AI "reads" on photo i+1
function fakeFetch(calls, { pagesOut, slow } = {}) {
    return async (url, init) => {
        const body = JSON.parse(init.body);
        calls.push({ url, body });
        const raw = JSON.stringify(body);
        const isRead = raw.includes('"read_pages"') || raw.includes('inline_data') || raw.includes('image_url');
        const which = Number((raw.match(/This is photo (\d+) of/) || [])[1] || 1);
        if (isRead && slow && slow(which)) {
            // behave like a call that hit the time limit
            await new Promise((r, j) => init.signal.addEventListener('abort', () => j(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))));
        }
        const story = {
            title: 'The ₦10K Money Mystery', dek: 'Who ate your money?', section: 'money', tags: ['money'],
            body: ['Hook line with **bold**.', '## :piggy: Where did it go?', 'Tolu, 15, tracked every naira.', '## :rocket: Not a site icon', '@profile Tolu Adebayo | 15 | Saver · Student', '> Small spends add up fast.', '- **Write** it down'],
            eli10: ['a', 'b', 'c', 'd'], vocab: [], notes: 'Check the surname.',
            question: { prompt: 'How much did Tolu have on Monday?', options: ['₦650', '₦10,000', '₦5,000', '₦1,000'], answer: 1 },
        };
        const defaults = [
            { title: 'The ₦10K Money Mystery', text: transcript, accent: '#1FA34F', notes: 'Last line is cut off.', pictures: [{ box: [0.1, 0.2, 0.5, 0.4], caption: 'Tolu counting money', role: 'cover' }] },
            { text: 'Part two of the story, with more facts about saving.', accent: '#1FA34F', pictures: [{ box: [60, 10, 30, 30], role: 'profile', name: 'Tolu Adebayo' }] },
        ];
        const readOut = (pagesOut || defaults)[which - 1] || { text: 'More text on another page of the article.' };
        if (url.includes('anthropic')) {
            const name = body.tools[0].name;
            return { ok: true, json: async () => ({ content: [{ type: 'tool_use', name, input: name === 'read_pages' ? readOut : story }] }) };
        }
        if (url.includes('groq')) return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(isRead ? readOut : story) } }] }) };
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(isRead ? readOut : story) }] } }] }) };
    };
}

test('snapColour picks the nearest site colour and ignores black, white and greys', () => {
    assert.equal(snapColour('#1FA34F'), '#16A34A');
    assert.equal(snapColour('ffd833'), '#FFD400');
    assert.equal(snapColour('#2A62E8'), '#2563EB');
    assert.equal(snapColour('#111111'), null);
    assert.equal(snapColour('#F4F1EA'), null);
    assert.equal(snapColour('#808080'), null);
    assert.equal(snapColour('teal'), null);
});

test('cleanIcons keeps only the site icons on headings, at most 4', () => {
    assert.deepEqual(cleanIcons(['## :bulb: Ideas', '### :rocket: Space', 'text :bulb: stays', '##  :star:  Stars']), ['## :bulb: Ideas', '### Space', 'text :bulb: stays', '## :star: Stars']);
    const five = cleanIcons(Array.from({ length: 5 }, () => '## :bulb: x'));
    assert.equal(five.filter((b) => b.includes(':bulb:')).length, 4);
});

test('cleanPictures checks boxes, reads percent, keeps one cover', () => {
    const out = cleanPictures([
        { photo: 1, box: [0.1, 0.1, 0.3, 0.3], role: 'cover' },
        { photo: 1, box: [0.5, 0.5, 0.4, 0.4], role: 'cover' },
        { photo: 2, box: [10, 20, 50, 40], role: 'inline' },
        { photo: 3, box: [0, 0, 1, 1] },                     // photo 3 does not exist
        { photo: 1, box: [0.1, 0.1, 0.01, 0.5] },            // too thin
        { photo: 1, box: [0.8, 0.8, 0.5, 0.5], role: 'profile' }, // profile without a name → inline, box clipped
    ], 2);
    assert.equal(out.length, 4);
    assert.deepEqual(out.map((p) => p.role), ['cover', 'inline', 'inline', 'inline']);
    assert.deepEqual(out[2].box, [0.1, 0.2, 0.5, 0.4]);
    assert.deepEqual(out[3].box, [0.8, 0.8, 0.2, 0.2]);
    // no cover marked → the biggest becomes it
    const auto = cleanPictures([{ photo: 1, box: [0, 0, 0.2, 0.2] }, { photo: 1, box: [0, 0, 0.6, 0.6] }], 1);
    assert.deepEqual(auto.map((p) => p.role), ['inline', 'cover']);
});

test('checkPages: 1 to 4 pictures, right types, not too big', () => {
    assert.throws(() => checkPages([]), /at least one/);
    assert.throws(() => checkPages([1, 2, 3, 4, 5].map(photo)), /Up to 4/);
    assert.throws(() => checkPages([{ type: 'application/pdf', data: 'A'.repeat(2000) }]), /JPG, PNG or WEBP/);
    assert.throws(() => checkPages([{ type: 'image/png', data: 'not base64!' }]), /could not be read/);
    assert.throws(() => checkPages([{ type: 'image/png', data: 'A'.repeat(4_600_000) }]), /too big/);
    assert.equal(checkPages([{ type: 'image/jpeg', data: `data:image/jpeg;base64,${'A'.repeat(2000)}` }])[0].data.length, 2000);
});

test('readPages needs an AI key', async () => {
    await assert.rejects(readPages([photo()], { env: {} }), /needs an AI key/);
});

test('storyFromPages with Claude: each photo is read on its own, then the joined text is written in the house style', async () => {
    const calls = [];
    const out = await storyFromPages([photo(1), photo(2)], { env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl: fakeFetch(calls), sections: [{ key: 'money', label: 'MONEY MATTERS' }] });
    const reads = calls.filter((c) => c.body.tools?.[0]?.name === 'read_pages');
    assert.equal(reads.length, 2);
    reads.forEach((r) => assert.equal(r.body.messages[0].content.filter((c) => c.type === 'image').length, 1));
    assert.deepEqual(reads.map((r) => r.body.messages[0].content[1].text.match(/photo (\d) of 2/)[1]).sort(), ['1', '2']);
    // the writing step got both pages, in order, plus the photo rules
    const write = calls.find((c) => c.body.tools?.[0]?.name === 'nextgen_story').body;
    const prompt = write.messages[0].content;
    assert.ok(prompt.indexOf('Tolu, 15, had ₦10,000 on Monday') < prompt.indexOf('Part two of the story'));
    assert.match(prompt, /COPIED FROM PHOTOS/);
    assert.equal(out.source, 'ai');
    assert.equal(out.story.section, 'money');
    assert.ok(out.story.body.includes('## :piggy: Where did it go?'));
    assert.ok(out.story.body.includes('## Not a site icon'));
    assert.match(out.story.notes, /Photo 1: Last line is cut off.*surname/);
    assert.equal(out.design.accent, '#16A34A');
    assert.equal(out.design.accentRaw, '#1FA34F');
    assert.deepEqual(out.design.pictures.map((p) => [p.photo, p.role]), [[1, 'cover'], [2, 'profile']]);
    assert.equal(out.design.pictures[1].name, 'Tolu Adebayo');
    assert.deepEqual(out.design.pictures[1].box, [0.6, 0.1, 0.3, 0.3]);
});

test('photos added out of order are put in the printed section order', async () => {
    const pagesOut = [
        { first_number: 7, text: '## 7. So, When Are We Voting?\n\nINEC has announced the key dates.', accent: '#2E7D32', pictures: [] },
        { first_number: 4, text: '## 4. The NextGen Promise Checker\n\nAsk these 7 questions.', accent: '#2E7D32', pictures: [{ box: [0.5, 0.4, 0.3, 0.3], role: 'inline', caption: 'Cartoon' }] },
        { first_number: 1, title: "What's an Election?", text: "## 1. What's an Election?\n\nAn election is how citizens choose the people they want to represent and lead them.", accent: '#E53935', pictures: [] },
    ];
    const calls = [];
    const out = await storyFromPages([photo(1), photo(2), photo(3)], { env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl: fakeFetch(calls, { pagesOut }) });
    const t = out.transcript;
    assert.ok(t.indexOf('## 1.') < t.indexOf('## 4.') && t.indexOf('## 4.') < t.indexOf('## 7.'));
    assert.deepEqual(out.design.order, [3, 2, 1]);
    assert.match(out.story.notes, /put in section order/);
    // the picture still points at the photo it is on (photo 2), and becomes the main picture
    assert.deepEqual(out.design.pictures.map((p) => [p.photo, p.role]), [[2, 'cover']]);
    // green on 2 of 3 pages wins
    assert.equal(out.design.accent, '#16A34A');
});

test('a photo that takes too long gets one more try, then a clear message', async () => {
    let tries = 0;
    const calls = [];
    const out = await readPages([photo(1), photo(2)], { env: { ANTHROPIC_API_KEY: 'k' }, timeoutMs: 50, fetchImpl: fakeFetch(calls, { slow: (n) => n === 2 && tries++ === 0 }) });
    assert.ok(out.text.includes('Part two'));
    await assert.rejects(
        readPages([photo(1), photo(2)], { env: { ANTHROPIC_API_KEY: 'k' }, timeoutMs: 50, fetchImpl: fakeFetch([], { slow: (n) => n === 2 }) }),
        (e) => e.status === 504 && /^Photo 2 could not be read\. Claude: The AI took too long/.test(e.message) && !/aborted/.test(e.message),
    );
});

test('storyFromPages with Gemini and Groq sends the photos in their formats', async () => {
    const g = [];
    await storyFromPages([photo()], { env: { GEMINI_API_KEY: 'k' }, fetchImpl: fakeFetch(g) });
    assert.match(g[0].url, /generativelanguage/);
    assert.equal(g[0].body.contents[0].parts[0].inline_data.mime_type, 'image/jpeg');
    const q = [];
    await storyFromPages([photo()], { env: { GROQ_API_KEY: 'k' }, fetchImpl: fakeFetch(q) });
    assert.equal(q[0].body.model, 'qwen/qwen3.6-27b');
    assert.match(q[0].body.messages[1].content[0].image_url.url, /^data:image\/jpeg;base64,/);
});

test('storyFromPages: photos with too little text give a clear message', async () => {
    await assert.rejects(
        storyFromPages([photo()], { env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl: fakeFetch([], { pagesOut: [{ text: '[unclear] [unclear]' }] }) }),
        (e) => e.status === 422 && /closer, flat and in good light/.test(e.message),
    );
});

// Gemini answers "high demand" (503) for the models in `busy`
function busyGemini(calls, busy, { photoBusy = () => true } = {}) {
    const ok = fakeFetch([]);
    return async (url, init) => {
        const raw = init.body;
        const which = Number((raw.match(/This is photo (\d+) of/) || [])[1] || 1);
        const model = decodeURIComponent((url.match(/models\/([^:]+):/) || [])[1] || '');
        calls.push(model || url);
        if (url.includes('generativelanguage') && busy(model) && photoBusy(which)) {
            return { ok: false, status: 503, json: async () => ({ error: { message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.' } }) };
        }
        return ok(url, init);
    };
}

test('Gemini busy: waits, then tries the next free model', async () => {
    const calls = [];
    const out = await readPages([photo(1)], { env: { GEMINI_API_KEY: 'k' }, waitMs: 1, fetchImpl: busyGemini(calls, (m) => m === 'gemini-flash-latest') });
    assert.ok(out.text.includes('Tolu'));
    // flash-latest twice (busy, one more try), then the next model
    assert.deepEqual(calls, ['gemini-flash-latest', 'gemini-flash-latest', 'gemini-flash-lite-latest']);
});

test('Gemini busy on every model: a clear message naming the photo, no raw Google text', async () => {
    await assert.rejects(
        readPages([photo(1), photo(2), photo(3)], { env: { GEMINI_API_KEY: 'k' }, waitMs: 1, fetchImpl: busyGemini([], () => true, { photoBusy: (n) => n === 3 }) }),
        (e) => /^Photo 3 could not be read\. Gemini: Google's free AI is very busy right now/.test(e.message) && !/Spikes in demand/.test(e.message),
    );
});

test('with Groq and Gemini keys, Groq reads first (same as the writer); Gemini steps in when Groq is down', async () => {
    const calls = [];
    const out = await readPages([photo(1)], { env: { GEMINI_API_KEY: 'k', GROQ_API_KEY: 'g' }, fetchImpl: fakeFetch(calls) });
    assert.match(calls[0].url, /groq/);
    assert.equal(out.readBy, 'Groq');
    // Groq down → Gemini
    const down = async (url, init) => (url.includes('groq') ? { ok: false, status: 503, json: async () => ({ error: { message: 'over capacity' } }) } : fakeFetch([])(url, init));
    const out2 = await readPages([photo(1)], { env: { GEMINI_API_KEY: 'k', GROQ_API_KEY: 'g' }, fetchImpl: down });
    assert.equal(out2.readBy, 'Gemini');
    // PHOTO_AI puts one first
    const c3 = [];
    await readPages([photo(1)], { env: { GEMINI_API_KEY: 'k', GROQ_API_KEY: 'g', PHOTO_AI: 'gemini' }, fetchImpl: fakeFetch(c3) });
    assert.match(c3[0].url, /generativelanguage/);
});

test('the writing step on Gemini also moves to another model when busy', async () => {
    const { formatStory } = require('./storyFormatter');
    const calls = [];
    const r = await formatStory('Tolu, 15, had ₦10,000 on Monday and ₦650 by Friday. She tracked every naira for a week.', { env: { GEMINI_API_KEY: 'k' }, fetchImpl: busyGemini(calls, (m) => m === 'gemini-flash-latest') });
    assert.equal(r.source, 'ai');
    assert.ok(calls.includes('gemini-flash-lite-latest'));
});

test('Groq: a retired picture model hands the photo to Gemini, and the message is about the real problem', async () => {
    // Groq answers "model does not exist" for every model; Gemini reads it
    const f = async (url, init) => (url.includes('groq')
        ? { ok: false, status: 404, json: async () => ({ error: { message: 'The model `qwen/qwen3.6-27b` does not exist or you do not have access to it.', code: 'model_not_found' } }) }
        : fakeFetch([])(url, init));
    const out = await readPages([photo(1)], { env: { GROQ_API_KEY: 'g', GEMINI_API_KEY: 'k' }, fetchImpl: f });
    assert.equal(out.readBy, 'Gemini');
    // only Groq: says which setting to change
    await assert.rejects(readPages([photo(1)], { env: { GROQ_API_KEY: 'g' }, fetchImpl: f }), /GROQ_VISION_MODEL/);
});

test('free services read the photos one by one; Claude reads them all at once', async () => {
    let open = 0, most = 0;
    const slowOk = (inner) => async (url, init) => { open++; most = Math.max(most, open); await new Promise((r) => setTimeout(r, 20)); try { return await inner(url, init); } finally { open--; } };
    await readPages([photo(1), photo(2), photo(3)], { env: { GROQ_API_KEY: 'g' }, fetchImpl: slowOk(fakeFetch([])) });
    assert.equal(most, 1);
    most = 0;
    await readPages([photo(1), photo(2), photo(3)], { env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl: slowOk(fakeFetch([])) });
    assert.equal(most, 3);
});

test('PDF pages with real text: no AI reading, the text is used as it is', async () => {
    const calls = [];
    const pdfPage = (text, extra = {}) => ({ text, ...extra });
    const out = await readPages([
        pdfPage('## 2. The Manifesto\n\nA promise is easy. A plan shows seriousness.', { accent: '#2E7D32' }),
        pdfPage("## 1. What's an Election?\n\nAn election is how citizens choose the people they want to represent and lead them.", { pictures: [{ box: [0.1, 0.5, 0.4, 0.3], role: 'cover', caption: '' }] }),
    ], { env: {}, fetchImpl: fakeFetch(calls) });
    assert.equal(calls.length, 0); // nothing was sent to an AI, and no key was needed
    assert.ok(out.text.indexOf('## 1.') < out.text.indexOf('## 2.')); // put in section order
    assert.equal(out.readBy, 'the PDF text');
    assert.equal(out.accent, '#16A34A');
    assert.deepEqual(out.design?.pictures ?? out.pictures.map((p) => [p.photo, p.role]), [[2, 'cover']]);
});

test('a mix of a PDF text page and a photo: only the photo is read by the AI', async () => {
    const calls = [];
    const out = await readPages([{ text: 'Page one of the article, copied exactly from the design file PDF.' }, photo(2)], { env: { GROQ_API_KEY: 'g' }, fetchImpl: fakeFetch(calls) });
    assert.equal(calls.length, 1);
    assert.match(out.readBy, /the PDF text/);
    assert.match(out.readBy, /Groq/);
    assert.ok(out.text.startsWith('Page one of the article'));
});

test('story from PDF text pages with no AI key at all: the basic layout still works', async () => {
    const r = await storyFromPages([{ text: 'Dangote vs Nobody?\n\nSo, quick one: Dangote refinery supplies more than 90% of Nigeria’s petrol. Government has stopped issuing import licences.' }], { env: {} });
    assert.equal(r.source, 'basic');
    assert.match(r.story.title, /Dangote vs Nobody/);
});

test('Groq fails, then Gemini fails: the message shows what BOTH said (the backup never hides the first)', async () => {
    const f = async (url) => (url.includes('groq')
        ? { ok: false, status: 400, json: async () => ({ error: { message: 'model qwen/qwen3.6-27b is not available on your plan' } }) }
        : { ok: false, status: 404, json: async () => ({ error: { message: 'This model models/gemini-2.5-flash-lite is no longer available to new users.' } }) });
    await assert.rejects(readPages([photo(1)], { env: { GROQ_API_KEY: 'g', GEMINI_API_KEY: 'k' }, waitMs: 1, fetchImpl: f }),
        (e) => /could not be read\. Groq: .*not available on your plan.* · Gemini: /.test(e.message));
});
