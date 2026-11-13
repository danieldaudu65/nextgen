/*
 * ============================================================
 * Paystack payments (schools buying seats, students paying for themselves)
 * ============================================================
 * Needs PAYSTACK_SECRET_KEY in server/.env. Without it the server runs in
 * DEMO mode: no real money, a test checkout page that marks the payment paid.
 * Docs: https://paystack.com/docs/api/transaction/
 * ============================================================
 */
const crypto = require('crypto');

const BASE = 'https://api.paystack.co';
const demoMode = (env = process.env) => !env.PAYSTACK_SECRET_KEY;

const newReference = (prefix = 'NG') => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();

async function call(path, { method = 'GET', body, env = process.env, fetchImpl = fetch } = {}) {
    const res = await fetchImpl(`${BASE}${path}`, {
        method,
        headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === false) {
        const e = new Error(`Paystack: ${data.message || res.status}`);
        e.status = 502;
        throw e;
    }
    return data.data;
}

// Start a payment → { url, reference }. amount is in NAIRA (Paystack wants kobo).
async function initialize({ email, amount, reference, callbackUrl, metadata }, opts = {}) {
    const env = opts.env || process.env;
    if (demoMode(env)) return { url: `${callbackUrl.replace(/\/pay\/callback.*$/, '')}/pay/demo?reference=${encodeURIComponent(reference)}`, reference, demo: true };
    const data = await call('/transaction/initialize', {
        method: 'POST',
        body: { email, amount: Math.round(amount * 100), reference, callback_url: callbackUrl, currency: 'NGN', metadata },
        ...opts,
    });
    return { url: data.authorization_url, reference: data.reference, demo: false };
}

// Ask Paystack if it was paid → { paid, amount (naira), raw }
async function verify(reference, opts = {}) {
    const data = await call(`/transaction/verify/${encodeURIComponent(reference)}`, opts);
    return { paid: data.status === 'success', amount: (data.amount || 0) / 100, currency: data.currency, raw: data };
}

// Webhook signature: HMAC SHA512 of the raw body with the secret key
function validSignature(rawBody, signature, secret) {
    if (!rawBody || !signature || !secret) return false;
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    const a = Buffer.from(hash);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { demoMode, newReference, initialize, verify, validSignature };
