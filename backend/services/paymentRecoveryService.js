const PaymentIntent = require('../models/PaymentIntent');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { getRazorpayInstance } = require('../config/razorpay');
const { getNextOrderNumber } = require('../utils/orderNumber');
const { refundPayment } = require('./refundService');

/**
 * Recovers PaymentIntents that are stuck in 'processing' status
 * (e.g. from an abrupt server crash or unhandled network disconnection during checkout).
 * 
 * Rules:
 * - When captured payment found: set razorpayPaymentId on intent, finalize order or refund if out of stock.
 * - When authorized (not yet captured) payment found: do NOT mark failed. Set status back to 'created'
 *   with awaitingCapture: true and re-check on later runs for up to 30 minutes; after that, void/refund and mark failed.
 * - Status overwrite guard: Re-read intent after refundPayment and never overwrite a 'refunded' status with 'failed'.
 */
/**
 * Fulfills an order for a PaymentIntent that has a confirmed captured payment.
 * Handles inventory deduction, order record creation, and error compensation.
 */
async function fulfillCapturedIntent(lockedIntent, capturedPayment) {
  lockedIntent.razorpayPaymentId = capturedPayment.id;
  lockedIntent.awaitingCapture = false;
  await lockedIntent.save();

  let stockAvailable = lockedIntent.stockDeducted;

  if (!stockAvailable) {
    try {
      const successfullyDeducted = [];
      for (const item of lockedIntent.items) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.product, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );

        if (!updated) {
          for (const rollItem of successfullyDeducted) {
            await Product.findByIdAndUpdate(rollItem.product, { $inc: { stock: rollItem.quantity } });
          }
          throw new Error(`Insufficient stock for ${item.name}`);
        }
        successfullyDeducted.push(item);
      }
      lockedIntent.stockDeducted = true;
      await lockedIntent.save();
      stockAvailable = true;
    } catch (stockErr) {
      console.warn(`[Payment Recovery]: Stock unavailable for captured payment ${capturedPayment.id}. Initiating refund.`);
      await refundPayment({
        paymentId: capturedPayment.id,
        intentId: lockedIntent._id,
        amountInPaise: capturedPayment.amount,
        reason: 'Stock became unavailable; refunded via automated recovery',
      });

      const refreshedIntent = await PaymentIntent.findById(lockedIntent._id);
      if (refreshedIntent && refreshedIntent.status !== 'refunded') {
        refreshedIntent.status = 'failed';
        refreshedIntent.failureReason = stockErr.message;
        await refreshedIntent.save();
      }
      return;
    }
  }

  // Stock is reserved and payment is captured: Finish Order creation exactly once
  try {
    const orderNumber = await getNextOrderNumber();
    const newOrder = await Order.create({
      orderNumber,
      user: lockedIntent.user,
      items: lockedIntent.items.map((it) => ({
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
      shippingAddress: lockedIntent.shippingAddress,
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      paidAt: new Date(capturedPayment.created_at ? capturedPayment.created_at * 1000 : Date.now()),
      razorpayOrderId: lockedIntent.razorpayOrderId,
      razorpayPaymentId: capturedPayment.id,
      razorpaySignature: 'recovered_processing_job',
      subtotal: lockedIntent.subtotal,
      shippingPrice: lockedIntent.shippingPrice,
      totalAmount: lockedIntent.totalAmount,
      notes: 'Order recovered and fulfilled by background recovery service',
      statusHistory: [
        {
          status: 'Confirmed',
          date: new Date(),
          note: `Payment captured and order recovered from stuck processing state (Payment ID: ${capturedPayment.id})`,
        },
      ],
    });

    lockedIntent.status = 'completed';
    lockedIntent.orderId = newOrder._id;
    lockedIntent.refundStatus = 'none';
    lockedIntent.needsAttention = false;
    lockedIntent.refundAttempts = 0;
    lockedIntent.refundLastError = null;
    lockedIntent.refundNextAttemptAt = null;
    await lockedIntent.save();
    console.log(`[Payment Recovery Success]: Successfully finalized Order #${newOrder.orderNumber} for ${lockedIntent.razorpayOrderId}`);
  } catch (orderCreateErr) {
    console.error(`[Payment Recovery Error]: Order creation failed:`, orderCreateErr.message);

    // E11000 duplicate key or race condition: re-query existing order
    const existingOrder = await Order.findOne({ razorpayPaymentId: capturedPayment.id });
    if (existingOrder) {
      console.log(`[Payment Recovery Idempotent]: Existing order #${existingOrder.orderNumber} found for payment ${capturedPayment.id}. Marking intent completed.`);
      lockedIntent.status = 'completed';
      lockedIntent.orderId = existingOrder._id;
      lockedIntent.refundStatus = 'none';
      lockedIntent.needsAttention = false;
      await lockedIntent.save();
      return;
    }

    const claimedIntent = await PaymentIntent.findOneAndUpdate(
      { _id: lockedIntent._id, stockDeducted: true },
      { $set: { stockDeducted: false } },
      { new: true }
    );
    if (claimedIntent) {
      for (const item of lockedIntent.items) {
        if (item && item.product) {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }
      }
      lockedIntent.stockDeducted = false;
    }

    // Guard: Before ANY auto-refund, verify that no order exists for that payment
    const checkOrder = await Order.findOne({ razorpayPaymentId: capturedPayment.id });
    if (!checkOrder) {
      await refundPayment({
        paymentId: capturedPayment.id,
        intentId: lockedIntent._id,
        amountInPaise: capturedPayment.amount,
        reason: 'Order creation exception during recovery; payment refunded',
      });
    } else {
      lockedIntent.status = 'completed';
      lockedIntent.orderId = checkOrder._id;
      await lockedIntent.save();
      return;
    }

    const refreshedIntent = await PaymentIntent.findById(lockedIntent._id);
    if (refreshedIntent && refreshedIntent.status !== 'refunded') {
      refreshedIntent.status = 'failed';
      refreshedIntent.failureReason = orderCreateErr.message;
      await refreshedIntent.save();
    }
  }
}

/**
 * Recovers PaymentIntents:
 * 1. Scans status: 'created', awaitingCapture: true intents older than 30 minutes: voids/refunds and marks failed.
 * 2. Scans status: 'processing' intents stuck > 5 minutes: finalizes order or grants 30m grace for authorized payments.
 */
const runPaymentRecoveryJob = async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const razorpay = getRazorpayInstance();

    // -------------------------------------------------------------
    // Phase 1: Scan status: 'created', awaitingCapture: true intents older than 30m
    // Apply void/refund and mark failed since capture never occurred within 30 minutes
    // -------------------------------------------------------------
    const expiredAwaitingCapture = await PaymentIntent.find({
      status: 'created',
      awaitingCapture: true,
      createdAt: { $lt: thirtyMinutesAgo },
    }).limit(10);

    for (const intent of expiredAwaitingCapture) {
      const lockedIntent = await PaymentIntent.findOneAndUpdate(
        { _id: intent._id, status: 'created', awaitingCapture: true },
        { $set: { status: 'processing', claimedAt: new Date() } },
        { new: true }
      );
      if (!lockedIntent) continue;

      console.log(`[Payment Recovery]: Processing expired awaitingCapture intent ${lockedIntent.razorpayOrderId} (>30m old)...`);

      // Check if Order already exists
      const existingOrder = await Order.findOne({ razorpayOrderId: lockedIntent.razorpayOrderId });
      if (existingOrder) {
        lockedIntent.status = 'completed';
        lockedIntent.orderId = existingOrder._id;
        lockedIntent.awaitingCapture = false;
        lockedIntent.refundStatus = 'none';
        lockedIntent.needsAttention = false;
        lockedIntent.refundAttempts = 0;
        lockedIntent.refundLastError = null;
        lockedIntent.refundNextAttemptAt = null;
        await lockedIntent.save();
        continue;
      }

      // Check payments from Razorpay
      let paymentsList = [];
      try {
        const orderPayments = await razorpay.orders.fetchPayments(lockedIntent.razorpayOrderId);
        paymentsList = orderPayments?.items || (Array.isArray(orderPayments) ? orderPayments : []);
      } catch (fetchErr) {
        console.error(`[Payment Recovery Error]: Could not fetch payments for ${lockedIntent.razorpayOrderId}:`, fetchErr.message);
      }

      const capturedPayment = paymentsList.find((p) => p.status === 'captured');
      const authorizedPayment = paymentsList.find((p) => p.status === 'authorized');

      if (capturedPayment) {
        await fulfillCapturedIntent(lockedIntent, capturedPayment);
      } else {
        const paymentToVoidId = authorizedPayment?.id || lockedIntent.razorpayPaymentId;
        const paymentAmount = authorizedPayment?.amount || lockedIntent.expectedAmount;

        console.log(
          `[Payment Recovery]: Authorized payment ${paymentToVoidId || 'N/A'} for ${lockedIntent.razorpayOrderId} exceeded 30 minute window without capture. Voiding/refunding and marking failed.`
        );

        if (paymentToVoidId) {
          lockedIntent.razorpayPaymentId = paymentToVoidId;
          await lockedIntent.save();

          try {
            await refundPayment({
              paymentId: paymentToVoidId,
              intentId: lockedIntent._id,
              amountInPaise: paymentAmount,
              reason: 'Payment authorized but not captured within 30 minutes',
            });
          } catch (voidErr) {
            console.warn(`[Payment Recovery]: Voiding/refunding authorized payment notice: ${voidErr.message}`);
          }
        }

        const claimedVoidIntent = await PaymentIntent.findOneAndUpdate(
          { _id: lockedIntent._id, stockDeducted: true },
          { $set: { stockDeducted: false } },
          { new: true }
        );
        if (claimedVoidIntent) {
          for (const item of lockedIntent.items) {
            if (item && item.product) {
              await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
            }
          }
          lockedIntent.stockDeducted = false;
        }

        const refreshed = await PaymentIntent.findById(lockedIntent._id);
        if (refreshed && refreshed.status !== 'refunded') {
          refreshed.status = 'failed';
          refreshed.failureReason = 'Payment authorized but never captured within 30 minutes';
          refreshed.awaitingCapture = false;
          await refreshed.save();
        } else if (refreshed) {
          refreshed.awaitingCapture = false;
          await refreshed.save();
        }
      }
    }

    // -------------------------------------------------------------
    // Phase 2: Find stuck processing intents
    // -------------------------------------------------------------
    const stuckIntents = await PaymentIntent.find({
      status: 'processing',
      claimedAt: { $lt: fiveMinutesAgo },
    }).limit(10);

    if (stuckIntents.length > 0) {
      console.log(`[Payment Recovery]: Found ${stuckIntents.length} stuck 'processing' intent(s).`);
    }

    for (const intent of stuckIntents) {
      // Atomic concurrency lock: update claimedAt to current time so other workers don't race
      const lockedIntent = await PaymentIntent.findOneAndUpdate(
        { _id: intent._id, status: 'processing', claimedAt: { $lt: fiveMinutesAgo } },
        { $set: { claimedAt: new Date() } },
        { new: true }
      );

      if (!lockedIntent) continue;

      console.log(`[Payment Recovery]: Processing stuck intent for Razorpay Order ${lockedIntent.razorpayOrderId}...`);

      // 1. Check if an Order already exists for this Razorpay order
      const existingOrder = await Order.findOne({ razorpayOrderId: lockedIntent.razorpayOrderId });
      if (existingOrder) {
        console.log(`[Payment Recovery]: Order #${existingOrder.orderNumber} already exists. Marking intent completed.`);
        lockedIntent.status = 'completed';
        lockedIntent.orderId = existingOrder._id;
        lockedIntent.refundStatus = 'none';
        lockedIntent.needsAttention = false;
        lockedIntent.refundAttempts = 0;
        lockedIntent.refundLastError = null;
        lockedIntent.refundNextAttemptAt = null;
        if (existingOrder.razorpayPaymentId && !lockedIntent.razorpayPaymentId) {
          lockedIntent.razorpayPaymentId = existingOrder.razorpayPaymentId;
        }
        await lockedIntent.save();
        continue;
      }

      // 2. Query Razorpay API for payments on this order
      let paymentsList = [];
      try {
        const orderPayments = await razorpay.orders.fetchPayments(lockedIntent.razorpayOrderId);
        paymentsList = orderPayments?.items || (Array.isArray(orderPayments) ? orderPayments : []);
      } catch (fetchErr) {
        console.error(`[Payment Recovery Error]: Could not fetch payments for ${lockedIntent.razorpayOrderId}:`, fetchErr.message);
        continue;
      }

      const capturedPayment = paymentsList.find((p) => p.status === 'captured');
      const authorizedPayment = paymentsList.find((p) => p.status === 'authorized');

      // Handle authorized (not yet captured) payment
      if (!capturedPayment && authorizedPayment) {
        const intentAgeMs = Date.now() - new Date(lockedIntent.createdAt || Date.now()).getTime();
        const THIRTY_MINUTES_MS = 30 * 60 * 1000;

        if (intentAgeMs < THIRTY_MINUTES_MS) {
          console.log(`[Payment Recovery]: Payment ${authorizedPayment.id} for ${lockedIntent.razorpayOrderId} is authorized. Giving 30m grace window.`);
          lockedIntent.status = 'created';
          lockedIntent.awaitingCapture = true;
          lockedIntent.razorpayPaymentId = authorizedPayment.id;
          await lockedIntent.save();
          continue;
        } else {
          console.log(`[Payment Recovery]: Authorized payment ${authorizedPayment.id} for ${lockedIntent.razorpayOrderId} exceeded 30 minute window without capture. Voiding/refunding and marking failed.`);
          lockedIntent.razorpayPaymentId = authorizedPayment.id;
          await lockedIntent.save();

          try {
            await refundPayment({
              paymentId: authorizedPayment.id,
              intentId: lockedIntent._id,
              amountInPaise: authorizedPayment.amount,
              reason: 'Payment authorized but not captured within 30 minutes',
            });
          } catch (voidErr) {
            console.warn(`[Payment Recovery]: Voiding/refunding authorized payment notice: ${voidErr.message}`);
          }

          const refreshed = await PaymentIntent.findById(lockedIntent._id);
          if (refreshed && refreshed.status !== 'refunded') {
            refreshed.status = 'failed';
            refreshed.failureReason = 'Payment authorized but never captured within 30 minutes';
            refreshed.awaitingCapture = false;
            await refreshed.save();
          } else if (refreshed) {
            refreshed.awaitingCapture = false;
            await refreshed.save();
          }
          continue;
        }
      }

      if (!capturedPayment) {
        console.log(`[Payment Recovery]: No payment found for ${lockedIntent.razorpayOrderId}. Marking failed.`);
        const claimedFailIntent = await PaymentIntent.findOneAndUpdate(
          { _id: lockedIntent._id, stockDeducted: true },
          { $set: { stockDeducted: false } },
          { new: true }
        );
        if (claimedFailIntent) {
          for (const item of lockedIntent.items) {
            if (item && item.product) {
              await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
            }
          }
          lockedIntent.stockDeducted = false;
        }

        lockedIntent.status = 'failed';
        lockedIntent.failureReason = 'No captured payment found during recovery';
        await lockedIntent.save();
        continue;
      }

      // 3. Captured payment exists: fulfill order
      await fulfillCapturedIntent(lockedIntent, capturedPayment);
    }
  } catch (err) {
    console.error('[Payment Recovery Exception]:', err.message);
  }
};

let recoveryIntervalHandle = null;

const startPaymentRecoveryScheduler = (intervalMs = 5 * 60 * 1000) => {
  if (recoveryIntervalHandle) return;
  // Run on startup (after 5s warmup), then periodically every 5 minutes
  setTimeout(runPaymentRecoveryJob, 5000);
  recoveryIntervalHandle = setInterval(runPaymentRecoveryJob, intervalMs);
};

const stopPaymentRecoveryScheduler = () => {
  if (recoveryIntervalHandle) {
    clearInterval(recoveryIntervalHandle);
    recoveryIntervalHandle = null;
  }
};

module.exports = {
  runPaymentRecoveryJob,
  fulfillCapturedIntent,
  startPaymentRecoveryScheduler,
  stopPaymentRecoveryScheduler,
};
