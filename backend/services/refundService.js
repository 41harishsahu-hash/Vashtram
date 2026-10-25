const PaymentIntent = require('../models/PaymentIntent');
const Order = require('../models/Order');
const { getRazorpayInstance } = require('../config/razorpay');

/**
 * Sanitizes Razorpay error messages to avoid printing or returning secrets/stacktraces.
 */
const sanitizeErrorMessage = (error) => {
  if (!error) return 'Unknown refund error';
  const msg = typeof error === 'string' ? error : error.message || error.description || JSON.stringify(error);
  return msg.replace(/[a-zA-Z0-9_-]{20,}/g, '[REDACTED]').slice(0, 300);
};

const MAX_REFUND_ATTEMPTS = 5;

/**
 * Shared, idempotent, race-safe refund function.
 * Used by payment verify, webhook, cancelOrder, stuck processing recovery, and admin retries.
 * 
 * Features:
 * 1. Concurrency guard using refundLockedAt (prevents duplicate simultaneous calls).
 * 2. Razorpay-side idempotency via fetchMultipleRefund checking processed refunds sum.
 * 3. Partial refund handling (only refunds remaining balance; never marks processed on partial).
 * 4. Exponential backoff and retry scheduling with refundNextAttemptAt and MAX_REFUND_ATTEMPTS cap.
 * 
 * @param {Object} params
 * @param {string} [params.paymentId] - Razorpay payment ID
 * @param {number} [params.amountInPaise] - Target amount to refund in paise
 * @param {number} [params.amount] - Target amount in rupees (converted to paise)
 * @param {string} [params.reason] - Reason for refund
 * @param {string} [params.intentId] - PaymentIntent ID or Razorpay Order ID
 * @param {string} [params.orderId] - Order ID
 * @returns {Promise<{success: boolean, refund?: Object, error?: string, alreadyRefunded?: boolean, inProgress?: boolean}>}
 */
