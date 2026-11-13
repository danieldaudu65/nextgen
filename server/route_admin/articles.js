const express = require('express');
const mongoose = require('mongoose');
const article = require('../models/article');
const edition = require('../models/edition');
const { requireAdmin, requireRole, hasRole } = require('../middleware/adminAuth');
const { getSettings } = require('../services/settings');
const { formatStory } = require('../services/storyFormatter');
const { validQuestion } = require('../services/readCheck');
const router = express.Router();

// Fields an admin may set (anything else in the body is ignored)
const EDITABLE = ['slug', 'edition', 'section', 'sectionLabel', 'pages', 'title', 'dek', 'image', 'imagePosition', 'imageFit',
    'gallery', 'homepageFeatured', 'author', 'readMins', 'points', 'body', 'eli10', 'game', 'tags', 'reviewNote', 'question'];

const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);

const pick = (body) => {
    const data = {};
    EDITABLE.forEach((k) => { if (body[k] !== undefined) data[k] = body[k]; });
    if (data.slug !== undefined) data.slug = slugify(data.slug);
    if (Array.isArray(data.body)) data.body = data.body.map(String).filter((b) => b.trim());
    if (Array.isArray(data.eli10)) data.eli10 = data.eli10.map(String).filter((b) => b.trim());
    if (Array.isArray(data.tags)) data.tags = data.tags.map((t) => String(t).trim()).filter(Boolean);
    if (Array.isArray(data.gallery)) data.gallery = data.gallery
        .filter((item) => item && typeof item.image === 'string' && item.image.trim())
        .map((item) => ({ image: item.image.trim(), caption: String(item.caption || '').trim() }));
    // The check question: keep it only when complete (prompt, 2–4 options, a valid answer); empty clears it
    if (data.question !== undefined) data.question = validQuestion(data.question) || { prompt: '', options: [], answer: 0, explain: '' };
    return data;
};

// Writers can only move their stories between draft and review.
// Editors and superadmins can publish / unpublish.
function allowedStatus(user, status) {
    if (!status) return true;
    if (status === 'published') return hasRole(user, 'editor');
    return ['draft', 'review'].includes(status);
}

// Writers can edit their own stories while they are not published
function canEdit(user, doc) {
    if (hasRole(user, 'editor')) return true;
    return String(doc.createdBy) === String(user._id) && doc.status !== 'published';
}

