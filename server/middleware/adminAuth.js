const jwt = require('jsonwebtoken');
const admin = require('../models/admin');

// =====================================================
// REQUIRE ADMIN (any NextGen team member)
// =====================================================
// Admins use their own cookie ("admin_token"), separate from students.
// Sets req.admin.

const requireAdmin = async (req, res, next) => {
    try {
        const token = req.cookies?.admin_token;

        if (!token) {
            return res.status(401).json({ success: false, message: 'Admin login required.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.type !== 'admin' || !decoded.id) {
            return res.status(401).json({ success: false, message: 'Invalid admin token.' });
        }

        const user = await admin.findById(decoded.id);
        if (!user || !user.active) {
            return res.status(401).json({ success: false, message: 'Admin account not found or disabled.' });
        }

        req.admin = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Invalid or expired admin token.' });
        }
        console.error('❌ Admin authentication error:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify admin access.' });
    }
};

// =====================================================
// REQUIRE ROLE
// Use after requireAdmin:  router.post('/', requireAdmin, requireRole('editor'), ...)
// superadmin always passes.
// =====================================================

const RANK = { writer: 1, editor: 2, superadmin: 3 };

const requireRole = (minRole) => (req, res, next) => {
    if (RANK[req.admin?.role] >= RANK[minRole]) return next();
    return res.status(403).json({ success: false, message: `Only ${minRole}s and above can do this.` });
};

const hasRole = (user, minRole) => RANK[user?.role] >= RANK[minRole];

module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.requireRole = requireRole;
module.exports.hasRole = hasRole;
