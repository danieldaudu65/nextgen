const jwt = require('jsonwebtoken');
const schoolAccount = require('../models/schoolAccount');
const school = require('../models/school');

// School dashboard login ("school_token" cookie). Sets req.account and req.school.
module.exports = async function requireSchool(req, res, next) {
    try {
        const token = req.cookies?.school_token;
        if (!token) return res.status(401).json({ success: false, message: 'School login required.' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.type !== 'school' || !decoded.id) return res.status(401).json({ success: false, message: 'Invalid school login.' });
        const account = await schoolAccount.findById(decoded.id);
        if (!account || !account.active) return res.status(401).json({ success: false, message: 'School account not found or disabled.' });
        const sch = await school.findById(account.school);
        if (!sch) return res.status(401).json({ success: false, message: 'School not found.' });
        req.account = account;
        req.school = sch;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Your school login expired. Log in again.' });
        }
        console.error('School auth error:', error);
        return res.status(500).json({ success: false, message: 'Failed to check school login.' });
    }
};
