/*
 * ============================================================
 * Secrets - read ONLY from environment variables (.env)
 * ============================================================
 * Nothing secret is written in the code, so the repo can be
 * pushed to GitHub safely. Missing required values stop the
 * server at startup with a clear message.
 * ============================================================
 */

const REQUIRED = ["MONGODB_URI", "JWT_SECRET"];

function checkRequiredEnv() {
    const missing = REQUIRED.filter((key) => !process.env[key]);
    if (missing.length) {
        console.error(`\n❌ Missing required environment variables: ${missing.join(", ")}`);
        console.error("   Add them to server/.env (see .env.example) and restart.\n");
        process.exit(1);
    }
}

module.exports = { checkRequiredEnv };
