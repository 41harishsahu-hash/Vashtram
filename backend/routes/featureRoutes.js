const express = require('express');
const router = express.Router();
const {
  getFeatures,
  getAdminFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  toggleFeatureStatus,
  deleteFeature,
  reorderFeatures,
  resetFeatureDefaults,
} = require('../controllers/featureController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public route to get active features for the consumer storefront
router.get('/', getFeatures);

// Admin-only routes
router.get('/admin', protect, admin, getAdminFeatures);
router.post('/', protect, admin, createFeature);
router.put('/reorder', protect, admin, reorderFeatures);
router.post('/reset', protect, admin, resetFeatureDefaults);

router.get('/:id', protect, admin, getFeatureById);
router.put('/:id', protect, admin, updateFeature);
router.delete('/:id', protect, admin, deleteFeature);
router.put('/:id/toggle', protect, admin, toggleFeatureStatus);
router.patch('/:id/status', protect, admin, toggleFeatureStatus);

module.exports = router;
