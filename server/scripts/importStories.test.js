const test = require('node:test');
const assert = require('node:assert');
const { parseArgs, vocabUsed, missingVocab, missingCategories, storyData } = require('./importStories');
const { articles } = require('./content/articles');
const { october2026 } = require('./content/october2026');

test('every story is complete', () => {
    const slugs = new Set();
    articles.forEach((a) => {
        assert.ok(a.slug && a.title && a.section && a.body?.length, `incomplete: ${a.slug}`);
        assert.ok(!slugs.has(a.slug), `duplicate slug ${a.slug}`); slugs.add(a.slug);
        assert.match(a.slug, /^[a-z0-9-]+$/);
    });
});

test('every [[word]] has a meaning (story vocab or word bank)', () => {
    const { unknown } = missingVocab(articles, [], october2026.vocab);
    assert.deepStrictEqual(unknown, []);
});

test('vocab already in the volume is not added twice; aliases and plurals match', () => {
    const story = { body: ['An [[EV]] and two [[Concepts]] and [[electric vehicle]]'], vocab: [
        { word: 'Electric vehicle', aliases: ['EV'] }, { word: 'Concept' }] };
    assert.deepStrictEqual(vocabUsed(story), ['EV', 'Concepts', 'electric vehicle']);
    const { add } = missingVocab([story], [{ word: 'concept' }], []);
    assert.deepStrictEqual(add.map((v) => v.word), ['Electric vehicle']);
});

test('missing categories are added once, existing kept', () => {
    const add = missingCategories([{ section: 'stars', sectionLabel: 'NEXTGEN STARS' }, { section: 'stars' }, { section: 'money' }], [{ key: 'money' }]);
    assert.strictEqual(add.length, 1);
    assert.strictEqual(add[0].key, 'stars');
    assert.strictEqual(add[0].label, 'NEXTGEN STARS');
});

test('import data never carries image, gallery or status', () => {
    const d = storyData({ slug: 's', title: 't', image: '/x.jpg', gallery: [1], status: 'published', homepageFeatured: true, body: ['b'] }, 'vol');
    assert.deepStrictEqual(Object.keys(d).sort(), ['body', 'edition', 'slug', 'title']);
});

test('options', () => {
    assert.deepStrictEqual(parseArgs(['--publish', '--edition', 'v4']), { publish: true, update: false, edition: 'v4', only: null, admin: null });
    assert.throws(() => parseArgs(['--nope']));
});
