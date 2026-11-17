const express = require('express');
const nomination = require('../models/nomination');
const article = require('../models/article');
const { CATEGORIES, RELATIONSHIPS, cleanNomination, publicNominee } = require('../services/nominations');
const { imageUpload, saveImage } = require('../services/imageStore');
const { rateLimit } = require('../services/rateLimit');
const router = express.Router();


// ============================================================
// THE WALL OF STARS (Nominate a Star page)
// GET /nominations/stars
// ============================================================
// Past NextGen Stars stories + nominees the team has featured.
router.get('/stars', async (req, res) => {
    try {
        const [stories, featured] = await Promise.all([
            article.find({ status: 'published', createdBy: { $exists: true, $ne: null }, $or: [{ section: 'stars' }, { sectionLabel: /star/i }] }, 'slug title dek image imagePosition publishedAt')
                .sort({ publishedAt: -1 }).limit(24).lean(),
            nomination.find({ status: 'featured' }).sort({ updatedAt: -1 }).limit(24).lean(),
        ]);
        return res.status(200).json({
            success: true,
            categories: CATEGORIES,
            relationships: RELATIONSHIPS,
            stars: [
                ...stories.map((a) => ({ id: a.slug, kind: 'story', name: a.title, headline: a.dek, photo: a.image, imagePosition: a.imagePosition, href: `/articles/${a.slug}` })),
                ...featured.map(publicNominee),
            ],
        });
    } catch (error) {
        console.error('Stars error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// SEND A NOMINATION
// POST /nominations           (5 per hour per device)
// POST /nominations/photo     form-data "image", 3 MB  → { url }
// ============================================================
router.post('/', rateLimit({ max: 5, windowMs: 3600e3, message: 'You have sent a few nominations already. Try again in an hour.' }), async (req, res) => {
    try {
        const { data, error } = cleanNomination(req.body);
        if (error) return res.status(400).json({ success: false, message: error });
        await nomination.create(data);
        return res.status(201).json({ success: true, message: `Thank you! We'll read your nomination for ${data.nomineeName} 🌟` });
    } catch (err) {
        console.error('Nomination error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

const upload = imageUpload(10);
router.post('/photo', rateLimit({ max: 10, windowMs: 3600e3 }), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Choose a JPG, PNG or WEBP under 3 MB' });
        return res.status(200).json({ success: true, url: await saveImage(req.file, req, 'nextgen/nominations') });
    } catch (error) {
        console.error('Nomination photo error:', error);
        return res.status(500).json({ success: false, message: 'Upload failed' });
    }
});

module.exports = router;
