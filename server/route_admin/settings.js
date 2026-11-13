const express = require('express');
const { requireAdmin, requireRole } = require('../middleware/adminAuth');
const { getSettings, saveSettings, DEFAULTS } = require('../services/settings');
const paystack = require('../services/paystack');
const router = express.Router();


// ============================================================
// SETTINGS (leaderboard, reading + question, access, school plans)
// GET /admin_settings
// PUT /admin_settings   (superadmins)   the whole settings object; bad values fall back to defaults
// ============================================================
router.get('/', requireAdmin, async (req, res) => {
    try {
        return res.status(200).json({ success: true, settings: await getSettings(), defaults: DEFAULTS, payments: { demo: paystack.demoMode() } });
    } catch (error) {
        console.error('Settings error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/', requireAdmin, requireRole('superadmin'), async (req, res) => {
    try {
        const settings = await saveSettings(req.body || {}, req.admin._id);
        return res.status(200).json({ success: true, message: 'Settings saved', settings });
    } catch (error) {
        console.error('Save settings error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