const refundPayment = async ({
  paymentId,
  amountInPaise,
  amount,
  reason = 'Automated refund',
  intentId,
  orderId,
  force = false,
}) => {
  // 1. Locate PaymentIntent and/or Order
  let intent = null;
  if (intentId) {
    const intentIdStr = intentId.toString();
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(intentIdStr);
    intent = await PaymentIntent.findOne({
      $or: [{ _id: isObjectId ? intentIdStr : null }, { razorpayOrderId: intentIdStr }],
    });
  }

  let order = null;
  if (orderId) {
    order = await Order.findById(orderId);
  }
  if (!order && intent?.orderId) {
    order = await Order.findById(intent.orderId);
  }

  // Resolve Razorpay payment ID using strict precedence:
  // intent.razorpayPaymentId || order.razorpayPaymentId || provided paymentId
  const resolvedPaymentId =
    intent?.razorpayPaymentId ||
    order?.razorpayPaymentId ||
    paymentId;

  if (!intent && resolvedPaymentId) {
    intent = await PaymentIntent.findOne({ razorpayPaymentId: resolvedPaymentId }).catch(() => null);
  }
  if (!order && resolvedPaymentId) {
    order = await Order.findOne({ razorpayPaymentId: resolvedPaymentId }).catch(() => null);
  }

  if (!resolvedPaymentId) {
    const error = 'Cannot process refund: Missing Razorpay payment ID';
    console.error(`[RefundService Error]: ${error}`);
    return { success: false, error };
  }

  // 1b. Guard: Prevent system rollback auto-refunds from refunding when an active order exists.
  // System auto-refunds pass intentId without orderId. Explicit admin/customer refunds pass orderId or force: true.
  if (!force && !orderId) {
    if (order && !['Cancelled', 'Returned'].includes(order.orderStatus) && !order.isRefunded) {
      console.warn(
        `[RefundService Guard]: Refusing system auto-refund for payment ${resolvedPaymentId}: active Order #${order.orderNumber} exists.`
      );
      return {
        success: false,
        skipped: true,
        error: `Active order #${order.orderNumber} exists for payment`,
        intent,
        order,
      };
    }
    if (intent && intent.status === 'completed' && intent.orderId) {
      console.log(
        `[RefundService Guard]: Skipping refund for completed PaymentIntent ${intent.razorpayOrderId} with linked order ${intent.orderId} (force=false).`
      );
      return {
        success: false,
        skipped: true,
        error: 'Cannot refund completed intent with active order without force option',
        intent,
        order,
      };
    }
  }

  // 2. Check if already marked refunded locally
  if (intent?.refundStatus === 'processed' || order?.refundStatus === 'processed' || order?.isRefunded) {
    console.log(`[RefundService Idempotency]: Payment ${resolvedPaymentId} already marked as refunded in database.`);
    return {
      success: true,
      alreadyRefunded: true,
      refundId: order?.refundId || intent?.refundId,
      order,
      intent,
    };
  }

  // Calculate target paise
  let targetPaise = amountInPaise;
  if (!targetPaise && amount) {
    targetPaise = Math.round(amount * 100);
  }
  if (!targetPaise && intent?.expectedAmount) {
    targetPaise = intent.expectedAmount;
  }
  if (!targetPaise && order?.totalAmount) {
    targetPaise = Math.round(order.totalAmount * 100);
  }

  // 3. Concurrency Guard: Atomic lock using refundLockedAt
  // Acquire lock only if unlocked or lock is older than 2 minutes
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  let lockAcquired = false;

  if (intent) {
    const lockedIntent = await PaymentIntent.findOneAndUpdate(
      {
        _id: intent._id,
        $or: [{ refundLockedAt: null }, { refundLockedAt: { $lt: twoMinutesAgo } }],
      },
      { $set: { refundLockedAt: new Date() } },
      { new: true }
    );
    if (!lockedIntent) {
      console.log(`[RefundService Concurrency]: Refund already in progress for PaymentIntent ${intent._id}. Skipping.`);
      return { success: false, inProgress: true, error: 'Refund already in progress by another worker', intent, order };
    }
    intent = lockedIntent;
    lockAcquired = true;
  }

  if (order && !lockAcquired) {
    const lockedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        $or: [{ refundLockedAt: null }, { refundLockedAt: { $lt: twoMinutesAgo } }],
      },
      { $set: { refundLockedAt: new Date() } },
      { new: true }
    );
    if (!lockedOrder) {
      console.log(`[RefundService Concurrency]: Refund already in progress for Order ${order._id}. Skipping.`);
      return { success: false, inProgress: true, error: 'Refund already in progress by another worker', intent, order };
    }
    order = lockedOrder;
    lockAcquired = true;
  }

  const razorpay = getRazorpayInstance();

  try {
    // 4. Razorpay-side Idempotency & Partial Refund Check: Fetch existing refunds
    let sumProcessedPaise = 0;
    let lastRefundId = null;

    try {
      if (razorpay.payments && typeof razorpay.payments.fetchMultipleRefund === 'function') {
        const existingRefunds = await razorpay.payments.fetchMultipleRefund(resolvedPaymentId);
        const items = existingRefunds?.items || (Array.isArray(existingRefunds) ? existingRefunds : []);
        for (const r of items) {
          if (r.status === 'processed' || r.status === 'captured' || r.status === 'pending') {
            sumProcessedPaise += Number(r.amount) || 0;
            lastRefundId = r.id;
          }
        }
      }
    } catch (checkErr) {
      console.warn(`[RefundService]: Pre-check fetchMultipleRefund notice: ${checkErr.message}`);
    }

    // If existing processed refunds already meet or exceed the target amount -> fully refunded!
    if (targetPaise && sumProcessedPaise >= targetPaise) {
      console.log(`[RefundService Idempotency]: Existing processed refunds totaling ₹${sumProcessedPaise / 100} found on Razorpay for payment ${resolvedPaymentId}.`);
      
      if (intent) {
        intent.refundStatus = 'processed';
        intent.status = 'refunded';
        intent.refundId = lastRefundId || intent.refundId;
        intent.needsAttention = false;
        intent.refundLastError = null;
        intent.refundNextAttemptAt = null;
        await intent.save();
      }

      if (order) {
        order.isRefunded = true;
        order.paymentStatus = 'Refunded';
        order.refundStatus = 'processed';
        order.refundId = lastRefundId || order.refundId;
        order.refundAmount = sumProcessedPaise / 100;
        order.needsAttention = false;
        order.refundLastError = null;
        order.refundNextAttemptAt = null;
        order.refundedAt = new Date();

        if (['Pending', 'Confirmed', 'Processing'].includes(order.orderStatus)) {
          order.orderStatus = 'Cancelled';
          order.statusHistory.push({
            status: 'Cancelled',
            date: new Date(),
            note: `Order cancelled upon full refund (Refund ID: ${lastRefundId || order.refundId}) - Reason: ${reason}`,
          });
          await order.save();
          const { restoreOrderStock } = require('./stockService');
          await restoreOrderStock(order, { reason: 'Order already refunded on Razorpay' });
        } else if (['Shipped', 'Delivered'].includes(order.orderStatus)) {
          order.statusHistory.push({
            status: order.orderStatus,
            date: new Date(),
            note: `Refund of ₹${order.refundAmount} already processed on Razorpay. Order is ${order.orderStatus}; manual restock decision required.`,
          });
          await order.save();
        } else if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned') {
          await order.save();
          const { restoreOrderStock } = require('./stockService');
          await restoreOrderStock(order, { reason: 'Order already refunded on Razorpay' });
        } else {
          await order.save();
        }
      }

      return {
        success: true,
        alreadyRefunded: true,
        refundId: lastRefundId,
        order,
        intent,
      };
    }

    // Determine amount to refund (partial handling): refund only remaining balance!
    let amountToRefundPaise = targetPaise;
    if (targetPaise && sumProcessedPaise > 0) {
      amountToRefundPaise = targetPaise - sumProcessedPaise;
      console.log(`[RefundService Partial]: Payment ${resolvedPaymentId} has ₹${sumProcessedPaise / 100} already refunded. Refunding remaining balance ₹${amountToRefundPaise / 100}.`);
    }

    // 5. Execute Refund with Razorpay
    const refundPayload = {
      receipt: `rcpt_rfnd_${intent?._id || order?._id || Date.now()}`,
      notes: {
        reason,
        orderId: order?._id ? order._id.toString() : '',
        orderNumber: order?.orderNumber || '',
        intentId: intent?._id ? intent._id.toString() : '',
      },
    };

    if (amountToRefundPaise) {
      refundPayload.amount = amountToRefundPaise;
    }

    const refund = await razorpay.payments.refund(resolvedPaymentId, refundPayload);
    const newTotalRefundedPaise = sumProcessedPaise + (refund.amount || amountToRefundPaise || 0);
    const isFullyRefunded = !targetPaise || newTotalRefundedPaise >= targetPaise;

    // 6. Update Intent on success
    if (intent) {
      intent.refundStatus = isFullyRefunded ? 'processed' : 'pending';
      if (isFullyRefunded) {
        intent.status = 'refunded';
      }
      intent.refundId = refund.id;
      intent.needsAttention = !isFullyRefunded; // only cleared if fully refunded
      intent.refundLastError = null;
      intent.refundNextAttemptAt = null;
      await intent.save();
    }

    // 7. Update Order on success
    if (order) {
      order.refundStatus = isFullyRefunded ? 'processed' : 'pending';
      order.refundId = refund.id;
      order.refundAmount = newTotalRefundedPaise / 100;
      order.needsAttention = !isFullyRefunded;
      order.refundLastError = null;
      order.refundNextAttemptAt = null;
      order.refundedAt = new Date();

      if (isFullyRefunded) {
        order.isRefunded = true;
        order.paymentStatus = 'Refunded';

        if (['Pending', 'Confirmed', 'Processing'].includes(order.orderStatus)) {
          order.orderStatus = 'Cancelled';
          order.statusHistory.push({
            status: 'Cancelled',
            date: new Date(),
            note: `Order cancelled upon full refund (Refund ID: ${refund.id}) - Reason: ${reason}`,
          });
          await order.save();
          const { restoreOrderStock } = require('./stockService');
          await restoreOrderStock(order, { reason: `Refund processed: ${reason}` });
        } else if (['Shipped', 'Delivered'].includes(order.orderStatus)) {
          order.statusHistory.push({
            status: order.orderStatus,
            date: new Date(),
            note: `Refund of ₹${order.refundAmount} processed via Razorpay (Refund ID: ${refund.id}). Order is ${order.orderStatus}; manual restock decision required.`,
          });
          await order.save();
        } else if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned') {
          order.statusHistory.push({
            status: 'Refunded',
            date: new Date(),
            note: `Refund of ₹${order.refundAmount} processed via Razorpay (Refund ID: ${refund.id}) - Reason: ${reason}`,
          });
          await order.save();
          const { restoreOrderStock } = require('./stockService');
          await restoreOrderStock(order, { reason: `Refund processed: ${reason}` });
        } else {
          await order.save();
        }
      } else {
        await order.save();
      }
    }

    console.log(`[RefundService Success]: Refund ${refund.id} processed for payment ${resolvedPaymentId} (Full: ${isFullyRefunded})`);
    return { success: true, refund, order, intent, isFullyRefunded };
  } catch (refundError) {
    const sanitizedError = sanitizeErrorMessage(refundError);
    console.error(`[RefundService Failure]: Refund failed for payment ${resolvedPaymentId}: ${sanitizedError}`);

    // Update Intent failure tracking with exponential backoff
    if (intent) {
      const attempts = (intent.refundAttempts || 0) + 1;
      intent.refundStatus = 'failed';
      intent.refundAttempts = attempts;
      intent.refundLastError = sanitizedError;
      intent.needsAttention = true;

      if (attempts >= MAX_REFUND_ATTEMPTS) {
        intent.refundNextAttemptAt = null; // Exhausted retries, permanent attention
      } else {
        const backoffMs = Math.pow(2, attempts) * 60 * 1000;
        intent.refundNextAttemptAt = new Date(Date.now() + backoffMs);
      }
      await intent.save();
    }

    // Update Order failure tracking with exponential backoff
    if (order) {
      const attempts = (order.refundAttempts || 0) + 1;
      order.refundStatus = 'failed';
      order.refundAttempts = attempts;
      order.refundLastError = sanitizedError;
      order.needsAttention = true;

      if (attempts >= MAX_REFUND_ATTEMPTS) {
        order.refundNextAttemptAt = null;
      } else {
        const backoffMs = Math.pow(2, attempts) * 60 * 1000;
        order.refundNextAttemptAt = new Date(Date.now() + backoffMs);
      }
      await order.save();
    }

    return {
      success: false,
      error: sanitizedError,
      order,
      intent,
    };
  } finally {
    // Release atomic concurrency locks in finally block
    if (intent?._id) {
      await PaymentIntent.findByIdAndUpdate(intent._id, { refundLockedAt: null }).catch(() => {});
    }
    if (order?._id) {
      await Order.findByIdAndUpdate(order._id, { refundLockedAt: null }).catch(() => {});
    }
  }
};

