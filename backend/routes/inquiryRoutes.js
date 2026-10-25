const express = require('express');
const router = express.Router();
const {
  createInquiry,
  getInquiries,
  getInquiryById,
  updateInquiry,
  deleteInquiry,
} = require('../controllers/inquiryController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public customer submission endpoint
router.post('/', createInquiry);

// Admin protected endpoints
router.get('/', protect, admin, getInquiries);
router.get('/:id', protect, admin, getInquiryById);
router.put('/:id', protect, admin, updateInquiry);
router.delete('/:id', protect, admin, deleteInquiry);

module.exports = router;
