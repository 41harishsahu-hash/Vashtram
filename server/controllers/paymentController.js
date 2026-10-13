const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const PaymentIntent = require('../models/PaymentIntent');
const WebhookEvent = require('../models/WebhookEvent');
const { getNextOrderNumber } = require('../utils/orderNumber');
const {
  getRazorpayCredentials,
  getRazorpayInstance,
} = require('../config/razorpay');
const { refundPayment } = require('../services/refundService');

/**
 * Validates shipping address fields
 */
const validateShippingAddress = (shippingAddress) => {
  if (!shippingAddress) {
    const error = new Error('Shipping address is required');
    error.statusCode = 400;
    throw error;
  }

  const { fullName, mobileNumber, email, address, city, state, pincode } = shippingAddress;

  if (!fullName || fullName.trim().length < 2 || fullName.trim().length > 60) {
    const error = new Error('Please provide a valid full name (2-60 characters)');
    error.statusCode = 400;
    throw error;
  }

  if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber.trim())) {
    const error = new Error('Please provide a valid 10-digit Indian mobile number starting with 6-9');
    error.statusCode = 400;
    throw error;
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    const error = new Error('Please provide a valid email address');
    error.statusCode = 400;
    throw error;
  }

  if (!address || address.trim().length < 5 || address.trim().length > 250) {
    const error = new Error('Please provide a complete delivery address (5-250 characters)');
    error.statusCode = 400;
    throw error;
  }

  if (!city || city.trim().length < 2) {
    const error = new Error('Please provide a valid city');
    error.statusCode = 400;
    throw error;
  }

  if (!state || state.trim().length < 2) {
    const error = new Error('Please provide a valid state');
    error.statusCode = 400;
    throw error;
  }

  if (!pincode || !/^\d{6}$/.test(pincode.trim())) {
    const error = new Error('Please provide a valid 6-digit postal pincode');
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Server Price Authority:
 * Recalculates and verifies products, availability, and unit prices strictly from MongoDB.
 * Dynamically retrieves shipping fee and free-shipping threshold from Admin Settings.
 */
/**
 * Safe constant-time signature comparison using crypto.timingSafeEqual with equal-length check.
 */
const safeCompareSignatures = (sigA, sigB) => {
  if (typeof sigA !== 'string' || typeof sigB !== 'string') return false;
  const bufA = Buffer.from(sigA, 'utf8');
  const bufB = Buffer.from(sigB, 'utf8');
  // Reject empty strings: a blank signature must never match anything
  if (bufA.length === 0 || bufB.length === 0) return false;
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Utility: Combines items in req.body.items sharing the same productId, size and color.
 * Sums their quantities into a single aggregated quantity per unique product/variant combination.
 * Enforces strict string types for product, size, and color, and positive integer for quantity.
 */
const aggregateOrderItems = (items) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    const error = new Error('Order must contain at least one item');
    error.statusCode = 400;
    throw error;
  }

  const aggregatedMap = new Map();

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      const error = new Error('Invalid item structure in order');
      error.statusCode = 400;
      throw error;
    }

    const rawProduct = item.productId ?? item.product ?? item._id;
    if (typeof rawProduct !== 'string' || !rawProduct.trim()) {
      const error = new Error('Product identifier must be a valid non-empty string');
      error.statusCode = 400;
      throw error;
    }
    const productId = rawProduct.trim();
    const rawSize = item.size !== undefined ? item.size : item.sizeName;
    if (rawSize !== undefined && rawSize !== null && typeof rawSize !== 'string') {
      const error = new Error('Size must be a string');
      error.statusCode = 400;
      throw error;
    }

    if (item.color !== undefined && item.color !== null && typeof item.color !== 'string') {
      const error = new Error('Color must be a string');
      error.statusCode = 400;
      throw error;
    }

    if (typeof item.quantity !== 'number' && typeof item.quantity !== 'string') {
      const error = new Error('Invalid product quantity specified');
      error.statusCode = 400;
      throw error;
    }

    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      const error = new Error('Item quantity must be an integer of at least 1');
      error.statusCode = 400;
      throw error;
    }

    // Determine normalized size and color key for grouping
    const normalizedSize = (
      item.sizeName ||
      item.sizeMeasurement ||
      item.size ||
      ''
    ).trim().toLowerCase();

    const normalizedColor = (
      item.color ||
      ''
    ).trim().toLowerCase();

    const groupKey = `${productId}:::${normalizedSize}:::${normalizedColor}`;

    if (aggregatedMap.has(groupKey)) {
      const existing = aggregatedMap.get(groupKey);
      existing.quantity += qty;
    } else {
      aggregatedMap.set(groupKey, {
        ...item,
        productId,
        size: item.size || item.sizeName || '',
        sizeName: item.sizeName || item.size || '',
        quantity: qty,
      });
    }
  }

  return Array.from(aggregatedMap.values());
};

/**
 * Server Price Authority & Stock Verification:
 * Aggregates cart duplicates, recalculates and verifies products, stock, and unit prices strictly from MongoDB.
 * Dynamically retrieves shipping fee and free-shipping threshold from Admin Settings.
 */
