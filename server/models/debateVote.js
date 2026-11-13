const mongoose = require('mongoose');

// One vote per student per debate (the unique index enforces it)
const debateVoteSchema = new mongoose.Schema({
    debate:                     { type: mongoose.Schema.Types.ObjectId, ref: 'debates', required: true },
    student:                    { type: mongoose.Schema.Types.ObjectId, ref: 'students', required: true },
    side:                       { type: String, enum: ['A', 'B'], required: true },
}, {
    timestamps: true,
    collection: 'debate_votes'
});

debateVoteSchema.index({ debate: 1, student: 1 }, { unique: true });

module.exports = mongoose.models.debate_votes || mongoose.model('debate_votes', debateVoteSchema);
