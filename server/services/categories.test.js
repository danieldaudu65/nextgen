const test = require('node:test');
const assert = require('node:assert');
const { cleanCategory, inCategory, articleFilter, DEFAULT_CATEGORIES, slugify, fromSection, titleCase } = require('./categories');
const { mergeSettings } = require('./settings');

test('cleanCategory makes a safe category from the admin form', () => {
    const c = cleanCategory({ name: '  Tech & Gadgets ', desc: 'x'.repeat(300), accent: '#abcdef', icon: 'tech', sections: 'Tech, tech-pulse,,TECH' });
    assert.equal(c.name, 'Tech & Gadgets');
    assert.equal(c.slug, 'tech-and-gadgets');
    assert.equal(c.desc.length, 160);
    assert.equal(c.accent, '#ABCDEF');
    assert.deepEqual(c.sections, ['tech', 'tech-pulse']);
    assert.equal(c.active, true);
});

test('cleanCategory rejects a missing name and fixes bad colour / icon', () => {
    assert.ok(cleanCategory({ name: '  ' }).error);
    const c = cleanCategory({ name: 'Sports', accent: 'red', icon: 'rocket' });
    assert.equal(c.accent, '#FFD400');
    assert.equal(c.icon, 'news');
});

test('partial updates only touch what was sent; renaming keeps the section key', () => {
    assert.deepEqual(cleanCategory({ active: false }, { partial: true }), { active: false });
    assert.deepEqual(cleanCategory({ name: 'Tech News' }, { partial: true }), { name: 'Tech News' });
    assert.equal(cleanCategory({ link: 'javascript:alert(1)' }, { partial: true }).link, '');
    assert.equal(cleanCategory({ link: '/#arcade' }, { partial: true }).link, '/#arcade');
});

test('the categories are the edition sections', () => {
    assert.deepEqual(DEFAULT_CATEGORIES.map((c) => c.slug), ['big-news', 'money', 'tech', 'pop', 'stars', 'toons', 'crack', 'vocab', 'debate']);
    assert.deepEqual(DEFAULT_CATEGORIES.slice(0, 5).map((c) => c.name), ['The Big News', 'Money Matters', 'Tech Pulse', 'Pop Culture', 'NextGen Stars']);
    assert.equal(DEFAULT_CATEGORIES.find((c) => c.slug === 'crack').link, '/#arcade');
    const c = fromSection({ key: 'Sports Corner', label: 'SPORTS CORNER', genz: 'Goals only ⚽' }, 4);
    assert.deepEqual([c.slug, c.name, c.desc, c.order, c.active], ['sports-corner', 'Sports Corner', 'Goals only ⚽', 4, true]);
    assert.equal(titleCase('NEXTGEN STARS'), 'NextGen Stars');
});

test('a story joins its section category (and extra sections / matching labels)', () => {
    const tech = DEFAULT_CATEGORIES.find((c) => c.slug === 'tech');
    const money = DEFAULT_CATEGORIES.find((c) => c.slug === 'money');
    assert.ok(inCategory(tech, 'tech', 'TECH PULSE'));
    assert.ok(inCategory(money, 'money', 'MONEY MATTERS'));
    assert.ok(inCategory(money, 'old-key', 'MONEY MATTERS'));
    assert.ok(!inCategory(tech, 'money', 'MONEY MATTERS'));
    assert.ok(inCategory({ ...tech, sections: ['gadgets'] }, 'gadgets', 'GADGETS'));
    const f = articleFilter({ slug: 'money', name: 'Money Matters', sections: [] });
    assert.deepEqual(f.$or[0].section.$in, ['money']);
    assert.ok(f.$or[1].sectionLabel.test('MONEY MATTERS') && !f.$or[1].sectionLabel.test('money'));
    assert.ok(articleFilter({ slug: 'x', name: 'Rock & Roll', sections: [] }).$or[1].sectionLabel.test('rock and roll'));
});

test('slugify handles accents and symbols', () => assert.equal(slugify('Épée & Fun!'), 'epee-and-fun'));

test('homepage hero settings: defaults and limits', () => {
    assert.deepEqual(mergeSettings({}).home, { heroMax: 5, heroSeconds: 7 });
    assert.deepEqual(mergeSettings({ home: { heroMax: 99, heroSeconds: 1 } }).home, { heroMax: 10, heroSeconds: 3 });
});
