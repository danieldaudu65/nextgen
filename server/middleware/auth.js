const jwt = require('jsonwebtoken');
const student = require('../models/student');

// Route needs a logged-in student. Sets req.user.
const auth = async (req, res, next) => {
    try {
        const token = req.cookies?.token; // ✅ COOKIE ONLY

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Join or log in to save your points',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await student.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Student not found',
            });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
        });
    }
};

module.exports = auth;
