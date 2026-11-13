const express = require('express');
const student = require('../models/student');
const auth = require('../middleware/auth');
const { GAME_POINTS } = require('../config/rules');
const { awardPoints } = require('../services/points');
const { studentSummary } = require('../services/summary');
const router = express.Router();


// ============================================================
// FINISHED A MINI-GAME
// POST /user_games/complete  { game, edition }
// ============================================================
// Points once per game per edition. Games: money, sort, promise, wordsearch, crossword
// TODO: check each game's win on the server (like the quiz) before launch
router.post('/complete', auth, async (req, res) => {
    try {
        const { game, edition } = req.body;
        const pts = GAME_POINTS[game];

        if (!pts || !edition) {
            return res.status(400).json({
                success: false,
                message: `game must be one of: ${Object.keys(GAME_POINTS).join(', ')}`,
            });
        }

        const result = await awardPoints(req.user, `GAME:${game}`, edition, pts, { edition });
        const user = await student.findById(req.user._id);

        return res.status(200).json({
            success: true,
            awarded: result.awarded,
            locked: result.locked,
            message: result.locked ? 'Get NextGen access to earn points' : result.awarded ? `+${result.awarded} points` : 'Already counted for this edition',
            user: await studentSummary(user),
        });
    } catch (error) {
        console.error('Game complete error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
