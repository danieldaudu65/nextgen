const express = require('express');
const student = require('../models/student');
const school = require('../models/school');
const accessCode = require('../models/accessCode');
const pointsEvent = require('../models/pointsEvent');
const readProgress = require('../models/readProgress');
const payment = require('../models/payment');
const requireSchool = require('../middleware/schoolAuth');
const paystack = require('../services/paystack');
const { makeCode, seatsLeft } = require('../services/access');
const { getSettings } = require('../services/settings');
const { schoolSummary } = require('../services/schoolView');
const { dayKey, startOfWeek } = require('../utils/dates');
const { imageUpload, saveImage } = require('../services/imageStore');
const { READING_ACTIONS } = require('../config/rules');
const router = express.Router();

router.use(requireSchool);
const siteUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
const fail = (res, error, where) => { console.error(`School ${where} error:`, error); return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' }); };

// last N Lagos days as "YYYY-MM-DD", oldest first
const lastDays = (n) => Array.from({ length: n }, (_, i) => dayKey(new Date(Date.now() - (n - 1 - i) * 864e5)));


// ============================================================
// OVERVIEW (cards, charts, top students, classes, national rank)
// GET /school_dashboard/overview
// ============================================================
router.get('/overview', async (req, res) => {
    try {
        const sid = req.school._id;
        const days = lastDays(14);
        const [summary, rank, perDay, activeWeek, topStudents, classes, reads, questions] = await Promise.all([
            schoolSummary(req.school, req.account),
            school.countDocuments({ points: { $gt: req.school.points } }).then((n) => n + 1),
            pointsEvent.aggregate([
                { $match: { school: sid, day: { $gte: days[0] } } },
                { $group: { _id: { day: '$day', reading: { $in: ['$action', READING_ACTIONS] } }, points: { $sum: '$points' } } },
            ]),
            pointsEvent.distinct('student', { school: sid, createdAt: { $gte: startOfWeek() } }).then((a) => a.length),
            student.find({ school: sid }, 'name handle className points streak color').sort({ points: -1 }).limit(5).lean(),
            student.aggregate([
                { $match: { school: sid } },
                { $group: { _id: { $ifNull: ['$className', 'No class'] }, students: { $sum: 1 }, points: { $sum: '$points' } } },
                { $sort: { points: -1 } },
            ]),
            readProgress.aggregate([
                { $match: { completed: true, completedDay: { $gte: days[0] } } },
                { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 's' } },
                { $match: { 's.school': sid } },
                { $group: { _id: '$article', reads: { $sum: 1 } } },
                { $sort: { reads: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'articles', localField: '_id', foreignField: 'slug', as: 'a' } },
                { $project: { _id: 0, slug: '$_id', reads: 1, title: { $first: '$a.title' } } },
            ]),
            readProgress.aggregate([
                { $match: { qAnsweredAt: { $ne: null } } },
                { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 's' } },
                { $match: { 's.school': sid } },
                { $group: { _id: null, answered: { $sum: 1 }, correct: { $sum: { $cond: ['$qDone', 1, 0] } } } },
            ]),
        ]);
        const chart = days.map((d) => ({
            day: d,
            reading: perDay.find((x) => x._id.day === d && x._id.reading)?.points || 0,
            games: perDay.find((x) => x._id.day === d && !x._id.reading)?.points || 0,
        }));
        return res.status(200).json({
            success: true,
            school: summary,
            nationalRank: rank,
            activeThisWeek: activeWeek,
            chart,
            topStudents: topStudents.map((s) => ({ id: String(s._id), name: s.name, handle: s.handle, className: s.className, points: s.points, streak: s.streak, color: s.color })),
            classes: classes.map((c) => ({ className: c._id, students: c.students, points: c.points, average: c.students ? Math.round(c.points / c.students) : 0 })),
            topStories: reads,
            quiz: questions[0] ? { answered: questions[0].answered, correct: questions[0].correct } : { answered: 0, correct: 0 },
        });
    } catch (error) { return fail(res, error, 'overview'); }
});


