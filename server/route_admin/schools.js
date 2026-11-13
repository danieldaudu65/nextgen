const express = require('express');
const mongoose = require('mongoose');
const school = require('../models/school');
const student = require('../models/student');
const { requireAdmin, requireRole } = require('../middleware/adminAuth');
const payment = require('../models/payment');
const paystack = require('../services/paystack');
const { markPaid } = require('../services/payments');
const { getSettings } = require('../services/settings');
const router = express.Router();

const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');


// ============================================================
// LIST
// GET /admin_schools?q=king&verified=0
// ============================================================
router.get('/', requireAdmin, async (req, res) => {
    try {
        const filter = {};
        if (req.query.verified === '0') filter.verified = false;
        if (req.query.verified === '1') filter.verified = true;
        if (req.query.q) {
            const q = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = { $regex: q, $options: 'i' };
        }
        const list = await school.find(filter).sort({ points: -1 }).limit(500).lean();
        return res.status(200).json({
            success: true,
            schools: list.map(({ _id, __v, ...s }) => ({ ...s, id: String(_id) })),
        });
    } catch (error) {
        console.error('Admin schools error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// ADD A SCHOOL (editors)
// POST /admin_schools  { name, city, state, verified? }
// ============================================================
router.post('/', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        const { name, city, state, verified } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'School name is required' });
        }
        const slug = slugify(`${name}-${city || ''}`);
        if (await school.exists({ slug })) {
            return res.status(409).json({ success: false, message: 'That school is already on the list' });
        }
        const doc = await school.create({ name, city, state, slug, verified: Boolean(verified) });
        return res.status(201).json({ success: true, message: 'School added', school: { id: String(doc._id) } });
    } catch (error) {
        console.error('Create school error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// EDIT / VERIFY (editors)
// PUT /admin_schools/:id  { name?, city?, state?, verified? }
// ============================================================
router.put('/:id', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ success: false, message: 'School not found' });
        }
        const data = {};
        ['name', 'city', 'state', 'verified'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
        const doc = await school.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
        if (!doc) {
            return res.status(404).json({ success: false, message: 'School not found' });
        }
        return res.status(200).json({ success: true, message: 'School saved' });
    } catch (error) {
        console.error('Update school error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// DELETE (superadmin, only if no students joined it)
// DELETE /admin_schools/:id
// ============================================================
router.delete('/:id', requireAdmin, requireRole('superadmin'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ success: false, message: 'School not found' });
        }
        if (await student.exists({ school: req.params.id })) {
            return res.status(400).json({ success: false, message: 'Students have joined this school, so it can\'t be deleted' });
        }
        await school.deleteOne({ _id: req.params.id });
        return res.status(200).json({ success: true, message: 'School deleted' });
    } catch (error) {
        console.error('Delete school error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// GIVE A SCHOOL A PLAN BY HAND (paid by bank transfer, a free pilot, ...)
// POST /admin_schools/:id/grant  { planId } or { seats, days, amount? }   (superadmins)
// Recorded as a "manual" payment so it shows in the school's history.
// ============================================================
router.post('/:id/grant', requireAdmin, requireRole('superadmin'), async (req, res) => {
    try {
        const sch = await school.findById(req.params.id).catch(() => null);
        if (!sch) return res.status(404).json({ success: false, message: 'School not found' });
        const { schoolPlans } = await getSettings();
        const plan = schoolPlans.find((p) => p.id === req.body.planId);
        const seats = plan ? plan.seats : Math.round(Number(req.body.seats) || 0);
        const days = plan ? plan.days : Math.round(Number(req.body.days) || 365);
        if (seats < 1 || days < 1) return res.status(400).json({ success: false, message: 'Pick a plan, or give seats and days' });
        const reference = paystack.newReference('NGM');
        await payment.create({ reference, kind: 'school', school: sch._id, plan: plan ? plan.id : 'custom', seats, days, amount: plan ? plan.price : Number(req.body.amount) || 0, provider: 'manual', email: req.admin.email });
        await markPaid(reference, { provider: 'manual' });
        const fresh = await school.findById(sch._id).lean();
        return res.status(200).json({ success: true, message: `${sch.name}: ${seats} seats until ${new Date(fresh.accessUntil).toDateString()}`, school: { ...fresh, id: String(fresh._id) } });
    } catch (error) {
        console.error('Grant plan error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
