const mongoose = require('mongoose');

// Site settings (Admin → Settings). One row with key "main"; see services/settings.js for the shape + defaults.
const settingsSchema = new mongoose.Schema({
    key:                        { type: String, required: true, unique: true },
    data:                       { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy:                  { type: mongoose.Schema.Types.ObjectId, ref: 'admins', default: null },
}, {
    timestamps: true,
    collection: 'settings'
});

module.exports = mongoose.models.settings || mongoose.model('settings', settingsSchema);
