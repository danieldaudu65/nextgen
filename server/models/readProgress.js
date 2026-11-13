const mongoose = require('mongoose');

// One row per student per story: how far they have read.
const readProgressSchema = new mongoose.Schema({
    student:                    { type: mongoose.Schema.Types.ObjectId, ref: 'students', required: true },
    edition:                    { type: String, required: true },  // edition slug, e.g. "oct-2026"
    article:                    { type: String, required: true },  // story slug
    firstSeenAt:                { type: Date, default: Date.now },
    activeSeconds:              { type: Number, default: 0 },
    maxScroll:                  { type: Number, default: 0 },      // 0 → 1
    completed:                  { type: Boolean, default: false },
    completedAt:                { type: Date, default: null },
    completedDay:               { type: String, default: null },   // "YYYY-MM-DD" Lagos, for the daily mission

    // ---------- The story question (see services/readCheck.js) ----------
    qAttempts:                  { type: Number, default: 0 },
    qStartedAt:                 { type: Date, default: null },
    qAnsweredAt:                { type: Date, default: null },
    qDone:                      { type: Boolean, default: false },  // answered correctly
    qLastResult:                { type: String, enum: ['correct', 'wrong', 'timeout', null], default: null },
}, {
    timestamps: true,
    collection: 'read_progress'
});

readProgressSchema.index({ student: 1, article: 1 }, { unique: true });
readProgressSchema.index({ student: 1, completedDay: 1 });

module.exports = mongoose.models.read_progress || mongoose.model('read_progress', readProgressSchema);
