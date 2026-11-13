// ===============================
// Import stories into the admin panel
// ===============================
// Loads the stories in scripts/content/articles.js into a volume, as normal
// admin stories (they show in Admin → Stories and can be edited there).
//
// Usage:
//   npm run import-stories                                   → all stories → the current volume, as drafts
//   npm run import-stories -- --publish                      → publish them straight away
//   npm run import-stories -- --edition 2026-december-vol-4  → into a specific volume (its link/slug)
//   npm run import-stories -- --only ishaq-ev-for-everyday-people
//   npm run import-stories -- --admin you@punchng.com        → who the stories belong to
//   npm run import-stories -- --update                       → refresh the TEXT of stories already imported
//
// Safe to run again: stories already in the admin are skipped (or text-refreshed with --update).
// Pictures, gallery, homepage choice and status you set in Admin are never overwritten.
// Missing categories and Vocab Vault words are added to the volume automatically.
// ===============================

const VOCAB_MARK = /\[\[([^\]]+)\]\]/g;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Text fields the import owns. Everything else (image, gallery, homepageFeatured, status) belongs to Admin.
const TEXT_FIELDS = ['section', 'sectionLabel', 'pages', 'title', 'dek', 'author', 'readMins', 'points', 'body', 'eli10', 'game', 'tags', 'question'];

function parseArgs(argv) {
    const args = { publish: false, update: false, edition: null, only: null, admin: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--publish') args.publish = true;
        else if (a === '--update') args.update = true;
        else if (a === '--edition') args.edition = argv[++i];
        else if (a === '--only') args.only = argv[++i];
        else if (a === '--admin') args.admin = argv[++i];
        else throw new Error(`Unknown option "${a}"`);
    }
    return args;
}

/** All [[words]] used in a story */
function vocabUsed(story) {
    const words = new Set();
    [...(story.body || []), ...(story.eli10 || [])].forEach((block) => {
        for (const m of String(block).matchAll(VOCAB_MARK)) words.add(m[1].replace(/\*+/g, '').trim());
    });
    return [...words];
}

const matches = (entry, word) => [entry.word, ...(entry.aliases || [])].some((w) => {
    const a = norm(w); const b = norm(word);
    return a === b || a === b.replace(/s$/, '') || a.replace(/s$/, '') === b;
});

/**
 * Vocab entries to add to the volume for these stories.
 * Looks in each story's own `vocab` list first, then the shared word bank.
 * Returns { add: [...entries], unknown: [...words with no definition] }
 */
function missingVocab(stories, volumeVocab, wordBank) {
    const have = [...(volumeVocab || [])];
    const add = []; const unknown = [];
    stories.forEach((story) => {
        vocabUsed(story).forEach((word) => {
            if ([...have, ...add].some((v) => matches(v, word))) return;
            const def = [...(story.vocab || []), ...(wordBank || [])].find((v) => matches(v, word));
            if (def) add.push(def); else if (!unknown.includes(word)) unknown.push(word);
        });
    });
    return { add, unknown };
}

/** Category (section) entries the volume is missing, in the same shape Admin creates */
function missingCategories(stories, sections) {
    const keys = new Set((sections || []).map((s) => s.key));
    const add = [];
    stories.forEach((s) => {
        if (!s.section || keys.has(s.section)) return;
        keys.add(s.section);
        const label = s.sectionLabel || s.section.toUpperCase();
        add.push({ key: s.section, label, title: label.charAt(0) + label.slice(1).toLowerCase(), blurb: '', pages: '', variant: 'default', featured: false, href: '/#edition' });
    });
    return add;
}

/** The fields an import writes for one story */
function storyData(story, editionSlug) {
    const data = { slug: story.slug, edition: editionSlug };
    TEXT_FIELDS.forEach((k) => { if (story[k] !== undefined) data[k] = story[k]; });
    if (!data.sectionLabel && data.section) data.sectionLabel = data.section.toUpperCase();
    return data;
}

module.exports = { parseArgs, vocabUsed, missingVocab, missingCategories, storyData, TEXT_FIELDS };