const calculateOrderPricing = async (rawItems) => {
  // 1. Aggregate duplicate items that share the exact same productId, size and color
  const items = aggregateOrderItems(rawItems);

  const verifiedItems = [];
  let calculatedSubtotal = 0;

  // Pre-aggregate total requested quantity per product across ALL cart lines (e.g. 3+3 must fail when stock is 4)
  const productQuantityTotals = new Map();
  for (const item of items) {
    const pId = item.productId;
    productQuantityTotals.set(pId, (productQuantityTotals.get(pId) || 0) + item.quantity);
  }

  for (const item of items) {
    const productId = item.productId;
    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error('Product not found or no longer available');
      error.statusCode = 404;
      throw error;
    }

    if (!product.isActive) {
      const error = new Error(`Product "${product.name}" is currently inactive and cannot be ordered`);
      error.statusCode = 400;
      throw error;
    }

    const requestedQty = item.quantity;
    const totalProductRequested = productQuantityTotals.get(productId) || requestedQty;

    // Validate that aggregated quantity across all lines does not exceed available product inventory
    if (requestedQty > product.stock || totalProductRequested > product.stock) {
      const error = new Error(
        product.stock <= 0
          ? `Product "${product.name}" is out of stock.`
          : `Insufficient stock for "${product.name}". Only ${product.stock} item${product.stock === 1 ? '' : 's'} available.`
      );
      error.statusCode = 400;
      throw error;
    }

    let realUnitPrice;
    let chosenSizeLabel = '';
    let matchedMeasurement = '';
    let matchedSizeName = '';

    // Check if the product has sizes
    if (product.sizes && product.sizes.length > 0) {
      const effectiveSize = (typeof item.size === 'string' && item.size.trim())
        ? item.size.trim()
        : (typeof item.sizeName === 'string' && item.sizeName.trim() ? item.sizeName.trim() : null);

      if (!effectiveSize) {
        const error = new Error('Invalid product size selected');
        error.statusCode = 400;
        throw error;
      }

      const clientSizeTrimmed = effectiveSize.toLowerCase();
      const requestedSizeName = (item.sizeName || '').trim().toLowerCase();
      const requestedSizeMeasurement = (item.sizeMeasurement || '').trim().toLowerCase();

      // Search for a matching size strictly using variant name, measurement or formatted label
      const foundSize = product.sizes.find((s) => {
        const sName = (s.name || '').trim().toLowerCase();
        const sMeasurement = (s.measurement || '').trim().toLowerCase();
        const formatted = s.measurement && s.name
          ? `${s.measurement} (${s.name})`.toLowerCase()
          : (s.measurement || s.name || '').toLowerCase();

        if (requestedSizeName && sName === requestedSizeName) return true;
        if (requestedSizeMeasurement && sMeasurement === requestedSizeMeasurement) return true;
        if (clientSizeTrimmed) {
          if (formatted === clientSizeTrimmed) return true;
          if (sName && sName === clientSizeTrimmed) return true;
          if (sMeasurement && sMeasurement === clientSizeTrimmed) return true;
        }
        return false;
      });

      // If NO matching size is found, immediately throw a 400 Bad Request error. Never use client price.
      if (!foundSize) {
        const error = new Error('Invalid product size selected');
        error.statusCode = 400;
        throw error;
      }

      realUnitPrice = foundSize.price;
      matchedMeasurement = foundSize.measurement || '';
      matchedSizeName = foundSize.name || '';
      chosenSizeLabel =
        foundSize.measurement && foundSize.name
          ? `${foundSize.measurement} (${foundSize.name})`
          : foundSize.measurement || foundSize.name;
    } else {
      // Product has no sizes: ignore client size, and store product's own default size label
      realUnitPrice =
        product.discountPrice !== null &&
        product.discountPrice !== undefined &&
        product.discountPrice > 0 &&
        product.discountPrice < product.price
          ? product.discountPrice
          : product.price;

      chosenSizeLabel = product.size || 'Standard';
    }

    calculatedSubtotal += realUnitPrice * requestedQty;

    verifiedItems.push({
      product: product._id,
      name: product.name,
      image: product.images && product.images.length > 0 ? product.images[0] : '/img/placeholder.svg',
      price: realUnitPrice,
      quantity: requestedQty,
      size: chosenSizeLabel,
      sizeMeasurement: matchedMeasurement,
      sizeName: matchedSizeName,
      color: item.color || product.color || '',
    });
  }

  // Dynamic shipping calculation based on MongoDB store settings
  const settings = await Settings.getSingleton();
  const threshold =
    typeof settings.freeShippingThreshold === 'number' ? settings.freeShippingThreshold : 999;
  const standardFee =
    typeof settings.standardShippingFee === 'number' ? settings.standardShippingFee : 99;

  const shippingPrice = calculatedSubtotal >= threshold ? 0 : standardFee;
  const totalAmount = calculatedSubtotal + shippingPrice;

  return { verifiedItems, calculatedSubtotal, shippingPrice, totalAmount };
};

/**
 * Atomically deducts inventory for each item in the order.
 * Uses conditional update `{ _id, stock: { $gte: qty } }` to prevent negative stock under concurrency.
 * If any product fails, rolls back previously deducted quantities.
 */
const atomicallyDeductStock = async (items) => {
  const successfullyDeducted = [];

  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );

    if (!updated) {
      // Rollback previous deductions
      for (const rollbackItem of successfullyDeducted) {
        await Product.findByIdAndUpdate(rollbackItem.product, {
          $inc: { stock: rollbackItem.quantity },
        });
      }

      const currentProd = await Product.findById(item.product);
      const available = currentProd ? currentProd.stock : 0;
      const error = new Error(
        `Insufficient stock for "${item.name}". Only ${available} item${available === 1 ? '' : 's'} available.`
      );
      error.statusCode = 400;
      throw error;
    }

    successfullyDeducted.push(item);
  }
};

// @desc    Get Razorpay Public Key ID
// @route   GET /api/payment/key
// @access  Public
const getRazorpayKey = async (req, res) => {
  const { keyId, isConfigured } = getRazorpayCredentials();

  res.status(200).json({
    success: true,
    keyId: isConfigured ? keyId : '',
    isConfigured,
  });
};

