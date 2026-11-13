const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const A = require('./access');
const S = require('./settings');
const R = require('./readCheck');
const P = require('./paystack');
const { rangeMatch } = require('./leaderboardRange');

test('codes are 8 easy-to-read characters, and cleanCode tidies typing', () => {
    const c = A.makeCode();
    assert.match(c, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    assert.equal(A.cleanCode(' abcd-2345 '), 'ABCD2345');
    assert.equal(A.cleanDevice('short'), null);
    assert.equal(A.cleanDevice('dev_1234abcd'), 'dev_1234abcd');
});

test('access: only with a type and a future end date', () => {
    const now = new Date('2026-11-13T10:00:00Z');
    assert.equal(A.hasAccess({}, now), false);
    assert.equal(A.hasAccess({ access: { type: 'school', until: '2026-11-12' } }, now), false);
    assert.equal(A.hasAccess({ access: { type: 'personal', until: '2027-01-01' } }, now), true);
});

test('device lock: school-code accounts lock to the first device', () => {
    assert.equal(A.deviceCheck({}, 'devA12345'), 'ok');
    assert.equal(A.deviceCheck({ accessCode: 'x' }, 'devA12345'), 'bind');
    assert.equal(A.deviceCheck({ accessCode: 'x', deviceId: 'devA12345' }, 'devA12345'), 'ok');
    assert.equal(A.deviceCheck({ accessCode: 'x', deviceId: 'devA12345' }, 'devB12345'), 'locked');
});

test('codeProblem explains why a code cannot be used', () => {
    const now = new Date('2026-11-13');
    const sch = { accessUntil: '2027-11-13' };
    assert.equal(A.codeProblem({ status: 'unused' }, sch, now), null);
    assert.match(A.codeProblem(null, sch, now), /does not exist/);
    assert.match(A.codeProblem({ status: 'used' }, sch, now), /already been used/);
    assert.match(A.codeProblem({ status: 'unused' }, { accessUntil: '2026-01-01' }, now), /ended/);
});

test('renewals stack on the time left', () => {
    const now = new Date('2026-11-13T00:00:00Z');
    assert.equal(A.extendUntil(null, 10, now).toISOString(), '2026-11-23T00:00:00.000Z');
    assert.equal(A.extendUntil('2026-12-01T00:00:00Z', 10, now).toISOString(), '2026-12-11T00:00:00.000Z');
    assert.equal(A.seatsLeft({ seats: 100 }, 30), 70);
});

test('settings: defaults fill gaps, bad values are clamped', () => {
    const s = S.mergeSettings({ leaderboard: { range: 'nonsense', size: 999 }, reading: { readSeconds: '90' }, schoolPlans: [{ name: 'Big School', seats: 500, price: 900000 }] });
    assert.equal(s.leaderboard.range, 'volume');
    assert.equal(s.leaderboard.size, 50);
    assert.equal(s.reading.readSeconds, 90);
    assert.equal(s.reading.questionSeconds, 60);
    assert.deepEqual(s.schoolPlans, [{ id: 'plan-1', name: 'Big School', seats: 500, price: 900000, days: 365 }]);
    assert.equal(S.readSecondsFor(S.mergeSettings({}), 4), 120);
    assert.equal(S.mergeSettings({}).personalPlans.length, 3);
    // old single-price settings become one package
    assert.deepEqual(S.mergeSettings({ access: { personalPrice: 2000, personalDays: 365 } }).personalPlans, [{ id: 'yearly', name: 'Yearly', price: 2000, days: 365 }]);
    assert.equal(S.mergeSettings({ personalPlans: [{ name: 'Weekly', price: 150, days: 7, seats: 9 }] }).personalPlans[0].seats, undefined);
    assert.equal(S.readSecondsFor(S.mergeSettings({ reading: { mode: 'story' } }), 4), 240);
});

test('story question: one try + one retry, with a timer', () => {
    const cfg = { questionSeconds: 60, retries: 1 };
    const t0 = new Date('2026-11-13T10:00:00Z');
    const at = (s) => new Date(t0.getTime() + s * 1000);
    assert.equal(R.questionState({}, cfg, t0).status, 'ready');
    const open = { qAttempts: 1, qStartedAt: t0 };
    assert.equal(R.questionState(open, cfg, at(30)).status, 'open');
    assert.equal(R.questionState(open, cfg, at(30)).secondsLeft, 30);
    assert.equal(R.questionState(open, cfg, at(70)).status, 'ready'); // timed out → retry available
    assert.equal(R.questionState({ qAttempts: 2, qStartedAt: t0 }, cfg, at(70)).status, 'out');
    assert.equal(R.questionState({ qDone: true }, cfg, t0).status, 'done');
    const q = { prompt: 'Q', options: ['a', 'b', 'c'], answer: 2 };
    assert.equal(R.gradeAnswer(open, q, 2, cfg, at(10)).correct, true);
    assert.equal(R.gradeAnswer(open, q, 0, cfg, at(10)).triesLeft, 1);
    assert.equal(R.gradeAnswer(open, q, 2, cfg, at(80)).ok, false);
    assert.equal(R.publicQuestion(q).answer, undefined);
    assert.equal(R.validQuestion({ prompt: 'Q', options: ['a'], answer: 0 }), null);
    assert.deepEqual(R.validQuestion({ prompt: ' Q ', options: ['a', '', 'b'], answer: 1 }), { prompt: 'Q', options: ['a', 'b'], answer: 1, explain: '' });
});

test('Paystack: demo mode without a key, and webhook signatures', async () => {
    assert.equal(P.demoMode({}), true);
    const r = await P.initialize({ email: 'a@b.co', amount: 2000, reference: 'NG-1', callbackUrl: 'http://site.test/pay/callback?x=1' }, { env: {} });
    assert.equal(r.url, 'http://site.test/pay/demo?reference=NG-1');
    let sent;
    const live = await P.initialize({ email: 'a@b.co', amount: 2000, reference: 'NG-2', callbackUrl: 'http://site.test/pay/callback' }, {
        env: { PAYSTACK_SECRET_KEY: 'sk_test' },
        fetchImpl: async (url, o) => { sent = { url, body: JSON.parse(o.body), auth: o.headers.authorization }; return { ok: true, json: async () => ({ status: true, data: { authorization_url: 'https://checkout.paystack.com/x', reference: 'NG-2' } }) }; },
    });
    assert.equal(live.url, 'https://checkout.paystack.com/x');
    assert.equal(sent.body.amount, 200000); // kobo
    assert.equal(sent.auth, 'Bearer sk_test');
    const body = Buffer.from('{"event":"charge.success"}');
    const sig = crypto.createHmac('sha512', 'sk_test').update(body).digest('hex');
    assert.equal(P.validSignature(body, sig, 'sk_test'), true);
    assert.equal(P.validSignature(body, 'bad', 'sk_test'), false);
});

test('leaderboard range: volume, whole edition (year), week, all', () => {
    const eds = [{ slug: 'oct-2026', year: 2026, status: 'current', volume: 'Volume 4' }, { slug: 'jul-2026', year: 2026, status: 'archive' }, { slug: 'oct-2025', year: 2025, status: 'archive' }];
    const vol = rangeMatch('volume', eds).match;
    assert.deepEqual(vol.$or[0], { edition: 'oct-2026' });
    // older points (no edition field) match by the start of their ref
    const re = new RegExp(vol.$or[1].ref.$regex);
    assert.ok(re.test('oct-2026:whats-an-election') && re.test('oct-2026') && !re.test('oct-2026-x:y') && !re.test('jul-2026:a'));
    assert.deepEqual(rangeMatch('edition', eds).match.$or[0], { edition: { $in: ['oct-2026', 'jul-2026'] } });
    assert.equal(rangeMatch('edition', eds).label, '2026 edition');
    assert.ok(rangeMatch('week', eds).match.createdAt.$gte instanceof Date);
    assert.deepEqual(rangeMatch('all', eds).match, {});
});
