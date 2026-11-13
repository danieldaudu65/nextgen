/*
 * Saving uploaded images (admin, school logos, nomination photos).
 * Cloudinary when its keys are in .env, otherwise server/uploads (lost on redeploy).
 */
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const imageUpload = (maxMb = 5) => multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

const cloudinaryReady = () =>
    Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

let configured = false;
function configure() {
    if (configured || !cloudinaryReady()) return;
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
    configured = true;
}

// → public URL of the saved image
async function saveImage(file, req, folder = 'nextgen') {
    if (!cloudinaryReady()) {
        const ext = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' })[file.mimetype];
        const filename = `${crypto.randomUUID()}${ext}`;
        const uploadDir = path.join(__dirname, '..', 'uploads');
        await fs.mkdir(uploadDir, { recursive: true });
        await fs.writeFile(path.join(uploadDir, filename), file.buffer);
        const base = (process.env.PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        return `${base}/uploads/${filename}`;
    }
    configure();
    const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, out) => (err ? reject(err) : resolve(out))).end(file.buffer);
    });
    return result.secure_url;
}

module.exports = { imageUpload, cloudinaryReady, saveImage };
