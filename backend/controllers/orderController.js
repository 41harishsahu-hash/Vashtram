const Order = require('../models/Order');
const Product = require('../models/Product');
const { getNextOrderNumber } = require('../utils/orderNumber');
const { restoreOrderStock } = require('../services/stockService');

// Customers must not see internal system notes (payment IDs, refund details).
// Only timeline notes marked visibleToCustomer are sent to them.
const toCustomerView = (order) => {
  const obj = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  obj.statusHistory = (obj.statusHistory || []).map((entry) => ({
    status: entry.status,
    date: entry.date,
    note: entry.visibleToCustomer ? entry.note : '',
  }));
  return obj;
};

// @desc    Direct order endpoint disabled - prepaid online payment required
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res, _next) => {
  return res.status(400).json({
    success: false,
    message:
      'Cash on Delivery is disabled. VASHTRAM is a 100% prepaid-only platform. Please initiate payment via Razorpay (/api/payment/create-order) and verify payment (/api/payment/verify).',
  });
};

// @desc    Get logged in user's orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name slug images')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders: orders.map(toCustomerView),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order by ID or orderNumber
// @route   GET /api/orders/:identifier
// @access  Private
const getOrderById = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let order;

    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(identifier).populate('user', 'name email phone');
    } else {
      order = await Order.findOne({ orderNumber: identifier.toUpperCase() }).populate(
        'user',
        'name email phone'
      );
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Authorization: User can only view their own orders unless admin.
    // Handles deleted/missing customer relation safely without crashing.
    const orderUserId = order.user?._id
      ? order.user._id.toString()
      : (order.user ? order.user.toString() : null);

    if (req.user.role !== 'admin' && (!orderUserId || orderUserId !== req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order',
      });
    }

    res.status(200).json({
      success: true,
      order: req.user.role === 'admin' ? order : toCustomerView(order),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order (Customer or Admin) with stock restoration & auto-refund if paid
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Authorization: User can only cancel their own order unless admin
    const orderUserId = order.user?._id
      ? order.user._id.toString()
      : (order.user ? order.user.toString() : null);

    if (req.user.role !== 'admin' && (!orderUserId || orderUserId !== req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    // Only allow cancellation in valid states
    const cancellableStatuses = ['Pending', 'Confirmed', 'Processing'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in status "${order.orderStatus}". Only Pending, Confirmed, or Processing orders can be cancelled.`,
      });
    }

    // Use atomic stock restoration service
    const restoreResult = await restoreOrderStock(id);
    if (restoreResult.restored || restoreResult.reason === 'ALREADY_RESTORED') {
      order.stockRestored = true;
    }

    // Process Razorpay refund if paid online
    let refundNotice = '';
    if (
      (order.paymentStatus === 'Completed' || order.paymentStatus === 'Paid') &&
      order.razorpayPaymentId &&
      !order.isRefunded
    ) {
      const { refundPayment } = require('../services/refundService');
      const refundResult = await refundPayment({
        paymentId: order.razorpayPaymentId,
        orderId: order._id,
        amount: order.totalAmount,
        reason: reason || 'Customer requested order cancellation',
        force: true,
      });

      if (refundResult.success) {
        refundNotice = ' A refund has been initiated.';
      } else {
        refundNotice = ' We could not complete the automatic refund; our team has been notified and will refund you.';
      }
    }

    order.orderStatus = 'Cancelled';
    order.statusHistory.push({
      status: 'Cancelled',
      date: new Date(),
      note: reason || `Cancelled by ${req.user.role === 'admin' ? 'Admin' : 'Customer'}.${refundNotice}`,
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} has been successfully cancelled.${refundNotice}`,
      order: req.user.role === 'admin' ? order : toCustomerView(order),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  generateOrderNumber: getNextOrderNumber,
};
