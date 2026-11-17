const mongoose = require('mongoose');

// NextGen World: a student's best stars on each level of one edition's island.
// One row per student per edition. Stars only go up (best score is kept).
const worldProgressSchema = new mongoose.Schema({
    student:                    { type: mongoose.Schema.Types.ObjectId, ref: 'students', required: true },
    edition:                    { type: String, required: true }, // edition slug, e.g. "oct-2026"
    stars: {
        money:                  { type: Number, default: 0, min: 0, max: 3 },
        quiz:                   { type: Number, default: 0, min: 0, max: 3 },
        debate:                 { type: Number, default: 0, min: 0, max: 3 },
        sort:                   { type: Number, default: 0, min: 0, max: 3 },
        promise:                { type: Number, default: 0, min: 0, max: 3 },
        wordsearch:             { type: Number, default: 0, min: 0, max: 3 },
        boss:                   { type: Number, default: 0, min: 0, max: 3 },
    },
}, {
    timestamps: true,
    collection: 'world_progress'
});

worldProgressSchema.index({ student: 1, edition: 1 }, { unique: true });

module.exports = mongoose.models.world_progress || mongoose.model('world_progress', worldProgressSchema);
