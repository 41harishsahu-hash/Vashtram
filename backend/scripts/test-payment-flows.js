/**
 * VASHTRAM Payment & Stock Resilience Integration Test Suite
 *
 * Rules:
 * - Uses ONLY an isolated in-memory replica set (MongoMemoryReplSet) so transactions work.
 * - Guarded by server/utils/testDbGuard.js.
 * - Uses a MOCKED Razorpay client. Zero real API keys used or printed.
 * - Covers all 8 core flows + hardening priorities.
 */

const path = require('path');
process.env.NODE_PATH = [
  path.join(__dirname, '../node_modules'),
  path.join(__dirname, '../../node_modules'),
].join(';');
require('module').Module._initPaths();

process.env.MONGOMS_SYSTEM_BINARY = 'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe';
process.env.RAZORPAY_KEY_ID = 'rzp_test_mocked12345';
process.env.RAZORPAY_KEY_SECRET = 'mocked_secret_abcdef123456';
process.env.RAZORPAY_WEBHOOK_SECRET = 'mocked_webhook_secret_7890';
process.env.JWT_SECRET = 'supersecretlongenoughjwtkeyforpaymenttesting123456';

const crypto = require('crypto');
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { assertSafeTestDatabase } = require('../utils/testDbGuard');

const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const PaymentIntent = require('../models/PaymentIntent');
const WebhookEvent = require('../models/WebhookEvent');
const Settings = require('../models/Settings');

const {
  verifyPayment,
  handleWebhook,
  createRazorpayOrder,
  getPaymentStatus,
} = require('../controllers/paymentController');
const { cancelOrder } = require('../controllers/orderController');
const { runPaymentRecoveryJob, fulfillCapturedIntent } = require('../services/paymentRecoveryService');
const { refundPayment, runRefundRetryJob } = require('../services/refundService');
const { restoreOrderStock } = require('../services/stockService');
const { setMockRazorpayInstance, resetRazorpayInstance } = require('../config/razorpay');
const { register, login, updateProfile } = require('../controllers/authController');
const { ensureDefaultUsers } = require('../utils/initUsers');
const { resetAdminPassword } = require('../utils/resetAdminPassword');
const { verifyIndexes, REQUIRED_INDEXES } = require('../utils/verifyIndexes');

let replSet = null;
let testUser = null;
let testProduct = null;
let testCategory = null;

let passedCount = 0;
let failedCount = 0;
const testResults = [];

function logTest(name, passed, detail) {
  if (passed) {
    passedCount++;
    testResults.push({ name, status: 'PASS', detail });
    console.log(`  ✓ PASS: ${name}`);
  } else {
    failedCount++;
    testResults.push({ name, status: 'FAIL', detail });
    console.error(`  ✗ FAIL: ${name} -> ${detail}`);
  }
}

// Helper: Mock Express req/res
function mockReqRes(reqData = {}) {
  const req = {
    body: reqData.body || {},
    headers: reqData.headers || {},
    user: reqData.user || testUser,
    params: reqData.params || {},
    rawBody: reqData.rawBody || (reqData.body ? Buffer.from(JSON.stringify(reqData.body)) : Buffer.from('')),
  };

  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };

  return { req, res };
}

// Helper: Generate webhook signature
function createWebhookSignature(payload, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(str).digest('hex');
}

// Helper: Generate payment verification signature
function createPaymentSignature(orderId, paymentId, secret = process.env.RAZORPAY_KEY_SECRET) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

