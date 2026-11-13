const express = require('express');
const nomination = require('../models/nomination');
const { requireAdmin, requireRole } = require('../middleware/adminAuth');
const router = express.Router();


// ============================================================
// NOMINATIONS (Admin → Nominations)
// GET    /admin_nominations?status=new&q=ada
// PUT    /admin_nominations/:id   { status, featureBlurb, adminNote }   (editors)
// DELETE /admin_nominations/:id                                       (superadmins)
// ============================================================
router.get('/', requireAdmin, async (req, res) => {
    try {
        const filter = {};
        if (['new', 'shortlisted', 'featured', 'declined'].includes(req.query.status)) filter.status = req.query.status;
        const q = String(req.query.q || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (q) filter.$or = [{ nomineeName: { $regex: q, $options: 'i' } }, { schoolName: { $regex: q, $options: 'i' } }, { headline: { $regex: q, $options: 'i' } }];
        const [list, counts] = await Promise.all([
            nomination.find(filter).sort({ createdAt: -1 }).limit(300).lean(),
            nomination.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        ]);
        const count = { new: 0, shortlisted: 0, featured: 0, declined: 0 };
        counts.forEach((c) => { count[c._id] = c.n; });
        return res.status(200).json({ success: true, counts: count, nominations: list.map(({ _id, __v, ...n }) => ({ ...n, id: String(_id) })) });
    } catch (error) {
        console.error('Admin nominations error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/:id', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        const set = { reviewedBy: req.admin._id };
        if (['new', 'shortlisted', 'featured', 'declined'].includes(req.body.status)) set.status = req.body.status;
        if (req.body.featureBlurb !== undefined) set.featureBlurb = String(req.body.featureBlurb || '').trim().slice(0, 240) || null;
        if (req.body.adminNote !== undefined) set.adminNote = String(req.body.adminNote || '').trim().slice(0, 1000) || null;
        const doc = await nomination.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean().catch(() => null);
        if (!doc) return res.status(404).json({ success: false, message: 'Nomination not found' });
        const msg = { featured: `${doc.nomineeName} is now on the Nominate a Star page 🌟`, shortlisted: `${doc.nomineeName} shortlisted`, declined: 'Marked as declined', new: 'Moved back to new' }[doc.status];
        return res.status(200).json({ success: true, message: msg || 'Saved' });
    } catch (error) {
        console.error('Update nomination error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/:id', requireAdmin, requireRole('superadmin'), async (req, res) => {
    try {
        const r = await nomination.deleteOne({ _id: req.params.id }).catch(() => ({ deletedCount: 0 }));
        if (!r.deletedCount) return res.status(404).json({ success: false, message: 'Nomination not found' });
        return res.status(200).json({ success: true, message: 'Nomination deleted' });
    } catch (error) {
        console.error('Delete nomination error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