/**
 * Background retry worker for failed refunds.
 * Runs with capped attempts (max 5) and exponential backoff based on refundNextAttemptAt.
 */
const runRefundRetryJob = async () => {
  try {
    const now = new Date();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    // Find PaymentIntents needing retry:
    // Attempts < MAX_REFUND_ATTEMPTS, status != 'completed',
    // combined $and with $or for refundNextAttemptAt and $or for refundLockedAt
    const failedIntents = await PaymentIntent.find({
      refundStatus: 'failed',
      status: { $ne: 'completed' },
      refundAttempts: { $lt: MAX_REFUND_ATTEMPTS },
      $and: [
        { $or: [{ refundNextAttemptAt: null }, { refundNextAttemptAt: { $lte: now } }] },
        { $or: [{ refundLockedAt: null }, { refundLockedAt: { $lt: twoMinutesAgo } }] },
      ],
    }).limit(10);

    for (const intent of failedIntents) {
      if (intent.status === 'completed' && intent.orderId) {
        console.log(`[Refund Retry Job]: PaymentIntent ${intent.razorpayOrderId} is completed with order ${intent.orderId}. Skipping refund retry.`);
        continue;
      }

      const paymentId =
        intent.razorpayPaymentId ||
        (intent.orderId ? (await Order.findById(intent.orderId))?.razorpayPaymentId : null);

      if (paymentId) {
        console.log(`[Refund Retry Job]: Retrying refund for PaymentIntent ${intent.razorpayOrderId} (attempt ${intent.refundAttempts + 1})...`);
        await refundPayment({
          paymentId,
          intentId: intent._id,
          amountInPaise: intent.expectedAmount,
          reason: 'Background retry for failed refund',
          force: false,
        });
      }
    }

    // Find Orders needing retry
    const failedOrders = await Order.find({
      refundStatus: 'failed',
      refundAttempts: { $lt: MAX_REFUND_ATTEMPTS },
      razorpayPaymentId: { $exists: true, $ne: null },
      $and: [
        { $or: [{ refundNextAttemptAt: null }, { refundNextAttemptAt: { $lte: now } }] },
        { $or: [{ refundLockedAt: null }, { refundLockedAt: { $lt: twoMinutesAgo } }] },
      ],
    }).limit(10);

    for (const order of failedOrders) {
      console.log(`[Refund Retry Job]: Retrying refund for Order #${order.orderNumber} (attempt ${order.refundAttempts + 1})...`);
      await refundPayment({
        paymentId: order.razorpayPaymentId,
        orderId: order._id,
        amount: order.totalAmount,
        reason: 'Background retry for order refund',
        force: true,
      });
    }
  } catch (err) {
    console.error('[Refund Retry Job Exception]:', err.message);
  }
};

let retryIntervalHandle = null;

const startRefundRetryScheduler = (intervalMs = 5 * 60 * 1000) => {
  if (retryIntervalHandle) return;
  // Run once after initial 30s delay, then periodically
  setTimeout(runRefundRetryJob, 30000);
  retryIntervalHandle = setInterval(runRefundRetryJob, intervalMs);
};

const stopRefundRetryScheduler = () => {
  if (retryIntervalHandle) {
    clearInterval(retryIntervalHandle);
    retryIntervalHandle = null;
  }
};

module.exports = {
  refundPayment,
  runRefundRetryJob,
  startRefundRetryScheduler,
  stopRefundRetryScheduler,
  sanitizeErrorMessage,
  MAX_REFUND_ATTEMPTS,
};
