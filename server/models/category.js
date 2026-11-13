const mongoose = require('mongoose');

// Site categories (Admin → Categories) = the edition sections (THE BIG NEWS, TECH PULSE…).
// slug = the section key, so a story with section "tech" is in the "tech" category (see services/categories.js).
const categorySchema = new mongoose.Schema({
    slug:                       { type: String, required: true, unique: true, trim: true, lowercase: true }, // section key: "tech"
    name:                       { type: String, required: true, trim: true },                              // "Tech Pulse"
    desc:                       { type: String, trim: true, default: '' },
    accent:                     { type: String, default: '#FFD400' },                                      // card colour
    icon:                       { type: String, default: 'news' },
    sections:                   { type: [String], default: [] },                                           // extra section keys to include
    link:                       { type: String, default: '' },                                             // card goes here instead (CRACK THIS → /#arcade)
    order:                      { type: Number, default: 0, index: true },
    active:                     { type: Boolean, default: true, index: true },
    updatedBy:                  { type: mongoose.Schema.Types.ObjectId, ref: 'admins', default: null },
}, {
    timestamps: true,
    collection: 'categories'
});

module.exports = mongoose.models.category || mongoose.model('category', categorySchema);
