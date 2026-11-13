// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeProgress, nextStreak, currentStreak, requiredSeconds } = require('./reading');
const { dayKey, daysBetween } = require('../utils/dates');

test('a story is not read until time AND scroll are reached', () => {
    const t0 = new Date('2026-11-06T10:00:00Z');
    let p = mergeProgress({}, { activeSeconds: 5, scrollDepth: 0.3 }, 4, t0);
    assert.equal(p.completed, false);
    p = mergeProgress(p, { activeSeconds: 80, scrollDepth: 0.75 }, 4, new Date(t0.getTime() + 80e3));
    assert.equal(p.completed, true);
    assert.equal(p.justCompleted, true);
    const again = mergeProgress(p, { activeSeconds: 90, scrollDepth: 1 }, 4, new Date(t0.getTime() + 95e3));
    assert.equal(again.justCompleted, false); // points only once
});

test('cannot fake reading time faster than the clock', () => {
    const p = mergeProgress({}, { activeSeconds: 600, scrollDepth: 1 }, 4, new Date('2026-11-06T10:00:00Z'));
    assert.ok(p.activeSeconds <= 15);
    assert.equal(p.completed, false);
});

test('required seconds has a floor', () => {
    assert.equal(requiredSeconds(1), 20);
    assert.equal(requiredSeconds(4), 72);
});

test('streaks: same day, next day, gap', () => {
    assert.equal(nextStreak({}, '2026-11-06').streak, 1);
    assert.equal(nextStreak({ streak: 3, lastActiveDay: '2026-11-06' }, '2026-11-06').streak, 3);
    assert.equal(nextStreak({ streak: 3, lastActiveDay: '2026-11-05' }, '2026-11-06').streak, 4);
    assert.equal(nextStreak({ streak: 9, lastActiveDay: '2026-11-01' }, '2026-11-06').streak, 1);
    assert.equal(currentStreak({ streak: 5, lastActiveDay: '2026-11-04' }, '2026-11-06'), 0);
});

test('days use Lagos time', () => {
    assert.equal(dayKey(new Date('2026-11-05T23:30:00Z')), '2026-11-06'); // 00:30 in Lagos
    assert.equal(daysBetween('2026-10-31', '2026-11-01'), 1);
});
