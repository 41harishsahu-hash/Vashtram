const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
} = require('../config/cloudinary');

const { validateUploadedFile } = require('../utils/uploadValidator');

// Use memory storage for clean buffer streaming to Cloudinary
const memoryStorage = multer.memoryStorage();

// Allowed image MIME types and extensions
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (ALLOWED_MIME_TYPES.includes(mime) && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB limit, 1 file max
  fileFilter,
});

// @desc    Upload product image (Cloudinary in production, dev fallback)
// @route   POST /api/upload
// @access  Private/Admin
router.post('/', protect, admin, (req, res, _next) => {
  upload.single('image')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image size exceeds maximum limit of 5MB',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files uploaded. Only 1 file is allowed per request.',
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided for upload',
      });
    }

    // Comprehensive security & signature validation
    try {
      validateUploadedFile(req.file);
    } catch (valErr) {
      return res.status(valErr.statusCode || 400).json({
        success: false,
        message: valErr.message,
      });
    }

    // 1. Production or Cloudinary-configured path
    if (isCloudinaryConfigured()) {
      try {
        const rawFolder = typeof req.body.folder === 'string' ? req.body.folder.trim() : '';
        const folderOk = /^[a-z0-9/_-]+$/i.test(rawFolder) && !rawFolder.includes('..');
        const targetFolder = rawFolder && folderOk
          ? (rawFolder.startsWith('vastram') ? rawFolder : `vastram/${rawFolder}`)
          : 'vastram/products';
        const uploadResult = await uploadToCloudinary(req.file.buffer, {
          folder: targetFolder,
        });

        return res.status(200).json({
          success: true,
          message: 'Image uploaded to Cloudinary successfully',
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          storage: 'cloudinary',
        });
      } catch (uploadError) {
        console.error('[Cloudinary Upload Error]:', uploadError.message);
        // In development mode, fallback to local storage instead of breaking the entire upload workflow
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Upload]: Falling back to local storage in development mode');
          // Proceed down to step 3 (Development local fallback)
        } else {
          return res.status(502).json({
            success: false,
            message: `Failed to upload image to cloud storage: ${uploadError.message || 'Service unavailable'}`,
          });
        }
      }
    }

    // 2. Production with missing Cloudinary credentials -> REJECT
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        success: false,
        message:
          'Cloudinary image storage is required in production but is not configured. Local disk fallback is strictly prohibited in production.',
      });
    }

    // 3. Development local fallback
    try {
      const uploadDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const uniqueName = `vashtram-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = path.join(uploadDir, uniqueName);

      fs.writeFileSync(filePath, req.file.buffer);

      const localUrl = `/uploads/${uniqueName}`;

      return res.status(200).json({
        success: true,
        message: 'Image uploaded locally (Development Mode). Configure Cloudinary for production.',
        url: localUrl,
        publicId: null,
        storage: 'local',
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to write image to local disk in development mode.',
      });
    }
  });
});

// @desc    Delete product image from Cloudinary or local disk
// @route   DELETE /api/upload
// @access  Private/Admin
router.delete('/', protect, admin, async (req, res) => {
  try {
    const { url, publicId } = req.body;

    if (!url && !publicId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either url or publicId of the image to delete',
      });
    }

    let targetPublicId = publicId || extractPublicIdFromUrl(url);

    if (targetPublicId && isCloudinaryConfigured()) {
      await deleteFromCloudinary(targetPublicId);
      return res.status(200).json({
        success: true,
        message: 'Cloudinary asset deleted successfully',
      });
    }

    // If local file URL
    if (url && url.includes('/uploads/')) {
      const filename = path.basename(url);
      const localPath = path.join(__dirname, '..', 'uploads', filename);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      return res.status(200).json({
        success: true,
        message: 'Local image file deleted successfully',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'External image reference removed',
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete image asset',
    });
  }
});

module.exports = router;
