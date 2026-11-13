const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const admin = require('../models/admin');
const { requireAdmin } = require('../middleware/adminAuth');
const { setAuthCookie, clearAuthCookie } = require('../utils/setAuthCookie');
const router = express.Router();

const makeToken = (user) => jwt.sign({ id: user._id, type: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });

const publicAdmin = (a) => ({ id: String(a._id), name: a.name, email: a.email, role: a.role });


// ============================================================
// ADMIN LOGIN
// POST /admin_auth/login  { email, password }
// ============================================================
// There is no public sign-up. The first superadmin is made with
// `npm run create-admin`, then they add the team in /admin/team.
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await admin.findOne({ email: String(email || '').toLowerCase().trim() }).select('+password');
        const ok = user && user.active && (await bcrypt.compare(String(password || ''), user.password));

        if (!ok) {
            return res.status(401).json({ success: false, message: 'Wrong email or password' });
        }

        user.lastLoginAt = new Date();
        await user.save();

        setAuthCookie(res, makeToken(user), 'admin_token');
        return res.status(200).json({ success: true, message: `Welcome back, ${user.name}`, admin: publicAdmin(user) });
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// ADMIN LOGOUT
// POST /admin_auth/logout
// ============================================================
router.post('/logout', (req, res) => {
    clearAuthCookie(res, 'admin_token');
    return res.status(200).json({ success: true, message: 'Logged out' });
});


// ============================================================
// WHO AM I
// GET /admin_auth/me
// ============================================================
router.get('/me', requireAdmin, (req, res) => {
    return res.status(200).json({ success: true, admin: publicAdmin(req.admin) });
});

module.exports = router;
