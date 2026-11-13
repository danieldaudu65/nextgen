const express = require('express');
const edition = require('../models/edition');
const article = require('../models/article');
const { requireAdmin, requireRole } = require('../middleware/adminAuth');
const { syncFromSections } = require('../services/categories');
const router = express.Router();

// Fields an editor may set
const EDITABLE = ['title', 'month', 'volume', 'year', 'volumeNumber', 'issueMonth', 'status', 'cover', 'label', 'subtitle', 'tagline', 'headline', 'headlineAccent',
    'lede', 'electionDate', 'ticker', 'sections', 'vocab', 'quiz', 'sort', 'promiseQuestions', 'money', 'wordSearch', 'publishedAt'];

const pick = (body) => {
    const data = {};
    EDITABLE.forEach((k) => { if (body[k] !== undefined) data[k] = body[k]; });
    return data;
};

function withYearMetadata(e) {
    const year = e.year || Number(String(e.month || e.slug).match(/20\d{2}/)?.[0]) || undefined;
    const monthText = String(e.issueMonth || e.month || e.slug).toLowerCase();
    const issueMonth = e.issueMonth || ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].find((m) => monthText.includes(m)) || 'other';
    const monthVolume = { march: 1, june: 2, september: 3, december: 4 }[issueMonth];
    return { ...e, year, issueMonth, volumeNumber: e.volumeNumber || monthVolume };
}

// Only one edition can be "current" (the one on the homepage)
async function makeOnlyCurrent(slug) {
    await edition.updateMany({ status: 'current', slug: { $ne: slug } }, { $set: { status: 'archive' } });
}


// ============================================================
// LIST
// GET /admin_editions
// ============================================================
router.get('/', requireAdmin, async (req, res) => {
    try {
        const [list, counts] = await Promise.all([
            edition.find({}, 'slug title month volume year volumeNumber issueMonth status cover publishedAt updatedAt').sort({ publishedAt: -1 }).lean(),
            article.aggregate([{ $group: { _id: '$edition', total: { $sum: 1 }, published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } } } }]),
        ]);
        const bySlug = Object.fromEntries(counts.map((c) => [c._id, c]));

        return res.status(200).json({
            success: true,
            editions: list.map(({ _id, ...e }) => ({ ...withYearMetadata(e), stories: bySlug[e.slug]?.total || 0, published: bySlug[e.slug]?.published || 0 })),
        });
    } catch (error) {
        console.error('Admin editions error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// ONE EDITION (everything, including quiz answers)
// GET /admin_editions/:slug
// ============================================================
router.get('/:slug', requireAdmin, async (req, res) => {
    try {
        const doc = await edition.findOne({ slug: req.params.slug }).lean();
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Edition not found' });
        }
        const { _id, __v, article: _legacyArticle, ...rest } = doc;
        return res.status(200).json({ success: true, edition: rest });
    } catch (error) {
        console.error('Admin edition error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// CREATE (editors)
// POST /admin_editions  { slug, title, month, ... }
// ============================================================
router.post('/', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        const slug = String(req.body.slug || '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-');
        const data = pick(req.body);

        if (!slug || !data.month) {
            return res.status(400).json({ success: false, message: 'Link (slug) and release month are required' });
        }
        if (data.issueMonth && !['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'other'].includes(data.issueMonth)) {
            return res.status(400).json({ success: false, message: 'Choose a valid release month.' });
        }
        if (await edition.exists({ slug })) {
            return res.status(409).json({ success: false, message: 'An edition with that slug already exists' });
        }
        if (data.year && data.volumeNumber && await edition.exists({ year: data.year, volumeNumber: data.volumeNumber })) {
            return res.status(409).json({ success: false, message: 'That year already has this volume. Open it from the year edition list.' });
        }

        const doc = await edition.create({ status: 'upcoming', ...data, slug });
        if (doc.status === 'current') await makeOnlyCurrent(doc.slug);

        await syncFromSections({ force: true }).catch(() => {}); // new sections → categories
        return res.status(201).json({ success: true, message: 'Edition created', edition: { slug: doc.slug } });
    } catch (error) {
        console.error('Create edition error:', error);
        return res.status(500).json({ success: false, message: error.name === 'ValidationError' ? error.message : 'Server error' });
    }
});


// ============================================================
// UPDATE (editors)
// PUT /admin_editions/:slug
// ============================================================
router.put('/:slug', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        const doc = await edition.findOne({ slug: req.params.slug });
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Edition not found' });
        }

        const nextYear = req.body.year === null ? undefined : req.body.year ?? doc.year;
        const nextVolume = req.body.volumeNumber ?? doc.volumeNumber;
        if (nextYear && nextVolume && await edition.exists({ _id: { $ne: doc._id }, year: nextYear, volumeNumber: nextVolume })) {
            return res.status(409).json({ success: false, message: 'That year already has this volume.' });
        }

        Object.assign(doc, pick(req.body));
        if (doc.status === 'current' && !doc.publishedAt) doc.publishedAt = new Date();
        await doc.save();
        await syncFromSections({ force: true }).catch(() => {}); // new sections → categories
        if (doc.status === 'current') await makeOnlyCurrent(doc.slug);

        return res.status(200).json({ success: true, message: 'Edition saved' });
    } catch (error) {
        console.error('Update edition error:', error);
        return res.status(error.name === 'ValidationError' ? 400 : 500).json({
            success: false,
            message: error.name === 'ValidationError' ? error.message : 'Server error',
        });
    }
});


// ============================================================
// DELETE (superadmin, only if it has no stories)
// DELETE /admin_editions/:slug
// ============================================================
router.delete('/:slug', requireAdmin, requireRole('superadmin'), async (req, res) => {
    try {
        if (await article.exists({ edition: req.params.slug })) {
            return res.status(400).json({ success: false, message: 'Move or delete this edition\'s stories first' });
        }
        const result = await edition.deleteOne({ slug: req.params.slug });
        if (!result.deletedCount) {
            return res.status(404).json({ success: false, message: 'Edition not found' });
        }
        return res.status(200).json({ success: true, message: 'Edition deleted' });
    } catch (error) {
        console.error('Delete edition error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
