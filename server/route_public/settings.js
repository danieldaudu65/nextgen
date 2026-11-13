const express = require('express');
const school = require('../models/school');
const accessCode = require('../models/accessCode');
const paystack = require('../services/paystack');
const { getSettings, publicSettings } = require('../services/settings');
const { cleanCode, codeProblem } = require('../services/access');
const router = express.Router();


// ============================================================
// PUBLIC SETTINGS (reading time, question timer, prices, plans)
// GET /site/settings
// ============================================================
router.get('/settings', async (req, res) => {
    try {
        return res.status(200).json({ success: true, settings: publicSettings(await getSettings()), demoPayments: paystack.demoMode() });
    } catch (error) {
        console.error('Public settings error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// CHECK A SCHOOL CODE (the join form shows "Joining King's College")
// GET /site/codes/:code
// ============================================================
router.get('/codes/:code', async (req, res) => {
    try {
        const code = await accessCode.findOne({ code: cleanCode(req.params.code) }, 'status school').lean();
        const sch = code ? await school.findById(code.school, 'name city accessUntil').lean() : null;
        const problem = codeProblem(code, sch);
        return res.status(200).json({ success: true, valid: !problem, message: problem, school: sch && !problem ? { name: sch.name, city: sch.city } : null });
    } catch (error) {
        console.error('Code check error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
