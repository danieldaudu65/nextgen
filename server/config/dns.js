/*
 * ============================================================
 * DNS fix for MongoDB Atlas (mongodb+srv://)
 * ============================================================
 * Some networks / ISPs (common on Windows in Nigeria) can't answer the
 * SRV lookup Atlas needs, which gives:
 *   querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net
 * So we tell Node to use public DNS servers before connecting.
 * Override with DNS_SERVERS=1.1.1.1,8.8.8.8 in .env if needed.
 * ============================================================
 */
const dns = require('dns');

const servers = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1,8.8.4.4')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

dns.setServers(servers);

module.exports = { servers };
