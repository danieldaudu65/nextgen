const express = require('express');
const payment = require('../models/payment');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const student = require('../models/student');
const paystack = require('../services/paystack');
const { markPaid } = require('../services/payments');
const { getSettings } = require('../services/settings');
const { studentSummary } = require('../services/summary');
const router = express.Router();

const siteUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || ''));


// ============================================================
// PAY FOR MYSELF (a package, for students who are not with a subscribed school)
// POST /user_pay/personal  { planId, email }   → { url } (Paystack checkout, or the demo page)
// Students have no email on NextGen, so we ask for one (a parent's is fine) only for the receipt.
// ============================================================
router.post('/personal', auth, async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Enter an email for the receipt (a parent’s is fine)' });
        const { personalPlans } = await getSettings();
        const plan = personalPlans.find((p) => p.id === req.body.planId) || (personalPlans.length === 1 ? personalPlans[0] : null);
        if (!plan) return res.status(400).json({ success: false, message: 'Pick a package' });
        const reference = paystack.newReference('NGP');
        await payment.create({ reference, kind: 'personal', student: req.user._id, plan: plan.id, amount: plan.price, days: plan.days, email, provider: paystack.demoMode() ? 'demo' : 'paystack' });
        const r = await paystack.initialize({ email, amount: plan.price, reference, callbackUrl: `${siteUrl()}/pay/callback`, metadata: { kind: 'personal', student: String(req.user._id), plan: plan.id } });
        return res.status(200).json({ success: true, url: r.url, reference, demo: r.demo });
    } catch (error) {
        console.error('Personal pay error:', error);
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
    }
});


// ============================================================
// CHECK A PAYMENT (the page Paystack sends people back to calls this)
// GET /user_pay/verify/:reference
// ============================================================
router.get('/verify/:reference', optionalAuth, async (req, res) => {
    try {
        const p = await payment.findOne({ reference: req.params.reference }).lean();
        if (!p) return res.status(404).json({ success: false, message: 'Payment not found' });
        let status = p.status;
        if (status !== 'paid' && p.provider === 'paystack' && !paystack.demoMode()) {
            const v = await paystack.verify(p.reference);
            if (v.paid && v.amount >= p.amount) { await markPaid(p.reference, { provider: 'paystack' }); status = 'paid'; }
            else if (v.raw?.status === 'failed' || v.raw?.status === 'abandoned') { await payment.updateOne({ _id: p._id }, { $set: { status: 'failed' } }); status = 'failed'; }
        }
        const user = req.user ? await student.findById(req.user._id) : null;
        return res.status(200).json({ success: true, payment: { reference: p.reference, kind: p.kind, status, amount: p.amount, seats: p.seats, days: p.days }, user: user ? await studentSummary(user) : null });
    } catch (error) {
        console.error('Verify pay error:', error);
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
    }
});


// ============================================================
// DEMO CHECKOUT (only when PAYSTACK_SECRET_KEY is not set)
// GET  /user_pay/demo/:reference      → what is being paid
// POST /user_pay/demo/:reference      { outcome: 'paid' | 'failed' }
// ============================================================
router.get('/demo/:reference', async (req, res) => {
    if (!paystack.demoMode()) return res.status(404).json({ success: false, message: 'Not found' });
    const p = await payment.findOne({ reference: req.params.reference }, 'reference kind amount seats days status email').lean();
    if (!p) return res.status(404).json({ success: false, message: 'Payment not found' });
    return res.status(200).json({ success: true, payment: p });
});
router.post('/demo/:reference', async (req, res) => {
    try {
        if (!paystack.demoMode()) return res.status(404).json({ success: false, message: 'Not found' });
        const p = await payment.findOne({ reference: req.params.reference });
        if (!p) return res.status(404).json({ success: false, message: 'Payment not found' });
        if (req.body.outcome === 'failed') await payment.updateOne({ _id: p._id, status: 'pending' }, { $set: { status: 'failed' } });
        else await markPaid(p.reference, { provider: 'demo' });
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Demo pay error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
