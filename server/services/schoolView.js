// What the school dashboard shows about its school (shared by several routes)
const accessCode = require('../models/accessCode');
const { seatsLeft } = require('./access');

async function schoolSummary(sch, account) {
    const [issued, used] = await Promise.all([
        accessCode.countDocuments({ school: sch._id, status: { $ne: 'revoked' } }),
        accessCode.countDocuments({ school: sch._id, status: 'used' }),
    ]);
    const active = Boolean(sch.accessUntil && new Date(sch.accessUntil) > new Date());
    return {
        id: String(sch._id), name: sch.name, city: sch.city, state: sch.state, verified: sch.verified,
        points: sch.points, studentCount: sch.studentCount,
        plan: { id: sch.plan, seats: sch.seats, until: sch.accessUntil, active },
        codes: { issued, used, unused: issued - used, left: seatsLeft(sch, issued) },
        account: account ? { name: account.name, email: account.email } : undefined,
        profile: { logo: sch.logo || null, motto: sch.motto || '', about: sch.about || '', website: sch.website || '', founded: sch.founded || null, schoolType: sch.schoolType || null, showOnShowcase: sch.showOnShowcase !== false },
    };
}

module.exports = { schoolSummary };
