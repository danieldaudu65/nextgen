const mongoose = require('mongoose');

// One story. Each edition has many articles; each article has its own page: /articles/<slug>
//
// body / eli10 are lists of blocks (one string per block):
//   "plain text"          → paragraph
//   "## Heading"          → section heading
//   "> Callout text"      → highlighted box
//   "- item"              → bullet (next to each other = one list)
//   Use [[word]] anywhere to mark a Vocab Vault word (tap to see the meaning).
const articleSchema = new mongoose.Schema({
    slug:                       { type: String, required: true, unique: true, index: true }, // "whats-an-election"
    edition:                    { type: String, required: true, index: true },               // "oct-2026"
    section:                    { type: String, required: true, index: true },               // "big-news"
    sectionLabel:               { type: String, required: true },                            // "THE BIG NEWS"
    pages:                      { type: String, default: null },                             // "p.2–3" in print

    title:                      { type: String, required: true },
    dek:                        { type: String, default: null }, // one-line summary under the title
    image:                      { type: String, default: null },
    imagePosition:              { type: String, default: null },
    // How the main picture sits in boxes of other shapes: auto (decide by shape), cover (fill), contain (whole picture)
    imageFit:                   { type: String, enum: ['auto', 'cover', 'contain'], default: 'auto' },
    // The story's colour (callouts, bullets, highlights) from the printed page; null = the normal NextGen yellow
    accent:                     { type: String, default: null },
    gallery:                    [{ _id: false, image: { type: String, required: true }, caption: { type: String, default: '' } }],
    homepageFeatured:           { type: Boolean, default: false, index: true },
    homepageAt:                 { type: Date, default: null },                               // when it was put in the homepage hero (newest first)
    author:                     { type: String, default: 'NextGen Team' },

    readMins:                   { type: Number, default: 3 },  // used by the reading tracker
    // The check question shown after the reading time (answer never leaves the server)
    question:                   {
        prompt:                 { type: String, default: '' },
        options:                [String],
        answer:                 { type: Number, default: 0 },
        explain:                { type: String, default: '' },
    },
    points:                     { type: Number, default: 10 },

    body:                       { type: [String], default: [] },
    eli10:                      { type: [String], default: [] }, // "Explain like I'm 10" version

    game:                       { label: String, href: String }, // "Play the game from this story"
    tags:                       { type: [String], default: [] },

    // draft → review (writer sends it) → published (editor publishes)
    status:                     { type: String, enum: ['draft', 'review', 'published'], default: 'draft', index: true },
    reviewNote:                 { type: String, default: null }, // editor's note back to the writer
    createdBy:                  { type: mongoose.Schema.Types.ObjectId, ref: 'admins', default: null },
    updatedBy:                  { type: mongoose.Schema.Types.ObjectId, ref: 'admins', default: null },
    publishedAt:                { type: Date, default: null },
}, {
    timestamps: true,
    collection: 'articles'
});

module.exports = mongoose.models.articles || mongoose.model('articles', articleSchema);
