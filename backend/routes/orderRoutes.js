const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.get('/myorders', protect, getMyOrders);
router.get('/:identifier', protect, getOrderById);
router.put('/:id/cancel', protect, cancelOrder);
router.patch('/:id/cancel', protect, cancelOrder);

module.exports = router;
