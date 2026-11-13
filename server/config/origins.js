/*
 * Single list of frontends allowed to call this API.
 * Add extra origins without touching code via:
 *   EXTRA_CORS_ORIGINS=https://foo.com,https://bar.com
 */
const baseOrigins = [
    'http://localhost:3000',
    'https://punchnextgen.com',
    'https://www.punchnextgen.com',
];

const extraOrigins = (process.env.EXTRA_CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const allowedOrigins = [...new Set([...baseOrigins, ...extraOrigins])];

module.exports = { allowedOrigins };