// ============================================================
// STUDENTS
// GET  /school_dashboard/students?q=&className=
// POST /school_dashboard/students/:id/unlock   (new phone → clear the device lock)
// POST /school_dashboard/students/:id/remove   (leaves the school, loses school access, code cancelled)
// ============================================================
router.get('/students', async (req, res) => {
    try {
        const filter = { school: req.school._id };
        const q = String(req.query.q || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { handle: { $regex: q, $options: 'i' } }];
        if (req.query.className) filter.className = String(req.query.className);
        const list = await student.find(filter, 'name handle className points streak lastActiveDay color accessCode deviceId createdAt').sort({ points: -1 }).limit(500).lean();
        const codes = await accessCode.find({ _id: { $in: list.map((s) => s.accessCode).filter(Boolean) } }, 'code').lean();
        const codeOf = new Map(codes.map((c) => [String(c._id), c.code]));
        return res.status(200).json({
            success: true,
            students: list.map((s) => ({
                id: String(s._id), name: s.name, handle: s.handle, className: s.className, points: s.points, streak: s.streak,
                lastActiveDay: s.lastActiveDay, color: s.color, code: s.accessCode ? codeOf.get(String(s.accessCode)) || null : null,
                deviceLocked: Boolean(s.deviceId), joinedAt: s.createdAt,
            })),
        });
    } catch (error) { return fail(res, error, 'students'); }
});

router.post('/students/:id/unlock', async (req, res) => {
    try {
        const r = await student.updateOne({ _id: req.params.id, school: req.school._id }, { $set: { deviceId: null } });
        if (!r.matchedCount) return res.status(404).json({ success: false, message: 'Student not found in your school' });
        return res.status(200).json({ success: true, message: 'Unlocked. The student can now log in on their new device.' });
    } catch (error) { return fail(res, error, 'unlock'); }
});

router.post('/students/:id/remove', async (req, res) => {
    try {
        const st = await student.findOne({ _id: req.params.id, school: req.school._id });
        if (!st) return res.status(404).json({ success: false, message: 'Student not found in your school' });
        await student.updateOne({ _id: st._id }, { $set: { school: null, accessCode: null, deviceId: null, ...(st.access?.type === 'school' ? { 'access.type': null, 'access.until': null } : {}) } });
        if (st.accessCode) await accessCode.updateOne({ _id: st.accessCode }, { $set: { status: 'revoked' } });
        await school.updateOne({ _id: req.school._id }, { $inc: { studentCount: -1, points: -(st.points || 0) } });
        return res.status(200).json({ success: true, message: `${st.name} was removed. Their seat is free again.` });
    } catch (error) { return fail(res, error, 'remove'); }
});


// ============================================================
// CODES
// GET  /school_dashboard/codes?status=unused|used|revoked
// POST /school_dashboard/codes  { count, className?, labels? }   labels = one name per line (optional)
// POST /school_dashboard/codes/:id/revoke   (only unused codes; frees the seat)
// ============================================================
router.get('/codes', async (req, res) => {
    try {
        const filter = { school: req.school._id };
        if (['unused', 'used', 'revoked'].includes(req.query.status)) filter.status = req.query.status;
        const list = await accessCode.find(filter).sort({ createdAt: -1 }).limit(2000).populate('student', 'name handle').lean();
        return res.status(200).json({
            success: true,
            joinBase: `${siteUrl()}/join?code=`,
            codes: list.map((c) => ({ id: String(c._id), code: c.code, status: c.status, label: c.label, className: c.className, student: c.student ? { name: c.student.name, handle: c.student.handle } : null, usedAt: c.usedAt, createdAt: c.createdAt })),
        });
    } catch (error) { return fail(res, error, 'codes'); }
});

router.post('/codes', async (req, res) => {
    try {
        const sch = req.school;
        if (!sch.accessUntil || new Date(sch.accessUntil) <= new Date()) return res.status(402).json({ success: false, message: 'Pick a plan first. Codes need an active plan.' });
        const issued = await accessCode.countDocuments({ school: sch._id, status: { $ne: 'revoked' } });
        const left = seatsLeft(sch, issued);
        const labels = (Array.isArray(req.body.labels) ? req.body.labels : String(req.body.labels || '').split('\n')).map((l) => String(l).trim()).filter(Boolean);
        const count = labels.length || Math.round(Number(req.body.count) || 0);
        if (count < 1) return res.status(400).json({ success: false, message: 'How many codes?' });
        if (count > left) return res.status(400).json({ success: false, message: `You have ${left} seat${left === 1 ? '' : 's'} left. Upgrade your plan for more.` });

        const className = String(req.body.className || '').trim().slice(0, 20) || null;
        const made = [];
        for (let i = 0; i < count; i++) {
            for (let tries = 0; tries < 5; tries++) {
                try {
                    made.push(await accessCode.create({ code: makeCode(), school: sch._id, className, label: labels[i] ? labels[i].slice(0, 60) : null }));
                    break;
                } catch (err) { if (err?.code !== 11000) throw err; } // same code by chance: try again
            }
        }
        return res.status(201).json({ success: true, message: `${made.length} code${made.length === 1 ? '' : 's'} ready`, codes: made.map((c) => ({ id: String(c._id), code: c.code, status: c.status, label: c.label, className: c.className })) });
    } catch (error) { return fail(res, error, 'make codes'); }
});