// ===============================
// Run (only when called as a script)
// ===============================
if (require.main === module) {
    require('dotenv').config();
    require('../config/secrets').checkRequiredEnv();
    require('../config/dns');

    const mongoose = require('mongoose');
    const edition = require('../models/edition');
    const article = require('../models/article');
    const admin = require('../models/admin');
    const { articles } = require('./content/articles');
    const { october2026 } = require('./content/october2026');

    async function run() {
        const args = parseArgs(process.argv.slice(2));
        await mongoose.connect(process.env.MONGODB_URI);

        // ---- who owns the stories
        const owner = args.admin
            ? await admin.findOne({ email: args.admin.toLowerCase().trim(), active: true })
            : await admin.findOne({ role: 'superadmin', active: true }).sort({ createdAt: 1 });
        if (!owner) throw new Error(args.admin ? `No active admin with email ${args.admin}` : 'No superadmin yet. Run: npm run create-admin -- "Name" email "password"');

        // ---- which volume
        const vol = args.edition
            ? await edition.findOne({ slug: args.edition })
            : await edition.findOne({ status: 'current' });
        if (!vol) {
            const list = await edition.find({}, 'slug month volume status').sort({ updatedAt: -1 }).lean();
            console.log('\nVolumes in the database:');
            list.forEach((e) => console.log(`   ${e.slug.padEnd(28)} ${e.month} · ${e.volume || ''} (${e.status})`));
            throw new Error(args.edition
                ? `No volume with the link "${args.edition}"`
                : 'No volume is set as "On homepage" (current). Pick one with --edition <link>, or set one current in Admin → Editions.');
        }

        const stories = articles.filter((s) => !args.only || s.slug === args.only);
        if (!stories.length) throw new Error(`No story with the slug "${args.only}" in scripts/content/articles.js`);
        console.log(`\n📥 Importing ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'} into ${vol.month} · ${vol.volume || vol.slug} as ${args.publish ? 'PUBLISHED' : 'drafts'} (owner: ${owner.name})\n`);

        // ---- categories + vocab the volume needs
        const cats = missingCategories(stories, vol.sections);
        const { add: words, unknown } = missingVocab(stories, vol.vocab, october2026.vocab);
        if (cats.length || words.length) {
            vol.sections.push(...cats);
            vol.vocab.push(...words);
            await vol.save();
        }
        cats.forEach((c) => console.log(`   ➕ category  ${c.label}`));
        words.forEach((w) => console.log(`   ➕ vocab     ${w.word}`));
        unknown.forEach((w) => console.log(`   ⚠️  no meaning for [[${w}]] yet: add it in Admin → Editions → Vocab Vault`));

        // ---- stories
        const tally = { created: 0, adopted: 0, updated: 0, skipped: 0 };
        for (const story of stories) {
            const data = storyData(story, vol.slug);
            const doc = await article.findOne({ slug: story.slug });

            if (!doc) {
                await article.create({
                    ...data,
                    image: story.image || null,
                    imagePosition: story.imagePosition || null,
                    status: args.publish ? 'published' : 'draft',
                    publishedAt: args.publish ? new Date() : null,
                    createdBy: owner._id, updatedBy: owner._id,
                });
                tally.created++; console.log(`   ✅ added     ${story.title}`);
            } else if (!doc.createdBy) {
                // An old copy from the previous seed: bring it into the admin panel
                Object.assign(doc, data, { createdBy: owner._id, updatedBy: owner._id });
                if (!doc.image && story.image) doc.image = story.image;
                doc.status = args.publish ? 'published' : 'draft';
                doc.publishedAt = args.publish ? (doc.publishedAt || new Date()) : null;
                await doc.save();
                tally.adopted++; console.log(`   ♻️  adopted   ${story.title} (old seed copy)`);
            } else if (args.update) {
                Object.assign(doc, data, { updatedBy: owner._id });
                if (args.publish && doc.status !== 'published') { doc.status = 'published'; doc.publishedAt = doc.publishedAt || new Date(); }
                await doc.save();
                tally.updated++; console.log(`   🔁 updated   ${story.title} (text only, your images kept)`);
            } else {
                tally.skipped++; console.log(`   ⏭️  skipped   ${story.title} (already in Admin, use --update to refresh text)`);
            }
        }

        console.log(`\nDone: ${tally.created} added, ${tally.adopted} adopted, ${tally.updated} updated, ${tally.skipped} skipped.`);
        console.log('Open http://localhost:3000/admin/articles to add pictures and publish.\n');
        await mongoose.disconnect();
    }

    run().catch(async (err) => {
        console.error(`\n❌ ${err.message}\n`);
        await mongoose.disconnect();
        process.exit(1);
    });
}
