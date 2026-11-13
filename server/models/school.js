const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    name:                       { type: String, required: true, trim: true },
    city:                       { type: String, trim: true, default: null },
    state:                      { type: String, trim: true, default: null },
    slug:                       { type: String, required: true, unique: true },

    // Running totals, kept in sync by services/points.js (fast leaderboard reads)
    points:                     { type: Number, default: 0, index: true },
    studentCount:               { type: Number, default: 0 },

    verified:                   { type: Boolean, default: false }, // set by the NextGen team

    // ---------- Plan (bought on the school dashboard, or granted by the NextGen team) ----------
    plan:                       { type: String, default: null },   // plan id from Admin → Settings
    seats:                      { type: Number, default: 0 },      // student codes the school may create
    accessUntil:                { type: Date, default: null },     // students with this school's codes have access until then
    contactName:                { type: String, trim: true, default: null },
    contactPhone:               { type: String, trim: true, default: null },

    // ---------- Public profile (School Showcase), edited on the school dashboard ----------
    logo:                       { type: String, default: null },
    motto:                      { type: String, trim: true, maxlength: 120, default: null },
    about:                      { type: String, trim: true, maxlength: 1200, default: null },
    website:                    { type: String, trim: true, maxlength: 200, default: null },
    founded:                    { type: Number, default: null },
    schoolType:                 { type: String, enum: ['public', 'private', 'mission', 'federal', 'other', null], default: null },
    showOnShowcase:             { type: Boolean, default: true },
    sample:                     { type: Boolean, default: false },
}, {
    timestamps: true,
    collection: 'schools'
});

module.exports = mongoose.models.schools || mongoose.model('schools', schoolSchema);
