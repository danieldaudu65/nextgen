/*
 * Tiny in-memory rate limit for public forms (nominations).
 * rateLimit({ max: 5, windowMs: 3600e3 }) → Express middleware. Per IP, per server process.
 */
function rateLimit({ max, windowMs, message = 'Too many tries. Please wait a bit and try again.' }) {
    const hits = new Map();
    return (req, res, next) => {
        const now = Date.now();
        const key = req.ip || req.socket?.remoteAddress || 'x';
        const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
        if (list.length >= max) return res.status(429).json({ success: false, message });
        list.push(now);
        hits.set(key, list);
        if (hits.size > 5000) hits.clear(); // keep memory small
        next();
    };
}

module.exports = { rateLimit };