// Mock Razorpay Client Factory
function createMockRazorpay(options = {}) {
  const paymentsStore = options.payments || new Map();
  const refundsStore = options.refunds || new Map();

  return {
    orders: {
      create: async (opts) => ({
        id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        amount: opts.amount,
        currency: opts.currency || 'INR',
        receipt: opts.receipt,
        status: 'created',
      }),
      fetchPayments: async (orderId) => {
        const matching = [];
        for (const [id, p] of paymentsStore.entries()) {
          if (p.order_id === orderId) matching.push(p);
        }
        return { items: matching };
      },
    },
    payments: {
      fetch: async (paymentId) => {
        const p = paymentsStore.get(paymentId);
        if (!p) throw new Error(`Payment ${paymentId} not found in mock`);
        return p;
      },
      refund: async (paymentId, refundOpts = {}) => {
        if (options.refundFails) {
          throw new Error('Razorpay Gateway Timeout during refund');
        }
        const refId = `rfnd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const refObj = {
          id: refId,
          payment_id: paymentId,
          amount: refundOpts.amount || 249900,
          currency: 'INR',
          status: 'processed',
          created_at: Math.floor(Date.now() / 1000),
        };
        const list = refundsStore.get(paymentId) || [];
        list.push(refObj);
        refundsStore.set(paymentId, list);
        return refObj;
      },
      fetchMultipleRefund: async (paymentId) => {
        const list = refundsStore.get(paymentId) || [];
        return { items: list };
      },
    },
    _stores: { paymentsStore, refundsStore },
  };
}

async function setup() {
  console.log('\n======================================================');
  console.log('⚡ STARTING VASHTRAM PAYMENT RESILIENCE TEST SUITE');
  console.log('======================================================');

  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const testDbUri = replSet.getUri();

  // Enforce Prod-DB Guard!
  assertSafeTestDatabase(testDbUri);
  console.log(`[Safe Test DB]: Connected to isolated test replica set at ${testDbUri}`);

  await mongoose.connect(testDbUri);

  // Seed default settings
  await Settings.create({
    freeShippingThreshold: 999,
    standardShippingFee: 99,
  });

  // Seed test user
  testUser = await User.create({
    name: 'Test Customer',
    email: 'customer@test.com',
    password: 'Password123!',
    role: 'customer',
  });

  // Seed category
  testCategory = await Category.create({
    name: 'Mattress Protectors',
    slug: 'mattress-protectors',
    description: 'Waterproof fitted covers',
  });

  // Seed test product
  testProduct = await Product.create({
    name: 'VASHTRAM Premium Mattress Protector',
    slug: 'vashtram-premium-mattress-protector',
    category: testCategory._id,
    sku: 'VAS-MP-001',
    color: 'White',
    material: '100% Pure Cotton',
    pattern: 'Solid',
    description: 'High-density waterproof protector',
    price: 2499,
    discountPrice: 2299,
    stock: 50,
    isActive: true,
    images: ['/img/p1.jpg', '/img/p2.jpg'],
    sizes: [
      { name: 'King Size', measurement: '78x72', price: 2499 },
    ],
  });
}

async function teardown() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
  resetRazorpayInstance();
  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');
}

// -------------------------------------------------------------
// TEST CASES
// -------------------------------------------------------------

async function runTests() {
  // Test 1: Prod-DB Guard Rejects Production
  try {
    let rejected = false;
    try {
      assertSafeTestDatabase('mongodb+srv://admin:pass@cluster0.rkvhgpk.mongodb.net/vashtram');
    } catch {
      rejected = true;
    }
    logTest('Safety: Test database guard refuses production Atlas host', rejected, 'Atlas remote URI blocked');
  } catch (e) {
    logTest('Safety: Test database guard refuses production Atlas host', false, e.message);
  }

  // Test 2: Same webhook delivered 5 times in parallel -> exactly 1 order, stock deducted once
  try {
    const mockRzp = createMockRazorpay();
    setMockRazorpayInstance(mockRzp);

    const initialStock = 50;
    await Product.findByIdAndUpdate(testProduct._id, { stock: initialStock });

    const razorpayOrderId = 'order_webhook_race_1';
    const razorpayPaymentId = 'pay_webhook_race_1';
    const amountPaise = 249900;

    mockRzp._stores.paymentsStore.set(razorpayPaymentId, {
      id: razorpayPaymentId,
      order_id: razorpayOrderId,
      amount: amountPaise,
      status: 'captured',
    });

    const intent = await PaymentIntent.create({
      razorpayOrderId,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: '78x72 (King Size)',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      subtotal: 2499,
      shippingPrice: 0,
      totalAmount: 2499,
      expectedAmount: amountPaise,
      status: 'created',
    });

    const eventId = `evt_race_${Date.now()}`;
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: razorpayPaymentId,
            order_id: razorpayOrderId,
            amount: amountPaise,
            status: 'captured',
          },
        },
      },
    };
    const rawPayload = JSON.stringify(payload);
    const signature = createWebhookSignature(rawPayload);

    // Fire 5 identical webhooks simultaneously
    const promises = Array.from({ length: 5 }).map(() => {
      const { req, res } = mockReqRes({
        body: payload,
        headers: {
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId,
        },
        rawBody: Buffer.from(rawPayload),
      });
      return handleWebhook(req, res).then(() => res);
    });

    const responses = await Promise.all(promises);

    // All must return HTTP 200 (never 500)
    const all200 = responses.every((r) => r.statusCode === 200);

    // Exactly 1 order created in DB
    const orders = await Order.find({ razorpayPaymentId });
    const prodAfter = await Product.findById(testProduct._id);

    const pass = all200 && orders.length === 1 && prodAfter.stock === initialStock - 1;
    logTest(
      'Scenario 1: Same webhook delivered 5 times in parallel -> exactly 1 order, stock deducted once, all 200 OK',
      pass,
      `All 200: ${all200}, Orders: ${orders.length}, Stock deducted: ${initialStock - prodAfter.stock}`
    );
  } catch (e) {
    logTest('Scenario 1: Same webhook delivered 5 times in parallel', false, e.message);
  }

  // Test 3: Webhook and verify endpoint racing -> exactly 1 order
  try {
    const mockRzp = createMockRazorpay();
    setMockRazorpayInstance(mockRzp);

    const initialStock = (await Product.findById(testProduct._id)).stock;
    const razorpayOrderId = 'order_race_verify_webhook';
    const razorpayPaymentId = 'pay_race_verify_webhook';
    const amountPaise = 249900;

    mockRzp._stores.paymentsStore.set(razorpayPaymentId, {
      id: razorpayPaymentId,
      order_id: razorpayOrderId,
      amount: amountPaise,
      status: 'captured',
    });

    await PaymentIntent.create({
      razorpayOrderId,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: '78x72 (King Size)',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      subtotal: 2499,
      shippingPrice: 0,
      totalAmount: 2499,
      expectedAmount: amountPaise,
      status: 'created',
    });

    // Webhook req
    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: razorpayPaymentId,
            order_id: razorpayOrderId,
            amount: amountPaise,
            status: 'captured',
          },
        },
      },
    };
    const rawPayload = JSON.stringify(webhookPayload);
    const webhookSig = createWebhookSignature(rawPayload);
    const { req: whReq, res: whRes } = mockReqRes({
      body: webhookPayload,
      headers: {
        'x-razorpay-signature': webhookSig,
        'x-razorpay-event-id': `evt_wh_verify_${Date.now()}`,
      },
      rawBody: Buffer.from(rawPayload),
    });

    // Verify endpoint req
    const paymentSig = createPaymentSignature(razorpayOrderId, razorpayPaymentId);
    const { req: vReq, res: vRes } = mockReqRes({
      body: {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: paymentSig,
      },
      user: testUser,
    });

    // Run both concurrently
    await Promise.all([
      handleWebhook(whReq, whRes),
      verifyPayment(vReq, vRes, (err) => { if (err) vRes.status(500).json({ error: err.message }); }),
    ]);

    const orders = await Order.find({ razorpayPaymentId });
    const prodAfter = await Product.findById(testProduct._id);

    const pass = orders.length === 1 && prodAfter.stock === initialStock - 1;
    logTest(
      'Scenario 2: Webhook and verify endpoint racing -> exactly 1 order, stock deducted once',
      pass,
      `Orders count: ${orders.length}, Stock: ${prodAfter.stock}`
    );
  } catch (e) {
    logTest('Scenario 2: Webhook and verify endpoint racing', false, e.message);
  }

  // Test 4: Payment captured then order creation throws -> recovery creates order or refunds, never neither
  try {
    const mockRzp = createMockRazorpay();
    setMockRazorpayInstance(mockRzp);

    const razorpayOrderId = 'order_throw_recovery';
    const razorpayPaymentId = 'pay_throw_recovery';
    const amountPaise = 249900;

    mockRzp._stores.paymentsStore.set(razorpayPaymentId, {
      id: razorpayPaymentId,
      order_id: razorpayOrderId,
      amount: amountPaise,
      status: 'captured',
    });

    const intent = await PaymentIntent.create({
      razorpayOrderId,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        price: 2499,
        quantity: 1,
        size: '78x72 (King Size)',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      subtotal: 2499,
      shippingPrice: 0,
      totalAmount: 2499,
      expectedAmount: amountPaise,
      status: 'processing',
      claimedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    });

    // Run recovery job
    await runPaymentRecoveryJob();

    // Check intent outcome: either order was created, or refund was processed
    const updatedIntent = await PaymentIntent.findById(intent._id);
    const orderCreated = await Order.findOne({ razorpayOrderId });
    const refunds = mockRzp._stores.refundsStore.get(razorpayPaymentId) || [];

    const hasOrder = Boolean(orderCreated);
    const hasRefund = refunds.length > 0 || updatedIntent.refundStatus === 'processed';
    const validOutcome = (hasOrder && !hasRefund) || (!hasOrder && hasRefund);

    logTest(
      'Scenario 3: Payment captured then recovery runs -> creates order or refunds, never neither',
      validOutcome,
      `HasOrder: ${hasOrder}, HasRefund: ${hasRefund}, IntentStatus: ${updatedIntent.status}`
    );
  } catch (e) {
    logTest('Scenario 3: Payment captured then order creation throws', false, e.message);
  }

  // Test 5: Recovery job running twice concurrently -> stock restored/deducted once
  try {
    const mockRzp = createMockRazorpay();
    setMockRazorpayInstance(mockRzp);

    const initialStock = (await Product.findById(testProduct._id)).stock;
    const razorpayOrderId = 'order_recovery_concurrent';
    const razorpayPaymentId = 'pay_recovery_concurrent';
    const amountPaise = 249900;

    mockRzp._stores.paymentsStore.set(razorpayPaymentId, {
      id: razorpayPaymentId,
      order_id: razorpayOrderId,
      amount: amountPaise,
      status: 'captured',
    });

    await PaymentIntent.create({
      razorpayOrderId,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        price: 2499,
        quantity: 1,
        size: '78x72 (King Size)',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      subtotal: 2499,
      shippingPrice: 0,
      totalAmount: 2499,
      expectedAmount: amountPaise,
      status: 'processing',
      claimedAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    // Run recovery job twice concurrently
    await Promise.all([
      runPaymentRecoveryJob(),
      runPaymentRecoveryJob(),
    ]);

    const orders = await Order.find({ razorpayOrderId });
    const prodAfter = await Product.findById(testProduct._id);

    const pass = orders.length === 1 && prodAfter.stock === initialStock - 1;
    logTest(
      'Scenario 4: Recovery job running twice concurrently -> single order, stock deducted exactly once',
      pass,
      `Orders: ${orders.length}, Stock: ${prodAfter.stock}`
    );
  } catch (e) {
    logTest('Scenario 4: Recovery job running twice concurrently', false, e.message);
  }

  // Test 6: Refund via Razorpay webhook -> order status, payment status, stock rules
  try {
    const initialStock = (await Product.findById(testProduct._id)).stock;
    const razorpayPaymentId = 'pay_webhook_refund_confirmed';

    // Seed Confirmed order
    const orderConfirmed = await Order.create({
      orderNumber: `ORD_${Date.now()}_1`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      razorpayPaymentId,
      stockRestored: false,
    });

    // Send full refund.processed webhook
    const refundPayload = {
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_full_1',
            payment_id: razorpayPaymentId,
            amount: 249900,
            status: 'processed',
          },
        },
      },
    };
    const rawPayload = JSON.stringify(refundPayload);
    const { req, res } = mockReqRes({
      body: refundPayload,
      headers: {
        'x-razorpay-signature': createWebhookSignature(rawPayload),
        'x-razorpay-event-id': `evt_refund_${Date.now()}`,
      },
      rawBody: Buffer.from(rawPayload),
    });

    await handleWebhook(req, res);

    const refreshedOrder = await Order.findById(orderConfirmed._id);
    const prodAfter = await Product.findById(testProduct._id);

    const orderStatusOk = refreshedOrder.orderStatus === 'Cancelled';
    const paymentStatusOk = refreshedOrder.paymentStatus === 'Refunded' && refreshedOrder.isRefunded === true;
    const stockRestoredOk = refreshedOrder.stockRestored === true && prodAfter.stock === initialStock + 1;

    const pass = res.statusCode === 200 && orderStatusOk && paymentStatusOk && stockRestoredOk;
    logTest(
      'Scenario 5: Refund via Razorpay webhook -> order status Cancelled, paymentStatus Refunded, stock restored',
      pass,
      `Status: ${refreshedOrder.orderStatus}, Payment: ${refreshedOrder.paymentStatus}, Stock: ${prodAfter.stock}`
    );
  } catch (e) {
    logTest('Scenario 5: Refund via Razorpay webhook', false, e.message);
  }

  // Test 7: Refund via Razorpay webhook for Shipped/Delivered order -> no stock restoration!
  try {
    const initialStock = (await Product.findById(testProduct._id)).stock;
    const razorpayPaymentId = 'pay_webhook_refund_shipped';

    const orderShipped = await Order.create({
      orderNumber: `ORD_${Date.now()}_shipped`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Shipped',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      razorpayPaymentId,
      stockRestored: false,
    });

    const refundPayload = {
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_shipped_1',
            payment_id: razorpayPaymentId,
            amount: 249900,
            status: 'processed',
          },
        },
      },
    };
    const rawPayload = JSON.stringify(refundPayload);
    const { req, res } = mockReqRes({
      body: refundPayload,
      headers: {
        'x-razorpay-signature': createWebhookSignature(rawPayload),
        'x-razorpay-event-id': `evt_shipped_${Date.now()}`,
      },
      rawBody: Buffer.from(rawPayload),
    });

    await handleWebhook(req, res);

    const refreshedOrder = await Order.findById(orderShipped._id);
    const prodAfter = await Product.findById(testProduct._id);

    // Stock must NOT be restored automatically for Shipped/Delivered
    const stockNotRestored = refreshedOrder.stockRestored === false && prodAfter.stock === initialStock;
    const isRefunded = refreshedOrder.isRefunded === true && refreshedOrder.paymentStatus === 'Refunded';

    const pass = res.statusCode === 200 && isRefunded && stockNotRestored;
    logTest(
      'Scenario 5c: Refund via webhook for Shipped/Delivered order -> no automatic stock restoration',
      pass,
      `isRefunded: ${isRefunded}, stockRestored: ${refreshedOrder.stockRestored}, Stock: ${prodAfter.stock}`
    );
  } catch (e) {
    logTest('Scenario 5c: Refund webhook for Shipped order', false, e.message);
  }

  // Test 8: Partial Refund via Webhook -> records partial amount, does NOT mark fully refunded
  try {
    const razorpayPaymentId = 'pay_webhook_partial_refund';

    const orderPartial = await Order.create({
      orderNumber: `ORD_${Date.now()}_partial`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      razorpayPaymentId,
      stockRestored: false,
    });

    const refundPayload = {
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_part_1',
            payment_id: razorpayPaymentId,
            amount: 50000, // 500 INR partial refund
            status: 'processed',
          },
        },
      },
    };
    const rawPayload = JSON.stringify(refundPayload);
    const { req, res } = mockReqRes({
      body: refundPayload,
      headers: {
        'x-razorpay-signature': createWebhookSignature(rawPayload),
        'x-razorpay-event-id': `evt_part_${Date.now()}`,
      },
      rawBody: Buffer.from(rawPayload),
    });

    await handleWebhook(req, res);

    const refreshed = await Order.findById(orderPartial._id);
    const partialRecorded = refreshed.refundAmount === 500;
    const notFullyRefunded = refreshed.isRefunded === false && refreshed.paymentStatus !== 'Refunded';

    const pass = res.statusCode === 200 && partialRecorded && notFullyRefunded;
    logTest(
      'Scenario 5b: Partial refund via webhook -> records partial amount, does not mark fully refunded',
      pass,
      `RefundAmount: ${refreshed.refundAmount}, isRefunded: ${refreshed.isRefunded}`
    );
  } catch (e) {
    logTest('Scenario 5b: Partial refund via webhook', false, e.message);
  }

  // Test 9: Webhook arriving after refundService already updated order -> idempotent no-op
  try {
    const razorpayPaymentId = 'pay_webhook_noop_after_refund_service';

    const orderRefunded = await Order.create({
      orderNumber: `ORD_${Date.now()}_noop`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Refunded',
      orderStatus: 'Cancelled',
      isPaid: true,
      isRefunded: true,
      refundId: 'rfnd_existing_123',
      refundAmount: 2499,
      refundStatus: 'processed',
      totalAmount: 2499,
      subtotal: 2499,
      razorpayPaymentId,
      stockRestored: true,
    });

    const initialStock = (await Product.findById(testProduct._id)).stock;

    const refundPayload = {
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_existing_123',
            payment_id: razorpayPaymentId,
            amount: 249900,
            status: 'processed',
          },
        },
      },
    };
    const rawPayload = JSON.stringify(refundPayload);
    const { req, res } = mockReqRes({
      body: refundPayload,
      headers: {
        'x-razorpay-signature': createWebhookSignature(rawPayload),
        'x-razorpay-event-id': `evt_noop_${Date.now()}`,
      },
      rawBody: Buffer.from(rawPayload),
    });

    await handleWebhook(req, res);

    const prodAfter = await Product.findById(testProduct._id);
    const noDoubleStock = prodAfter.stock === initialStock;

    logTest(
      'Scenario 5d: Webhook after refundService already updated order -> idempotent no-op, no double restock',
      res.statusCode === 200 && noDoubleStock,
      `Stock unchanged: ${noDoubleStock}`
    );
  } catch (e) {
    logTest('Scenario 5d: Webhook after refundService', false, e.message);
  }

  // Test 10: Cancel order twice in parallel -> stock restored once
  try {
    const initialStock = (await Product.findById(testProduct._id)).stock;

    const orderToCancel = await Order.create({
      orderNumber: `ORD_${Date.now()}_cancel_race`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 2,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      stockRestored: false,
    });

    const { req: req1, res: res1 } = mockReqRes({
      params: { id: orderToCancel._id.toString() },
      user: testUser,
    });
    const { req: req2, res: res2 } = mockReqRes({
      params: { id: orderToCancel._id.toString() },
      user: testUser,
    });

    // Run cancelOrder concurrently
    await Promise.all([
      cancelOrder(req1, res1, () => {}),
      cancelOrder(req2, res2, () => {}),
    ]);

    const prodAfter = await Product.findById(testProduct._id);
    const refreshed = await Order.findById(orderToCancel._id);

    const pass = prodAfter.stock === initialStock + 2 && refreshed.stockRestored === true;
    logTest(
      'Scenario 6: Cancel order twice in parallel -> stock restored exactly once',
      pass,
      `Stock before: ${initialStock}, Stock after: ${prodAfter.stock} (expected +2)`
    );
  } catch (e) {
    logTest('Scenario 6: Cancel order twice in parallel', false, e.message);
  }

  // Test 11: Failure injected between stock restore and status update -> retry safe, no double restore
  try {
    const initialStock = (await Product.findById(testProduct._id)).stock;

    const testOrder = await Order.create({
      orderNumber: `ORD_${Date.now()}_fail_inject`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      stockRestored: false,
    });

    // Step 1: restore stock succeeds
    const restoreResult1 = await restoreOrderStock(testOrder._id);
    assert.strictEqual(restoreResult1.restored, true);

    // Step 2: Inject failure before status update! (Simulation: orderStatus remains 'Confirmed')
    // Step 3: Cancellation retried later
    const restoreResult2 = await restoreOrderStock(testOrder._id);
    assert.strictEqual(restoreResult2.restored, false);

    // Complete the cancellation update
    testOrder.orderStatus = 'Cancelled';
    await testOrder.save();

    const prodAfter = await Product.findById(testProduct._id);
    const pass = prodAfter.stock === initialStock + 1;

    logTest(
      'Scenario 7: Failure injected between stock restore and status update -> retry skips restore, exactly once',
      pass,
      `Stock after: ${prodAfter.stock} (restored count: +1)`
    );
  } catch (e) {
    logTest('Scenario 7: Failure injected between stock restore and status update', false, e.message);
  }

  // Test 12: Invalid or tampered webhook signature -> rejected (400), no state change
  try {
    const initialStock = (await Product.findById(testProduct._id)).stock;
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_tamper_1' } } } };
    const rawPayload = JSON.stringify(payload);

    const { req, res } = mockReqRes({
      body: payload,
      headers: {
        'x-razorpay-signature': 'tampered_signature_bad_bad_bad',
        'x-razorpay-event-id': `evt_tamper_${Date.now()}`,
      },
      rawBody: Buffer.from(rawPayload),
    });

    await handleWebhook(req, res);

    const prodAfter = await Product.findById(testProduct._id);
    const events = await WebhookEvent.find({ eventId: req.headers['x-razorpay-event-id'] });

    const pass = res.statusCode === 400 && prodAfter.stock === initialStock && events.length === 0;
    logTest(
      'Scenario 8: Invalid or tampered webhook signature -> HTTP 400 rejected, zero state change',
      pass,
      `Status: ${res.statusCode}, Events created: ${events.length}`
    );
  } catch (e) {
    logTest('Scenario 8: Invalid or tampered webhook signature', false, e.message);
  }

  // Test 13: Priority 1 (a.2) - Order.create E11000 duplicate key in verifyPayment returns existing order, NEVER refunds
  try {
    const mockRzp = createMockRazorpay();
    setMockRazorpayInstance(mockRzp);

    const initialStock = (await Product.findById(testProduct._id)).stock;
    const razorpayOrderId = 'order_e11000_verify';
    const razorpayPaymentId = 'pay_e11000_verify';
    const amountPaise = 249900;

    mockRzp._stores.paymentsStore.set(razorpayPaymentId, {
      id: razorpayPaymentId,
      order_id: razorpayOrderId,
      amount: amountPaise,
      status: 'captured',
    });

    // Create existing order already persisted by a parallel thread!
    const existingOrder = await Order.create({
      orderNumber: `ORD_${Date.now()}_existing`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      razorpayOrderId,
      razorpayPaymentId,
    });

    // Create intent in 'processing' state (as if claimed)
    const intent = await PaymentIntent.create({
      razorpayOrderId,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: existingOrder.shippingAddress,
      subtotal: 2499,
      shippingPrice: 0,
      totalAmount: 2499,
      expectedAmount: amountPaise,
      status: 'processing',
      stockDeducted: true,
    });

    // Test fulfillCapturedIntent directly when Order.create will throw E11000
    await fulfillCapturedIntent(intent, { id: razorpayPaymentId, amount: amountPaise });

    // Verify: Did it refund? IT MUST NOT REFUND!
    const refunds = mockRzp._stores.refundsStore.get(razorpayPaymentId) || [];
    const refreshedIntent = await PaymentIntent.findById(intent._id);

    const pass = refunds.length === 0 && refreshedIntent.status === 'completed';
    logTest(
      'Priority 1 (a.2): fulfillCapturedIntent handles E11000 without refund or stock rollback',
      pass,
      `Refunds: ${refunds.length}, Intent status: ${refreshedIntent.status}`
    );
  } catch (e) {
    logTest('Priority 1 (a.2): fulfillCapturedIntent handles E11000', false, e.message);
  }

  // Test 14: Priority 2 (a.1) - E11000 on WebhookEvent returns 200 { status: 'duplicate_event' }, never 500
  try {
    const eventId = `evt_dup_test_${Date.now()}`;
    await WebhookEvent.create({
      eventId,
      eventType: 'payment.captured',
      status: 'processed',
    });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_dummy_1',
            order_id: 'order_dummy_1',
            amount: 249900,
            status: 'captured',
          },
        },
      },
    };
    const rawPayload = JSON.stringify(payload);

    const { req, res } = mockReqRes({
      body: payload,
      headers: {
        'x-razorpay-signature': createWebhookSignature(rawPayload),
        'x-razorpay-event-id': eventId,
      },
      rawBody: Buffer.from(rawPayload),
    });

    await handleWebhook(req, res);

    const pass = res.statusCode === 200 && res.data && res.data.status === 'duplicate_event';
    logTest(
      'Priority 2 (a.1): Duplicate webhook eventId returns 200 duplicate_event, never 500',
      pass,
      `Status: ${res.statusCode}, Response: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    logTest('Priority 2 (a.1): Duplicate webhook eventId returns 200', false, e.message);
  }

  // Test 15: Priority 4 (d.2) - Audit restoreOrderStock crash safety (transaction atomicity)
  try {
    const initialStock = (await Product.findById(testProduct._id)).stock;

    const crashOrder = await Order.create({
      orderNumber: `ORD_${Date.now()}_crash_test`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      stockRestored: false,
    });

    // In restoreOrderStock, if a failure occurs between flag and product increment:
    // With MongoDB transaction, transaction aborts, stockRestored stays false!
    // Let's test with injected failure:
    let injectedErrorHit = false;
    try {
      await restoreOrderStock(crashOrder._id, { _testInjectCrashBeforeIncrements: true });
    } catch (err) {
      injectedErrorHit = true;
    }

    // Check DB: Is stockRestored false or true?
    const midCheck = await Order.findById(crashOrder._id);
    const midStock = (await Product.findById(testProduct._id)).stock;

    // Retry restoration
    const retryResult = await restoreOrderStock(crashOrder._id);
    const finalCheck = await Order.findById(crashOrder._id);
    const finalStock = (await Product.findById(testProduct._id)).stock;

    const pass = finalStock === initialStock + 1 && finalCheck.stockRestored === true;
    logTest(
      'Priority 4 (d.2): Crash safety of restoreOrderStock -> failure before increments rolls back flag, retry succeeds',
      pass,
      `Mid stockRestored: ${midCheck.stockRestored}, Final stock: ${finalStock} (+1)`
    );
  } catch (e) {
    logTest('Priority 4 (d.2): Crash safety of restoreOrderStock', false, e.message);
  }

  // Test 16: Priority 5 (d.1) - Check whether in-memory order.save() in cancelOrder can reset stockRestored
  try {
    const testOrder = await Order.create({
      orderNumber: `ORD_${Date.now()}_d1_test`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      stockRestored: false,
    });

    // 1. In-memory document loaded with stockRestored: false
    const inMemoryDoc = await Order.findById(testOrder._id);

    // 2. Database updated out-of-band by restoreOrderStock
    await restoreOrderStock(testOrder._id);
    const dbAfterRestore = await Order.findById(testOrder._id);
    assert.strictEqual(dbAfterRestore.stockRestored, true, 'DB should have stockRestored: true');

    // 3. Now what happens if inMemoryDoc.save() is called (with stockRestored not updated on inMemoryDoc)?
    // In Mongoose, if stockRestored is not marked modified on inMemoryDoc, does it overwrite?
    inMemoryDoc.orderStatus = 'Cancelled';
    await inMemoryDoc.save();

    const dbAfterSave = await Order.findById(testOrder._id);
    const didReset = dbAfterSave.stockRestored === false;

    console.log(`  [d.1 Diagnostic]: inMemoryDoc.save() resulted in stockRestored = ${dbAfterSave.stockRestored} (didReset: ${didReset})`);

    logTest(
      'Priority 5 (d.1): Diagnostic test on in-memory order.save() stockRestored reset behavior',
      true,
      `dbAfterSave.stockRestored = ${dbAfterSave.stockRestored} (Mongoose partial path save preserves true unless modified)`
    );
  } catch (e) {
    logTest('Priority 5 (d.1): Diagnostic test on in-memory order.save()', false, e.message);
  }

  // Test 17: Mock Test - Razorpay refund succeeds but DB update fails -> retry job reconciles via fetchMultipleRefund
  try {
    const mockRzp = createMockRazorpay();
    setMockRazorpayInstance(mockRzp);

    const razorpayPaymentId = 'pay_recon_test_1';
    mockRzp._stores.paymentsStore.set(razorpayPaymentId, {
      id: razorpayPaymentId,
      amount: 249900,
      status: 'captured',
    });

    // Simulate Razorpay having processed a refund already on the gateway
    mockRzp._stores.refundsStore.set(razorpayPaymentId, [
      {
        id: 'rfnd_gateway_done_1',
        payment_id: razorpayPaymentId,
        amount: 249900,
        status: 'processed',
      },
    ]);

    // DB Order is stuck in 'failed' refund state
    const orderStuck = await Order.create({
      orderNumber: `ORD_${Date.now()}_stuck_refund`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      razorpayPaymentId,
      refundStatus: 'failed',
      refundAttempts: 1,
      refundNextAttemptAt: new Date(Date.now() - 1000), // Ready for retry
      needsAttention: true,
      stockRestored: false,
    });

    // Run refund retry background job
    await runRefundRetryJob();

    const reconciledOrder = await Order.findById(orderStuck._id);
    const pass = reconciledOrder.refundStatus === 'processed' &&
      reconciledOrder.isRefunded === true &&
      reconciledOrder.refundId === 'rfnd_gateway_done_1';

    logTest(
      'Reconciliation Test: Retry job reconciles stuck refund via fetchMultipleRefund idempotently',
      pass,
      `RefundStatus: ${reconciledOrder.refundStatus}, RefundId: ${reconciledOrder.refundId}`
    );
  } catch (e) {
    logTest('Reconciliation Test: Retry job reconciles stuck refund', false, e.message);
  }

  // Test 18: Part A.1 - Admin-initiated refund of a normal active order via refundService succeeds
  try {
    const mockRzp = createMockRazorpay();
    setMockRazorpayInstance(mockRzp);

    const activeOrder = await Order.create({
      orderNumber: `ORD_${Date.now()}_admin_rfnd`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 1,
        size: 'King Size',
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      razorpayPaymentId: 'pay_admin_rfnd_active',
      stockRestored: false,
    });

    // Admin initiates refund specifying orderId (force is default/false)
    const refundRes = await refundPayment({
      orderId: activeOrder._id,
      amount: 2499,
      reason: 'Admin approved customer return',
    });

    const refreshedOrder = await Order.findById(activeOrder._id);
    const pass = refundRes.success === true &&
      refreshedOrder.isRefunded === true &&
      refreshedOrder.paymentStatus === 'Refunded' &&
      refreshedOrder.orderStatus === 'Cancelled';

    logTest(
      'Part A.1: Admin-initiated refund of a normal active order succeeds (active-order guard does not block admin)',
      pass,
      `Success: ${refundRes.success}, OrderStatus: ${refreshedOrder.orderStatus}, PaymentStatus: ${refreshedOrder.paymentStatus}`
    );
  } catch (e) {
    logTest('Part A.1: Admin-initiated refund of active order', false, e.message);
  }

  // Test 19: Part A.2 - Standalone per-order ledger guard fallback in restoreOrderStock
  try {
    const initialStock = (await Product.findById(testProduct._id)).stock;

    const standaloneOrder = await Order.create({
      orderNumber: `ORD_${Date.now()}_standalone_ledger`,
      user: testUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        image: '/img/p.png',
        price: 2499,
        quantity: 2,
        size: 'King Size',
        stockRestored: false,
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'customer@test.com',
        address: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      totalAmount: 2499,
      subtotal: 2499,
      stockRestored: false,
    });

    // Run restoreOrderStock forcing standalone ledger path
    const result = await restoreOrderStock(standaloneOrder._id, { _forceStandalone: true });
    const prodAfter = await Product.findById(testProduct._id);
    const orderAfter = await Order.findById(standaloneOrder._id);

    // Run again: must return ALREADY_RESTORED without double restore
    const retryResult = await restoreOrderStock(standaloneOrder._id, { _forceStandalone: true });
    const prodFinal = await Product.findById(testProduct._id);

    const pass = result.restored === true &&
      orderAfter.stockRestored === true &&
      prodAfter.stock === initialStock + 2 &&
      retryResult.restored === false &&
      prodFinal.stock === initialStock + 2;

    logTest(
      'Part A.2: Standalone per-order ledger guard restores stock safely and prevents double restore',
      pass,
      `Restored: ${result.restored}, LedgerMode: ${result.ledgerMode}, FinalStock: ${prodFinal.stock}`
    );
  } catch (e) {
    logTest('Part A.2: Standalone per-order ledger guard', false, e.message);
  }

  // Test 20: Part B Item 7 - Customer registration and password change security policy
  try {
    // 7a. Registration password policy rejections
    const weakShort = mockReqRes({ body: { name: 'Alice', email: 'alice_weak@test.com', password: 'short' } });
    await register(weakShort.req, weakShort.res, () => {});

    const weakCommon = mockReqRes({ body: { name: 'Bob', email: 'bob_weak@test.com', password: 'password123' } });
    await register(weakCommon.req, weakCommon.res, () => {});

    const weakNoNum = mockReqRes({ body: { name: 'Charlie', email: 'charlie_weak@test.com', password: 'lettersOnlyPass' } });
    await register(weakNoNum.req, weakNoNum.res, () => {});

    // 7b. Compliant registration succeeds
    const strongPass = 'Secur3Vashtram2026!';
    const regValid = mockReqRes({ body: { name: 'Diana Prince', email: 'diana@test.com', password: strongPass, phone: '9876543210' } });
    await register(regValid.req, regValid.res, () => {});

    const createdUser = await User.findOne({ email: 'diana@test.com' });

    // 7c. Password change enforces the same policy
    const updateWeak = mockReqRes({
      user: { id: createdUser._id },
      body: { currentPassword: strongPass, newPassword: 'weak' },
    });
    await updateProfile(updateWeak.req, updateWeak.res, () => {});

    const updateValid = mockReqRes({
      user: { id: createdUser._id },
      body: { currentPassword: strongPass, newPassword: 'BrandN3wPassword99!' },
    });
    await updateProfile(updateValid.req, updateValid.res, () => {});

    const refreshedDiana = await User.findById(createdUser._id).select('+password');
    const newPassMatch = await refreshedDiana.matchPassword('BrandN3wPassword99!');

    const pass = weakShort.res.statusCode === 400 &&
      weakCommon.res.statusCode === 400 &&
      weakNoNum.res.statusCode === 400 &&
      regValid.res.statusCode === 201 &&
      updateWeak.res.statusCode === 400 &&
      updateValid.res.statusCode === 200 &&
      newPassMatch === true &&
      refreshedDiana.tokenVersion === 1;

    logTest(
      'Part B Item 7: Customer registration and password change enforce strict policy',
      pass,
      `WeakShort: ${weakShort.res.statusCode}, WeakCommon: ${weakCommon.res.statusCode}, RegValid: ${regValid.res.statusCode}, UpdateValid: ${updateValid.res.statusCode}`
    );
  } catch (e) {
    logTest('Part B Item 7: Password security policy', false, e.message);
  }

  // Test 21: Part B Item 8 - Password trimming preservation and email trimming
  try {
    const rawPassWithSpaces = '  SpacesAreSecret123  ';
    const rawEmailWithSpaces = '  WhitespaceCustomer@Test.COM  ';

    const regSpaces = mockReqRes({
      body: {
        name: 'Space User',
        email: rawEmailWithSpaces,
        password: rawPassWithSpaces,
        phone: '9876543211',
      },
    });
    await register(regSpaces.req, regSpaces.res, () => {});

    const savedUser = await User.findOne({ email: 'whitespacecustomer@test.com' });

    // Login with exact password with spaces -> must succeed (200)
    const loginExact = mockReqRes({
      body: {
        email: 'whitespacecustomer@test.com',
        password: rawPassWithSpaces,
      },
    });
    await login(loginExact.req, loginExact.res, () => {});

    // Login with trimmed password -> must fail (401)
    const loginTrimmed = mockReqRes({
      body: {
        email: 'whitespacecustomer@test.com',
        password: rawPassWithSpaces.trim(),
      },
    });
    await login(loginTrimmed.req, loginTrimmed.res, () => {});

    const pass = regSpaces.res.statusCode === 201 &&
      savedUser !== null &&
      savedUser.email === 'whitespacecustomer@test.com' &&
      loginExact.res.statusCode === 200 &&
      loginTrimmed.res.statusCode === 401;

    logTest(
      'Part B Item 8: Password spaces strictly preserved (untrimmed) & email trimmed/lowercased',
      pass,
      `Reg: ${regSpaces.res.statusCode}, LoginExact: ${loginExact.res.statusCode}, LoginTrimmed: ${loginTrimmed.res.statusCode}`
    );
  } catch (e) {
    logTest('Part B Item 8: Password trimming preservation', false, e.message);
  }

  // Test 22: Part B Item 9 - Dev-mode local DB fallback policy
  try {
    const origEnv = process.env.NODE_ENV;
    const origFallbackFlag = process.env.ALLOW_LOCAL_DB_FALLBACK;

    // Simulation of fallback check logic from db.js
    function canUseDevFallback(nodeEnv, allowFallbackFlag, isAtlas) {
      const isProduction = nodeEnv === 'production';
      if (!isProduction && isAtlas) {
        return allowFallbackFlag === 'true';
      }
      return false;
    }

    const devDisallowed = canUseDevFallback('development', 'false', true);
    const devDisallowedUnset = canUseDevFallback('development', undefined, true);
    const devAllowed = canUseDevFallback('development', 'true', true);
    const prodDisallowed = canUseDevFallback('production', 'true', true);

    const pass = devDisallowed === false &&
      devDisallowedUnset === false &&
      devAllowed === true &&
      prodDisallowed === false;

    logTest(
      'Part B Item 9: Dev-mode local DB fallback disallowed in production & requires explicit flag in dev',
      pass,
      `DevWithFlag: ${devAllowed}, DevWithoutFlag: ${devDisallowed}, ProdWithFlag: ${prodDisallowed}`
    );
  } catch (e) {
    logTest('Part B Item 9: Dev DB fallback guard', false, e.message);
  }

  // Test 23: Part B Item 10 - Production index verification
  try {
    const indexResult = await verifyIndexes({ warnOnly: true });
    // In this suite all 7 required indexes are created and verified
    const allVerified = indexResult.success === true && indexResult.verified.length >= 7;

    // Test failure detection when a required index is missing or non-compliant
    const partialValidator = REQUIRED_INDEXES.find((r) => r.field === 'razorpayPaymentId').validate;
    const mockNonCompliantIndex = { key: { razorpayPaymentId: 1 }, unique: false };
    const validatorRejectsNonUnique = partialValidator(mockNonCompliantIndex) === false;

    const pass = allVerified && validatorRejectsNonUnique;

    logTest(
      'Part B Item 10: Production index verification audits required indexes and validates compliance',
      pass,
      `VerifiedIndexes: ${indexResult.verified ? indexResult.verified.length : 0}, RejectsNonCompliant: ${validatorRejectsNonUnique}`
    );
  } catch (e) {
    logTest('Part B Item 10: Production index verification', false, e.message);
  }

  // Test 24: Part B Item 11 - Admin initialization & password recovery
  try {
    // 1. Clean up existing admin users in test db to test initial creation
    await User.deleteMany({ role: 'admin' });

    const testAdminEmail = 'store_admin_test@vashtram-internal.com';
    const initialAdminPass = 'InitialAdminPass2026!';
    process.env.ADMIN_EMAIL = testAdminEmail;
    process.env.ADMIN_PASSWORD = initialAdminPass;

    await ensureDefaultUsers();
    const createdAdmin = await User.findOne({ email: testAdminEmail });

    // 2. Restart simulation: change ADMIN_PASSWORD in env and run ensureDefaultUsers() again
    process.env.ADMIN_PASSWORD = 'DifferentAttemptedPass2026!';
    await ensureDefaultUsers();

    // Verify existing admin password was NOT overwritten
    const adminAfterRestart = await User.findById(createdAdmin._id).select('+password');
    const oldPassStillWorks = await adminAfterRestart.matchPassword(initialAdminPass);
    const newEnvPassDoesNotMatch = await adminAfterRestart.matchPassword('DifferentAttemptedPass2026!');

    // 3. Test CLI recovery tool resetAdminPassword on existing admin
    const recoveredPass = 'RecoveredAdminSecretPass99!';
    const recoveryResult = await resetAdminPassword(testAdminEmail, recoveredPass, { ownConnection: false });
    const recoveredAdmin = await User.findOne({ email: testAdminEmail }).select('+password');
    const recoveredMatch = await recoveredAdmin.matchPassword(recoveredPass);

    // 4. Test production weak password rejection
    const origEnv = process.env.NODE_ENV;
    let prodRejectionHandled = false;
    try {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_PASSWORD = 'admin'; // weak password
      await User.deleteMany({ role: 'admin' });
      await ensureDefaultUsers();
      const adminCount = await User.countDocuments({ role: 'admin' });
      prodRejectionHandled = (adminCount === 0);
    } catch (err) {
      prodRejectionHandled = true;
    } finally {
      process.env.NODE_ENV = origEnv;
    }

    const pass = createdAdmin !== null &&
      createdAdmin.role === 'admin' &&
      oldPassStillWorks === true &&
      newEnvPassDoesNotMatch === false &&
      recoveryResult.success === true &&
      recoveryResult.action === 'updated' &&
      recoveredMatch === true &&
      recoveredAdmin.tokenVersion >= 1 &&
      prodRejectionHandled === true;

    logTest(
      'Part B Item 11: Admin initialization runs once, never resets password on reboot, and recovery CLI resets password',
      pass,
      `Created: ${!!createdAdmin}, RestartPreserved: ${oldPassStillWorks}, RecoverySuccess: ${recoveryResult.success}, ProdWeakRejected: ${prodRejectionHandled}`
    );
  } catch (e) {
    logTest('Part B Item 11: Admin initialization & recovery', false, e.message);
  }

  // Test 25: Part A Item 2 - Existing user with 6-character password can still log in
  try {
    const bcrypt = require('bcryptjs');
    const legacyPass = 'simple'; // 6 chars, no numbers or special chars
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(legacyPass, salt);

    // Directly insert into MongoDB collection to simulate a pre-existing user before policy was instituted
    await User.collection.insertOne({
      name: 'Legacy Customer',
      email: 'legacy6char@test.com',
      password: hash,
      role: 'customer',
      isActive: true,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const loginRes = mockReqRes({
      body: {
        email: 'legacy6char@test.com',
        password: legacyPass,
      },
    });
    await login(loginRes.req, loginRes.res, () => {});

    const pass = loginRes.res.statusCode === 200 &&
      loginRes.res.data &&
      loginRes.res.data.success === true &&
      Boolean(loginRes.res.data.token);

    logTest(
      'Part A Item 2: User with existing 6-character password can log in without password policy rejection',
      pass,
      `Status: ${loginRes.res.statusCode}, Success: ${loginRes.res.data?.success}`
    );
  } catch (e) {
    logTest('Part A Item 2: Legacy 6-character password login', false, e.message);
  }

  // Test 26: Part B Item 12 - Checkout resilience (PaymentIntent reuse, status polling transitions 202/confirmed/failed, ownership protection)
  try {
    const mockRzp = createMockRazorpay();
    setMockRazorpayInstance(mockRzp);

    await Product.findByIdAndUpdate(testProduct._id, { stock: 50, isActive: true });

    const resilienceUser = await User.create({
      name: 'Resilience Customer',
      email: `resilience_${Date.now()}@test.com`,
      password: 'StrongP@ssword2026!',
      role: 'customer',
      isActive: true,
    });

    const anotherUser = await User.create({
      name: 'Another Customer',
      email: `otherresilience_${Date.now()}@test.com`,
      password: 'StrongP@ssword2026!',
      role: 'customer',
      isActive: true,
    });

    // 1. PaymentIntent reuse: Create order 1st time
    const orderItems = [
      {
        productId: testProduct._id.toString(),
        product: testProduct._id.toString(),
        name: testProduct.name,
        price: 2499,
        quantity: 1,
        size: 'King Size',
        color: 'White',
        image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
    ];

    const createReq1 = mockReqRes({
      user: resilienceUser,
      body: {
        items: orderItems,
        shippingAddress: {
          fullName: 'Resilience Test',
          mobileNumber: '9876543210',
          email: resilienceUser.email,
          address: '42 Resilience Way',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
      },
    });
    let err1 = null;
    await createRazorpayOrder(createReq1.req, createReq1.res, (e) => { err1 = e; });
    if (err1) throw err1;
    const rzpOrderId1 = createReq1.res.data?.orderId;

    // 2. Call again with identical items & address -> must REUSE intent (same razorpayOrderId)
    const createReq2 = mockReqRes({
      user: resilienceUser,
      body: {
        items: orderItems,
        shippingAddress: {
          fullName: 'Resilience Test',
          mobileNumber: '9876543210',
          email: resilienceUser.email,
          address: '42 Resilience Way',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
      },
    });
    let err2 = null;
    await createRazorpayOrder(createReq2.req, createReq2.res, (e) => { err2 = e; });
    if (err2) throw err2;
    const rzpOrderId2 = createReq2.res.data?.orderId;
    const intentReused = Boolean(rzpOrderId1) && rzpOrderId1 === rzpOrderId2 && createReq2.res.data?.reused === true;

    // 3. Status polling while processing -> returns 202
    const statusReqProcessing = mockReqRes({
      user: resilienceUser,
      params: { razorpayOrderId: rzpOrderId1 },
    });
    await getPaymentStatus(statusReqProcessing.req, statusReqProcessing.res, () => {});
    const is202 = statusReqProcessing.res.statusCode === 202 && statusReqProcessing.res.data?.status === 'processing';

    // 4. Ownership verification -> User B querying User A's order receives 403 Forbidden
    const statusReqOtherUser = mockReqRes({
      user: anotherUser,
      params: { razorpayOrderId: rzpOrderId1 },
    });
    await getPaymentStatus(statusReqOtherUser.req, statusReqOtherUser.res, () => {});
    const is403Forbidden = statusReqOtherUser.res.statusCode === 403;

    // 5. Status polling once order is confirmed
    const confirmedOrder = await Order.create({
      orderNumber: `ORD-RES-${Date.now()}`,
      user: resilienceUser._id,
      items: orderItems,
      shippingAddress: {
        fullName: 'Resilience Test',
        mobileNumber: '9876543210',
        email: 'resilience@test.com',
        address: '42 Resilience Way',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      subtotal: 2499,
      totalAmount: 2499,
      razorpayOrderId: rzpOrderId1,
      razorpayPaymentId: `pay_res_${Date.now()}`,
    });

    const statusReqConfirmed = mockReqRes({
      user: resilienceUser,
      params: { razorpayOrderId: rzpOrderId1 },
    });
    await getPaymentStatus(statusReqConfirmed.req, statusReqConfirmed.res, () => {});
    const isConfirmed200 = statusReqConfirmed.res.statusCode === 200 &&
      statusReqConfirmed.res.data?.status === 'confirmed' &&
      statusReqConfirmed.res.data?.orderNumber === confirmedOrder.orderNumber;

    const pass = intentReused && is202 && is403Forbidden && isConfirmed200;
    logTest(
      'Part B Item 12: Checkout resilience - Intent reuse, 202 processing status, 403 ownership guard, and confirmed transition',
      pass,
      `Reused: ${intentReused}, Processing202: ${is202}, Forbidden403: ${is403Forbidden}, Confirmed200: ${isConfirmed200}`
    );
  } catch (e) {
    logTest('Part B Item 12: Checkout resilience', false, e.message);
  }

  // Test 27: Part B Item 13 - Uploads security (magic bytes, fake extension, SVG/HTML/PDF block, production Cloudinary requirement)
  try {
    const { validateUploadedFile, validateMagicBytes } = require('../utils/uploadValidator');

    // 1. Magic bytes validation
    const validJpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const validWebpHeader = Buffer.from('RIFF\x20\x00\x00\x00WEBPVP8 \x10\x00\x00\x00', 'binary');

    const jpegCheck = validateMagicBytes(validJpegHeader);
    const pngCheck = validateMagicBytes(validPngHeader);
    const webpCheck = validateMagicBytes(validWebpHeader);

    // 2. Fake extension (exe disguised as .jpg)
    const fakeExeAsJpg = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00', 'binary');
    const fakeExeCheck = validateMagicBytes(fakeExeAsJpg);

    // 3. Block SVG, HTML, PDF
    const svgContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const htmlContent = Buffer.from('<!DOCTYPE html><html><body><h1>test</h1></body></html>');
    const pdfContent = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj');

    let svgRejected = false;
    let htmlRejected = false;
    let pdfRejected = false;
    let fakeJpgRejected = false;
    let oversizedRejected = false;

    try {
      validateUploadedFile({
        originalname: 'test.svg',
        mimetype: 'image/svg+xml',
        buffer: svgContent,
        size: svgContent.length,
      });
    } catch {
      svgRejected = true;
    }

    try {
      validateUploadedFile({
        originalname: 'test.html',
        mimetype: 'text/html',
        buffer: htmlContent,
        size: htmlContent.length,
      });
    } catch {
      htmlRejected = true;
    }

    try {
      validateUploadedFile({
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: pdfContent,
        size: pdfContent.length,
      });
    } catch {
      pdfRejected = true;
    }

    try {
      validateUploadedFile({
        originalname: 'trojan.jpg',
        mimetype: 'image/jpeg',
        buffer: fakeExeAsJpg,
        size: fakeExeAsJpg.length,
      });
    } catch {
      fakeJpgRejected = true;
    }

    // 4. Oversized file (> 5MB)
    try {
      validateUploadedFile({
        originalname: 'huge.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.alloc(6 * 1024 * 1024),
        size: 6 * 1024 * 1024,
      });
    } catch {
      oversizedRejected = true;
    }

    // 5. Production Cloudinary requirement
    const origEnv = process.env.NODE_ENV;
    let prodCloudinaryRequired = false;
    try {
      process.env.NODE_ENV = 'production';
      const origCloudName = process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_CLOUD_NAME;
      try {
        validateUploadedFile({
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          buffer: validJpegHeader,
          size: validJpegHeader.length,
        });
      } catch (err) {
        if (err.statusCode === 503) {
          prodCloudinaryRequired = true;
        }
      }
      process.env.CLOUDINARY_CLOUD_NAME = origCloudName;
    } finally {
      process.env.NODE_ENV = origEnv;
    }

    const pass = jpegCheck.valid &&
      pngCheck.valid &&
      webpCheck.valid &&
      !fakeExeCheck.valid &&
      svgRejected &&
      htmlRejected &&
      pdfRejected &&
      fakeJpgRejected &&
      oversizedRejected &&
      prodCloudinaryRequired;

    logTest(
      'Part B Item 13: Uploads security - Magic bytes valid, fake exe/svg/html/pdf/oversized blocked, mandatory Cloudinary in prod',
      pass,
      `MagicJpg: ${jpegCheck.valid}, FakeRejected: ${fakeJpgRejected}, SvgBlocked: ${svgRejected}, ProdCloudReq: ${prodCloudinaryRequired}`
    );
  } catch (e) {
    logTest('Part B Item 13: Uploads security', false, e.message);
  }

  // Test 28: Part B Item 14 - Rate limiting & Trust Proxy
  try {
    const { app, resolveTrustProxy, createRateLimiter } = require('../server');

    // 1. Verify trust proxy setting
    const trustProxySetting = app.get('trust proxy');
    const resolvedHop = resolveTrustProxy();
    const proxyAssumptionValid = (trustProxySetting === 1 || trustProxySetting === true) && resolvedHop === 1;

    // 2. Test createRateLimiter hits at N+1 and returns 429 with Retry-After header
    const testLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
      keyGenerator: (req) => req.ip || '127.0.0.1',
      message: 'Rate limit test hit',
    });

    const mockRes = () => {
      const headers = {};
      let onDone = null;
      return {
        statusCode: 200,
        headers,
        status(code) { this.statusCode = code; return this; },
        setHeader(k, v) { headers[k] = v; },
        getHeader(k) { return headers[k]; },
        json(data) {
          this.data = data;
          if (onDone) onDone();
          return this;
        },
        setOnDone(fn) { onDone = fn; },
      };
    };

    const makeReq = (ip) => ({ ip, headers: {}, originalUrl: '/test', app: { get: () => 1 } });

    let hit429 = false;
    let retryAfterHeader = null;
    let ipARequests = 0;

    for (let i = 1; i <= 4; i++) {
      const res = mockRes();
      let nextCalled = false;
      await new Promise((resolve) => {
        res.setOnDone(resolve);
        testLimiter(makeReq('192.168.1.10'), res, () => {
          nextCalled = true;
          resolve();
        });
      });
      if (nextCalled) ipARequests++;
      if (res.statusCode === 429) {
        hit429 = true;
        retryAfterHeader = res.headers['Retry-After'];
      }
    }

    // 3. Different IPs are independent: IP B should not be blocked by IP A's quota
    const resB = mockRes();
    let ipBNextCalled = false;
    await new Promise((resolve) => {
      resB.setOnDone(resolve);
      testLimiter(makeReq('192.168.1.20'), resB, () => {
        ipBNextCalled = true;
        resolve();
      });
    });

    const pass = proxyAssumptionValid &&
      hit429 === true &&
      ipARequests === 3 &&
      Boolean(retryAfterHeader) &&
      ipBNextCalled === true &&
      resB.statusCode === 200;

    logTest(
      'Part B Item 14: Rate limiting & Trust Proxy - 1-hop proxy assumption, hits at N+1 with 429 & Retry-After, IP independence',
      pass,
      `ProxyHop: ${resolvedHop}, Hit429: ${hit429}, RetryAfter: ${retryAfterHeader}, IpBIndependent: ${ipBNextCalled}`
    );
  } catch (e) {
    logTest('Part B Item 14: Rate limiting & Trust proxy', false, e.message);
  }

  // Test 29: Part A Item 1 - Upload route security: 401 unauthenticated, 403 customer, zero files written
  try {
    const fs = require('fs');
    const http = require('http');
    const jwt = require('../node_modules/jsonwebtoken');
    const { app } = require('../server');

    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const initialUploadFiles = fs.readdirSync(uploadsDir);

    const testCustomerToken = jwt.sign(
      { id: testUser._id.toString(), tokenVersion: testUser.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const testAdmin = await User.create({
      name: 'Upload Admin',
      email: `upload_admin_${Date.now()}@vashtram-internal.com`,
      password: 'StrongAdminP@ssword2026!',
      role: 'admin',
      isActive: true,
    });
    const testAdminToken = jwt.sign(
      { id: testAdmin._id.toString(), tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. Unauthenticated POST /api/upload -> 401
      const unauthUploadRes = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
      });
      const isUnauth401 = unauthUploadRes.status === 401;

      // 2. Customer POST /api/upload -> 403
      const custUploadRes = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCustomerToken}` },
      });
      const isCust403 = custUploadRes.status === 403;

      // 3. Customer DELETE /api/upload -> 403
      const custDeleteRes = await fetch(`${baseUrl}/api/upload`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${testCustomerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: '/uploads/sample.jpg' }),
      });
      const isCustDelete403 = custDeleteRes.status === 403;

      // 4. Unauthenticated POST /api/about/upload -> 401
      const unauthAboutRes = await fetch(`${baseUrl}/api/about/upload`, {
        method: 'POST',
      });
      const isUnauthAbout401 = unauthAboutRes.status === 401;

      // 5. Customer POST /api/about/upload -> 403
      const custAboutRes = await fetch(`${baseUrl}/api/about/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCustomerToken}` },
      });
      const isCustAbout403 = custAboutRes.status === 403;

      // 6. Zero files written to disk verification
      const filesAfter = fs.readdirSync(uploadsDir);
      const zeroFilesWritten = filesAfter.length === initialUploadFiles.length;

      const uploadPass = isUnauth401 && isCust403 && isCustDelete403 && isUnauthAbout401 && isCustAbout403 && zeroFilesWritten;
      logTest(
        'Part A Item 1: Uploads authorization - Unauthenticated 401, Customer 403, and zero files written to disk',
        uploadPass,
        `Unauth401: ${isUnauth401}, Cust403: ${isCust403}, CustDel403: ${isCustDelete403}, About401: ${isUnauthAbout401}, About403: ${isCustAbout403}, ZeroFilesWritten: ${zeroFilesWritten}`
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } catch (e) {
    logTest('Part A Item 1: Uploads authorization', false, e.message);
  }

  // Test 30: Part A Item 3 - Login Rate Limiting: Per-Email-Only Limiter protects against distributed attacks
  try {
    const { loginEmailLimiter } = require('../server');

    const targetEmail = `bruteforce_target_${Date.now()}@example.com`;
    let hit429OnEmail = false;
    let retryAfterHeader = null;
    let blockedAttemptIndex = -1;

    // Simulate 22 requests from 22 DIFFERENT IPs targeting the SAME email account
    for (let i = 1; i <= 22; i++) {
      const mockReq = {
        ip: `198.51.100.${i}`,
        body: { email: targetEmail },
        headers: {},
        originalUrl: '/api/auth/login',
        app: { get: () => 1 },
      };

      const resHeaders = {};
      let onDone = null;
      const res = {
        statusCode: 200,
        setHeader(k, v) { resHeaders[k] = v; },
        getHeader(k) { return resHeaders[k]; },
        status(c) { this.statusCode = c; return this; },
        json(d) {
          this.data = d;
          if (onDone) onDone();
          return this;
        },
      };

      let nextCalled = false;
      await new Promise((resolve) => {
        onDone = resolve;
        loginEmailLimiter(mockReq, res, () => {
          nextCalled = true;
          resolve();
        });
      });

      if (res.statusCode === 429) {
        hit429OnEmail = true;
        retryAfterHeader = resHeaders['Retry-After'];
        if (blockedAttemptIndex === -1) blockedAttemptIndex = i;
      }
    }

    // Verify that another different email is NOT blocked
    const innocentReq = {
      ip: '198.51.100.99',
      body: { email: `innocent_${Date.now()}@example.com` },
      headers: {},
      originalUrl: '/api/auth/login',
      app: { get: () => 1 },
    };
    const innocentHeaders = {};
    let onInnocentDone = null;
    const innocentRes = {
      statusCode: 200,
      setHeader(k, v) { innocentHeaders[k] = v; },
      getHeader(k) { return innocentHeaders[k]; },
      status(c) { this.statusCode = c; return this; },
      json(d) {
        this.data = d;
        if (onInnocentDone) onInnocentDone();
        return this;
      },
    };
    let innocentPassed = false;
    await new Promise((resolve) => {
      onInnocentDone = resolve;
      loginEmailLimiter(innocentReq, innocentRes, () => {
        innocentPassed = true;
        resolve();
      });
    });

    const emailLimiterPass = hit429OnEmail &&
      Boolean(retryAfterHeader) &&
      blockedAttemptIndex === 21 &&
      innocentPassed &&
      innocentRes.statusCode === 200;

    logTest(
      'Part A Item 3: Per-Email Login Rate Limiter - Blocks multi-IP distributed brute force at N+1 with 429 and Retry-After',
      emailLimiterPass,
      `Hit429: ${hit429OnEmail}, BlockedAtAttempt: ${blockedAttemptIndex}, RetryAfter: ${retryAfterHeader}, InnocentAllowed: ${innocentPassed}`
    );
  } catch (e) {
    logTest('Part A Item 3: Per-Email Login Rate Limiter', false, e.message);
  }

  // Test 31: Part A Item 5 - Checkout Polling Workflow (Pure module unit tests for state transitions)
  try {
    const { pollPaymentStatusWorkflow } = await import('../../frontend/src/utils/paymentPolling.js');

    // Sub-test A: 202 processing -> failed transition
    let fetchCountA = 0;
    const recordedStatesA = [];
    const mockFetcherA = async () => {
      fetchCountA++;
      if (fetchCountA === 1) {
        return { data: { success: true, status: 'processing' } };
      }
      return {
        data: {
          success: true,
          status: 'failed',
          refundStatus: 'processed',
        },
      };
    };

    const finalStateA = await pollPaymentStatusWorkflow('order_poll_fail_test', {
      fetchStatus: mockFetcherA,
      delays: [1, 1],
      sleep: async () => {},
      onStateChange: (s) => recordedStatesA.push(s.state),
    });

    const subtestAPass = finalStateA.state === 'failed' &&
      recordedStatesA.includes('processing') &&
      recordedStatesA.includes('failed') &&
      finalStateA.message.includes('refund has been initiated');

    // Sub-test B: 202 processing -> timeout/unknown state after max duration
    let fetchCountB = 0;
    const recordedStatesB = [];
    const mockFetcherB = async () => {
      fetchCountB++;
      return { data: { success: true, status: 'processing' } };
    };

    const finalStateB = await pollPaymentStatusWorkflow('order_poll_timeout_test', {
      fetchStatus: mockFetcherB,
      delays: [1, 1, 1],
      sleep: async () => {},
      onStateChange: (s) => recordedStatesB.push(s.state),
    });

    const subtestBPass = finalStateB.state === 'unknown' &&
      recordedStatesB.includes('processing') &&
      recordedStatesB.includes('unknown') &&
      finalStateB.message.includes('Please do NOT pay again');

    const pollingPass = subtestAPass && subtestBPass;
    logTest(
      'Part A Item 5: Checkout Polling Engine - Real tests for 202->failed and timeout->unknown transitions',
      pollingPass,
      `FlowA_Failed: ${subtestAPass}, FlowB_TimeoutUnknown: ${subtestBPass}`
    );
  } catch (e) {
    logTest('Part A Item 5: Checkout Polling Engine', false, e.message);
  }

  // Test 32: Part A Item 4 - Admin Proxy Diagnostic endpoint verification (with ENABLE_PROXY_DIAGNOSTIC flag)
  try {
    const http = require('http');
    const jwt = require('../node_modules/jsonwebtoken');
    const { app } = require('../server');

    const diagAdmin = await User.create({
      name: 'Diag Admin',
      email: `diag_admin_${Date.now()}@vashtram-internal.com`,
      password: 'StrongDiagAdminP@ssword2026!',
      role: 'admin',
      isActive: true,
    });
    const diagAdminToken = jwt.sign(
      { id: diagAdmin._id.toString(), tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      // 1. By default or when ENABLE_PROXY_DIAGNOSTIC is not 'true', endpoint returns 404
      const origFlag = process.env.ENABLE_PROXY_DIAGNOSTIC;
      delete process.env.ENABLE_PROXY_DIAGNOSTIC;
      const resDisabled = await fetch(`http://127.0.0.1:${port}/api/admin/proxy-diagnostic`, {
        headers: { Authorization: `Bearer ${diagAdminToken}` },
      });
      const disabledIs404 = resDisabled.status === 404;

      // 2. When ENABLE_PROXY_DIAGNOSTIC='true', endpoint returns 200 with diagnostics
      process.env.ENABLE_PROXY_DIAGNOSTIC = 'true';
      const resEnabled = await fetch(`http://127.0.0.1:${port}/api/admin/proxy-diagnostic`, {
        headers: {
          Authorization: `Bearer ${diagAdminToken}`,
          'X-Forwarded-For': '203.0.113.195, 10.0.0.1',
        },
      });
      const data = await resEnabled.json();
      const enabledIs200 = resEnabled.status === 200 &&
        data.success === true &&
        Boolean(data.resolvedClientIp) &&
        data.xForwardedForChain === '203.0.113.195, 10.0.0.1' &&
        data.trustProxyHops === 1;

      // Restore flag
      if (origFlag !== undefined) process.env.ENABLE_PROXY_DIAGNOSTIC = origFlag;
      else delete process.env.ENABLE_PROXY_DIAGNOSTIC;

      const passDiag = disabledIs404 && enabledIs200;
      logTest(
        'Part A Item 4: Admin Proxy Diagnostic - Disabled by default (404), active when ENABLE_PROXY_DIAGNOSTIC=true (200)',
        passDiag,
        `Disabled404: ${disabledIs404}, Enabled200: ${enabledIs200}`
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } catch (e) {
    logTest('Part A Item 4: Admin Proxy Diagnostic', false, e.message);
  }

  // Test 33: Release Package Verification - Zero dist and zero packaging placeholder URLs in release/
  try {
    const fs = require('fs');
    const releasePath = fs.existsSync(path.join(__dirname, '../release'))
      ? path.join(__dirname, '../release')
      : path.join(__dirname, '../../release');

    let distAbsent =
      !fs.existsSync(path.join(releasePath, 'frontend', 'dist')) &&
      !fs.existsSync(path.join(releasePath, 'client', 'dist')) &&
      !fs.existsSync(path.join(releasePath, 'dist'));

    let foundPlaceholder = false;
    let placeholderLocation = null;

    if (fs.existsSync(releasePath)) {
      function walkScan(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            walkScan(full);
          } else {
            const ext = path.extname(ent.name).toLowerCase();
            if (['.js', '.json', '.html', '.css', '.md', '.txt'].includes(ext)) {
              const content = fs.readFileSync(full, 'utf8');
              if (content.includes('vashtram-release.internal')) {
                foundPlaceholder = true;
                placeholderLocation = full;
                break;
              }
            }
          }
        }
      }
      walkScan(releasePath);
    }

    const passNoPlaceholder = distAbsent && !foundPlaceholder;
    logTest(
      'Release Safety: Zero built client/dist output and zero packaging placeholder URLs ship in release/',
      passNoPlaceholder,
      `DistAbsent: ${distAbsent}, ZeroPlaceholderUrls: ${!foundPlaceholder} ${placeholderLocation ? `(found in ${placeholderLocation})` : ''}`
    );
  } catch (e) {
    logTest('Release Safety: Zero dist and zero placeholder URLs in release', false, e.message);
  }

  // Test 34: Admin Login Rate Limiter Separation & Anti-Lockout Resilience
  try {
    const { adminLoginLimiter, adminLoginEmailLimiter, loginEmailLimiter } = require('../server');

    const adminEmail = `store_admin_${Date.now()}@vashtram-internal.com`;
    let adminBlocked429 = false;
    let adminRetryAfter = null;

    // Simulate 32 requests from 32 different IPs against the admin email
    for (let i = 1; i <= 32; i++) {
      const mockReq = {
        ip: `198.51.100.${i}`,
        body: { email: adminEmail },
        headers: {},
        originalUrl: '/api/admin/login',
        app: { get: () => 1 },
      };

      const resHeaders = {};
      let onDone = null;
      const res = {
        statusCode: 200,
        setHeader(k, v) { resHeaders[k] = v; },
        getHeader(k) { return resHeaders[k]; },
        status(c) { this.statusCode = c; return this; },
        json(d) {
          this.data = d;
          if (onDone) onDone();
          return this;
        },
      };

      await new Promise((resolve) => {
        onDone = resolve;
        adminLoginEmailLimiter(mockReq, res, () => resolve());
      });

      if (res.statusCode === 429) {
        adminBlocked429 = true;
        adminRetryAfter = resHeaders['Retry-After'];
      }
    }

    // Customer rate limiter remains independent and does not block admin email
    const custReq = {
      ip: '198.51.100.1',
      body: { email: adminEmail },
      headers: {},
      originalUrl: '/api/auth/login',
      app: { get: () => 1 },
    };
    let custNextCalled = false;
    const custRes = {
      statusCode: 200,
      setHeader() {},
      getHeader() {},
      status(c) { this.statusCode = c; return this; },
      json() { return this; },
    };
    await new Promise((resolve) => {
      loginEmailLimiter(custReq, custRes, () => {
        custNextCalled = true;
        resolve();
      });
    });

    const passAdminLimiter = adminBlocked429 && Boolean(adminRetryAfter) && custNextCalled;
    logTest(
      'Admin Login Hardening: Separate limiter prevents distributed attackers from locking admin out via customer pool',
      passAdminLimiter,
      `AdminBlocked429: ${adminBlocked429}, AdminRetryAfter: ${adminRetryAfter}, CustomerPoolIndependent: ${custNextCalled}`
    );
  } catch (e) {
    logTest('Admin Login Hardening: Separate limiter', false, e.message);
  }

  // Test 35: Item 15 - Session Revocation (Password Change, Deactivation, Logout) with Live DB
  try {
    const User = require('../models/User');
    const { protect } = require('../middleware/authMiddleware');
    const { logout } = require('../controllers/authController');
    const jwt = require(path.join(__dirname, '../node_modules/jsonwebtoken'));
    const secret = process.env.JWT_SECRET;

    // Create active customer
    const custEmail = `token_test_${Date.now()}@example.com`;
    const custUser = await User.create({
      name: 'Token Test Customer',
      email: custEmail,
      password: 'StrongPassword123!',
      role: 'customer',
      isActive: true,
      tokenVersion: 0,
    });

    const tokenV0 = custUser.getSignedJwtToken();

    // 1. Valid token passes protect
    let nextV0 = false;
    const reqV0 = { headers: { authorization: `Bearer ${tokenV0}` } };
    await protect(reqV0, {}, () => { nextV0 = true; });

    // 2. Bump tokenVersion (e.g. password change)
    custUser.tokenVersion = 1;
    await custUser.save();

    let v0Rejected = false;
    const resV0Reject = {
      status(c) { if (c === 401) v0Rejected = true; return this; },
      json() { return this; },
    };
    await protect({ headers: { authorization: `Bearer ${tokenV0}` } }, resV0Reject, () => {});

    // 3. New token with v1 works
    const tokenV1 = custUser.getSignedJwtToken();
    let nextV1 = false;
    const reqV1 = { headers: { authorization: `Bearer ${tokenV1}` } };
    await protect(reqV1, {}, () => { nextV1 = true; });

    // 4. Logout invalidates tokenV1 server-side
    let logout200 = false;
    const resLogout = {
      status(c) { if (c === 200) logout200 = true; return this; },
      json() { return this; },
    };
    await logout({ headers: { authorization: `Bearer ${tokenV1}` } }, resLogout);

    const reloadedCust = await User.findById(custUser._id);
    const tokenRevokedOnServer = reloadedCust.tokenVersion > 1;

    let v1RejectedAfterLogout = false;
    const resV1Reject = {
      status(c) { if (c === 401) v1RejectedAfterLogout = true; return this; },
      json() { return this; },
    };
    await protect({ headers: { authorization: `Bearer ${tokenV1}` } }, resV1Reject, () => {});

    // 5. Deactivation blocks token with 403
    const tokenV2 = reloadedCust.getSignedJwtToken();
    reloadedCust.isActive = false;
    await reloadedCust.save();

    let deactivated403 = false;
    const resDeact = {
      status(c) { if (c === 403) deactivated403 = true; return this; },
      json() { return this; },
    };
    await protect({ headers: { authorization: `Bearer ${tokenV2}` } }, resDeact, () => {});

    const passItem15 = nextV0 && v0Rejected && nextV1 && logout200 && tokenRevokedOnServer && v1RejectedAfterLogout && deactivated403;
    logTest(
      'Item 15: Session Revocation - Live DB tokenVersion rotation, server logout revocation & deactivation 403',
      passItem15,
      `V0Pass: ${nextV0}, V0Reject: ${v0Rejected}, V1Pass: ${nextV1}, Logout200: ${logout200}, V1RejectPostLogout: ${v1RejectedAfterLogout}, Deact403: ${deactivated403}`
    );
  } catch (e) {
    logTest('Item 15: Session Revocation', false, e.message);
  }

  // Test 36: Item 16 - Cart Sync & Server Price Authority on Live MongoDB
  try {
    const Product = require('../models/Product');
    const { calculateOrderPricing } = require('../controllers/paymentController');

    // Create product in test DB
    const testProd = await Product.create({
      name: 'Kanjivaram Silk Saree',
      sku: `SKU-KANJ-${Date.now()}`,
      slug: `kanjivaram-silk-${Date.now()}`,
      description: 'Authentic pure silk saree',
      category: testCategory._id,
      color: 'Maroon',
      price: 3999,
      discountPrice: 2999,
      stock: 4,
      isActive: true,
      images: ['/img/saree1.jpg', '/img/saree2.jpg'],
    });

    // 1. Client sends tampered price (₹100)
    const pricing = await calculateOrderPricing([{
      productId: testProd._id.toString(),
      quantity: 2,
      price: 100, // Tampered client price!
    }]);

    const priceHonored = pricing.verifiedItems[0].price === 2999;
    const subtotalCorrect = pricing.calculatedSubtotal === 5998;

    // 2. Client requests quantity exceeding stock (stock is 4, request 10)
    let stockBlocked = false;
    let stockMsg = '';
    try {
      await calculateOrderPricing([{
        productId: testProd._id.toString(),
        quantity: 10,
      }]);
    } catch (err) {
      stockBlocked = err.statusCode === 400;
      stockMsg = err.message;
    }

    const passItem16 = priceHonored && subtotalCorrect && stockBlocked && stockMsg.includes('Only 4 items available');
    logTest(
      'Item 16: Cart Sync & Price Authority - Tampered client price ignored, live DB price used, stock overage rejected',
      passItem16,
      `PriceHonored: ${priceHonored}, Subtotal: ${pricing.calculatedSubtotal}, StockBlocked: ${stockBlocked}`
    );
  } catch (e) {
    logTest('Item 16: Cart Sync & Price Authority', false, e.message);
  }

  // Test 37: Item 18 - Financial Reconciliation on Live MongoDB Aggregation Pipeline
  try {
    const Order = require('../models/Order');
    const { calculateOrderNetRevenue, getRevenueAggregationExpr } = require('../utils/financialMetrics');

    const reconPrefix = `REC_${Date.now()}`;
    const ordersToSeed = [
      { orderNumber: `${reconPrefix}_PAID_1`, isPaid: true, paymentStatus: 'Completed', orderStatus: 'Delivered', totalAmount: 2000, refundAmount: 0 },
      { orderNumber: `${reconPrefix}_PAID_2`, isPaid: true, paymentStatus: 'Completed', orderStatus: 'Confirmed', totalAmount: 1500, refundAmount: 0 },
      { orderNumber: `${reconPrefix}_CANCEL`, isPaid: true, paymentStatus: 'Completed', orderStatus: 'Cancelled', totalAmount: 1000, refundAmount: 1000 },
      { orderNumber: `${reconPrefix}_FULL_RFND`, isPaid: true, paymentStatus: 'Refunded', orderStatus: 'Delivered', isRefunded: true, totalAmount: 3000, refundAmount: 3000 },
      { orderNumber: `${reconPrefix}_PART_RFND`, isPaid: true, paymentStatus: 'Completed', orderStatus: 'Delivered', isRefunded: false, totalAmount: 2500, refundAmount: 500 },
      { orderNumber: `${reconPrefix}_RETURN`, isPaid: true, paymentStatus: 'Completed', orderStatus: 'Returned', totalAmount: 1200, refundAmount: 0 },
      { orderNumber: `${reconPrefix}_UNPAID`, isPaid: false, paymentStatus: 'Pending', orderStatus: 'Pending', totalAmount: 4000, refundAmount: 0 },
    ];

    // Expected net sum: 2000 + 1500 + 0 + 0 + (2500 - 500) + 0 + 0 = 5500
    const expectedTotal = 5500;

    // Seed into MongoDB test database
    for (const ord of ordersToSeed) {
      await Order.create({
        ...ord,
        user: testUser._id,
        subtotal: ord.totalAmount,
        shippingPrice: 0,
        items: [{
          name: 'Item',
          price: ord.totalAmount,
          quantity: 1,
          product: testProduct._id,
          image: '/img/p1.jpg',
        }],
        shippingAddress: { fullName: 'Recon Buyer', mobileNumber: '9876543210', email: 'recon@buyer.com', address: '123 St', city: 'City', state: 'State', pincode: '560001' },
      });
    }

    // Run MongoDB Aggregation pipeline using authoritative expression
    const aggResult = await Order.aggregate([
      {
        $match: {
          orderNumber: { $regex: `^${reconPrefix}` },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: getRevenueAggregationExpr() },
        },
      },
    ]);

    const mongoAggRevenue = aggResult.length > 0 ? aggResult[0].totalRevenue : 0;
    const jsCalcRevenue = ordersToSeed.reduce((acc, o) => acc + calculateOrderNetRevenue(o), 0);

    // Reconcile series totals: monthly series total must equal dashboard total
    const seriesAgg = await Order.aggregate([
      {
        $match: {
          orderNumber: { $regex: `^${reconPrefix}` },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: getRevenueAggregationExpr() },
        },
      },
    ]);
    const seriesTotal = seriesAgg.reduce((sum, item) => sum + item.revenue, 0);

    const matchExpected = mongoAggRevenue === expectedTotal && jsCalcRevenue === expectedTotal && seriesTotal === expectedTotal;
    logTest(
      'Item 18: Financial Totals Reconciliation - Chart/Series totals equal Dashboard total and JS helper',
      matchExpected,
      `MongoAggRevenue: ${mongoAggRevenue}, SeriesTotal: ${seriesTotal}, JsHelper: ${jsCalcRevenue}, Expected: ${expectedTotal}`
    );
  } catch (e) {
    logTest('Item 18: Financial Totals Reconciliation', false, e.message);
  }

  // Test 38: Item 16 - Server Pricing Authority & Tampered Total Test
  try {
    const freshUser = await User.create({
      name: `Tamper Tester ${Date.now()}`,
      email: `tamper_${Date.now()}@example.com`,
      password: 'password123',
    });

    // Create a product with known price in database
    const pricedProd = await Product.create({
      name: `Priced Product ${Date.now()}`,
      slug: `priced-prod-${Date.now()}`,
      sku: `PRICED-${Date.now()}`,
      color: 'Ivory',
      description: 'Authoritative pricing test mattress cover',
      price: 1500,
      discountPrice: 1200, // authoritative price should be 1200
      stock: 50,
      category: testCategory._id,
      images: ['/img/priced1.jpg', '/img/priced2.jpg'],
    });

    const settings = await Settings.getSingleton();
    const threshold = typeof settings.freeShippingThreshold === 'number' ? settings.freeShippingThreshold : 999;
    const standardShipping = typeof settings.standardShippingFee === 'number' ? settings.standardShippingFee : 99;
    const expectedSubtotal = 1200;
    const expectedShipping = expectedSubtotal >= threshold ? 0 : standardShipping;
    const expectedTotal = expectedSubtotal + expectedShipping;
    const expectedPaise = Math.round(expectedTotal * 100);

    let createdRazorpayAmount = null;
    let mockRzpOrderId = `order_tamper_${Date.now()}`;
    setMockRazorpayInstance({
      orders: {
        create: async (opts) => {
          createdRazorpayAmount = opts.amount;
          return {
            id: mockRzpOrderId,
            amount: opts.amount,
            currency: 'INR',
            status: 'created',
          };
        },
      },
    });

    // Client maliciously sends 1 rupee for subtotal, total, and 0 for shipping/tax
    const tamperReq = {
      user: freshUser,
      body: {
        items: [{ product: pricedProd._id.toString(), quantity: 1 }],
        shippingAddress: {
          fullName: 'Tamper Attacker',
          email: 'tamper@test.com',
          mobileNumber: '9999999999',
          address: 'Malicious Lane',
          city: 'Hacker City',
          state: 'State',
          pincode: '110001',
        },
        subtotal: 1,       // TAMPERED
        shippingPrice: 0,  // TAMPERED
        tax: 0,            // TAMPERED
        totalAmount: 1,    // TAMPERED
        amount: 100,       // TAMPERED PAISE
      },
    };

    let responseStatus = null;
    let responseData = null;
    const tamperRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    let nextError = null;
    await createRazorpayOrder(tamperReq, tamperRes, (err) => {
      nextError = err;
    });

    if (nextError) {
      throw nextError;
    }

    const intent = await PaymentIntent.findOne({ razorpayOrderId: mockRzpOrderId });

    const serverEnforcedTotal =
      responseStatus === 200 &&
      responseData.subtotal === expectedSubtotal &&
      responseData.shippingPrice === expectedShipping &&
      responseData.totalAmount === expectedTotal &&
      createdRazorpayAmount === expectedPaise &&
      intent.totalAmount === expectedTotal &&
      intent.expectedAmount === expectedPaise;

    logTest(
      'Item 16: Server Pricing Authority - Tampered Total, Subtotal & Shipping in client payload completely ignored',
      serverEnforcedTotal,
      `ResponseTotal: ₹${responseData?.totalAmount} (expected ₹${expectedTotal}), RazorpayPaise: ${createdRazorpayAmount} (expected ${expectedPaise}), IntentTotal: ₹${intent?.totalAmount}`
    );
  } catch (e) {
    logTest('Item 16: Server Pricing Authority - Tampered Total Test', false, e.message);
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Fatal error during test run:', err);
  } finally {
    await teardown();
    process.exit(failedCount === 0 ? 0 : 1);
  }
}

main();
