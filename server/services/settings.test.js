const test = require('node:test');
const assert = require('node:assert');
const { mergeSettings } = require('./settings');

test('Big News line-up: always 3 spots, slugs cleaned, no story twice, empty = automatic', () => {
    assert.deepEqual(mergeSettings({}).home.bigNews, ['', '', '']);
    assert.deepEqual(mergeSettings({ home: { bigNews: ['Fuel-Prices', 'fuel-prices', 'nigeria-2027 '] } }).home.bigNews, ['fuel-prices', '', 'nigeria-2027']);
    assert.deepEqual(mergeSettings({ home: { bigNews: ['a', 'b', 'c', 'd'] } }).home.bigNews, ['a', 'b', 'c']);
    assert.deepEqual(mergeSettings({ home: { bigNews: 'oops' } }).home.bigNews, ['', '', '']);
    // Fresh stories line-up works the same way, separately
    assert.deepEqual(mergeSettings({}).home.fresh, ['', '', '']);
    assert.deepEqual(mergeSettings({ home: { fresh: ['A', 'a', 'b'], bigNews: ['z'] } }).home.fresh, ['a', '', 'b']);
    assert.deepEqual(mergeSettings({ home: { fresh: ['A'], bigNews: ['z'] } }).home.bigNews, ['z', '', '']);
    // the hero settings are kept as they were
    assert.equal(mergeSettings({ home: { heroMax: 3, bigNews: ['x'] } }).home.heroMax, 3);
});
