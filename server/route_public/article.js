const express = require('express');
const article = require('../models/article');
const edition = require('../models/edition');
const { getSettings } = require('../services/settings');
const router = express.Router();

// Fields shown on cards / lists (not the full story)
const CARD_FIELDS = 'slug edition section sectionLabel pages title dek image imagePosition imageFit readMins points publishedAt author';

// Never send the question's answer: the page only learns that a question exists
const clean = ({ _id, __v, createdAt, updatedAt, createdBy, updatedBy, question, reviewNote, ...rest }) => ({
    ...rest,
    hasQuestion: Boolean(question && String(question.prompt || '').trim() && (question.options || []).filter(Boolean).length >= 2),
});

// The rotating homepage hero: published stories with a picture and "Show in the homepage hero" on.
// Newest switched on first; how many (heroMax) and how long each stays (heroSeconds) come from Admin → Settings.
router.get('/homepage', async (req, res) => {
    try {
        const { home } = await getSettings();
        const filter = { status: 'published', createdBy: { $exists: true, $ne: null }, homepageFeatured: true, image: { $nin: [null, ''] } };
        const list = await article.find(filter, CARD_FIELDS).sort({ homepageAt: -1, publishedAt: -1 }).limit(home.heroMax).lean();
        return res.status(200).json({ success: true, articles: list.map(clean), total: list.length, seconds: home.heroSeconds });
    } catch (error) {
        console.error('Homepage articles error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// One published, admin-created story for the homepage reader preview.
router.get('/lead', async (req, res) => {
    try {
        const doc = await article.findOne({ status: 'published', createdBy: { $exists: true, $ne: null } })
            .sort({ homepageFeatured: -1, publishedAt: -1 }).lean();
        if (!doc) return res.status(200).json({ success: true, article: null, vocab: [] });
        const ed = await edition.findOne({ slug: doc.edition }, 'vocab').lean();
        return res.status(200).json({ success: true, article: clean(doc), vocab: ed?.vocab || [] });
    } catch (error) {
        console.error('Lead article error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// LIST ARTICLES
// GET /articles?edition=oct-2026&section=big-news&limit=20
// ============================================================
router.get('/', async (req, res) => {
    try {
        const filter = { status: 'published', createdBy: { $exists: true, $ne: null } };
        if (req.query.edition) filter.edition = String(req.query.edition);
        if (req.query.section) filter.section = String(req.query.section);
        const limit = Math.min(Number(req.query.limit) || 20, 100);

        const list = await article.find(filter, CARD_FIELDS).sort({ publishedAt: -1 }).limit(limit).lean();

        return res.status(200).json({ success: true, articles: list.map(clean) });
    } catch (error) {
        console.error('Articles error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// ONE ARTICLE (+ the edition's Vocab Vault words + related stories)
// GET /articles/:slug
// ============================================================
router.get('/:slug', async (req, res) => {
    try {
        const doc = await article.findOne({ slug: req.params.slug, status: 'published', createdBy: { $exists: true, $ne: null } }).lean();

        if (!doc) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }

        const [ed, related] = await Promise.all([
            edition.findOne({ slug: doc.edition }, 'slug title month vocab').lean(),
            article
                .find({ edition: doc.edition, slug: { $ne: doc.slug }, status: 'published', createdBy: { $exists: true, $ne: null } }, CARD_FIELDS)
                .sort({ publishedAt: -1 })
                .limit(3)
                .lean(),
        ]);

        return res.status(200).json({
            success: true,
            article: clean(doc),
            edition: ed ? { slug: ed.slug, title: ed.title, month: ed.month } : null,
            vocab: ed?.vocab || [],
            related: related.map(clean),
        });
    } catch (error) {
        console.error('Article error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
