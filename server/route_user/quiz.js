const express = require('express');
const edition = require('../models/edition');
const optionalAuth = require('../middleware/optionalAuth');
const { POINTS } = require('../config/rules');
const { awardPoints } = require('../services/points');
const router = express.Router();


// ============================================================
// CHECK A QUIZ ANSWER
// POST /user_quiz/:slug/check  { questionId, choice }
// ============================================================
// Answers never leave the server. Guests can play;
// logged-in students also get points (once per question).
router.post('/:slug/check', optionalAuth, async (req, res) => {
    try {
        const { questionId, choice } = req.body;

        if (typeof questionId !== 'string' || typeof choice !== 'number') {
            return res.status(400).json({ success: false, message: 'Send { questionId: string, choice: number }' });
        }

        const ed = await edition.findOne({ slug: req.params.slug }, 'quiz').lean();
        const question = ed?.quiz?.find((q) => q.id === questionId);

        if (!question) {
            return res.status(404).json({ success: false, message: 'Question not found' });
        }

        const correct = question.answer === choice;
        let awarded = 0;
        let points = null;
        let locked = false;

        if (correct && req.user) {
            const result = await awardPoints(req.user, 'QUIZ_CORRECT', `${req.params.slug}:${questionId}`, POINTS.QUIZ_CORRECT, { edition: req.params.slug });
            locked = result.locked;
            awarded = result.awarded;
            points = result.points;
        }

        return res.status(200).json({ success: true, correct, answer: question.answer, awarded, points, locked });
    } catch (error) {
        console.error('Quiz check error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
