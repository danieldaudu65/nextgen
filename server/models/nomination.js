const mongoose = require('mongoose');

// "Nominate a Star": someone tells NextGen about a young person doing something amazing.
// Many nominees are under 18, so we keep only what an editor needs and require consent.
const nominationSchema = new mongoose.Schema({
    // the star
    nomineeName:                { type: String, required: true, trim: true, maxlength: 80 },
    nomineeAge:                 { type: Number, min: 5, max: 30, default: null },
    category:                   { type: String, required: true },   // see CATEGORIES in route_public/nominations.js
    schoolName:                 { type: String, trim: true, maxlength: 120, default: null },
    city:                       { type: String, trim: true, maxlength: 60, default: null },
    state:                      { type: String, trim: true, maxlength: 60, default: null },
    photo:                      { type: String, default: null },

    // what they did
    headline:                   { type: String, required: true, trim: true, maxlength: 140 }, // one line: "Built a solar charger from scrap"
    story:                      { type: String, required: true, trim: true, maxlength: 3000 },
    links:                      [{ type: String, trim: true, maxlength: 300 }],

    // who is nominating
    nominatorName:              { type: String, required: true, trim: true, maxlength: 80 },
    relationship:               { type: String, trim: true, maxlength: 60, default: null },  // teacher, parent, friend, self…
    nominatorEmail:             { type: String, trim: true, lowercase: true, maxlength: 120, default: null },
    nominatorPhone:             { type: String, trim: true, maxlength: 30, default: null },
    consent:                    { type: Boolean, required: true },  // parent/guardian (or the star, if 18+) agrees

    // NextGen team
    status:                     { type: String, enum: ['new', 'shortlisted', 'featured', 'declined'], default: 'new', index: true },
    featureBlurb:               { type: String, trim: true, maxlength: 240, default: null }, // short public line when featured
    adminNote:                  { type: String, trim: true, maxlength: 1000, default: null },
    reviewedBy:                 { type: mongoose.Schema.Types.ObjectId, ref: 'admins', default: null },
    sample:                     { type: Boolean, default: false },
}, {
    timestamps: true,
    collection: 'nominations'
});

module.exports = mongoose.models.nominations || mongoose.model('nominations', nominationSchema);
