// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { bossQuestions, publicBoss, checkBoss, bossStars, cleanStars, currentLevel, isOpen } = require('./world');

const ed = {
    slug: 'oct-2026',
    vocab: [
        { word: 'Electorate', definition: 'All the people who can vote.' },
        { word: 'Manifesto', definition: 'A plan of what a party will do.' },
        { word: 'Incumbent', definition: 'The person who already holds the job.' },
        { word: 'Policy', definition: 'A plan for dealing with a problem.' },
        { word: 'PVC', definition: "Permanent Voter's Card." },
    ],
    quiz: [
        { id: 'q1', question: '372 out of 400 is?', options: ['83%', '88%', '93%', '97%'], answer: 2 },
        { id: 'q2', question: 'Which weapon?', options: ['Foil', 'Sabre', 'Épée'], answer: 2 },
    ],
};

test('the Boss has 5 questions, the same ones every time', () => {
    const a = bossQuestions(ed), b = bossQuestions(ed);
    assert.equal(a.length, 5);
    assert.deepEqual(a, b);
    a.forEach((q) => assert.equal(typeof q.options[q.answer], 'string'));
});

test('Boss answers never go to the browser', () => {
    publicBoss(ed).forEach((q) => assert.equal('answer' in q, false));
});

test('checking the Boss: right answers win, wrong ones do not', () => {
    const qs = bossQuestions(ed);
    const all = checkBoss(ed, qs.map((q) => ({ id: q.id, choice: q.answer })));
    assert.equal(all.right, 5);
    assert.equal(all.stars, 3);
    const none = checkBoss(ed, qs.map((q) => ({ id: q.id, choice: (q.answer + 1) % q.options.length })));
    assert.equal(none.right, 0);
    assert.equal(none.stars, 0);
    assert.equal(checkBoss(ed, 'nonsense').right, 0);
});

test('Boss stars: 3 right to win', () => {
    assert.equal(bossStars(2, 5), 0);
    assert.equal(bossStars(3, 5), 1);
    assert.equal(bossStars(4, 5), 2);
    assert.equal(bossStars(5, 5), 3);
});

test('levels open in order', () => {
    const s = cleanStars({ money: 3, quiz: 1, debate: 9, sort: -2 });
    assert.equal(s.debate, 3);
    assert.equal(s.sort, 0);
    assert.equal(currentLevel({}), 0);
    assert.equal(currentLevel({ money: 2 }), 1);
    assert.equal(isOpen({ money: 2 }, 'quiz'), true);
    assert.equal(isOpen({ money: 2 }, 'debate'), false);
    assert.equal(isOpen({}, 'boss'), false);
    assert.equal(currentLevel({ money: 1, quiz: 1, debate: 1, sort: 1, promise: 1, wordsearch: 1, boss: 1 }), 7);
});
