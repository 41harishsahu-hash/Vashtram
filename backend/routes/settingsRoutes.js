const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public route to retrieve settings (including WhatsApp number and support info)
router.get('/', getSettings);

// Admin-only management routes
router.get('/admin', protect, admin, getSettings);
router.put('/', protect, admin, updateSettings);
router.put('/whatsapp', protect, admin, updateSettings);

module.exports = router;
