const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllOrders,
  updateOrderStatus,
  updateOrderTracking,
  updatePaymentStatus,
  getAllCustomers,
  toggleCustomerStatus,
  getAttentionPayments,
  retryPaymentRefund,
} = require('../controllers/adminController');
const { adminLogin } = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

const {
  getInquiries,
  getInquiryById,
  updateInquiry,
  deleteInquiry,
} = require('../controllers/inquiryController');

// Public admin authentication endpoint (strictly verifies role === 'admin')
router.post('/login', adminLogin);

// All subsequent admin routes require protect + admin authorization
router.use(protect, admin);

router.get('/dashboard', getDashboardStats);
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/tracking', updateOrderTracking);
router.put('/orders/:id/payment', updatePaymentStatus);
router.patch('/orders/:id/payment', updatePaymentStatus);
router.get('/customers', getAllCustomers);
router.put('/customers/:id/toggle', toggleCustomerStatus);

// Payments attention & retry
router.get('/payments/attention', getAttentionPayments);
router.post('/payments/:id/retry-refund', retryPaymentRefund);

// Inquiries management
router.get('/inquiries', getInquiries);
router.get('/inquiries/:id', getInquiryById);
router.put('/inquiries/:id', updateInquiry);
router.delete('/inquiries/:id', deleteInquiry);

// Admin-only proxy IP chain diagnostic (verifies req.ip vs X-Forwarded-For after deployment)
router.get('/proxy-diagnostic', (req, res) => {
  if (process.env.ENABLE_PROXY_DIAGNOSTIC !== 'true') {
    return res.status(404).json({
      success: false,
      message: 'Proxy diagnostic endpoint is disabled. Set ENABLE_PROXY_DIAGNOSTIC=true in environment to enable temporarily for post-deployment verification.',
    });
  }

  const xForwardedFor = req.headers['x-forwarded-for'] || 'none';
  const remoteAddress = req.socket?.remoteAddress || 'none';
  const resolvedIp = req.ip;
  const trustProxySetting = req.app.get('trust proxy');

  console.log(`[Proxy Diagnostic]: Resolved client IP: ${resolvedIp} | X-Forwarded-For: "${xForwardedFor}" | Socket: ${remoteAddress} | Trust Proxy: ${trustProxySetting}`);

  res.status(200).json({
    success: true,
    resolvedClientIp: resolvedIp,
    xForwardedForChain: xForwardedFor,
    socketRemoteAddress: remoteAddress,
    trustProxyHops: trustProxySetting,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
