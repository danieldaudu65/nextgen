const express = require('express');
const edition = require('../models/edition');
const student = require('../models/student');
const worldProgress = require('../models/worldProgress');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { POINTS } = require('../config/rules');
const { awardPoints } = require('../services/points');
const { studentSummary } = require('../services/summary');
const { LEVEL_KEYS, publicBoss, checkBoss, cleanStars, currentLevel, isOpen } = require('../services/world');
const router = express.Router();

const findEdition = (slug) => edition.findOne({ slug }, 'slug vocab quiz').lean();
const starsOf = async (user, slug) => cleanStars((await worldProgress.findOne({ student: user._id, edition: slug }).lean())?.stars);

// Keep the best stars for one level
async function saveStars(user, slug, game, stars){
    await worldProgress.updateOne(
        { student: user._id, edition: slug },
        { $max: { [`stars.${game}`]: stars }, $setOnInsert: { student: user._id, edition: slug } },
        { upsert: true },
    );
    return starsOf(user, slug);
}


// ============================================================
// MY PROGRESS ON AN ISLAND
// GET /user_world/:slug
// ============================================================
// Guests get null (the browser keeps their stars instead).
router.get('/:slug', optionalAuth, async (req, res) => {
    try {
        if (!req.user) return res.status(200).json({ success: true, stars: null, current: 0, levels: LEVEL_KEYS });
        const stars = await starsOf(req.user, req.params.slug);
        return res.status(200).json({ success: true, stars, current: currentLevel(stars), levels: LEVEL_KEYS });
    } catch (error) {
        console.error('World progress error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// SAVE A LEVEL RESULT (stars only; points still come from each game's own route)
// POST /user_world/:slug/result  { game, stars }
// ============================================================
// TODO: like /user_games/complete, check each game's win on the server before launch
router.post('/:slug/result', auth, async (req, res) => {
    try {
        const { game } = req.body;
        const stars = Math.round(Number(req.body.stars));
        if (!LEVEL_KEYS.includes(game) || game === 'boss' || !(stars >= 0 && stars <= 3)) {
            return res.status(400).json({ success: false, message: 'Send { game, stars: 0-3 }. The Boss is checked by /boss.' });
        }
        const ed = await edition.exists({ slug: req.params.slug });
        if (!ed) return res.status(404).json({ success: false, message: 'Edition not found' });

        const now = await starsOf(req.user, req.params.slug);
        if (!isOpen(now, game)) return res.status(403).json({ success: false, message: 'Clear the level before this one first' });

        const saved = await saveStars(req.user, req.params.slug, game, stars);
        return res.status(200).json({ success: true, stars: saved, current: currentLevel(saved) });
    } catch (error) {
        console.error('World result error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// THE BOSS: get the questions (no answers)
// GET /user_world/:slug/boss
// ============================================================
router.get('/:slug/boss', async (req, res) => {
    try {
        const ed = await findEdition(req.params.slug);
        if (!ed) return res.status(404).json({ success: false, message: 'Edition not found' });
        return res.status(200).json({ success: true, questions: publicBoss(ed) });
    } catch (error) {
        console.error('Boss questions error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// THE BOSS: check the answers
// POST /user_world/:slug/boss  { answers: [{ id, choice }] }
// ============================================================
// Guests can play (no points). Students get points once per edition when they win.
// The browser checks each answer as it goes (final: false) and sends them all at the end (final: true);
// only the final check saves stars and gives points.
router.post('/:slug/boss', optionalAuth, async (req, res) => {
    try {
        const ed = await findEdition(req.params.slug);
        if (!ed) return res.status(404).json({ success: false, message: 'Edition not found' });

        const result = checkBoss(ed, req.body.answers);
        let awarded = 0, locked = false, stars = null, user = null;

        if (req.user && req.body.final === true) {
            const now = await starsOf(req.user, req.params.slug);
            if (!isOpen(now, 'boss')) return res.status(403).json({ success: false, message: 'Clear every level before the Boss first' });
            if (result.stars > 0) {
                const r = await awardPoints(req.user, 'WORLD_BOSS', req.params.slug, POINTS.WORLD_BOSS, { edition: req.params.slug });
                awarded = r.awarded; locked = r.locked;
            }
            stars = await saveStars(req.user, req.params.slug, 'boss', result.stars);
            user = await studentSummary(await student.findById(req.user._id));
        }

        return res.status(200).json({ success: true, ...result, awarded, locked, progress: stars, user });
    } catch (error) {
        console.error('Boss check error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
