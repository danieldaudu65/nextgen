const mongoose = require('mongoose');

// One-time join codes a school gives its students (one code = one student account).
const accessCodeSchema = new mongoose.Schema({
    code:                       { type: String, required: true, unique: true }, // "K7MP2QXA"
    school:                     { type: mongoose.Schema.Types.ObjectId, ref: 'schools', required: true, index: true },
    status:                     { type: String, enum: ['unused', 'used', 'revoked'], default: 'unused', index: true },
    label:                      { type: String, trim: true, default: null },  // optional: student name / class the school wrote down
    className:                  { type: String, trim: true, default: null },
    student:                    { type: mongoose.Schema.Types.ObjectId, ref: 'students', default: null },
    usedAt:                     { type: Date, default: null },
    sample:                     { type: Boolean, default: false },
}, {
    timestamps: true,
    collection: 'access_codes'
});

module.exports = mongoose.models.access_codes || mongoose.model('access_codes', accessCodeSchema);
