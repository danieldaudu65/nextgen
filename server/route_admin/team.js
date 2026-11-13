const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const admin = require('../models/admin');
const { requireAdmin, requireRole } = require('../middleware/adminAuth');
const router = express.Router();

const ROLES = ['writer', 'editor', 'superadmin'];
const publicAdmin = (a) => ({ id: String(a._id), name: a.name, email: a.email, role: a.role, active: a.active, lastLoginAt: a.lastLoginAt });

// Everything here is superadmin only
router.use(requireAdmin, requireRole('superadmin'));


// ============================================================
// LIST TEAM
// GET /admin_team
// ============================================================
router.get('/', async (req, res) => {
    try {
        const list = await admin.find({}).sort({ createdAt: 1 }).lean();
        return res.status(200).json({ success: true, team: list.map(publicAdmin) });
    } catch (error) {
        console.error('Team error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// ADD A TEAM MEMBER
// POST /admin_team  { name, email, password, role }
// ============================================================
router.post('/', async (req, res) => {
    try {
        const { name, email, password, role = 'writer' } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email and a starting password are required' });
        }
        if (String(password).length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }
        if (!ROLES.includes(role)) {
            return res.status(400).json({ success: false, message: `Role must be one of: ${ROLES.join(', ')}` });
        }
        if (await admin.exists({ email: String(email).toLowerCase().trim() })) {
            return res.status(409).json({ success: false, message: 'That email is already on the team' });
        }

        const doc = await admin.create({ name, email, role, password: await bcrypt.hash(String(password), 10) });
        return res.status(201).json({ success: true, message: `${name} added as ${role}`, member: publicAdmin(doc) });
    } catch (error) {
        console.error('Add team member error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// CHANGE ROLE / DISABLE / RESET PASSWORD
// PUT /admin_team/:id  { role?, active?, password? }
// ============================================================
router.put('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Team member not found' });
        }
        const isMe = String(req.params.id) === String(req.admin._id);
        const { role, active, password } = req.body;

        if (isMe && (role && role !== 'superadmin' || active === false)) {
            return res.status(400).json({ success: false, message: 'You can\'t demote or disable yourself' });
        }
        if (role && !ROLES.includes(role)) {
            return res.status(400).json({ success: false, message: `Role must be one of: ${ROLES.join(', ')}` });
        }

        const update = {};
        if (role) update.role = role;
        if (typeof active === 'boolean') update.active = active;
        if (password) {
            if (String(password).length < 8) {
                return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
            }
            update.password = await bcrypt.hash(String(password), 10);
        }

        const doc = await admin.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Team member not found' });
        }
        return res.status(200).json({ success: true, message: 'Saved', member: publicAdmin(doc) });
    } catch (error) {
        console.error('Update team member error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