function hasStoryText(blocks) {
    return Array.isArray(blocks) && blocks.some((block) => String(block).replace(/^(?:#{1,3} |> ?|[-*] |\d+\. )/, '').trim().length > 0);
}


// ============================================================
// LIST (all statuses)
// GET /admin_articles?status=review&edition=oct-2026&q=money&mine=1
// ============================================================
router.get('/', requireAdmin, async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = String(req.query.status);
        if (req.query.edition) filter.edition = String(req.query.edition);
        if (req.query.mine === '1') filter.createdBy = req.admin._id;
        if (req.query.q) {
            const q = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [{ title: { $regex: q, $options: 'i' } }, { slug: { $regex: q, $options: 'i' } }];
        }

        const list = await article
            .find(filter, 'slug edition section sectionLabel title status readMins updatedAt publishedAt createdBy updatedBy image imagePosition imageFit homepageFeatured')
            .sort({ updatedAt: -1 })
            .limit(200)
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name')
            .lean();

        return res.status(200).json({
            success: true,
            articles: list.map((a) => ({
                ...a,
                id: String(a._id),
                _id: undefined,
                createdBy: a.createdBy?.name || 'Seed data',
                updatedBy: a.updatedBy?.name || null,
            })),
        });
    } catch (error) {
        console.error('Admin articles error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// HOMEPAGE HERO
// GET   /admin_articles/homepage          → { max, seconds, live, articles }
// PATCH /admin_articles/:id/homepage      { on: true|false }   (editors)
// A story shows in the rotating hero when it is published, has a picture and
// "Show in the homepage hero" is on. Newest switched on first; the first `max` show.
// ============================================================
const heroState = (a) => (a.status !== 'published' ? 'not-published' : !a.image ? 'no-picture' : 'live');

router.get('/homepage', requireAdmin, async (req, res) => {
    try {
        const { home } = await getSettings();
        const list = await article.find({ homepageFeatured: true }, 'slug title status image imagePosition imageFit sectionLabel publishedAt homepageAt')
            .sort({ homepageAt: -1, publishedAt: -1 }).limit(50).lean();
        let shown = 0;
        const articles = list.map((a) => {
            let state = heroState(a);
            if (state === 'live') { shown += 1; if (shown > home.heroMax) state = 'waiting'; }
            return { ...a, id: String(a._id), _id: undefined, state };
        });
        return res.status(200).json({ success: true, max: home.heroMax, seconds: home.heroSeconds, live: Math.min(shown, home.heroMax), articles });
    } catch (error) {
        console.error('Homepage hero list error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.patch('/:id/homepage', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Article not found' });
        const on = Boolean(req.body?.on);
        const doc = await article.findByIdAndUpdate(req.params.id,
            { $set: { homepageFeatured: on, homepageAt: on ? new Date() : null, updatedBy: req.admin._id } },
            { new: true, projection: 'title status image homepageFeatured' }).lean();
        if (!doc) return res.status(404).json({ success: false, message: 'Article not found' });
        const note = !on ? 'Removed from the homepage' : doc.status !== 'published' ? 'Added: it will show once it is published'
            : !doc.image ? 'Added: add a picture so it can show' : 'Added to the homepage';
        return res.status(200).json({ success: true, message: note, homepageFeatured: doc.homepageFeatured });
    } catch (error) {
        console.error('Homepage toggle error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// ONE ARTICLE
// GET /admin_articles/:id
// ============================================================
// ============================================================
// FORMAT A PASTED ARTICLE
// POST /admin_articles/format   { text, edition? }
// → { story: { title, dek, section, sectionLabel, tags, body, eli10, readMins, vocab, notes }, source: 'ai' | 'basic' }
// Uses Claude when ANTHROPIC_API_KEY is set (see services/storyFormatter.js); nothing is saved here.
// ============================================================
router.post('/format', requireAdmin, async (req, res) => {
    try {
        const { text, edition: editionSlug } = req.body || {};
        const vol = editionSlug ? await edition.findOne({ slug: String(editionSlug) }, 'sections vocab').lean() : null;
        const result = await formatStory(text, {
            sections: (vol?.sections || []).map((s) => ({ key: s.key, label: s.label })),
            vocab: vol?.vocab || [],
        });
        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        console.error('Format story error:', err.message);
        return res.status(err.status || 502).json({ success: false, message: err.message || 'Could not format the story' });
    }
});

router.get('/:id', requireAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }
        const doc = await article.findById(req.params.id).populate('createdBy', 'name').lean();
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }
        return res.status(200).json({
            success: true,
            article: { ...doc, id: String(doc._id), _id: undefined, createdById: doc.createdBy?._id ? String(doc.createdBy._id) : null, createdBy: doc.createdBy?.name || 'Seed data' },
        });
    } catch (error) {
        console.error('Admin article error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// CREATE
// POST /admin_articles  { title, edition, section, ..., status? }
// ============================================================
router.post('/', requireAdmin, async (req, res) => {
    try {
        const data = pick(req.body);
        const status = req.body.status || 'draft';

        if (!data.title || !data.edition || !data.section || !data.sectionLabel) {
            return res.status(400).json({ success: false, message: 'Title, edition and section are required' });
        }
        if (!allowedStatus(req.admin, status)) {
            return res.status(403).json({ success: false, message: 'Only editors can publish' });
        }
        if (status === 'published' && !hasStoryText(data.body)) {
            return res.status(400).json({ success: false, message: 'Add the story text before publishing.' });
        }
        if (!(await edition.exists({ slug: data.edition }))) {
            return res.status(400).json({ success: false, message: 'That edition does not exist' });
        }

        data.slug = data.slug || slugify(data.title);
        if (await article.exists({ slug: data.slug })) {
            return res.status(409).json({ success: false, message: 'Another story already uses that link (slug). Change it.' });
        }

        const doc = await article.create({
            ...data,
            status,
            publishedAt: status === 'published' ? new Date() : null,
            homepageAt: data.homepageFeatured ? new Date() : null,
            createdBy: req.admin._id,
            updatedBy: req.admin._id,
        });

        return res.status(201).json({ success: true, message: 'Story created', article: { id: String(doc._id), slug: doc.slug, status: doc.status } });
    } catch (error) {
        console.error('Create article error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// UPDATE (also used to send for review / publish / unpublish)
// PUT /admin_articles/:id  { ...fields, status? }
// ============================================================
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }
        const doc = await article.findById(req.params.id);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }
        if (!canEdit(req.admin, doc)) {
            return res.status(403).json({ success: false, message: 'You can only edit your own unpublished stories' });
        }

        const data = pick(req.body);
        const status = req.body.status;
        if (!allowedStatus(req.admin, status)) {
            return res.status(403).json({ success: false, message: 'Only editors can publish' });
        }
        if (status === 'published' && !hasStoryText(data.body ?? doc.body)) {
            return res.status(400).json({ success: false, message: 'Add the story text before publishing.' });
        }

        if (data.slug && data.slug !== doc.slug && (await article.exists({ slug: data.slug }))) {
            return res.status(409).json({ success: false, message: 'Another story already uses that link (slug). Change it.' });
        }
        if (data.edition && !(await edition.exists({ slug: data.edition }))) {
            return res.status(400).json({ success: false, message: 'That edition does not exist' });
        }

        if (data.homepageFeatured === true && !doc.homepageFeatured) doc.homepageAt = new Date();
        if (data.homepageFeatured === false) doc.homepageAt = null;
        Object.assign(doc, data);
        // An editor explicitly saving a legacy seed story adopts it into the admin-managed newsroom.
        if (!doc.createdBy) doc.createdBy = req.admin._id;
        if (status) {
            doc.status = status;
            if (status === 'published' && !doc.publishedAt) doc.publishedAt = new Date();
        }
        doc.updatedBy = req.admin._id;
        await doc.save();

        return res.status(200).json({ success: true, message: 'Saved', article: { id: String(doc._id), slug: doc.slug, status: doc.status } });
    } catch (error) {
        console.error('Update article error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// DELETE
// DELETE /admin_articles/:id   (editors; writers only their own drafts)
// ============================================================
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }
        const doc = await article.findById(req.params.id);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }

        const ownDraft = String(doc.createdBy) === String(req.admin._id) && doc.status === 'draft';
        if (!hasRole(req.admin, 'editor') && !ownDraft) {
            return res.status(403).json({ success: false, message: 'Only editors can delete this story' });
        }

        await doc.deleteOne();
        return res.status(200).json({ success: true, message: 'Story deleted' });
    } catch (error) {
        console.error('Delete article error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