// @desc    Create Razorpay Order (pre-payment intent with server-authoritative amount)
// @route   POST /api/payment/create-order
// @access  Private
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, notes } = req.body;

    // Task 7: REQUIRE shippingAddress and always run validateShippingAddress (no optional path)
    if (!shippingAddress) {
      const error = new Error('Shipping address is required');
      error.statusCode = 400;
      throw error;
    }
    validateShippingAddress(shippingAddress);

    const validatedAddress = {
      fullName: shippingAddress.fullName.trim(),
      mobileNumber: shippingAddress.mobileNumber.trim(),
      email: shippingAddress.email.trim().toLowerCase(),
      address: shippingAddress.address.trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      pincode: shippingAddress.pincode.trim(),
    };

    // 1. Calculate authoritative server price and shipping
    const { verifiedItems, calculatedSubtotal, shippingPrice, totalAmount } =
      await calculateOrderPricing(items);

    // 2. Razorpay amount must be in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(totalAmount * 100);

    // Reuse existing active PaymentIntent for the same user and cart if created within 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existingIntent = await PaymentIntent.findOne({
      user: req.user._id,
      status: { $in: ['created', 'processing'] },
      createdAt: { $gte: thirtyMinutesAgo },
      expectedAmount: amountInPaise,
    }).sort({ createdAt: -1 });

    if (existingIntent) {
      const isCartIdentical =
        existingIntent.items.length === verifiedItems.length &&
        existingIntent.items.every((it, idx) => {
          const v = verifiedItems[idx];
          return (
            v &&
            it.product.toString() === v.product.toString() &&
            it.quantity === v.quantity &&
            it.size === v.size
          );
        });

      if (isCartIdentical) {
        console.log(`[PaymentIntent Reuse]: Reusing active order ${existingIntent.razorpayOrderId} for user ${req.user._id}`);
        const { keyId } = getRazorpayCredentials();
        return res.status(200).json({
          success: true,
          orderId: existingIntent.razorpayOrderId,
          amount: existingIntent.expectedAmount,
          currency: existingIntent.currency,
          subtotal: existingIntent.subtotal,
          shippingPrice: existingIntent.shippingPrice,
          totalAmount: existingIntent.totalAmount,
          keyId,
          reused: true,
          status: existingIntent.status,
        });
      }
    }

    const razorpay = getRazorpayInstance();

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now().toString().slice(-8)}_${Math.floor(Math.random() * 1000)}`,
      notes: {
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        itemsCount: verifiedItems.length.toString(),
      },
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // 3. Store PaymentIntent internally with authoritative address and expected amount
    await PaymentIntent.findOneAndUpdate(
      { razorpayOrderId: razorpayOrder.id },
      {
        razorpayOrderId: razorpayOrder.id,
        user: req.user._id,
        items: verifiedItems,
        shippingAddress: validatedAddress,
        subtotal: calculatedSubtotal,
        shippingPrice,
        totalAmount,
        expectedAmount: amountInPaise,
        currency: 'INR',
        status: 'created',
        notes: (notes || '').slice(0, 500),
      },
      { upsert: true, new: true }
    );

    const { keyId } = getRazorpayCredentials();

    res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // in paise
      currency: razorpayOrder.currency,
      subtotal: calculatedSubtotal,
      shippingPrice,
      totalAmount, // in rupees
      keyId,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay Payment Signature and Confirm Prepaid Order
// @route   POST /api/payment/verify
// @access  Private
const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // 1. Validate required Razorpay verification payload
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing Razorpay payment verification details. Payment could not be verified.',
      });
    }

    // 2. Idempotency Check (Task 7): Check existing order AND verify ownership BEFORE returning
    const existingOrder = await Order.findOne({
      $or: [
        { razorpayPaymentId: razorpay_payment_id },
        { razorpayOrderId: razorpay_order_id, paymentStatus: 'Completed' },
      ],
    });

    if (existingOrder) {
      // Ownership check BEFORE returning order
      if (existingOrder.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Security violation: You are not authorized to access this order.',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Payment has already been processed for this order.',
        order: existingOrder,
      });
    }

    // 3. Cryptographic HMAC-SHA256 signature verification
    const { keySecret: secret } = getRazorpayCredentials();
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay secret key is not configured on the server.',
      });
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload.toString())
      .digest('hex');

    if (!safeCompareSignatures(expectedSignature, razorpay_signature)) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Invalid cryptographic signature. Order was NOT placed.',
      });
    }

    // 4. Retrieve internal PaymentIntent to verify ownership and expected amount
    const paymentIntent = await PaymentIntent.findOne({ razorpayOrderId: razorpay_order_id });
    if (!paymentIntent) {
      return res.status(404).json({
        success: false,
        message: 'Payment intent not found. Please contact support.',
      });
    }

    // 5. Payment Ownership Verification: authenticated user must own the intent
    if (paymentIntent.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Security violation: You are not authorized to verify this payment.',
      });
    }

    // 6. Fetch payment entity from Razorpay API to confirm capture and amount match
    const razorpay = getRazorpayInstance();
    let paymentRecord;
    try {
      paymentRecord = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchErr) {
      console.error('[Razorpay Fetch Payment Error]:', fetchErr.message);
      // Return 503 (upstream unavailable) + pending flag so the frontend polls
      // via /payment/status instead of treating this as a definitive payment failure.
      return res.status(503).json({
        success: true,
        pending: true,
        razorpayOrderId: razorpay_order_id,
        message: 'Payment gateway temporarily unavailable during verification. Checking status — please do not refresh.',
      });
    }

    if (paymentRecord.order_id !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Security error: Payment does not match the requested order ID.',
      });
    }

    // 7. Payment Status Verification: only captured payments are accepted as completed
    if (paymentRecord.status !== 'captured') {
      return res.status(400).json({
        success: false,
        message: `Payment status is "${paymentRecord.status}". VASHTRAM only accepts captured payments.`,
      });
    }

    // 8. Expected Amount Verification: server authority against PaymentIntent expected amount
    if (paymentRecord.amount !== paymentIntent.expectedAmount) {
      console.warn(
        `[Payment Tampering Detected]: Expected ${paymentIntent.expectedAmount} paise, received ${paymentRecord.amount} paise.`
      );
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Paid amount does not match authoritative cart price.',
      });
    }

    // 9. Atomic State Machine Claim:
    // Transition status from 'created' to 'processing' atomically to win execution rights.
    const claimedIntent = await PaymentIntent.findOneAndUpdate(
      { _id: paymentIntent._id, status: 'created' },
      { $set: { status: 'processing', claimedAt: new Date(), razorpayPaymentId: razorpay_payment_id } },
      { new: true }
    );

    if (!claimedIntent) {
      // Another concurrent process (such as a parallel webhook or double-click) claimed the intent.
      // Poll briefly for the finalized order
      for (let attempt = 0; attempt < 6; attempt++) {
        const finishedOrder = await Order.findOne({
          $or: [
            { razorpayPaymentId: razorpay_payment_id },
            { razorpayOrderId: razorpay_order_id },
          ],
        });
        if (finishedOrder) {
          if (finishedOrder.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Security violation: Not authorized to access this order.',
            });
          }
          return res.status(200).json({
            success: true,
            message: 'Payment has already been processed for this order.',
            order: finishedOrder,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const updatedIntent = await PaymentIntent.findById(paymentIntent._id);
      if (updatedIntent && (updatedIntent.status === 'failed' || updatedIntent.status === 'refunded')) {
        const refundMsg = updatedIntent.refundStatus === 'processed'
          ? 'A refund has been initiated.'
          : 'We could not complete the automatic refund; our team has been notified and will refund you.';
        return res.status(400).json({
          success: false,
          message: `Payment processing encountered an error: ${updatedIntent.failureReason || 'Failed to complete order'}. ${refundMsg}`,
        });
      }

      // Task 4: Return HTTP 202 with pending flag when order is not yet finalized
      return res.status(202).json({
        success: true,
        pending: true,
        razorpayOrderId: razorpay_order_id,
        message: 'Payment received and order is currently being finalized.',
      });
    }

    // 10. Concurrency-Safe Atomic Stock Deduction with Auto-Refund on failure
    try {
      await atomicallyDeductStock(claimedIntent.items);
      claimedIntent.stockDeducted = true;
      await claimedIntent.save();
    } catch (stockError) {
      console.error('[Stock Deduction Failed]:', stockError.message);
      claimedIntent.status = 'failed';
      claimedIntent.failureReason = stockError.message;
      await claimedIntent.save();

      // Initiate automatic refund via shared refund service
      const refundResult = await refundPayment({
        paymentId: razorpay_payment_id,
        intentId: claimedIntent._id,
        amountInPaise: paymentRecord.amount,
        reason: 'Items became unavailable during order verification',
      });

      const refundNotice = refundResult.success
        ? 'A refund has been initiated.'
        : 'We could not complete the automatic refund; our team has been notified and will refund you.';

      return res.status(400).json({
        success: false,
        message: `Order confirmation failed: ${stockError.message}. ${refundNotice}`,
      });
    }

    // 11. Concurrency-Safe Unique Order Number Generation
    const orderNumber = await getNextOrderNumber();

    // 12. Persist Confirmed Order using strictly the intent's saved address and items (Task 7)
    let order;
    try {
      order = await Order.create({
        orderNumber,
        user: req.user._id,
        items: claimedIntent.items.map((it) => ({
          product: it.product,
          name: it.name || 'Product',
          image: it.image || '/img/placeholder.svg',
          price: it.price || 0,
          quantity: it.quantity || 1,
          size: it.size || 'King',
          sizeMeasurement: it.sizeMeasurement || '',
          sizeName: it.sizeName || '',
          color: it.color || '',
        })),
        shippingAddress: claimedIntent.shippingAddress,
        paymentMethod: 'Razorpay Online Payment',
        paymentStatus: 'Completed',
        orderStatus: 'Confirmed',
        isPaid: true,
        paidAt: new Date(),
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        subtotal: claimedIntent.subtotal,
        shippingPrice: claimedIntent.shippingPrice,
        totalAmount: claimedIntent.totalAmount,
        notes: claimedIntent.notes || '',
        statusHistory: [
          {
            status: 'Confirmed',
            date: new Date(),
            note: `Prepaid online payment verified via Razorpay (Payment ID: ${razorpay_payment_id})`,
          },
        ],
      });
    } catch (orderError) {
      console.error('[Order Creation Exception]:', orderError.message);

      // Check if order already exists for this payment (E11000 duplicate key or race condition)
      const existingOrder = await Order.findOne({ razorpayPaymentId: razorpay_payment_id });
      if (existingOrder) {
        console.log(`[Order Creation Idempotent]: Existing order #${existingOrder.orderNumber} found for payment ${razorpay_payment_id}. Skipping rollback.`);
        claimedIntent.status = 'completed';
        claimedIntent.orderId = existingOrder._id;
        await claimedIntent.save();
        return res.status(200).json({
          success: true,
          message: 'Payment verified and order confirmed successfully! Thank you for choosing VASHTRAM.',
          order: existingOrder,
        });
      }

      // Compensating transaction: Restore stock if previously deducted
      if (claimedIntent.stockDeducted) {
        for (const item of claimedIntent.items) {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }
        claimedIntent.stockDeducted = false;
      }
      claimedIntent.status = 'failed';
      claimedIntent.failureReason = orderError.message;
      await claimedIntent.save();

      // Guard: Before ANY auto-refund, double check that no order exists for that payment
      const checkOrder = await Order.findOne({ razorpayPaymentId: razorpay_payment_id });
      if (checkOrder) {
        claimedIntent.status = 'completed';
        claimedIntent.orderId = checkOrder._id;
        await claimedIntent.save();
        return res.status(200).json({
          success: true,
          message: 'Payment verified and order confirmed successfully! Thank you for choosing VASHTRAM.',
          order: checkOrder,
        });
      }

      // Compensating transaction: Refund customer via shared service
      const refundResult = await refundPayment({
        paymentId: razorpay_payment_id,
        intentId: claimedIntent._id,
        amountInPaise: paymentRecord.amount,
        reason: 'Order creation exception after payment capture',
      });

      const refundNotice = refundResult.success
        ? 'A refund has been initiated.'
        : 'We could not complete the automatic refund; our team has been notified and will refund you.';

      return res.status(500).json({
        success: false,
        message: `Order creation encountered an unexpected error. ${refundNotice}`,
      });
    }

    // 13. Mark PaymentIntent Completed
    claimedIntent.status = 'completed';
    claimedIntent.orderId = order._id;
    await claimedIntent.save();

    res.status(201).json({
      success: true,
      message: 'Payment verified and order confirmed successfully! Thank you for choosing VASHTRAM.',
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Poll status of a Payment Intent
// @route   GET /api/payment/status/:razorpayOrderId
// @access  Private (auth required, must verify intent belongs to req.user)
const getPaymentStatus = async (req, res, next) => {
  try {
    const { razorpayOrderId } = req.params;

    if (!razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: 'Missing razorpayOrderId parameter',
      });
    }

    const intent = await PaymentIntent.findOne({ razorpayOrderId });
    if (!intent) {
      return res.status(404).json({
        success: false,
        message: 'Payment intent not found',
      });
    }

    // Verify ownership: customers can only view their own payment status
    if (intent.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Security violation: Not authorized to view this payment status',
      });
    }

    // Find linked order if exists
    const order = intent.orderId
      ? await Order.findById(intent.orderId)
      : await Order.findOne({ razorpayOrderId });

    // Confirmed state
    if (order && (order.paymentStatus === 'Completed' || order.orderStatus === 'Confirmed')) {
      return res.status(200).json({
        success: true,
        status: 'confirmed',
        orderId: order._id,
        orderNumber: order.orderNumber,
        message: 'Order confirmed successfully',
      });
    }

    if (intent.status === 'completed' && order) {
      return res.status(200).json({
        success: true,
        status: 'confirmed',
        orderId: order._id,
        orderNumber: order.orderNumber,
        message: 'Order confirmed successfully',
      });
    }

    // Failed state
    if (intent.status === 'failed') {
      return res.status(200).json({
        success: false,
        status: 'failed',
        refundStatus: intent.refundStatus,
        message: intent.failureReason || 'Payment or order creation could not be completed',
      });
    }

    // Still processing (status === 'created' or 'processing') -> HTTP 202 Accepted
    return res.status(202).json({
      success: true,
      status: 'processing',
      pending: true,
      message: 'Payment processing is currently in progress. Please continue polling.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Razorpay Webhook for Payment Capture Recovery & Resiliency
// @route   POST /api/payment/webhook
// @access  Public (Signature-Verified with dedicated RAZORPAY_WEBHOOK_SECRET)
const handleWebhook = async (req, res) => {
  try {
    // Dedicated Webhook Secret (never fall back to RAZORPAY_KEY_SECRET)
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const webhookSignature = req.headers['x-razorpay-signature'];

    if (!webhookSignature) {
      return res.status(400).json({ success: false, message: 'Missing webhook signature header' });
    }

    if (!webhookSecret) {
      console.error('[Webhook Configuration Error]: Dedicated RAZORPAY_WEBHOOK_SECRET is not configured on server.');
      return res.status(500).json({ success: false, message: 'Dedicated webhook secret not configured' });
    }

    // Cryptographic signature verification using raw request payload
    const rawPayload = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawPayload)
      .digest('hex');

    if (!safeCompareSignatures(expectedSignature, webhookSignature)) {
      console.warn('[Webhook Error]: Webhook signature mismatch.');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    const eventId =
      req.headers['x-razorpay-event-id'] ||
      req.body?.id ||
      `evt_${req.body.payload?.payment?.entity?.order_id}_${Date.now()}`;

    // Webhook Idempotency Check: Check if event has already been processed
    const existingEvent = await WebhookEvent.findOne({ eventId });
    if (existingEvent) {
      console.log(`[Webhook Duplicate]: Event ${eventId} was already handled.`);
      return res.status(200).json({ status: 'duplicate_event', eventId });
    }

    console.log(`[Razorpay Webhook Received]: Event "${event}" (ID: ${eventId})`);

    // Process payment.captured or order.paid
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload?.payment?.entity;
      if (!paymentEntity) {
        return res.status(200).json({ status: 'ignored_missing_payload' });
      }

      const paymentId = paymentEntity.id;
      const razorpayOrderId = paymentEntity.order_id;

      // 1. Idempotency Check: if order already exists, do not duplicate
      const existingOrder = await Order.findOne({
        $or: [
          { razorpayPaymentId: paymentId },
          { razorpayOrderId: razorpayOrderId, paymentStatus: 'Completed' },
        ],
      });

      if (existingOrder) {
        console.log(`[Webhook]: Order #${existingOrder.orderNumber} already exists for payment ${paymentId}. Skipping.`);
        await WebhookEvent.create({
          eventId,
          eventType: event,
          status: 'duplicate',
          orderNumber: existingOrder.orderNumber,
          razorpayOrderId,
          razorpayPaymentId: paymentId,
        });
        return res.status(200).json({ status: 'already_processed', orderNumber: existingOrder.orderNumber });
      }

      // 2. Locate internal PaymentIntent
      const intent = await PaymentIntent.findOne({ razorpayOrderId });
      if (!intent) {
        console.warn(`[Webhook]: No PaymentIntent found for Razorpay order ${razorpayOrderId}`);
        await WebhookEvent.create({
          eventId,
          eventType: event,
          status: 'ignored',
          error: 'No PaymentIntent found',
          razorpayOrderId,
          razorpayPaymentId: paymentId,
        });
        return res.status(200).json({ status: 'no_intent_found' });
      }

      // 3. Expected Amount Verification
      if (paymentEntity.amount !== intent.expectedAmount) {
        console.error(`[Webhook Amount Mismatch]: Expected ${intent.expectedAmount}, received ${paymentEntity.amount}`);
        await WebhookEvent.create({
          eventId,
          eventType: event,
          status: 'failed',
          error: 'Amount mismatch',
          razorpayOrderId,
          razorpayPaymentId: paymentId,
        });
        return res.status(400).json({ status: 'amount_mismatch' });
      }

      // 4. Atomic PaymentIntent Claim
      const claimedIntent = await PaymentIntent.findOneAndUpdate(
        { razorpayOrderId, status: 'created' },
        { $set: { status: 'processing', claimedAt: new Date(), razorpayPaymentId: paymentId } },
        { new: true }
      );

      if (!claimedIntent) {
        // Task 3: Check if this is a late capture for an intent already marked 'failed'
        const failedIntent = await PaymentIntent.findOne({ razorpayOrderId, status: 'failed' });
        if (failedIntent && !failedIntent.orderId && failedIntent.refundStatus !== 'processed') {
          console.log(`[Webhook Late Capture]: Payment ${paymentId} captured for failed intent ${razorpayOrderId}. Attempting recovery/fulfillment...`);
          // Atomically claim the failed intent for late capture processing
          const lateClaimed = await PaymentIntent.findOneAndUpdate(
            { _id: failedIntent._id, status: 'failed', refundStatus: { $ne: 'processed' } },
            { $set: { status: 'processing', claimedAt: new Date(), razorpayPaymentId: paymentId } },
            { new: true }
          );

          if (lateClaimed) {
            let stockDeductionSuccess = false;
            try {
              await atomicallyDeductStock(lateClaimed.items);
              lateClaimed.stockDeducted = true;
              await lateClaimed.save();
              stockDeductionSuccess = true;
            } catch (lateStockErr) {
              console.warn(`[Webhook Late Capture]: Stock unavailable for ${razorpayOrderId}: ${lateStockErr.message}. Refunding payment.`);
              await refundPayment({
                paymentId,
                intentId: lateClaimed._id,
                amountInPaise: paymentEntity.amount,
                reason: 'Stock unavailable upon late payment capture',
              });
              const refreshed = await PaymentIntent.findById(lateClaimed._id);
              if (refreshed && refreshed.status !== 'refunded') {
                refreshed.status = 'failed';
                refreshed.failureReason = lateStockErr.message;
                await refreshed.save();
              }
              await WebhookEvent.create({
                eventId,
                eventType: event,
                status: 'late_capture_refunded',
                razorpayOrderId,
                razorpayPaymentId: paymentId,
              });
              return res.status(200).json({ status: 'late_capture_refunded' });
            }

            if (stockDeductionSuccess) {
              try {
                const lateOrderNumber = await getNextOrderNumber();
                const lateOrder = await Order.create({
                  orderNumber: lateOrderNumber,
                  user: lateClaimed.user,
                  items: lateClaimed.items.map((it) => ({
                    product: it.product,
                    name: it.name || 'Product',
                    image: it.image || '/img/placeholder.svg',
                    price: it.price || 0,
                    quantity: it.quantity || 1,
                    size: it.size || 'King',
                    sizeMeasurement: it.sizeMeasurement || '',
                    sizeName: it.sizeName || '',
                    color: it.color || '',
                  })),
                  shippingAddress: lateClaimed.shippingAddress,
                  paymentMethod: 'Razorpay Online Payment',
                  paymentStatus: 'Completed',
                  orderStatus: 'Confirmed',
                  isPaid: true,
                  paidAt: new Date(paymentEntity.created_at ? paymentEntity.created_at * 1000 : Date.now()),
                  razorpayOrderId,
                  razorpayPaymentId: paymentId,
                  razorpaySignature: 'webhook_late_capture',
                  subtotal: lateClaimed.subtotal,
                  shippingPrice: lateClaimed.shippingPrice,
                  totalAmount: lateClaimed.totalAmount,
                  notes: 'Order fulfilled via late captured webhook',
                  statusHistory: [
                    {
                      status: 'Confirmed',
                      date: new Date(),
                      note: `Payment captured via late webhook (Payment ID: ${paymentId})`,
                    },
                  ],
                });

                lateClaimed.status = 'completed';
                lateClaimed.orderId = lateOrder._id;
                lateClaimed.refundStatus = 'none';
                lateClaimed.needsAttention = false;
                lateClaimed.refundAttempts = 0;
                lateClaimed.refundLastError = null;
                lateClaimed.refundNextAttemptAt = null;
                await lateClaimed.save();

                await WebhookEvent.create({
                  eventId,
                  eventType: event,
                  status: 'processed',
                  orderNumber: lateOrder.orderNumber,
                  razorpayOrderId,
                  razorpayPaymentId: paymentId,
                });
                return res.status(200).json({ status: 'order_created_late_capture', orderNumber: lateOrder.orderNumber });
              } catch (lateOrderErr) {
                console.error('[Webhook Late Capture]: Order creation failed:', lateOrderErr.message);
                if (lateClaimed.stockDeducted) {
                  for (const rollItem of lateClaimed.items) {
                    await Product.findByIdAndUpdate(rollItem.product, { $inc: { stock: rollItem.quantity } });
                  }
                  lateClaimed.stockDeducted = false;
                  await lateClaimed.save();
                }
                await refundPayment({
                  paymentId,
                  intentId: lateClaimed._id,
                  amountInPaise: paymentEntity.amount,
                  reason: 'Order creation exception upon late payment capture',
                });
              }
            }
          }
        }

        console.log(`[Webhook Race]: PaymentIntent for ${razorpayOrderId} already claimed or completed.`);
        await WebhookEvent.create({
          eventId,
          eventType: event,
          status: 'duplicate',
          razorpayOrderId,
          razorpayPaymentId: paymentId,
        }).catch((evtErr) => {
          if (evtErr.code === 11000 || (evtErr.message && evtErr.message.includes('E11000'))) {
            console.log(`[Webhook Duplicate EventId]: Duplicate event ${eventId} caught.`);
          }
        });
        return res.status(200).json({ status: 'already_claimed_or_processed' });
      }

      // 5. Concurrency-Safe Atomic Stock Deduction with Auto-Refund on failure
      try {
        await atomicallyDeductStock(claimedIntent.items);
        claimedIntent.stockDeducted = true;
        await claimedIntent.save();
      } catch (stockError) {
        console.error('[Webhook Stock Error]:', stockError.message);
        claimedIntent.status = 'failed';
        claimedIntent.failureReason = stockError.message;
        await claimedIntent.save();

        const checkOrder = await Order.findOne({ razorpayPaymentId: paymentId });
        if (!checkOrder) {
          await refundPayment({
            paymentId,
            intentId: claimedIntent._id,
            amountInPaise: paymentEntity.amount,
            reason: 'Items out of stock during webhook processing',
          });
        }

        await WebhookEvent.create({
          eventId,
          eventType: event,
          status: 'failed',
          error: stockError.message,
          razorpayOrderId,
          razorpayPaymentId: paymentId,
        }).catch(() => {});

        return res.status(200).json({ status: 'stock_failed_refunded' });
      }

      // 6. Concurrency-Safe Order Number Generation
      const orderNumber = await getNextOrderNumber();

      // 7. Create Confirmed Order with Compensating Rollback & Refund on error
      let newOrder;
      try {
        newOrder = await Order.create({
          orderNumber,
          user: claimedIntent.user,
          items: claimedIntent.items.map((it) => ({
            product: it.product,
            name: it.name || 'Product',
            image: it.image || '/img/placeholder.svg',
            price: it.price || 0,
            quantity: it.quantity || 1,
            size: it.size || 'King',
            sizeMeasurement: it.sizeMeasurement || '',
            sizeName: it.sizeName || '',
            color: it.color || '',
          })),
          shippingAddress: claimedIntent.shippingAddress,
          paymentMethod: 'Razorpay Online Payment',
          paymentStatus: 'Completed',
          orderStatus: 'Confirmed',
          isPaid: true,
          paidAt: new Date(paymentEntity.created_at ? paymentEntity.created_at * 1000 : Date.now()),
          razorpayOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: 'webhook_captured',
          subtotal: claimedIntent.subtotal,
          shippingPrice: claimedIntent.shippingPrice,
          totalAmount: claimedIntent.totalAmount,
          notes: claimedIntent.notes || 'Order confirmed and recovered via Razorpay webhook',
          statusHistory: [
            {
              status: 'Confirmed',
              date: new Date(),
              note: `Payment captured and order created via Razorpay Webhook (Payment ID: ${paymentId})`,
            },
          ],
        });
      } catch (orderError) {
        console.error('[Webhook Order Creation Failed]:', orderError.message);

        // Check if order already exists for this payment (E11000 duplicate key or race condition)
        const existing = await Order.findOne({ razorpayPaymentId: paymentId });
        if (existing) {
          console.log(`[Webhook Order Creation Idempotent]: Existing order #${existing.orderNumber} found for payment ${paymentId}. Skipping rollback.`);
          claimedIntent.status = 'completed';
          claimedIntent.orderId = existing._id;
          await claimedIntent.save();
          await WebhookEvent.create({
            eventId,
            eventType: event,
            status: 'processed',
            orderNumber: existing.orderNumber,
            razorpayOrderId,
            razorpayPaymentId: paymentId,
          }).catch(() => {});
          return res.status(200).json({ status: 'order_already_created', orderNumber: existing.orderNumber });
        }

        // Compensating stock rollback
        if (claimedIntent.stockDeducted) {
          for (const item of claimedIntent.items) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
          }
          claimedIntent.stockDeducted = false;
        }
        claimedIntent.status = 'failed';
        claimedIntent.failureReason = orderError.message;
        await claimedIntent.save();

        const checkOrder = await Order.findOne({ razorpayPaymentId: paymentId });
        if (!checkOrder) {
          await refundPayment({
            paymentId,
            intentId: claimedIntent._id,
            amountInPaise: paymentEntity.amount,
            reason: 'Order creation failed in webhook',
          });
        }

        await WebhookEvent.create({
          eventId,
          eventType: event,
          status: 'failed',
          error: orderError.message,
          razorpayOrderId,
          razorpayPaymentId: paymentId,
        }).catch(() => {});

        return res.status(200).json({ status: 'order_creation_failed_refunded' });
      }

      claimedIntent.status = 'completed';
      claimedIntent.orderId = newOrder._id;
      await claimedIntent.save();

      await WebhookEvent.create({
        eventId,
        eventType: event,
        status: 'processed',
        orderNumber: newOrder.orderNumber,
        razorpayOrderId,
        razorpayPaymentId: paymentId,
      }).catch(() => {});

      console.log(`[Webhook Success]: Created order #${newOrder.orderNumber} for payment ${paymentId}`);
      return res.status(200).json({ status: 'order_created', orderNumber: newOrder.orderNumber });
    }

    // Process refund.processed or refund.failed
    if (event === 'refund.processed' || event === 'refund.failed') {
      const refundEntity = req.body.payload?.refund?.entity;
      const paymentEntity = req.body.payload?.payment?.entity;
      const refundId = refundEntity?.id || `rfnd_${Date.now()}`;
      const paymentId = refundEntity?.payment_id || paymentEntity?.id;
      const refundAmountPaise = Number(refundEntity?.amount) || 0;
      const refundAmountRupees = refundAmountPaise ? refundAmountPaise / 100 : 0;

      if (!paymentId) {
        return res.status(200).json({ status: 'ignored_missing_payment_id' });
      }

      const order = await Order.findOne({ razorpayPaymentId: paymentId });
      const intent = await PaymentIntent.findOne({ razorpayPaymentId: paymentId });

      if (event === 'refund.failed') {
        const errorDesc = refundEntity?.error_description || 'Refund failed via webhook';
        if (order) {
          order.refundStatus = 'failed';
          order.refundLastError = errorDesc;
          order.needsAttention = true;
          await order.save();
        }
        if (intent) {
          intent.refundStatus = 'failed';
          intent.refundLastError = errorDesc;
          intent.needsAttention = true;
          await intent.save();
        }
        await WebhookEvent.create({
          eventId,
          eventType: event,
          status: 'failed',
          error: errorDesc,
          razorpayPaymentId: paymentId,
        }).catch(() => {});
        return res.status(200).json({ status: 'refund_failed_recorded' });
      }

      // event === 'refund.processed'
      if (!order && !intent) {
        console.warn(`[Webhook Refund]: No Order or PaymentIntent found for payment ${paymentId}`);
        await WebhookEvent.create({
          eventId,
          eventType: event,
          status: 'ignored',
          error: 'No Order or PaymentIntent found',
          razorpayPaymentId: paymentId,
        }).catch(() => {});
        return res.status(200).json({ status: 'no_entity_found' });
      }

      // Idempotency: If refundService already processed this refundId
      if (order && order.isRefunded && order.refundId === refundId) {
        console.log(`[Webhook Refund Idempotency]: Refund ${refundId} already applied to order #${order.orderNumber}. Skipping.`);
        await WebhookEvent.create({
          eventId,
          eventType: event,
          status: 'duplicate',
          orderNumber: order.orderNumber,
          razorpayPaymentId: paymentId,
        }).catch(() => {});
        return res.status(200).json({ status: 'already_refunded', orderNumber: order.orderNumber });
      }

      if (order) {
        const targetTotal = order.totalAmount || 0;
        const priorRefundAmount = (order.refundId && order.refundId !== refundId) ? (order.refundAmount || 0) : 0;
        const newTotalRefunded = priorRefundAmount + (refundAmountRupees || targetTotal);
        const isFullyRefunded = targetTotal > 0 && newTotalRefunded >= targetTotal;

        order.refundId = refundId;
        order.refundAmount = newTotalRefunded;
        order.refundStatus = isFullyRefunded ? 'processed' : 'pending';
        order.needsAttention = !isFullyRefunded;
        order.refundedAt = new Date();

        if (isFullyRefunded) {
          order.isRefunded = true;
          order.paymentStatus = 'Refunded';

          if (['Pending', 'Confirmed', 'Processing'].includes(order.orderStatus)) {
            order.orderStatus = 'Cancelled';
            order.statusHistory.push({
              status: 'Cancelled',
              date: new Date(),
              note: `Order cancelled upon full refund via Webhook (Refund ID: ${refundId})`,
            });
            await order.save();
            const { restoreOrderStock } = require('../services/stockService');
            await restoreOrderStock(order, { reason: 'Webhook full refund processed' });
          } else if (['Shipped', 'Delivered'].includes(order.orderStatus)) {
            order.statusHistory.push({
              status: order.orderStatus,
              date: new Date(),
              note: `Refund of ₹${newTotalRefunded} processed via Webhook (Refund ID: ${refundId}). Order is ${order.orderStatus}; manual restock decision required.`,
            });
            await order.save();
            // RULE: NO RESTOCK FOR SHIPPED/DELIVERED!
          } else if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned') {
            await order.save();
            const { restoreOrderStock } = require('../services/stockService');
            await restoreOrderStock(order, { reason: 'Webhook full refund processed' });
          } else {
            await order.save();
          }
        } else {
          // Partial refund
          order.statusHistory.push({
            status: order.orderStatus,
            date: new Date(),
            note: `Partial refund of ₹${refundAmountRupees} processed via Webhook (Refund ID: ${refundId}). Total refunded: ₹${newTotalRefunded} of ₹${targetTotal}.`,
          });
          await order.save();
        }
      }

      if (intent) {
        const isFullyRefunded = !order || order.isRefunded;
        intent.refundId = refundId;
        intent.refundStatus = isFullyRefunded ? 'processed' : 'pending';
        if (isFullyRefunded) intent.status = 'refunded';
        intent.needsAttention = !isFullyRefunded;
        await intent.save();
      }

      await WebhookEvent.create({
        eventId,
        eventType: event,
        status: 'processed',
        orderNumber: order ? order.orderNumber : null,
        razorpayPaymentId: paymentId,
      }).catch(() => {});

      return res.status(200).json({ status: 'refund_processed' });
    }

    res.status(200).json({ status: 'event_acknowledged' });
  } catch (error) {
    if (error.code === 11000 || (error.message && error.message.includes('E11000'))) {
      console.log('[Webhook Duplicate Event]: E11000 caught at controller boundary. Returning 200 duplicate_event.');
      return res.status(200).json({ status: 'duplicate_event' });
    }
    console.error('[Webhook Exception]:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Executes a real refund via the shared RefundService for an eligible paid order.
 */
const processRazorpayRefund = async (order, reason = 'Admin initiated refund') => {
  if (!order.isPaid || order.paymentStatus !== 'Completed') {
    const error = new Error('Only completed prepaid orders are eligible for a refund.');
    error.statusCode = 400;
    throw error;
  }

  if (order.isRefunded || order.paymentStatus === 'Refunded') {
    const error = new Error('This order has already been refunded.');
    error.statusCode = 400;
    throw error;
  }

  if (!order.razorpayPaymentId) {
    const error = new Error('No Razorpay payment ID associated with this order.');
    error.statusCode = 400;
    throw error;
  }

  const result = await refundPayment({
    paymentId: order.razorpayPaymentId,
    orderId: order._id,
    amount: order.totalAmount,
    reason,
    force: true,
  });

  if (!result.success) {
    const error = new Error(result.error || 'Failed to process refund');
    error.statusCode = 500;
    throw error;
  }

  return result.refund;
};

module.exports = {
  getRazorpayKey,
  createRazorpayOrder,
  verifyPayment,
  getPaymentStatus,
  handleWebhook,
  calculateOrderPricing,
  aggregateOrderItems,
  validateShippingAddress,
  processRazorpayRefund,
  getRazorpayInstance,
};
