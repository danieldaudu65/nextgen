const express = require('express');
const payment = require('../models/payment');
const paystack = require('../services/paystack');
const { markPaid } = require('../services/payments');
const router = express.Router();


// ============================================================
// PAYSTACK WEBHOOK
// POST /paystack/webhook   (set this URL in Paystack → Settings → API Keys & Webhooks)
// ============================================================
// Paystack signs every call; we check the signature with the secret key,
// then double-check the payment with Paystack before applying it.
router.post('/webhook', async (req, res) => {
    try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!paystack.validSignature(req.rawBody, req.get('x-paystack-signature'), secret)) {
            return res.status(401).json({ success: false, message: 'Bad signature' });
        }
        const event = req.body;
        if (event?.event === 'charge.success' && event.data?.reference) {
            const p = await payment.findOne({ reference: event.data.reference }).lean();
            if (p && p.status !== 'paid') {
                const v = await paystack.verify(p.reference);
                if (v.paid && v.amount >= p.amount) await markPaid(p.reference, { provider: 'paystack' });
            }
        }
        return res.sendStatus(200); // always 200 for events we don't use, or Paystack retries
    } catch (error) {
        console.error('Paystack webhook error:', error);
        return res.sendStatus(500);
    }
});

module.exports = router;
