const mongoose = require('mongoose');

// The points ledger. Every point a student earns is one row here.
// The unique index on (student, action, ref) means nothing can be claimed twice.
const pointsEventSchema = new mongoose.Schema({
    student:                    { type: mongoose.Schema.Types.ObjectId, ref: 'students', required: true },
    school:                     { type: mongoose.Schema.Types.ObjectId, ref: 'schools', default: null, index: true },
    action:                     { type: String, required: true }, // READ_STORY, QUIZ_CORRECT, GAME:money, ...
    ref:                        { type: String, required: true }, // what it was for, e.g. "oct-2026:whats-an-election"
    points:                     { type: Number, required: true },
    day:                        { type: String, index: true },    // "YYYY-MM-DD" Lagos
    edition:                    { type: String, default: null, index: true }, // volume slug, for "per volume / per edition" leaderboards
}, {
    timestamps: true,
    collection: 'points_events'
});

pointsEventSchema.index({ student: 1, action: 1, ref: 1 }, { unique: true });
pointsEventSchema.index({ createdAt: -1 });

module.exports = mongoose.models.points_events || mongoose.model('points_events', pointsEventSchema);