router.post('/codes/:id/revoke', async (req, res) => {
    try {
        const r = await accessCode.updateOne({ _id: req.params.id, school: req.school._id, status: 'unused' }, { $set: { status: 'revoked' } });
        if (!r.modifiedCount) return res.status(400).json({ success: false, message: 'Only unused codes can be cancelled. To free a used seat, remove the student.' });
        return res.status(200).json({ success: true, message: 'Code cancelled. The seat is free again.' });
    } catch (error) { return fail(res, error, 'revoke'); }
});


// ============================================================
// PLANS + PAYING (Paystack)
// GET  /school_dashboard/plans
// POST /school_dashboard/pay  { planId }   → { url }
// GET  /school_dashboard/payments
// ============================================================
router.get('/plans', async (req, res) => {
    try {
        const { schoolPlans } = await getSettings();
        return res.status(200).json({ success: true, plans: schoolPlans, demo: paystack.demoMode() });
    } catch (error) { return fail(res, error, 'plans'); }
});

router.post('/pay', async (req, res) => {
    try {
        const { schoolPlans } = await getSettings();
        const plan = schoolPlans.find((p) => p.id === req.body.planId);
        if (!plan) return res.status(400).json({ success: false, message: 'Pick a plan' });
        const reference = paystack.newReference('NGS');
        await payment.create({ reference, kind: 'school', school: req.school._id, plan: plan.id, seats: plan.seats, days: plan.days, amount: plan.price, email: req.account.email, provider: paystack.demoMode() ? 'demo' : 'paystack' });
        const r = await paystack.initialize({ email: req.account.email, amount: plan.price, reference, callbackUrl: `${siteUrl()}/pay/callback`, metadata: { kind: 'school', school: String(req.school._id), plan: plan.id } });
        return res.status(200).json({ success: true, url: r.url, reference, demo: r.demo });
    } catch (error) { return fail(res, error, 'pay'); }
});

router.get('/payments', async (req, res) => {
    try {
        const list = await payment.find({ school: req.school._id }).sort({ createdAt: -1 }).limit(50).lean();
        return res.status(200).json({ success: true, payments: list.map((p) => ({ reference: p.reference, plan: p.plan, seats: p.seats, days: p.days, amount: p.amount, status: p.status, provider: p.provider, paidAt: p.paidAt, createdAt: p.createdAt })) });
    } catch (error) { return fail(res, error, 'payments'); }
});


// ============================================================
// PUBLIC PROFILE (shown on the School Showcase)
// PUT  /school_dashboard/profile  { motto, about, website, founded, schoolType, showOnShowcase, logo, city, state }
// POST /school_dashboard/logo     form-data "image" (3 MB) → { url }
// ============================================================
router.put('/profile', async (req, res) => {
    try {
        const b = req.body || {};
        const str = (v, max) => String(v ?? '').trim().slice(0, max) || null;
        const set = {};
        if (b.motto !== undefined) set.motto = str(b.motto, 120);
        if (b.about !== undefined) set.about = str(b.about, 1200);
        if (b.website !== undefined) {
            const w = str(b.website, 200);
            set.website = w && !/^https?:\/\//i.test(w) ? `https://${w}` : w;
        }
        if (b.founded !== undefined) { const y = Math.round(Number(b.founded)); set.founded = y >= 1800 && y <= new Date().getFullYear() ? y : null; }
        if (b.schoolType !== undefined) set.schoolType = ['public', 'private', 'mission', 'federal', 'other'].includes(b.schoolType) ? b.schoolType : null;
        if (b.showOnShowcase !== undefined) set.showOnShowcase = Boolean(b.showOnShowcase);
        if (b.logo !== undefined) set.logo = /^https?:\/\//.test(String(b.logo || '')) ? String(b.logo).slice(0, 400) : null;
        if (b.city !== undefined) set.city = str(b.city, 60);
        if (b.state !== undefined) set.state = str(b.state, 60);
        await school.updateOne({ _id: req.school._id }, { $set: set });
        const fresh = await school.findById(req.school._id);
        return res.status(200).json({ success: true, message: 'Profile saved. It shows on the School Showcase.', school: await schoolSummary(fresh, req.account) });
    } catch (error) { return fail(res, error, 'profile'); }
});

const logoUpload = imageUpload(3);
router.post('/logo', logoUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Choose a JPG, PNG or WEBP under 3 MB' });
        return res.status(200).json({ success: true, url: await saveImage(req.file, req, 'nextgen/schools') });
    } catch (error) { return fail(res, error, 'logo'); }
});

module.exports = router;
