const mongoose = require('mongoose');

const debateSchema = new mongoose.Schema({
    edition:                    { type: String, index: true },
    question:                   { type: String, required: true },
    teamA:                      { label: String, pitch: String },
    teamB:                      { label: String, pitch: String },
    votesA:                     { type: Number, default: 0 },
    votesB:                     { type: Number, default: 0 },
    imageA:                     { type: String, default: null },
    imageB:                     { type: String, default: null },
    active:                     { type: Boolean, default: true, index: true },
}, {
    timestamps: true,
    collection: 'debates'
});

module.exports = mongoose.models.debates || mongoose.model('debates', debateSchema);
