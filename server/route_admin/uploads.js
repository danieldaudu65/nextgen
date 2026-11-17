const express = require('express');
const { requireAdmin } = require('../middleware/adminAuth');
const { imageUpload, cloudinaryReady, saveImage, MAX_MB } = require('../services/imageStore');
const router = express.Router();

// Images are kept in memory for a moment, then sent to Cloudinary or local uploads (services/imageStore.js)
const upload = imageUpload();


// ============================================================
// WHERE DO UPLOADS GO?
// GET /admin_uploads/status → { storage: 'cloudinary' | 'local' }
// The editor shows this so nobody is surprised when images vanish on a redeploy.
// ============================================================
router.get('/status', requireAdmin, (req, res) => {
    return res.status(200).json({ success: true, storage: cloudinaryReady() ? 'cloudinary' : 'local' });
});


// ============================================================
// UPLOAD AN IMAGE
// POST /admin_uploads/image   (form-data, field name "image")
// → { url }
// ============================================================
router.post('/image', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: `Choose a JPG, PNG, WEBP or GIF under ${MAX_MB} MB` });
        }
        return res.status(200).json({ success: true, url: await saveImage(req.file, req) });
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ success: false, message: 'Upload failed' });
    }
});

module.exports = router;
