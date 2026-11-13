const jwt = require('jsonwebtoken');
const student = require('../models/student');

// Route works for guests too. If a student is logged in, req.user is set.
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.token;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await student.findById(decoded.id);
        }
    } catch (err) {
        req.user = null; // bad/expired token = treat as guest
    }
    next();
};

module.exports = optionalAuth;
