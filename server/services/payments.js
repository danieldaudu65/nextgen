/*
 * Applying a paid payment: adds the seats / access exactly once.
 * Used by the Paystack callback check, the webhook, demo checkout and the admin "grant" button.
 */
const payment = require('../models/payment');
const school = require('../models/school');
const student = require('../models/student');
const { extendUntil } = require('./access');

async function applyPayment(ref) {
    // Claim it atomically so the webhook and the callback can't both apply it
    const p = await payment.findOneAndUpdate({ reference: ref, status: 'paid', appliedAt: null }, { $set: { appliedAt: new Date() } }, { new: true });
    if (!p) return payment.findOne({ reference: ref }).lean();

    if (p.kind === 'school' && p.school) {
        const sch = await school.findById(p.school);
        const until = extendUntil(sch.accessUntil, p.days);
        // Buying a plan sets the seats to that plan's size (or adds when it's the same plan: a top-up)
        const seats = sch.plan === p.plan && sch.accessUntil && new Date(sch.accessUntil) > new Date() ? Math.max(sch.seats, p.seats) : p.seats;
        await school.updateOne({ _id: sch._id }, { $set: { plan: p.plan, seats, accessUntil: until } });
        // Students who joined with this school's codes get the new end date too
        await student.updateMany({ school: sch._id, 'access.type': 'school' }, { $set: { 'access.until': until } });
    }
    if (p.kind === 'personal' && p.student) {
        const st = await student.findById(p.student);
        const keepSchool = st.access?.type === 'school' && st.access.until && new Date(st.access.until) > new Date();
        await student.updateOne({ _id: st._id }, { $set: { 'access.type': keepSchool ? 'school' : 'personal', 'access.until': extendUntil(st.access?.until, p.days) } });
    }
    return p.toObject();
}

// Mark paid (after Paystack or demo says so) and apply
async function markPaid(ref, { provider, amount } = {}) {
    await payment.updateOne({ reference: ref, status: { $ne: 'paid' } }, { $set: { status: 'paid', paidAt: new Date(), ...(provider ? { provider } : {}), ...(amount ? { amount } : {}) } });
    return applyPayment(ref);
}

module.exports = { applyPayment, markPaid };
