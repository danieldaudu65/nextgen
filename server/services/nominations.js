// Checking a nomination form (pure, easy to test)
const CATEGORIES = ['Academics', 'Sports', 'Arts & Music', 'Tech & Innovation', 'Leadership', 'Business', 'Community', 'Other'];
const RELATIONSHIPS = ['Teacher', 'Parent / guardian', 'Friend', 'Classmate', 'Myself', 'Other'];

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const validUrl = (u) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(u);

// → { data } or { error }
function cleanNomination(body = {}) {
    const d = {
        nomineeName: str(body.nomineeName, 80),
        nomineeAge: body.nomineeAge === '' || body.nomineeAge == null ? null : Math.round(Number(body.nomineeAge)),
        category: str(body.category, 40),
        schoolName: str(body.schoolName, 120) || null,
        city: str(body.city, 60) || null,
        state: str(body.state, 60) || null,
        photo: str(body.photo, 400) || null,
        headline: str(body.headline, 140),
        story: str(body.story, 3000),
        links: (Array.isArray(body.links) ? body.links : String(body.links || '').split(/\s+/)).map((l) => str(l, 300)).filter(validUrl).slice(0, 5),
        nominatorName: str(body.nominatorName, 80),
        relationship: str(body.relationship, 60) || null,
        nominatorEmail: str(body.nominatorEmail, 120).toLowerCase() || null,
        nominatorPhone: str(body.nominatorPhone, 30) || null,
        consent: body.consent === true || body.consent === 'true',
    };
    if (d.nomineeName.length < 2) return { error: "Who is the star? Add their name." };
    if (d.nomineeAge !== null && (!Number.isFinite(d.nomineeAge) || d.nomineeAge < 5 || d.nomineeAge > 30)) return { error: 'Age should be between 5 and 30.' };
    if (!CATEGORIES.includes(d.category)) return { error: 'Pick a category.' };
    if (d.headline.length < 8) return { error: 'Add a one-line headline about what they did.' };
    if (d.story.length < 60) return { error: 'Tell us a bit more about what they did (at least a few sentences).' };
    if (d.nominatorName.length < 2) return { error: 'Add your name.' };
    if (!d.nominatorEmail && !d.nominatorPhone) return { error: 'Add an email or phone number so we can reach you.' };
    if (d.nominatorEmail && !validEmail(d.nominatorEmail)) return { error: 'That email does not look right.' };
    if (d.photo && !validUrl(d.photo)) d.photo = null;
    if (!d.consent) return { error: "Tick the consent box: the star's parent or guardian (or the star, if 18+) must agree." };
    return { data: d };
}

// What the public "wall of stars" may show about a featured nominee (no contact details, no full story)
const publicNominee = (n) => ({
    id: String(n._id), kind: 'nominee', name: n.nomineeName, age: n.nomineeAge, category: n.category,
    school: n.schoolName, place: [n.city, n.state].filter(Boolean).join(', ') || null,
    photo: n.photo, headline: n.headline, blurb: n.featureBlurb || null,
});

module.exports = { CATEGORIES, RELATIONSHIPS, cleanNomination, publicNominee };
