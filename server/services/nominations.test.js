const test = require('node:test');
const assert = require('node:assert');
const { cleanNomination, publicNominee } = require('./nominations');

const good = {
    nomineeName: ' Ada Obi ', nomineeAge: '15', category: 'Tech & Innovation', schoolName: 'School A', city: 'Lagos', state: 'Lagos',
    headline: 'Built a solar phone charger from scrap', story: 'Ada collected old solar panels and built a charger her whole street now uses. She taught three friends to build one too.',
    links: 'https://example.com/ada not-a-link', nominatorName: 'Mrs Bello', relationship: 'Teacher', nominatorEmail: 'Bello@School.ng', consent: true,
};

test('a good nomination is cleaned', () => {
    const { data, error } = cleanNomination(good);
    assert.equal(error, undefined);
    assert.equal(data.nomineeName, 'Ada Obi');
    assert.equal(data.nomineeAge, 15);
    assert.deepEqual(data.links, ['https://example.com/ada']);
    assert.equal(data.nominatorEmail, 'bello@school.ng');
});

test('nominations need a category, a real story, a way to reach you and consent', () => {
    assert.match(cleanNomination({ ...good, category: 'Gossip' }).error, /category/);
    assert.match(cleanNomination({ ...good, story: 'Too short.' }).error, /more/);
    assert.match(cleanNomination({ ...good, nominatorEmail: '', nominatorPhone: '' }).error, /email or phone/);
    assert.match(cleanNomination({ ...good, consent: false }).error, /consent/);
    assert.match(cleanNomination({ ...good, nomineeAge: 3 }).error, /Age/);
});

test('the public wall never shows contact details or the full story', () => {
    const pub = publicNominee({ _id: 'x', ...cleanNomination(good).data, featureBlurb: 'Solar queen ☀️' });
    assert.equal(pub.nominatorEmail, undefined);
    assert.equal(pub.story, undefined);
    assert.equal(pub.blurb, 'Solar queen ☀️');
});
