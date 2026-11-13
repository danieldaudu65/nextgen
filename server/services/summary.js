/*
 * Everything the website needs about the logged-in student:
 * points, streak, rank, school + school rank, and today's Reading Mission.
 */
const readProgress = require('../models/readProgress');
const student = require('../models/student');
const school = require('../models/school');
const sanitizeStudent = require('../utils/sanitizeStudent');
const { MISSION_TARGET } = require('../config/rules');
const { dayKey } = require('../utils/dates');
const { currentStreak } = require('./reading');
const { hasAccess } = require('./access');

async function studentSummary(user) {
    const today = dayKey();

    const [todayReads, rank, mySchool] = await Promise.all([
        readProgress.countDocuments({ student: user._id, completedDay: today }),
        student.countDocuments({ points: { $gt: user.points } }).then((n) => n + 1),
        user.school ? school.findById(user.school, 'name city points') : null,
    ]);

    const schoolRank = mySchool ? (await school.countDocuments({ points: { $gt: mySchool.points } })) + 1 : null;

    return {
        ...sanitizeStudent(user),
        streak: currentStreak(user, today),
        rank,
        school: mySchool ? { id: String(mySchool._id), name: mySchool.name, city: mySchool.city, rank: schoolRank } : null,
        mission: { done: Math.min(todayReads, MISSION_TARGET), target: MISSION_TARGET },
        // can earn points + play games (school seat or personal plan)
        access: { active: hasAccess(user), type: user.access?.type || null, until: user.access?.until || null },
    };
}

module.exports = { studentSummary };
