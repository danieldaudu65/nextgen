const express = require('express');
const edition = require('../models/edition');
const router = express.Router();

// Never send quiz answers to the browser (/user_quiz/:slug/check verifies them)
function publicEdition(doc) {
    const { _id, __v, createdAt, updatedAt, article: _legacyArticle, ...rest } = doc;
    return { ...rest, quiz: (doc.quiz || []).map(({ answer, ...q }) => q) };
}


// ============================================================
// ALL EDITIONS (the shelf)
// GET /editions
// ============================================================
router.get('/', async (req, res) => {
    try {
        const list = await edition
            .find({}, 'slug title month status cover label subtitle publishedAt')
            .sort({ publishedAt: -1 })
            .lean();

        return res.status(200).json({ success: true, editions: list.map(({ _id, ...e }) => e) });
    } catch (error) {
        console.error('Editions error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// CURRENT EDITION (everything the homepage needs)
// GET /editions/current
// ============================================================
router.get('/current', async (req, res) => {
    try {
        const doc = await edition.findOne({ status: 'current' }).sort({ publishedAt: -1 }).lean();

        if (!doc) {
            return res.status(404).json({ success: false, message: 'No current edition yet. Run `npm run seed`.' });
        }

        return res.status(200).json({ success: true, edition: publicEdition(doc) });
    } catch (error) {
        console.error('Current edition error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// ONE EDITION
// GET /editions/:slug
// ============================================================
router.get('/:slug', async (req, res) => {
    try {
        const doc = await edition.findOne({ slug: req.params.slug }).lean();

        if (!doc) {
            return res.status(404).json({ success: false, message: 'Edition not found' });
        }

        return res.status(200).json({ success: true, edition: publicEdition(doc) });
    } catch (error) {
        console.error('Edition error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
