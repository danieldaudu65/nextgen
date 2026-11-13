const express = require('express');
const article = require('../models/article');
const edition = require('../models/edition');
const student = require('../models/student');
const school = require('../models/school');
const readProgress = require('../models/readProgress');
const { requireAdmin } = require('../middleware/adminAuth');
const pointsEvent = require('../models/pointsEvent');
const payment = require('../models/payment');
const accessCode = require('../models/accessCode');
const { startOfWeek, dayKey } = require('../utils/dates');
const router = express.Router();


// ============================================================
// DASHBOARD NUMBERS
// GET /admin_dashboard
// ============================================================
router.get('/', requireAdmin, async (req, res) => {
    try {
        const since = startOfWeek();

        const [byStatus, current, students, newStudents, schools, unverified, readsThisWeek, topStories] = await Promise.all([
            article.aggregate([
                { $match: { createdBy: { $exists: true, $ne: null } } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            edition.findOne({ status: 'current' }, 'slug title month').lean(),
            student.countDocuments({ sample: { $ne: true } }),
            student.countDocuments({ sample: { $ne: true }, createdAt: { $gte: since } }),
            school.countDocuments({}),
            school.countDocuments({ verified: false }),
            readProgress.countDocuments({ completed: true, completedAt: { $gte: since } }),
            readProgress.aggregate([
                { $match: { completed: true, completedAt: { $gte: since } } },
                { $group: { _id: '$article', reads: { $sum: 1 } } },
                { $sort: { reads: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'articles', localField: '_id', foreignField: 'slug', as: 'a' } },
                { $project: { reads: 1, slug: '$_id', title: { $first: '$a.title' } } },
            ]),
        ]);

        const articles = { draft: 0, review: 0, published: 0 };
        byStatus.forEach((s) => { articles[s._id] = s.count; });

        return res.status(200).json({
            success: true,
            stats: {
                articles,
                currentEdition: current,
                students,
                newStudentsThisWeek: newStudents,
                schools,
                unverifiedSchools: unverified,
                readsThisWeek,
                topStories: topStories.map(({ _id, ...t }) => t),
            },
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// CHARTS (the "Charts" switch on the dashboard)
// GET /admin_dashboard/charts?days=14   (7–90)
// ============================================================
// Group points by what earned them: reading, quiz, games, debate, streak
const groupOf = (action) => {
    if (['READ_STORY', 'READ_QUESTION', 'READING_MISSION'].includes(action)) return 'reading';
    if (action === 'QUIZ_CORRECT') return 'quiz';
    if (action.startsWith('GAME:')) return 'games';
    if (action === 'DEBATE_VOTE') return 'debate';
    return 'streak';
};

router.get('/charts', requireAdmin, async (req, res) => {
    try {
        const n = Math.min(90, Math.max(7, Number(req.query.days) || 14));
        const days = Array.from({ length: n }, (_, i) => dayKey(new Date(Date.now() - (n - 1 - i) * 864e5)));
        const since = new Date(`${days[0]}T00:00:00+01:00`);

        const [reads, signups, points, topStories, topSchools, paid, access, codes] = await Promise.all([
            readProgress.aggregate([{ $match: { completed: true, completedDay: { $gte: days[0] } } }, { $group: { _id: '$completedDay', n: { $sum: 1 }, answered: { $sum: { $cond: [{ $ne: ['$qAnsweredAt', null] }, 1, 0] } }, correct: { $sum: { $cond: ['$qDone', 1, 0] } } } }]),
            student.aggregate([{ $match: { sample: { $ne: true }, createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Lagos' } }, n: { $sum: 1 } } }]),
            pointsEvent.aggregate([{ $match: { day: { $gte: days[0] } } }, { $group: { _id: { day: '$day', action: '$action' }, points: { $sum: '$points' } } }]),
            readProgress.aggregate([
                { $match: { completed: true, completedDay: { $gte: days[0] } } },
                { $group: { _id: '$article', reads: { $sum: 1 } } }, { $sort: { reads: -1 } }, { $limit: 8 },
                { $lookup: { from: 'articles', localField: '_id', foreignField: 'slug', as: 'a' } },
                { $project: { _id: 0, slug: '$_id', reads: 1, title: { $first: '$a.title' } } },
            ]),
            pointsEvent.aggregate([
                { $match: { day: { $gte: days[0] }, school: { $ne: null } } },
                { $group: { _id: '$school', points: { $sum: '$points' } } }, { $sort: { points: -1 } }, { $limit: 8 },
                { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 's' } },
                { $project: { _id: 0, points: 1, name: { $first: '$s.name' } } },
            ]),
            payment.aggregate([{ $match: { status: 'paid', paidAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Africa/Lagos' } }, amount: { $sum: '$amount' } } }]),
            student.aggregate([{ $match: { 'access.until': { $gt: new Date() } } }, { $group: { _id: '$access.type', n: { $sum: 1 } } }]),
            accessCode.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        ]);

        const at = (list, d, key = 'n') => list.find((x) => x._id === d)?.[key] || 0;
        const daily = days.map((d) => {
            const row = { day: d, reads: at(reads, d), answered: at(reads, d, 'answered'), correct: at(reads, d, 'correct'), signups: at(signups, d), revenue: at(paid, d, 'amount'), reading: 0, quiz: 0, games: 0, debate: 0, streak: 0 };
            points.filter((p) => p._id.day === d).forEach((p) => { row[groupOf(p._id.action)] += p.points; });
            return row;
        });
        const count = (list, k) => list.find((x) => x._id === k)?.n || 0;
        return res.status(200).json({
            success: true,
            days: n,
            daily,
            topStories,
            topSchools,
            access: { school: count(access, 'school'), personal: count(access, 'personal') },
            codes: { unused: count(codes, 'unused'), used: count(codes, 'used'), revoked: count(codes, 'revoked') },
        });
    } catch (error) {
        console.error('Dashboard charts error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
