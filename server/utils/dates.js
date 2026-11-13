const { TIMEZONE } = require('../config/rules');

// "2026-11-06" in Lagos time, so a day starts at midnight in Nigeria, not UTC.
function dayKey(date = new Date(), timeZone = TIMEZONE) {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Whole days between two "YYYY-MM-DD" keys (b - a)
function daysBetween(a, b) {
    const toUTC = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
    return Math.round((toUTC(b) - toUTC(a)) / 864e5);
}

// Monday 00:00 (Lagos) of the current week
function startOfWeek(date = new Date()) {
    const d = new Date(`${dayKey(date)}T00:00:00+01:00`);
    const dow = (d.getUTCDay() + 6) % 7; // Mon = 0 (Lagos is UTC+1, no daylight saving)
    return new Date(d.getTime() - dow * 864e5);
}

module.exports = { dayKey, daysBetween, startOfWeek };
