const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const student = require('../models/student');
const school = require('../models/school');
const accessCode = require('../models/accessCode');
const auth = require('../middleware/auth');
const { setAuthCookie, clearAuthCookie } = require('../utils/setAuthCookie');
const { studentSummary } = require('../services/summary');
const { cleanCode, cleanDevice, codeProblem, deviceCheck } = require('../services/access');
const router = express.Router();

const COLORS = ['#F5C518', '#2F7DE1', '#E0457B', '#2FA36B', '#6B4FD8', '#F28C28'];

const makeToken = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const cleanHandle = (h) => String(h || '').replace(/^@/, '').toLowerCase().trim();
const deviceOf = (req) => cleanDevice(req.get('x-device-id') || req.body?.deviceId);

// Claim a code for a student (atomic: two people can't take the same code)
async function claimCode(code, user, deviceId) {
    const sch = await school.findById(code.school);
    const problem = codeProblem(code, sch);
    if (problem) return { error: problem };
    const taken = await accessCode.findOneAndUpdate(
        { _id: code._id, status: 'unused' },
        { $set: { status: 'used', student: user._id, usedAt: new Date() } },
        { new: true }
    );
    if (!taken) return { error: 'That code has already been used.' };

    const movedSchool = String(user.school || '') !== String(sch._id);
    await student.updateOne({ _id: user._id }, {
        $set: {
            school: sch._id,
            className: user.className || code.className || null,
            accessCode: code._id,
            deviceId: deviceId || null,
            'access.type': 'school',
            'access.until': sch.accessUntil,
        },
    });
    if (movedSchool) {
        await school.updateOne({ _id: sch._id }, { $inc: { studentCount: 1, points: user.points || 0 } });
        if (user.school) await school.updateOne({ _id: user.school }, { $inc: { studentCount: -1, points: -(user.points || 0) } });
    }
    return { school: sch };
}


// ============================================================
// REGISTER
// POST /user_auth/register  { name, handle, password, schoolId?, className?, code? }
// Header X-Device-Id (random id the browser keeps) locks school-code accounts to the device.
// ============================================================
router.post('/register', async (req, res) => {
    try {
        const { name, handle, password, schoolId, className } = req.body;
        const codeText = cleanCode(req.body.code);
        const deviceId = deviceOf(req);

        if (!name || !handle || !password) {
            return res.status(400).json({ success: false, message: 'Name, handle and password are required' });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const newHandle = cleanHandle(handle);
        if (!/^[a-z0-9._]{3,20}$/.test(newHandle)) {
            return res.status(400).json({ success: false, message: 'Handle: 3–20 letters, numbers, dots or underscores' });
        }

        const taken = await student.exists({ handle: newHandle });
        if (taken) {
            return res.status(409).json({ success: false, message: 'That handle is taken. Try another one' });
        }

        // A school code (optional) decides the school; check it BEFORE creating the account
        let code = null;
        if (codeText) {
            code = await accessCode.findOne({ code: codeText });
            const problem = codeProblem(code, code && (await school.findById(code.school)));
            if (problem) return res.status(400).json({ success: false, message: problem });
            if (!deviceId) return res.status(400).json({ success: false, message: 'Refresh the page and try again (device check).' });
        }

        // Without a code, the school is optional, but if they pick one it must exist
        let mySchool = null;
        if (!code && schoolId) {
            mySchool = await school.findById(schoolId).catch(() => null);
            if (!mySchool) {
                return res.status(400).json({ success: false, message: 'Pick your school from the list' });
            }
        }

        let user = await student.create({
            name: String(name).trim(),
            handle: newHandle,
            password: await bcrypt.hash(String(password), 10),
            school: mySchool?._id,
            className: className || null,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });

        if (code) {
            const claim = await claimCode(code, user, deviceId);
            if (claim.error) {
                await student.deleteOne({ _id: user._id }); // nothing half-made
                return res.status(400).json({ success: false, message: claim.error });
            }
            user = await student.findById(user._id);
        } else if (mySchool) {
            await school.updateOne({ _id: mySchool._id }, { $inc: { studentCount: 1 } });
        }

        setAuthCookie(res, makeToken(user));
        return res.status(201).json({
            success: true,
            message: code ? 'Welcome to NextGen. Your school gave you full access 🎉' : 'Welcome to NextGen',
            user: await studentSummary(user),
        });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// LOGIN
// POST /user_auth/login  { handle, password }   (+ X-Device-Id)
// ============================================================
router.post('/login', async (req, res) => {
    try {
        const { handle, password } = req.body;

        const user = await student.findOne({ handle: cleanHandle(handle) }).select('+password +deviceId');
        const ok = user && (await bcrypt.compare(String(password || ''), user.password));

        if (!ok) {
            return res.status(401).json({ success: false, message: 'Wrong handle or password' });
        }

        // School-code accounts only work on their own device
        const deviceId = deviceOf(req);
        const check = deviceCheck(user, deviceId);
        if (check === 'locked') {
            return res.status(403).json({ success: false, code: 'DEVICE_LOCKED', message: 'This account is locked to another phone or computer. Ask your school to unlock it, then log in here.' });
        }
        if (check === 'bind') await student.updateOne({ _id: user._id }, { $set: { deviceId } });

        setAuthCookie(res, makeToken(user));
        return res.status(200).json({
            success: true,
            message: 'Welcome back',
            user: await studentSummary(user),
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// USE A SCHOOL CODE (already have an account)
// POST /user_auth/redeem  { code }   (+ X-Device-Id)
// ============================================================
router.post('/redeem', auth, async (req, res) => {
    try {
        const deviceId = deviceOf(req);
        if (!deviceId) return res.status(400).json({ success: false, message: 'Refresh the page and try again (device check).' });
        const code = await accessCode.findOne({ code: cleanCode(req.body.code) });
        const claim = await claimCode(code, req.user, deviceId);
        if (claim.error) return res.status(400).json({ success: false, message: claim.error });
        const user = await student.findById(req.user._id);
        return res.status(200).json({ success: true, message: `You're in with ${claim.school.name} 🎉`, user: await studentSummary(user) });
    } catch (error) {
        console.error('Redeem error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// LOGOUT
// POST /user_auth/logout
// ============================================================
router.post('/logout', (req, res) => {
    clearAuthCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out' });
});


// ============================================================
// ME (points, streak, rank, school, today's mission, access)
// GET /user_auth/me
// ============================================================
router.get('/me', auth, async (req, res) => {
    try {
        return res.status(200).json({ success: true, user: await studentSummary(req.user) });
    } catch (error) {
        console.error('Me error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
