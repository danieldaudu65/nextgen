const mongoose = require('mongoose');

// One NextGen volume within a yearly edition, with everything that issue needs.
const sectionSchema = new mongoose.Schema({
    key:                        { type: String, required: true },
    label:                      { type: String, required: true }, // "THE BIG NEWS"
    pages:                      String,                           // "p.2–3"
    title:                      { type: String, trim: true, default: '' },
    blurb:                      String,
    genz:                       String,
    image:                      String,
    imagePosition:              String,
    icon:                       String,
    variant:                    { type: String, enum: ['big', 'wide', 'full', 'default'], default: 'default' },
    tone:                       { type: String, enum: ['yellow', 'pink', 'purple', 'blue'] },
    featured:                   { type: Boolean, default: false }, // shown on the homepage
    href:                       { type: String, default: '#' },
}, { _id: false });

const editionSchema = new mongoose.Schema({
    slug:                       { type: String, required: true, unique: true, index: true }, // "oct-2026"
    title:                      { type: String, trim: true, default: '' },
    month:                      { type: String, required: true },  // "Oct 2026"
    volume:                     String,                            // "Vol 4 No 1"
    year:                       { type: Number, index: true },
    volumeNumber:               { type: Number, min: 1, max: 4 },
    issueMonth:                 { type: String, enum: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'other'] },
    status:                     { type: String, enum: ['current', 'upcoming', 'archive'], default: 'archive', index: true },
    cover:                      String,
    label:                      String,   // shelf label for upcoming / archive issues
    subtitle:                   String,
    tagline:                    String,
    headline:                   [String],
    headlineAccent:             String,
    lede:                       String,
    electionDate:               String,
    ticker:                     [{ _id: false, tag: String, text: String }],
    sections:                   [sectionSchema],

    // ---------- Games & extras ----------
    vocab:                      [{ _id: false, word: String, category: String, definition: String, nextgen: String, aliases: [String] }],
    quiz:                       [{ _id: false, id: { type: String, required: true }, question: String, options: [String], answer: { type: Number, required: true } }],
    sort:                       [{ _id: false, text: String, answer: { type: String, enum: ['cheat', 'buddy'] } }],
    promiseQuestions:           [String],
    money:                      { start: Number, save: Number, items: [{ _id: false, label: String, price: Number }] },
    wordSearch:                 { grid: [String], words: [String] },

    publishedAt:                { type: Date, default: null },
}, {
    timestamps: true,
    collection: 'editions'
});

module.exports = mongoose.models.editions || mongoose.model('editions', editionSchema);
