const mongoose = require('mongoose');

// NextGen team members who use the admin panel (/admin).
//   writer     → writes stories, sends them for review (can't publish)
//   editor     → everything a writer can + publish, editions, schools
//   superadmin → everything + manage the team
const adminSchema = new mongoose.Schema({
    name:                       { type: String, required: true, trim: true },
    email:                      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:                   { type: String, required: true, select: false }, // bcrypt hash
    role:                       { type: String, enum: ['writer', 'editor', 'superadmin'], default: 'writer', index: true },
    active:                     { type: Boolean, default: true },
    lastLoginAt:                { type: Date, default: null },
}, {
    timestamps: true,
    collection: 'admins'
});

module.exports = mongoose.models.admins || mongoose.model('admins', adminSchema);
