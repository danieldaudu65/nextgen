// ===============================
// Create (or reset) a superadmin
// Usage:
//   npm run create-admin -- "Daniel Success" you@punchng.com "a-strong-password"
// ===============================
// There is no public admin sign-up. Run this once to make the first
// superadmin, then add the rest of the team from /admin/team.

require('dotenv').config();
require('../config/secrets').checkRequiredEnv();
require('../config/dns');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const admin = require('../models/admin');

async function run() {
    const [name, email, password] = process.argv.slice(2);

    if (!name || !email || !password) {
        console.log('\nUsage: npm run create-admin -- "Full Name" email@example.com "password"\n');
        process.exit(1);
    }
    if (password.length < 8) {
        console.log('\n❌ Password must be at least 8 characters\n');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const hash = await bcrypt.hash(password, 10);
    const doc = await admin.findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { $set: { name, password: hash, role: 'superadmin', active: true } },
        { upsert: true, new: true }
    );

    console.log(`\n✅ Superadmin ready: ${doc.name} <${doc.email}>`);
    console.log('   Log in at http://localhost:3000/admin/login\n');
    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error('❌ Failed:', err);
    await mongoose.disconnect();
    process.exit(1);
});
