const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Category = require('../models/Category');
const Inquiry = require('../models/Inquiry');
const PaymentIntent = require('../models/PaymentIntent');
const { createSafeRegex } = require('../utils/regexHelper');
const { restoreOrderStock } = require('../services/stockService');
const { refundPayment } = require('../services/refundService');
const { getRevenueAggregationExpr } = require('../utils/financialMetrics');

// @desc    Get real Admin Dashboard statistics from MongoDB
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res, next) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalCategories = await Category.countDocuments();

    // Total Revenue calculated via authoritative financialMetrics helper:
    // Only paid orders (not Cancelled/Refunded), partial refunds deducted, Returned handled explicitly
    const revenueAgg = await Order.aggregate([
      { $group: { _id: null, total: { $sum: getRevenueAggregationExpr() } } },
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    // Monthly revenue series for charts/dashboard computed via identical helper
    const monthlySeries = await Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: getRevenueAggregationExpr() },
          orders: {
            $sum: {
              $cond: [{ $gt: [getRevenueAggregationExpr(), 0] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Order status counts
    const pendingOrders = await Order.countDocuments({ orderStatus: 'Pending' });
    const processingOrders = await Order.countDocuments({
      orderStatus: { $in: ['Processing', 'Confirmed'] },
    });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'Shipped' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'Delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'Cancelled' });

    // Low stock products count (stock <= 5)
    const lowStockCount = await Product.countDocuments({ stock: { $lte: 5 } });

    // Inquiry counts
    const totalInquiries = await Inquiry.countDocuments();
    const newInquiries = await Inquiry.countDocuments({ status: 'New' });

    // Refund & Payment attention tracking
    const attentionIntentsCount = await PaymentIntent.countDocuments({
      $or: [{ needsAttention: true }, { refundStatus: 'failed' }],
    });
    const attentionOrdersCount = await Order.countDocuments({
      $or: [{ needsAttention: true }, { refundStatus: 'failed' }],
    });
    const needsAttentionCount = attentionIntentsCount + attentionOrdersCount;

    const failedRefundsCount =
      (await PaymentIntent.countDocuments({ refundStatus: 'failed' })) +
      (await Order.countDocuments({ refundStatus: 'failed' }));

    const attentionItems = await PaymentIntent.find({
      $or: [{ needsAttention: true }, { refundStatus: 'failed' }],
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    // Recent 6 orders
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(6);

    // Low stock items list (up to 5 items)
    const lowStockItems = await Product.find({ stock: { $lte: 5 } })
      .select('name sku stock price images')
      .limit(5);

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        totalOrders,
        totalCustomers,
        totalCategories,
        totalRevenue,
        monthlySeries,
        pendingOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        lowStockCount,
        totalInquiries,
        newInquiries,
        needsAttentionCount,
        failedRefundsCount,
      },
      attentionItems,
      recentOrders,
      lowStockItems,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders with filtering & search for Admin
// @route   GET /api/admin/orders
// @access  Private/Admin
const getAllOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 15 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.orderStatus = status;
    }

    if (search && search.trim() !== '') {
      const searchRegex = createSafeRegex(search.trim(), 'i');
      if (searchRegex) {
        query.$or = [
          { orderNumber: searchRegex },
          { 'shippingAddress.fullName': searchRegex },
          { 'shippingAddress.email': searchRegex },
          { 'shippingAddress.mobileNumber': searchRegex },
          { 'shippingAddress.city': searchRegex },
        ];
      }
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const pageNum = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limitNum = isNaN(parsedLimit) ? 15 : Math.min(100, Math.max(1, parsedLimit));
    const skip = (pageNum - 1) * limitNum;

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images sku')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      total,
      count: orders.length,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

const ALLOWED_ORDER_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: ['Returned'],
  Cancelled: [],
  Returned: [],
};

// Validates and cleans courier / tracking details sent by the admin
const sanitizeTrackingInput = (body = {}) => {
  const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  const courierName = text(body.courierName, 80);
  const trackingNumber = text(body.trackingNumber, 80);
  const rawUrl = typeof body.trackingUrl === 'string' ? body.trackingUrl.trim() : '';

  if (rawUrl.length > 500) {
    return { error: 'Tracking link is too long (maximum 500 characters).' };
  }
  if (rawUrl) {
    let parsed = null;
    try {
      parsed = new URL(rawUrl);
    } catch {
      parsed = null;
    }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      return { error: 'Tracking link must be a valid web address starting with http:// or https://' };
    }
  }

  return {
    courierName,
    trackingNumber,
    trackingUrl: rawUrl,
    hasAny: Boolean(courierName || trackingNumber || rawUrl),
  };
};

// @desc    Update order status with state machine enforcement
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminNote = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 300) : '';

    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // No-op if status is unchanged
    if (order.orderStatus === status) {
      return res.status(200).json({
        success: true,
        message: `Order status is already ${status}`,
        order,
      });
    }

    // Enforce allowed order state transitions
    const allowedNext = ALLOWED_ORDER_TRANSITIONS[order.orderStatus] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition order status from "${order.orderStatus}" to "${status}".`,
      });
    }

    // Courier / tracking details (required when marking an order as Shipped)
    const tracking = sanitizeTrackingInput(req.body);
    if (tracking.error) {
      return res.status(400).json({ success: false, message: tracking.error });
    }
    if (status === 'Shipped' && (!tracking.courierName || !tracking.trackingNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Courier name and tracking number are required to mark an order as Shipped.',
      });
    }

    let refundNotice = '';
    // Concurrency-Safe Single Stock Restoration strictly upon order Cancellation or Return via atomic claim
    if (status === 'Cancelled' || status === 'Returned') {
      const restoreResult = await restoreOrderStock(id);
      if (restoreResult.restored) {
        order.stockRestored = true;
      }

      // Automatically initiate Razorpay refund if order was paid online
      if (
        (order.paymentStatus === 'Completed' || order.paymentStatus === 'Paid') &&
        order.razorpayPaymentId &&
        !order.isRefunded
      ) {
        const { processRazorpayRefund } = require('./paymentController');
        try {
          await processRazorpayRefund(order, adminNote || 'Cancelled by Admin');
          refundNotice = ' (Payment refund initiated via Razorpay)';
        } catch (refundErr) {
          console.error('[Admin Cancel Order Refund Error]:', refundErr.message);
          refundNotice = ` (Automatic refund error: ${refundErr.message})`;
        }
      }
    }

    order.orderStatus = status;

    // Save courier / tracking details on the order
    if (status === 'Shipped' || tracking.hasAny) {
      order.shipment = {
        courierName: tracking.courierName,
        trackingNumber: tracking.trackingNumber,
        trackingUrl: tracking.trackingUrl,
        shippedAt: (order.shipment && order.shipment.shippedAt) || (status === 'Shipped' ? new Date() : null),
      };
    }

    // Record timeline entry
    const defaultNote =
      status === 'Shipped'
        ? `Order shipped via ${tracking.courierName}. Tracking number: ${tracking.trackingNumber}.`
        : `Order status updated to ${status} by Admin`;
    order.statusHistory.push({
      status,
      date: new Date(),
      note: (adminNote || defaultNote) + refundNotice,
      // Notes mixed with refund/system details are kept private
      visibleToCustomer: !refundNotice,
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}${refundNotice}`,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Correct courier / tracking details of a shipped order (without changing its status)
// @route   PATCH /api/admin/orders/:id/tracking
// @access  Private/Admin
const updateOrderTracking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!['Shipped', 'Delivered'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Tracking details can be edited only for Shipped or Delivered orders.',
      });
    }

    const tracking = sanitizeTrackingInput(req.body);
    if (tracking.error) {
      return res.status(400).json({ success: false, message: tracking.error });
    }
    if (!tracking.courierName || !tracking.trackingNumber) {
      return res.status(400).json({
        success: false,
        message: 'Courier name and tracking number are required.',
      });
    }

    order.shipment = {
      courierName: tracking.courierName,
      trackingNumber: tracking.trackingNumber,
      trackingUrl: tracking.trackingUrl,
      shippedAt: (order.shipment && order.shipment.shippedAt) || new Date(),
    };
    order.statusHistory.push({
      status: order.orderStatus,
      date: new Date(),
      note: `Tracking details updated: ${tracking.courierName}, tracking number ${tracking.trackingNumber}.`,
      visibleToCustomer: true,
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Tracking details updated',
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update payment status with real Razorpay refund execution
// @route   PUT /api/admin/orders/:id/payment
// @access  Private/Admin
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus, reason } = req.body;

    const validPaymentStatuses = ['Pending', 'Completed', 'Failed', 'Refunded'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`,
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Handle real Razorpay refund
    if (paymentStatus === 'Refunded') {
      const { processRazorpayRefund } = require('./paymentController');
      try {
        await processRazorpayRefund(order, reason || 'Admin initiated refund from Admin Panel');
        if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned') {
          const restoreResult2 = await restoreOrderStock(id);
          if (restoreResult2.restored) {
            order.stockRestored = true;
          }
        }
        return res.status(200).json({
          success: true,
          message: `Order #${order.orderNumber} successfully refunded via Razorpay!`,
          order,
        });
      } catch (refundErr) {
        const statusCode = refundErr.statusCode || 400;
        return res.status(statusCode).json({
          success: false,
          message: `Razorpay refund failed: ${refundErr.message}`,
        });
      }
    }

    order.paymentStatus = paymentStatus;
    await order.save();

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${paymentStatus}`,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all customers with aggregated order stats
// @route   GET /api/admin/customers
// @access  Private/Admin
const getAllCustomers = async (req, res, next) => {
  try {
    const customers = await User.find({ role: 'customer' })
      .select('-password')
      .sort({ createdAt: -1 });

    // Single aggregation query across all customers using authoritative financialMetrics helper
    const statsAgg = await Order.aggregate([
      {
        $group: {
          _id: '$user',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: getRevenueAggregationExpr() },
        },
      },
    ]);

    const statsMap = new Map();
    statsAgg.forEach((s) => {
      if (s._id) {
        statsMap.set(s._id.toString(), {
          orderCount: s.orderCount,
          totalSpent: s.totalSpent,
        });
      }
    });

    const customersWithStats = customers.map((cust) => {
      const stats = statsMap.get(cust._id.toString()) || { orderCount: 0, totalSpent: 0 };
      return {
        ...cust.toObject(),
        orderCount: stats.orderCount,
        totalSpent: stats.totalSpent,
      };
    });

    res.status(200).json({
      success: true,
      count: customersWithStats.length,
      customers: customersWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle customer active status
// @route   PUT /api/admin/customers/:id/toggle
// @access  Private/Admin
const toggleCustomerStatus = async (req, res, next) => {
  try {
    const customer = await User.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Block deactivating your own account
    if (customer._id.toString() === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    // Block deactivating any admin account
    if (customer.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be deactivated',
      });
    }

    customer.isActive = !customer.isActive;

    // Bump tokenVersion when deactivating a user so existing tokens die
    if (!customer.isActive) {
      customer.tokenVersion = (customer.tokenVersion || 0) + 1;
    }

    await customer.save();

    res.status(200).json({
      success: true,
      message: `Customer account ${customer.isActive ? 'activated' : 'deactivated'}`,
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        isActive: customer.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all payments and orders requiring attention (failed refunds, stuck processing)
// @route   GET /api/admin/payments/attention
// @access  Private/Admin
const getAttentionPayments = async (req, res, next) => {
  try {
    const intents = await PaymentIntent.find({
      $or: [{ needsAttention: true }, { refundStatus: 'failed' }],
    })
      .populate('user', 'name email')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const orders = await Order.find({
      $or: [{ needsAttention: true }, { refundStatus: 'failed' }],
    })
      .populate('user', 'name email')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({
      success: true,
      attentionPayments: intents,
      attentionOrders: orders,
      totalCount: intents.length + orders.length,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin retry refund endpoint for failed payment or order
// @route   POST /api/admin/payments/:id/retry-refund
// @access  Private/Admin (idempotent)
const retryPaymentRefund = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    let intent = await PaymentIntent.findOne({
      $or: [
        { _id: isObjectId ? id : null },
        { razorpayOrderId: id },
        { razorpayPaymentId: id },
      ],
    });

    let order = await Order.findOne({
      $or: [
        { _id: isObjectId ? id : null },
        { razorpayPaymentId: id },
        { razorpayOrderId: id },
      ],
    });

    if (!intent && !order) {
      return res.status(404).json({
        success: false,
        message: 'No payment or order record found for this identifier',
      });
    }

    const paymentId =
      intent?.razorpayPaymentId ||
      order?.razorpayPaymentId ||
      req.body.paymentId;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'No Razorpay payment ID associated with this record to refund',
      });
    }

    const result = await refundPayment({
      paymentId,
      intentId: intent?._id,
      orderId: order?._id,
      amount: order?.totalAmount,
      amountInPaise: intent?.expectedAmount,
      reason: req.body.reason || 'Admin manual refund retry',
      force: true,
    });

    if (result.inProgress) {
      return res.status(409).json({
        success: false,
        message: 'A refund operation is already in progress for this payment. Please wait.',
      });
    }

    if (result.success) {
      if (order && (order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned' || order.isRefunded)) {
        const { restoreOrderStock } = require('../services/stockService');
        await restoreOrderStock(order, { reason: 'Refund retry succeeded' });
      }
      return res.status(200).json({
        success: true,
        message: result.alreadyRefunded
          ? 'Refund had already been completed previously.'
          : 'Refund initiated and processed successfully via Razorpay.',
        refund: result.refund,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `Refund retry failed: ${result.error}`,
        error: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAllOrders,
  updateOrderStatus,
  updateOrderTracking,
  updatePaymentStatus,
  getAllCustomers,
  toggleCustomerStatus,
  getAttentionPayments,
  retryPaymentRefund,
  ALLOWED_ORDER_TRANSITIONS,
};
