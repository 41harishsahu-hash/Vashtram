const express = require('express');
const router = express.Router();
const {
  getRazorpayKey,
  createRazorpayOrder,
  verifyPayment,
  getPaymentStatus,
  handleWebhook,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Get Razorpay Key ID
router.get('/key', getRazorpayKey);

// Create Razorpay Order (pre-payment initialization)
router.post('/create-order', protect, createRazorpayOrder);

// Verify Razorpay HMAC signature & create confirmed order in DB
router.post('/verify', protect, verifyPayment);

// Poll Payment Intent status
router.get('/status/:razorpayOrderId', protect, getPaymentStatus);

// Razorpay Webhook for Payment Capture Recovery (idempotent, signature-verified)
router.post('/webhook', handleWebhook);

module.exports = router;
