const express = require('express');
const router = express.Router();
const {
  getHero,
  updateHeroText,
  addHeroImage,
  updateHeroImage,
  deleteHeroImage,
  reorderHeroImages,
  resetHeroDefaults,
} = require('../controllers/heroController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public route to view hero section
router.get('/', getHero);

// Admin-only management routes
router.put('/text', protect, admin, updateHeroText);
router.post('/images', protect, admin, addHeroImage);
router.put('/images/reorder', protect, admin, reorderHeroImages);
router.put('/images/:id', protect, admin, updateHeroImage);
router.delete('/images/:id', protect, admin, deleteHeroImage);
router.post('/reset', protect, admin, resetHeroDefaults);

module.exports = router;
