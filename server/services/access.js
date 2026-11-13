/*
 * ============================================================
 * Access: who can earn points and play games
 * ============================================================
 * A student has access when:
 *   - they joined with a school code from a school with an active plan, or
 *   - they paid for a personal plan.
 * School codes: one code = one account, and the account is locked to one
 * device (the school can unlock it when a student changes phone).
 * ============================================================
 */
const crypto = require('crypto');

// No 0/O/1/I/L, so codes are easy to read out loud and type
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeCode(length = 8, rand = crypto.randomBytes) {
    const bytes = rand(length);
    let out = '';
    for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    return out;
}

// "abcd-2345" / " ABCD2345 " → "ABCD2345"
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

// Device ids come from the browser (random, saved in localStorage)
const cleanDevice = (d) => (/^[a-zA-Z0-9_-]{8,64}$/.test(String(d || '')) ? String(d) : null);

function hasAccess(user, now = new Date()) {
    const until = user?.access?.until ? new Date(user.access.until) : null;
    return Boolean(user?.access?.type && until && until > now);
}

/*
 * Can this device log in to this account?
 * → 'ok'      (no lock, or same device)
 * → 'bind'    (account has a school code but no device yet: lock it to this one)
 * → 'locked'  (locked to another device)
 */
function deviceCheck(user, deviceId) {
    if (!user?.accessCode) return 'ok';           // not a school-code account: no device lock
    if (!user.deviceId) return deviceId ? 'bind' : 'ok';
    return user.deviceId === deviceId ? 'ok' : 'locked';
}

// Can a code be used to join right now?
function codeProblem(code, school, now = new Date()) {
    if (!code) return 'That code does not exist. Check it and try again.';
    if (code.status === 'revoked') return 'That code was cancelled by the school.';
    if (code.status === 'used') return 'That code has already been used.';
    if (!school) return 'That school is no longer on NextGen.';
    if (!school.accessUntil || new Date(school.accessUntil) <= now) return "That school's NextGen plan has ended. Ask your school to renew.";
    return null;
}

// Seats a school can still give out
const seatsLeft = (school, issued) => Math.max(0, (school?.seats || 0) - (issued || 0));

// New end date when a plan is bought: renewals stack on what is left
function extendUntil(current, days, now = new Date()) {
    const base = current && new Date(current) > now ? new Date(current) : now;
    return new Date(base.getTime() + days * 864e5);
}

module.exports = { CODE_ALPHABET, makeCode, cleanCode, cleanDevice, hasAccess, deviceCheck, codeProblem, seatsLeft, extendUntil };
