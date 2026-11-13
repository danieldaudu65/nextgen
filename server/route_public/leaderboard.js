const express = require('express');
const school = require('../models/school');
const edition = require('../models/edition');
const pointsEvent = require('../models/pointsEvent');
const { READING_ACTIONS } = require('../config/rules');
const { getSettings } = require('../services/settings');
const { rangeMatch } = require('../services/leaderboardRange');
const router = express.Router();

const schoolName = (s) => (s.city ? `${s.name}, ${s.city}` : s.name);


async function buildBoards(range, eds, lb, limit) {
    const { match, label } = rangeMatch(range, eds);
    const people = (extra) => pointsEvent.aggregate([
        { $match: { $and: [match, extra] } },
        { $group: { _id: '$student', points: { $sum: '$points' } } },
        { $sort: { points: -1 } },
        { $limit: limit },
        { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 's' } },
        { $unwind: '$s' },
        { $lookup: { from: 'schools', localField: 's.school', foreignField: '_id', as: 'sc' } },
    ]);
    const toRows = (rows) => rows.map((r, i) => ({ rank: i + 1, id: String(r._id), name: `@${r.s.handle}`, points: r.points, color: r.s.color, school: r.sc[0]?.name, streak: r.s.streak || 0 }));

    const [readers, players, schoolRows] = await Promise.all([
        lb.boards.readers ? people({ action: { $in: READING_ACTIONS } }) : [],
        lb.boards.players ? people({}) : [],
        lb.boards.schools
            ? pointsEvent.aggregate([
                { $match: { $and: [match, { school: { $ne: null } }] } },
                { $group: { _id: '$school', points: { $sum: '$points' }, students: { $addToSet: '$student' } } },
                { $project: { points: 1, active: { $size: '$students' } } },
            ])
            : [],
    ]);

    // Schools: total, or average per active student
    const info = await school.find({ _id: { $in: schoolRows.map((s) => s._id) } }, 'name city studentCount').lean();
    const byId = new Map(info.map((s) => [String(s._id), s]));
    const schools = schoolRows
        .map((s) => ({ ...s, info: byId.get(String(s._id)), perStudent: s.active ? Math.round(s.points / s.active) : 0 }))
        .filter((s) => s.info)
        .sort((a, b) => (lb.schoolRanking === 'average' ? b.perStudent - a.perStudent : b.points - a.points))
        .slice(0, limit)
        .map((s, i) => ({ rank: i + 1, id: String(s._id), name: schoolName(s.info), points: s.points, students: s.info.studentCount, active: s.active, perStudent: s.perStudent }));

    return { readers: toRows(readers), players: toRows(players), schools, label };
}

// ============================================================
// LEADERBOARDS
// GET /leaderboard?range=volume|edition|week|all   (default: Admin → Settings)
// ============================================================
//
// Three boards, everyone can see them:
//   readers  → Top Readers: reading + story question points only
//   players  → Top Players: every point (reading, quizzes, games, debates, streaks)
//   schools  → Top Schools: all points of each school's students
//              (ranked by total, or by average per student: Admin → Settings)
// The range decides which points count: this volume, the whole yearly
// edition, this week, or all time.
// ============================================================
router.get('/', async (req, res) => {
    try {
        const settings = await getSettings();
        const lb = settings.leaderboard;
        let range = ['volume', 'edition', 'week', 'all'].includes(req.query.range) ? req.query.range : lb.range;
        const limit = lb.size;
        const eds = await edition.find({}, 'slug year month status volume title').lean();

        let boards = await buildBoards(range, eds, lb, limit);
        // Nothing earned in this range yet (new volume, Monday morning…): show all time, so visitors never see empty boards
        let fellBack = false;
        if (range !== 'all' && !boards.readers.length && !boards.players.length && !boards.schools.length) {
            boards = await buildBoards('all', eds, lb, limit);
            range = 'all';
            fellBack = true;
        }
        const { readers, players, schools, label } = boards;

        return res.status(200).json({
            success: true,
            range, label, fellBack,
            period: range === 'week' ? 'week' : 'all', // older websites read this
            ranking: lb.schoolRanking,
            boards: lb.boards,
            showOnHome: lb.showOnHome,
            readers,
            players,
            schools,
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
