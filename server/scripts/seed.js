// ===============================
// Seed the database
// Usage: npm run seed
// ===============================
// - Adds demo editions if they are missing + refreshes the sample debate
// - Replaces SAMPLE schools / students / points (sample: true)
// - Preserves article records, real students and schools
// ===============================

require('dotenv').config();
require('../config/secrets').checkRequiredEnv();
require('../config/dns');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const edition = require('../models/edition');
const debate = require('../models/debate');
const debateVote = require('../models/debateVote');
const school = require('../models/school');
const student = require('../models/student');
const pointsEvent = require('../models/pointsEvent');
const readProgress = require('../models/readProgress');
const accessCode = require('../models/accessCode');
const schoolAccount = require('../models/schoolAccount');
const payment = require('../models/payment');
const nomination = require('../models/nomination');
const { makeCode } = require('../services/access');
const { dayKey } = require('../utils/dates');
const content = require('./content/october2026');

const SCHOOLS = [
    ['School A', 'Lagos', 'Lagos'],
    ['School B', 'Abuja', 'FCT'],
    ['School C', 'Ibadan', 'Oyo'],
    ['School D', 'Kano', 'Kano'],
    ['School E', 'Enugu', 'Enugu'],
];
const HANDLES = ['amaka.reads', 'tobi_codes', 'zainab.xyz', 'deji.builds', 'ife.writes', 'musa.math', 'ada.dev', 'kene.kicks', 'bisi.blogs', 'yusuf.yap'];
const COLORS = ['#F5C518', '#2F7DE1', '#E0457B', '#2FA36B', '#6B4FD8'];
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    // ===============================
    // Content
    // ===============================
    await Promise.all([debate.deleteMany({}), debateVote.deleteMany({})]);

    const others = content.editions
        .filter((e) => e.slug !== content.october2026.slug)
        .map((e, i) => ({ ...e, publishedAt: new Date(Date.UTC(2026, 9 - (i + 1), 1)) }));

    const demoEditions = [{ ...content.october2026, publishedAt: new Date(Date.UTC(2026, 9, 1)) }, ...others];
    await Promise.all(demoEditions.map((data) => edition.updateOne({ slug: data.slug }, { $setOnInsert: data }, { upsert: true })));

    const { id, ...debateData } = content.debate;
    await debate.create({ ...debateData, edition: content.october2026.slug, active: true });

    // ===============================
    // Sample schools + students
    // ===============================
    const oldSamples = await student.find({ sample: true }, '_id');
    const ids = oldSamples.map((s) => s._id);
    await Promise.all([
        pointsEvent.deleteMany({ student: { $in: ids } }),
        readProgress.deleteMany({ student: { $in: ids } }),
        student.deleteMany({ sample: true }),
        school.deleteMany({ sample: true }),
        accessCode.deleteMany({ sample: true }),
        schoolAccount.deleteMany({ sample: true }),
        payment.deleteMany({ sample: true }),
        nomination.deleteMany({ sample: true }),
    ]);

    // Schools A–C have a paid plan (demo), D–E have none yet
    const yearFromNow = new Date(Date.now() + 365 * 864e5);
    const schools = await school.create(
        SCHOOLS.map(([name, city, state], i) => ({
            name, city, state, slug: slugify(`${name}-${city}`), sample: true, verified: i < 3,
            ...(i < 3 ? { plan: 'standard', seats: 100, accessUntil: yearFromNow } : {}),
            contactName: `Head of ${name}`,
            motto: ['Knowledge is light', 'Excellence and service', 'Learn, lead, serve', 'Faith and discipline', 'Rise and shine'][i],
            about: `${name} is a demo school on NextGen. Schools write their own story on the school dashboard (Profile tab).`,
            founded: 1960 + i * 9, schoolType: i % 2 ? 'private' : 'public',
        }))
    );

    const password = await bcrypt.hash('nextgen123', 10);
    // School dashboard logins: school-a@nextgen.demo … school-e@nextgen.demo / nextgen123
    await schoolAccount.create(schools.map((sch, i) => ({ school: sch._id, name: `Head of ${sch.name}`, email: `school-${'abcde'[i]}@nextgen.demo`, password, sample: true })));
    await payment.create(schools.slice(0, 3).map((sch, i) => ({ reference: `NGS-DEMO-${i + 1}`, kind: 'school', school: sch._id, plan: 'standard', seats: 100, days: 365, amount: 300000, email: `school-${'abcde'[i]}@nextgen.demo`, status: 'paid', provider: 'demo', paidAt: new Date(Date.now() - (20 - i * 5) * 864e5), appliedAt: new Date(), sample: true })));

    // Demo points go to the volume that is on the homepage now, so the "per volume" leaderboard shows them
    const live = await edition.findOne({ status: 'current' }, 'slug month').lean();
    const current = live?.slug || demoEditions[0].slug;
    console.log(`   Demo points are for the current volume: ${live ? `${live.month} (${current})` : current}`);
    const CLASSES = ['JSS3', 'SS1', 'SS2', 'SS3'];
    const ACTIONS = [['READ_STORY', 5], ['READ_QUESTION', 5], ['QUIZ_CORRECT', 10], ['GAME:money', 40], ['GAME:sort', 25], ['DEBATE_VOTE', 20]];
    const today = dayKey();

    for (const [i, handle] of HANDLES.entries()) {
        const mySchool = schools[i % schools.length];
        const withPlan = Boolean(mySchool.accessUntil);
        // students of paying schools joined with a code; one student paid for themselves; the rest have no access
        const code = withPlan ? await accessCode.create({ code: makeCode(), school: mySchool._id, status: 'used', className: CLASSES[i % 4], usedAt: new Date(), sample: true }) : null;
        const personal = !withPlan && i === 3;

        const user = await student.create({
            name: handle.split(/[._]/)[0].replace(/^./, (c) => c.toUpperCase()),
            handle,
            password,
            school: mySchool._id,
            className: CLASSES[i % 4],
            color: COLORS[i % COLORS.length],
            streak: Math.max(1, 5 - i),
            bestStreak: 5,
            lastActiveDay: today,
            accessCode: code?._id || null,
            access: withPlan ? { type: 'school', until: yearFromNow } : personal ? { type: 'personal', until: yearFromNow } : { type: null, until: null },
            sample: true,
        });
        if (code) await accessCode.updateOne({ _id: code._id }, { $set: { student: user._id } });
        if (personal) await payment.create({ reference: `NGP-DEMO-${i}`, kind: 'personal', student: user._id, amount: 2000, days: 365, email: 'parent@nextgen.demo', status: 'paid', provider: 'demo', paidAt: new Date(), appliedAt: new Date(), sample: true });

        // Points spread over the last 14 days, so the charts and leaderboards have shape
        if (withPlan || personal) {
            let total = 0;
            const rows = [];
            for (let d = 0; d < 14; d++) {
                const day = dayKey(new Date(Date.now() - d * 864e5));
                const n = (i + d) % 3;
                for (let k = 0; k <= n; k++) {
                    const [action, pts] = ACTIONS[(i + d + k) % ACTIONS.length];
                    rows.push({ student: user._id, school: mySchool._id, action, ref: `sample:${d}:${k}`, points: pts, day, edition: current, createdAt: new Date(Date.now() - d * 864e5) });
                    total += pts;
                }
            }
            await pointsEvent.insertMany(rows);
            await student.updateOne({ _id: user._id }, { $set: { points: total } });
            await school.updateOne({ _id: mySchool._id }, { $inc: { points: total, studentCount: 1 } });
        } else {
            await school.updateOne({ _id: mySchool._id }, { $inc: { studentCount: 1 } });
        }
    }

    // Demo nominations (made-up people, no photos): one featured on the Nominate a Star page
    await nomination.create([
        { nomineeName: 'Demo Star', nomineeAge: 15, category: 'Tech & Innovation', schoolName: 'School A', city: 'Lagos', state: 'Lagos', headline: 'Built a solar phone charger from scrap parts', story: 'A demo nomination so you can see how the Nominate a Star page and the admin review work. Replace it with real ones.', nominatorName: 'Demo Teacher', relationship: 'Teacher', nominatorEmail: 'teacher@nextgen.demo', consent: true, status: 'featured', featureBlurb: 'Turning scrap into power ☀️', sample: true },
        { nomineeName: 'Demo Runner', nomineeAge: 16, category: 'Sports', schoolName: 'School B', city: 'Abuja', state: 'FCT', headline: 'Won the state 400m final', story: 'Another demo nomination, waiting for review in Admin → Nominations. Shortlist it, feature it or decline it.', nominatorName: 'Demo Coach', relationship: 'Teacher', nominatorPhone: '08000000000', consent: true, status: 'new', sample: true },
    ]);

    // A few spare (unused) codes for each paying school
    for (const sch of schools.filter((x) => x.accessUntil)) {
        await accessCode.create(Array.from({ length: 5 }, () => ({ code: makeCode(), school: sch._id, className: 'SS1', sample: true })));
    }

    const demoPoints = await pointsEvent.countDocuments({ ref: /^sample:/ });
    console.log(`   ${demoPoints} demo point records added (14 days)`);
    console.log(`🌱 Seeded ${1 + others.length} demo editions, no articles, 1 debate, ${schools.length} sample schools, ${HANDLES.length} sample students`);
    console.log('   Student login: handle "amaka.reads", password "nextgen123"');
    console.log('   School dashboard: school-a@nextgen.demo / nextgen123 (has a plan), school-d@nextgen.demo (no plan yet)');
    const spare = await accessCode.findOne({ sample: true, status: 'unused' }).lean();
    if (spare) console.log(`   Try joining with a school code: /join?code=${spare.code}`);
    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('❌ Seed failed:', err);
    await mongoose.disconnect();
    process.exit(1);
});
