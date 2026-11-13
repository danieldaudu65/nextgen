// ===============================
// NextGen Server - index.js
// ===============================

require('dotenv').config(); // load env before anything else reads it

// Stop early (with a clear message) if MONGODB_URI / JWT_SECRET are missing
require('./config/secrets').checkRequiredEnv();

// Use public DNS so mongodb+srv:// works on every network (see config/dns.js)
require('./config/dns');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Initialize Express
const app = express();
const port = process.env.PORT || 5000;

// ===============================
// Middleware
// ===============================
const { allowedOrigins } = require('./config/origins');

// rawBody: the Paystack webhook checks its signature against the exact bytes
app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: allowedOrigins, credentials: true })); // credentials = send the login cookie
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '30d', immutable: true }));

// VERY IMPORTANT FOR RENDER (cookies behind a proxy)
app.set('trust proxy', 1);

// ===============================
// MongoDB Connection
// ===============================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));

// ===============================
// Routes
// ===============================

// Public (no login needed)
app.use('/editions', require('./route_public/edition'));
app.use('/articles', require('./route_public/article'));
app.use('/schools', require('./route_public/school'));
app.use('/leaderboard', require('./route_public/leaderboard'));
app.use('/site', require('./route_public/settings'));
app.use('/paystack', require('./route_public/paystack'));
app.use('/nominations', require('./route_public/nominations'));
app.use('/categories', require('./route_public/categories'));

// Students
app.use('/user_auth', require('./route_user/auth'));
app.use('/user_reading', require('./route_user/reading'));
app.use('/user_games', require('./route_user/games'));
app.use('/user_quiz', require('./route_user/quiz'));
app.use('/user_debate', require('./route_user/debate'));
app.use('/user_pay', require('./route_user/pay'));

// Schools (school dashboard)
app.use('/school_auth', require('./route_school/auth'));
app.use('/school_dashboard', require('./route_school/dashboard'));

// NextGen team (admin panel)
app.use('/admin_auth', require('./route_admin/auth'));
app.use('/admin_dashboard', require('./route_admin/dashboard'));
app.use('/admin_articles', require('./route_admin/articles'));
app.use('/admin_editions', require('./route_admin/editions'));
app.use('/admin_schools', require('./route_admin/schools'));
app.use('/admin_team', require('./route_admin/team'));
app.use('/admin_uploads', require('./route_admin/uploads'));
app.use('/admin_settings', require('./route_admin/settings'));
app.use('/admin_nominations', require('./route_admin/nominations'));
app.use('/admin_categories', require('./route_admin/categories'));

// ===============================
// Default Route
// ===============================
app.get('/', (req, res) => {
    res.send('Welcome to NextGen Server');
});

app.get('/health', (req, res) => {
    res.json({
        ok: true,
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: Math.round(process.uptime()),
    });
});

// ===============================
// Start Server
// ===============================
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
