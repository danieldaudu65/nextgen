const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const school = require('../models/school');
const schoolAccount = require('../models/schoolAccount');
const requireSchool = require('../middleware/schoolAuth');
const { setAuthCookie, clearAuthCookie } = require('../utils/setAuthCookie');
const { schoolSummary } = require('../services/schoolView');
const router = express.Router();

const makeToken = (a) => jwt.sign({ id: a._id, type: 'school' }, process.env.JWT_SECRET, { expiresIn: '30d' });
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ''));


// ============================================================
// SCHOOL SIGN UP (creates the school + its first login)
// POST /school_auth/register  { schoolName, city, state, name, email, phone, password }
// ============================================================
router.post('/register', async (req, res) => {
    try {
        const { schoolName, city, state, name, phone, password } = req.body;
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!String(schoolName || '').trim() || !String(name || '').trim()) return res.status(400).json({ success: false, message: 'School name and your name are required' });
        if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email' });
        if (String(password || '').length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        if (await schoolAccount.exists({ email })) return res.status(409).json({ success: false, message: 'That email already has a school account. Log in instead.' });

        let slug = slugify(`${schoolName} ${city || ''}`) || `school-${Date.now()}`;
        if (await school.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
        const sch = await school.create({
            name: String(schoolName).trim(), city: String(city || '').trim() || null, state: String(state || '').trim() || null, slug,
            contactName: String(name).trim(), contactPhone: String(phone || '').trim() || null,
        });
        const account = await schoolAccount.create({ school: sch._id, name: String(name).trim(), email, password: await bcrypt.hash(String(password), 10) });

        setAuthCookie(res, makeToken(account), 'school_token');
        return res.status(201).json({ success: true, message: 'School created. Pick a plan to give your students access.', school: await schoolSummary(sch, account) });
    } catch (error) {
        console.error('School register error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// LOGIN / LOGOUT / ME
// ============================================================
router.post('/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const account = await schoolAccount.findOne({ email }).select('+password');
        const ok = account && account.active && (await bcrypt.compare(String(req.body.password || ''), account.password));
        if (!ok) return res.status(401).json({ success: false, message: 'Wrong email or password' });
        await schoolAccount.updateOne({ _id: account._id }, { $set: { lastLoginAt: new Date() } });
        const sch = await school.findById(account.school);
        setAuthCookie(res, makeToken(account), 'school_token');
        return res.status(200).json({ success: true, school: await schoolSummary(sch, account) });
    } catch (error) {
        console.error('School login error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    clearAuthCookie(res, 'school_token');
    return res.status(200).json({ success: true });
});

router.get('/me', requireSchool, async (req, res) => {
    try {
        return res.status(200).json({ success: true, school: await schoolSummary(req.school, req.account) });
    } catch (error) {
        console.error('School me error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
