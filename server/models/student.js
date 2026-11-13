const mongoose = require('mongoose');

// Students are often under 18: keep personal data to the minimum.
// No email, phone, birthday or photo; just a display name, a handle and a school.
const studentSchema = new mongoose.Schema({
    name:                       { type: String, required: true, trim: true, maxlength: 40 },
    handle:                     { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9._]{3,20}$/ },
    password:                   { type: String, required: true, select: false }, // bcrypt hash, never the real password
    school:                     { type: mongoose.Schema.Types.ObjectId, ref: 'schools', index: true },
    className:                  { type: String, trim: true, maxlength: 20, default: null }, // e.g. "SS2"
    color:                      { type: String, default: '#F5C518' },

    // ---------- Points & streaks (see services/points.js) ----------
    points:                     { type: Number, default: 0, index: true },
    streak:                     { type: Number, default: 0 },
    bestStreak:                 { type: Number, default: 0 },
    lastActiveDay:              { type: String, default: null }, // "YYYY-MM-DD" in Lagos time

    // ---------- Access (school seat or personal plan, see services/access.js) ----------
    access:                     {
        type:                   { type: String, enum: ['school', 'personal', null], default: null },
        until:                  { type: Date, default: null },
    },
    accessCode:                 { type: mongoose.Schema.Types.ObjectId, ref: 'access_codes', default: null }, // school code used to join
    deviceId:                   { type: String, default: null, select: false }, // school-code accounts are locked to one device

    sample:                     { type: Boolean, default: false }, // demo rows made by scripts/seed.js
}, {
    timestamps: true,
    collection: 'students'
});

module.exports = mongoose.models.students || mongoose.model('students', studentSchema);
