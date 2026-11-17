const express = require('express');
const article = require('../models/article');
const { listCategories, publicCategory, articleFilter, slugify } = require('../services/categories');
const router = express.Router();

const CARD_FIELDS = 'slug edition section sectionLabel pages title dek image imagePosition imageFit readMins points publishedAt author';

// ============================================================
// PUBLIC CATEGORIES
// GET /categories           → { categories }   (the ones switched on, in Admin order)
// GET /categories/:slug     → { category, articles }   published stories in it, newest first
// ============================================================
router.get('/', async (req, res) => {
    try {
        const list = await listCategories();
        return res.status(200).json({ success: true, categories: list.map(publicCategory) });
    } catch (error) {
        console.error('Public categories error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/:slug', async (req, res) => {
    try {
        const slug = slugify(req.params.slug);
        const list = await listCategories();
        const found = list.find((c) => c.slug === slug);
        if (!found) return res.status(404).json({ success: false, message: 'Category not found' });
        const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 30));
        const articles = await article
            .find({ status: 'published', createdBy: { $exists: true, $ne: null }, ...articleFilter(found) }, CARD_FIELDS)
            .sort({ publishedAt: -1 }).limit(limit).lean();
        return res.status(200).json({
            success: true,
            category: publicCategory(found),
            articles: articles.map(({ _id, ...a }) => a),
        });
    } catch (error) {
        console.error('Public category error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
