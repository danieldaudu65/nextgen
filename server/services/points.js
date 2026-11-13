/*
 * ============================================================
 * Points - the ONLY place that gives students points
 * ============================================================
 * 1. Checks access: with "points need access" on (Admin → Settings),
 *    only students with a school seat or a personal plan earn points.
 * 2. Writes a row to the ledger (points_events). The unique index
 *    means the same reward can never be claimed twice.
 * 3. Adds the points to the student AND to their school.
 * 4. Updates the daily streak (+ bonus at 3 and 7 days).
 * ============================================================
 */
const pointsEvent = require('../models/pointsEvent');
const student = require('../models/student');
const school = require('../models/school');
const { POINTS } = require('../config/rules');
const { dayKey } = require('../utils/dates');
const { nextStreak } = require('./reading');
const { hasAccess } = require('./access');
const { getSettings } = require('./settings');

/**
 * @param opts.edition  volume slug the points belong to (for per-volume / per-edition leaderboards)
 * @returns { awarded, points, bonus, locked }  locked = no access, nothing given
 */
async function awardPoints(user, action, ref, amount, opts = {}) {
    const today = dayKey();
    const edition = opts.edition || null;

    // 1. Access
    const settings = opts.settings || (await getSettings());
    if (settings.access.requireAccessForPoints && !hasAccess(user)) {
        return { awarded: 0, points: user.points, bonus: [], locked: true };
    }

    // 2. Ledger row (fails if already claimed)
    try {
        await pointsEvent.create({ student: user._id, school: user.school, action, ref, points: amount, day: today, edition });
    } catch (err) {
        if (err?.code === 11000) return { awarded: 0, points: user.points, bonus: [], locked: false }; // already claimed
        throw err;
    }

    // 3. + 4. Add points, update streak
    const s = nextStreak(user, today);
    const update = { $inc: { points: amount } };
    if (s.changed) {
        update.$set = { streak: s.streak, lastActiveDay: s.lastActiveDay };
        update.$max = { bestStreak: s.streak };
    }
    const fresh = await student.findByIdAndUpdate(user._id, update, { new: true });
    if (user.school) await school.updateOne({ _id: user.school }, { $inc: { points: amount } });

    // Streak bonus (paid once, on the day the streak hits 3 or 7)
    if (s.changed && (s.streak === 3 || s.streak === 7)) {
        const key = s.streak === 3 ? 'STREAK_3' : 'STREAK_7';
        const pts = s.streak === 3 ? POINTS.STREAK_BONUS_3 : POINTS.STREAK_BONUS_7;
        const bonus = await awardPoints(fresh, key, today, pts, { edition, settings });
        return { awarded: amount + bonus.awarded, points: bonus.points, bonus: bonus.awarded ? [{ action: key, points: pts }] : [], locked: false };
    }

    return { awarded: amount, points: fresh.points, bonus: [], locked: false };
}

module.exports = { awardPoints };
