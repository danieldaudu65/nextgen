const express = require('express');
const mongoose = require('mongoose');
const category = require('../models/category');
const edition = require('../models/edition');
const article = require('../models/article');
const { requireAdmin, requireRole } = require('../middleware/adminAuth');
const { ICONS, KNOWN, cleanCategory, inCategory, listCategories, syncFromSections } = require('../services/categories');
const router = express.Router();

const shape = (c) => ({ ...c, id: String(c._id), _id: undefined, __v: undefined });

// ============================================================
// CATEGORIES = the edition sections (homepage "Explore", top menu, /category/<slug>)
// GET    /admin_categories                 → { categories, sections, icons }
// POST   /admin_categories                 { name, desc, accent, icon, sections, active }      (editors)
// PUT    /admin_categories/order           { ids: [...] }   new order, first = top             (editors)
// PUT    /admin_categories/:id             any of the fields above                              (editors)
// DELETE /admin_categories/:id                                                                  (editors)
// Every edition section is a category automatically; a new one here also shows in the story editor.
// ============================================================
router.get('/', requireAdmin, async (req, res) => {
    try {
        await syncFromSections({ force: true });
        const [list, editions, counts] = await Promise.all([
            listCategories({ includeHidden: true }),
            edition.find({}, 'slug volume month sections.key sections.label').lean(),
            article.aggregate([{ $match: { status: 'published' } }, { $group: { _id: { section: '$section', label: '$sectionLabel' }, n: { $sum: 1 } } }]),
        ]);
        // Every section used by an edition or a published story, so admins can tick which belong where
        const sections = new Map();
        editions.forEach((e) => (e.sections || []).forEach((s) => { if (s.key && !sections.has(s.key)) sections.set(s.key, { key: s.key, label: s.label || s.key, stories: 0 }); }));
        counts.forEach(({ _id, n }) => {
            if (!_id.section) return;
            const row = sections.get(_id.section) || { key: _id.section, label: _id.label || _id.section, stories: 0 };
            row.stories += n;
            sections.set(_id.section, row);
        });
        const inEditions = new Set(editions.flatMap((e) => (e.sections || []).map((x) => x.key)));
        const categories = list.map((c) => ({
            ...shape(c),
            locked: Boolean(KNOWN[c.slug] || inEditions.has(c.slug)), // a paper section: hide it, it can't be deleted
            stories: counts.filter(({ _id }) => inCategory(c, _id.section, _id.label)).reduce((n, r) => n + r.n, 0),
        }));
        return res.status(200).json({ success: true, categories, sections: [...sections.values()], icons: ICONS });
    } catch (error) {
        console.error('Categories error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        const data = cleanCategory(req.body);
        if (data.error) return res.status(400).json({ success: false, message: data.error });
        if (await category.exists({ slug: data.slug })) return res.status(409).json({ success: false, message: 'A category with that name already exists' });
        const last = await category.findOne({}, 'order').sort({ order: -1 }).lean();
        const doc = await category.create({ ...data, order: data.order ?? (last ? last.order + 1 : 0), updatedBy: req.admin._id });
        return res.status(201).json({ success: true, message: 'Category added', category: shape(doc.toObject()) });
    } catch (error) {
        console.error('Add category error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/order', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((id) => mongoose.isValidObjectId(id));
        if (!ids.length) return res.status(400).json({ success: false, message: 'Send the new order' });
        await category.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
        return res.status(200).json({ success: true, message: 'Order saved' });
    } catch (error) {
        console.error('Order categories error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/:id', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
        const data = cleanCategory(req.body, { partial: true });
        if (data.error) return res.status(400).json({ success: false, message: data.error });
        if (data.slug && (await category.exists({ slug: data.slug, _id: { $ne: req.params.id } }))) {
            return res.status(409).json({ success: false, message: 'Another category already uses that name' });
        }
        const doc = await category.findByIdAndUpdate(req.params.id, { $set: { ...data, updatedBy: req.admin._id } }, { new: true }).lean();
        if (!doc) return res.status(404).json({ success: false, message: 'Category not found' });
        return res.status(200).json({ success: true, message: 'Saved', category: shape(doc) });
    } catch (error) {
        console.error('Update category error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/:id', requireAdmin, requireRole('editor'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
        const found = await category.findById(req.params.id, 'slug name').lean();
        if (!found) return res.status(404).json({ success: false, message: 'Category not found' });
        if (KNOWN[found.slug] || (await edition.exists({ 'sections.key': found.slug }))) {
            return res.status(400).json({ success: false, message: `“${found.name}” is a section of the paper, so it can't be deleted. Hide it instead.` });
        }
        const doc = await category.findByIdAndDelete(req.params.id).lean();
        return res.status(200).json({ success: true, message: `Deleted “${doc.name}”. Its stories are not deleted.` });
    } catch (error) {
        console.error('Delete category error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
