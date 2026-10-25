const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getAbout,
  updateAbout,
  uploadAboutImage,
  resetAboutImage,
} = require('../controllers/aboutController');
const { protect, admin } = require('../middleware/authMiddleware');

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
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB limit, 1 file max
  fileFilter,
});

// Middleware wrapper for clean Multer error handling
const handleUploadMiddleware = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image file size exceeds maximum limit of 5MB',
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
    next();
  });
};

// Public route to view About page data
router.get('/', getAbout);

// Admin-only routes
router.post('/upload', protect, admin, handleUploadMiddleware, uploadAboutImage);
router.put('/', protect, admin, updateAbout);
router.post('/reset', protect, admin, resetAboutImage);

module.exports = router;
