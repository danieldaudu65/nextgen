const express = require('express');
const mongoose = require('mongoose');
const debate = require('../models/debate');
const debateVote = require('../models/debateVote');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { POINTS } = require('../config/rules');
const { awardPoints } = require('../services/points');
const router = express.Router();

// What the website gets for a debate
const formatDebate = (d, mySide = null) => ({
    id: String(d._id),
    question: d.question,
    teamA: d.teamA,
    teamB: d.teamB,
    votesA: d.votesA,
    votesB: d.votesB,
    imageA: d.imageA,
    imageB: d.imageB,
    mySide,
});


// ============================================================
// CURRENT DEBATE (+ your vote if logged in)
// GET /user_debate/current
// ============================================================
router.get('/current', optionalAuth, async (req, res) => {
    try {
        const d = await debate.findOne({ active: true }).sort({ createdAt: -1 }).lean();

        if (!d) {
            return res.status(404).json({ success: false, message: 'No active debate' });
        }

        const mine = req.user ? await debateVote.findOne({ debate: d._id, student: req.user._id }).lean() : null;
        return res.status(200).json({ success: true, debate: formatDebate(d, mine?.side || null) });
    } catch (error) {
        console.error('Debate error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// VOTE (one vote per student)
// POST /user_debate/:id/vote  { side: "A" | "B" }
// ============================================================
router.post('/:id/vote', auth, async (req, res) => {
    try {
        const { side } = req.body;

        if (side !== 'A' && side !== 'B') {
            return res.status(400).json({ success: false, message: 'side must be "A" or "B"' });
        }
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Debate not found' });
        }

        // Save the vote (the unique index stops a second vote)
        try {
            await debateVote.create({ debate: req.params.id, student: req.user._id, side });
        } catch (err) {
            if (err?.code === 11000) {
                return res.status(409).json({ success: false, message: 'You already voted on this one 😉' });
            }
            throw err;
        }

        const d = await debate.findByIdAndUpdate(
            req.params.id,
            { $inc: side === 'A' ? { votesA: 1 } : { votesB: 1 } },
            { new: true }
        ).lean();

        if (!d) {
            return res.status(404).json({ success: false, message: 'Debate not found' });
        }

        const result = await awardPoints(req.user, 'DEBATE_VOTE', String(d._id), POINTS.DEBATE_VOTE, { edition: d.edition || null });
        return res.status(200).json({ success: true, debate: formatDebate(d, side), awarded: result.awarded, points: result.points, locked: result.locked });
    } catch (error) {
        console.error('Debate vote error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
