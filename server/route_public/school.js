const express = require('express');
const school = require('../models/school');
const student = require('../models/student');
const router = express.Router();


// ============================================================
// SCHOOLS (for the "Pick your school" dropdown)
// GET /schools?q=king
// ============================================================
router.get('/', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // treat search text as plain text
        const filter = q ? { name: { $regex: safe, $options: 'i' } } : {};

        const list = await school.find(filter, 'name city state').sort({ name: 1 }).limit(50).lean();

        return res.status(200).json({
            success: true,
            schools: list.map((s) => ({ id: String(s._id), name: s.name, city: s.city, state: s.state })),
        });
    } catch (error) {
        console.error('Schools error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// SCHOOL SHOWCASE
// GET /schools/showcase?q=king&state=Lagos&page=1
// ============================================================
// Every school (unless it hid itself), its details and its top 5 students.
const PAGE = 24;
router.get('/showcase', async (req, res) => {
    try {
        const filter = { showOnShowcase: { $ne: false } };
        const q = String(req.query.q || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { city: { $regex: q, $options: 'i' } }];
        if (req.query.state) filter.state = String(req.query.state);
        const page = Math.max(1, Math.round(Number(req.query.page) || 1));

        const [list, total, states] = await Promise.all([
            school.find(filter, 'name city state slug points studentCount verified logo motto about website founded schoolType accessUntil')
                .sort({ points: -1, name: 1 }).skip((page - 1) * PAGE).limit(PAGE).lean(),
            school.countDocuments(filter),
            school.distinct('state', { showOnShowcase: { $ne: false }, state: { $nin: [null, ''] } }),
        ]);

        // top 5 students of each school on this page (one query)
        const tops = await student.aggregate([
            { $match: { school: { $in: list.map((s) => s._id) } } },
            { $sort: { points: -1 } },
            { $group: { _id: '$school', top: { $push: { name: '$name', handle: '$handle', color: '$color', className: '$className', points: '$points', streak: '$streak' } } } },
            { $project: { top: { $slice: ['$top', 5] } } },
        ]);
        const topOf = new Map(tops.map((t) => [String(t._id), t.top]));

        // national rank = position by points among all showcased schools
        const ranks = await Promise.all(list.map((s) => school.countDocuments({ showOnShowcase: { $ne: false }, points: { $gt: s.points } })));

        return res.status(200).json({
            success: true,
            page, pages: Math.max(1, Math.ceil(total / PAGE)), total,
            states: states.sort(),
            schools: list.map((s, i) => ({
                id: String(s._id), slug: s.slug, name: s.name, city: s.city, state: s.state, verified: s.verified,
                logo: s.logo, motto: s.motto, about: s.about, website: s.website, founded: s.founded, schoolType: s.schoolType,
                points: s.points, studentCount: s.studentCount, rank: ranks[i] + 1,
                member: Boolean(s.accessUntil && new Date(s.accessUntil) > new Date()), // has a NextGen plan
                top: (topOf.get(String(s._id)) || []).map((t) => ({ ...t, handle: `@${t.handle}` })),
            })),
        });
    } catch (error) {
        console.error('Showcase error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
