/*
 * ============================================================
 * Reading + streak logic (no database here, so it's easy to test)
 * ============================================================
 */
const { READ_RULES } = require('../config/rules');
const { daysBetween } = require('../utils/dates');

// Seconds of active reading needed for a story with an estimated read time
function requiredSeconds(readMins = 3) {
    return Math.max(READ_RULES.minSeconds, Math.round(readMins * 60 * READ_RULES.secondsPerMinute));
}

/*
 * Merge a heartbeat from the browser into the saved progress.
 * The browser can lie, so we never accept more reading time than real time has passed.
 *
 * prev = { firstSeenAt, activeSeconds, maxScroll, completed }
 * beat = { activeSeconds, scrollDepth }
 */
function mergeProgress(prev, beat, readMins, now = new Date()) {
    const firstSeenAt = prev.firstSeenAt ? new Date(prev.firstSeenAt) : now;
    const elapsed = (now.getTime() - firstSeenAt.getTime()) / 1000 + READ_RULES.heartbeatSlack;

    const claimed = Math.max(0, Number(beat.activeSeconds) || 0);
    const activeSeconds = Math.round(Math.max(prev.activeSeconds || 0, Math.min(claimed, elapsed)));
    const maxScroll = Math.min(1, Math.max(prev.maxScroll || 0, Number(beat.scrollDepth) || 0));

    const completed =
        Boolean(prev.completed) ||
        (activeSeconds >= requiredSeconds(readMins) && maxScroll >= READ_RULES.minScrollDepth);

    return { firstSeenAt, activeSeconds, maxScroll, completed, justCompleted: completed && !prev.completed };
}

/*
 * Update a streak when the student is active today.
 * Same day → unchanged. Yesterday → +1. Missed a day → back to 1.
 */
function nextStreak({ streak = 0, lastActiveDay = null }, today) {
    if (!lastActiveDay) return { streak: 1, lastActiveDay: today, changed: true };
    const gap = daysBetween(lastActiveDay, today);
    if (gap <= 0) return { streak, lastActiveDay, changed: false };
    if (gap === 1) return { streak: streak + 1, lastActiveDay: today, changed: true };
    return { streak: 1, lastActiveDay: today, changed: true };
}

// What the streak shows right now (0 if they skipped yesterday)
function currentStreak({ streak = 0, lastActiveDay = null }, today) {
    if (!lastActiveDay) return 0;
    return daysBetween(lastActiveDay, today) <= 1 ? streak : 0;
}

module.exports = { requiredSeconds, mergeProgress, nextStreak, currentStreak };
