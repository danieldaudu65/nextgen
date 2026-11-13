const mongoose = require('mongoose');

// A school's login for the school dashboard (head teacher, NextGen coordinator, ...)
const schoolAccountSchema = new mongoose.Schema({
    school:                     { type: mongoose.Schema.Types.ObjectId, ref: 'schools', required: true, index: true },
    name:                       { type: String, required: true, trim: true, maxlength: 60 },
    email:                      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:                   { type: String, required: true, select: false }, // bcrypt hash
    active:                     { type: Boolean, default: true },
    lastLoginAt:                { type: Date, default: null },
    sample:                     { type: Boolean, default: false },
}, {
    timestamps: true,
    collection: 'school_accounts'
});

module.exports = mongoose.models.school_accounts || mongoose.model('school_accounts', schoolAccountSchema);
