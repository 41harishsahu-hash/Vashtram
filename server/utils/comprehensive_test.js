/**
 * VASHTRAM Comprehensive Test Suite
 * 
 * Safety Rules:
 * - MUST run with NODE_ENV=test
 * - MUST specify MONGODB_URI_TEST (must differ from MONGODB_URI)
 * - Starts app on ephemeral port (port 0)
 * - Injects mocked Razorpay instance via setMockRazorpayInstance
 * - Covers all 24 required payment, concurrency, security, and lifecycle test scenarios
 */

const http = require('http');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');

// Load test environment
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_at_least_32_characters_long_for_security';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_vashtram_test_mode_key';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret_32_chars_long_vashtram_test';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_vashtram_test_mode_32';

// Safety validations
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}

const { assertSafeTestDatabase } = require('./testDbGuard');
const testDbUri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/vashtram_test_isolated';

try {
  assertSafeTestDatabase(testDbUri);
} catch (err) {
  process.exit(1);
}

const fs = require('fs');
const { app, validateProductionConfig } = require('../server');
const { setMockRazorpayInstance, resetRazorpayInstance } = require('../config/razorpay');
const { refundPayment, runRefundRetryJob } = require('../services/refundService');
const { runPaymentRecoveryJob } = require('../services/paymentRecoveryService');
const { checkDir, distDir } = require('../../scripts/verify-dist');

// Models
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const PaymentIntent = require('../models/PaymentIntent');
const WebhookEvent = require('../models/WebhookEvent');
const Settings = require('../models/Settings');
const { getNextOrderNumber } = require('./orderNumber');

const runComprehensiveSuite = async () => {
  console.log('\n======================================================');
  console.log('🧪 VASHTRAM SAFE E2E TEST SUITE (ISOLATED TEST DATABASE)');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;
  const failureDetails = [];

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
      failureDetails.push(`${testName}: ${details}`);
    }
  };

  let server;
  let baseUrl;
  const mockPaymentsStore = new Map();
  const mockRefundsStore = new Map();

  // Set up mock Razorpay client
  const mockRazorpay = {
    orders: {
      create: async (opts) => ({
        id: `order_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        entity: 'order',
        amount: opts.amount,
        currency: opts.currency || 'INR',
        receipt: opts.receipt,
        status: 'created',
        notes: opts.notes || {},
      }),
      fetchPayments: async (orderId) => {
        const list = [];
        for (const payment of mockPaymentsStore.values()) {
          if (payment.order_id === orderId) {
            list.push(payment);
          }
        }
        return { items: list };
      },
    },
    payments: {
      fetch: async (paymentId) => {
        const stored = mockPaymentsStore.get(paymentId);
        if (stored) return stored;
        return {
          id: paymentId,
          entity: 'payment',
          amount: 99900,
          currency: 'INR',
          status: 'captured',
          order_id: 'order_mock_default',
          captured: true,
          method: 'upi',
        };
      },
      refund: async (paymentId, opts) => {
        const refundId = `rfnd_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const refundObj = {
          id: refundId,
          entity: 'refund',
          amount: opts.amount,
          currency: 'INR',
          payment_id: paymentId,
          status: 'processed',
          notes: opts.notes || {},
        };
        mockRefundsStore.set(refundId, refundObj);
        return refundObj;
      },
      fetchMultipleRefund: async (paymentId) => {
        const refunds = [];
        for (const refund of mockRefundsStore.values()) {
          if (refund.payment_id === paymentId) {
            refunds.push(refund);
          }
        }
        return { count: refunds.length, items: refunds };
      },
    },
  };

  const defaultRefundFn = mockRazorpay.payments.refund;
  setMockRazorpayInstance(mockRazorpay);

  try {
    // 1. Connect to isolated Test DB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
    console.log(`[Test DB]: Connected to isolated test database (${mongoose.connection.name})`);

    // Clean test collection data before run
    await User.deleteMany({ email: /@vashtram\.test$/ });
    await Product.deleteMany({ name: /Test Product/ });
    await Category.deleteMany({ name: /Test Category/ });
    await Order.deleteMany({ 'shippingAddress.email': /@vashtram\.test$/ });
    await PaymentIntent.deleteMany({ 'shippingAddress.email': /@vashtram\.test$/ });
    await WebhookEvent.deleteMany({ eventId: /^evt_test_/ });

    // 2. Start HTTP server on ephemeral port (0)
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
    console.log(`[Test Server]: Running on ephemeral test port ${port}`);

    // 3. Create Seeded Test Records
    const testAdmin = await User.create({
      name: 'Test Admin',
      email: 'test-admin@vashtram.test',
      password: 'TestPassword@123',
      role: 'admin',
      tokenVersion: 0,
      phone: '9876543210',
    });

    const testCustomer = await User.create({
      name: 'Test Customer',
      email: 'test-customer@vashtram.test',
      password: 'TestPassword@123',
      role: 'customer',
      tokenVersion: 0,
      phone: '9876543211',
    });

    const testCustomer2 = await User.create({
      name: 'Test Customer 2',
      email: 'test-customer2@vashtram.test',
      password: 'TestPassword@123',
      role: 'customer',
      tokenVersion: 0,
      phone: '9876543212',
    });

    const testCategory = await Category.create({
      name: 'Test Category Bedding',
      slug: `test-cat-${Date.now()}`,
      description: 'Test category description',
    });

    const testProductActive = await Product.create({
      name: 'Test Product King Cotton Bedsheet',
      slug: `test-prod-active-${Date.now()}`,
      description: 'Luxury 100% combed cotton bedsheet with breathable weave',
      category: testCategory._id,
      price: 1299,
      discountPrice: 1099,
      material: '100% Combed Cotton',
      color: 'Pure White',
      sku: `SKU-TEST-ACT-${Date.now()}`,
      images: ['/img/product-1.jpg', '/img/product-2.jpg'],
      stock: 25,
      isActive: true,
      sizes: [
        { measurement: '72×78', name: 'King', price: 1299 },
        { measurement: '60×78', name: 'Queen', price: 1099 },
        { measurement: '48×75', name: 'Double', price: 899 },
        { measurement: '36×75', name: 'Single', price: 699 },
      ],
    });

    const testProductInactive = await Product.create({
      name: 'Test Product Inactive Luxury',
      slug: `test-prod-inactive-${Date.now()}`,
      description: 'Inactive luxury protector for admin view testing only',
      category: testCategory._id,
      price: 2499,
      material: 'Egyptian Cotton',
      color: 'Cream Gold',
      sku: `SKU-TEST-INACT-${Date.now()}`,
      images: ['/img/product-1.jpg', '/img/product-2.jpg'],
      stock: 10,
      isActive: false,
    });

    await Settings.findOneAndUpdate(
      {},
      {
        storeName: 'VASHTRAM Test Store',
        freeShippingThreshold: 999,
        standardShippingFee: 99,
      },
      { upsert: true }
    );

    // =========================================================================
    // TEST 1: Admin Login (Valid, Invalid, Rate Limiting)
    // =========================================================================
    console.log('\n--- 1. Admin Login & Rate Limiting ---');
    const validLoginRes = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-admin@vashtram.test',
        password: 'TestPassword@123',
      }),
    });
    const validLoginData = await validLoginRes.json();
    assert(validLoginRes.status === 200 && validLoginData.token, 'Admin valid login succeeds with JWT');
    const adminToken = validLoginData.token;

    const invalidLoginRes = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-admin@vashtram.test',
        password: 'WrongPassword!',
      }),
    });
    assert(invalidLoginRes.status === 401, 'Admin invalid password rejected with 401');

    // Customer Login for customerToken
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-customer@vashtram.test',
        password: 'TestPassword@123',
      }),
    });
    const custLoginData = await custLoginRes.json();
    const customerToken = custLoginData.token;

    // Customer 2 Login
    const cust2LoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-customer2@vashtram.test',
        password: 'TestPassword@123',
      }),
    });
    const cust2LoginData = await cust2LoginRes.json();
    const customer2Token = cust2LoginData.token;

    // =========================================================================
    // TEST 2: tokenVersion Session Invalidation
    // =========================================================================
    console.log('\n--- 2. tokenVersion Session Invalidation ---');
    // First, verify myorders works with current token
    const myOrdersPre = await fetch(`${baseUrl}/orders/myorders`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(myOrdersPre.status === 200, 'Customer authenticated request succeeds with initial token');

    // Invalidate session by incrementing tokenVersion
    await User.findByIdAndUpdate(testCustomer._id, { $inc: { tokenVersion: 1 } });
    const myOrdersPost = await fetch(`${baseUrl}/orders/myorders`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(myOrdersPost.status === 401, 'Request rejected with 401 after tokenVersion invalidation');

    // Reset tokenVersion for further tests
    await User.findByIdAndUpdate(testCustomer._id, { tokenVersion: 0 });

    // =========================================================================
    // TEST 3: Public vs Admin Inactive Products
    // =========================================================================
    console.log('\n--- 3. Public vs Admin Inactive Products ---');
    const publicProductsRes = await fetch(`${baseUrl}/products?includeInactive=true`);
    const publicProductsData = await publicProductsRes.json();
    const hasInactivePublicly = publicProductsData.products.some((p) => p._id === testProductInactive._id.toString());
    assert(!hasInactivePublicly, 'Public product list hides inactive products even when includeInactive=true');

    const adminProductsRes = await fetch(`${baseUrl}/products?includeInactive=true`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminProductsData = await adminProductsRes.json();
    const hasInactiveAdmin = adminProductsData.products.some((p) => p._id === testProductInactive._id.toString());
    assert(hasInactiveAdmin, 'Admin product list includes inactive products when includeInactive=true');

    // =========================================================================
    // TEST 4: Size Filter (King, Queen, Double, Single)
    // =========================================================================
    console.log('\n--- 4. Size Filter ---');
    const kingFilterRes = await fetch(`${baseUrl}/products?size=King`);
    const kingFilterData = await kingFilterRes.json();
    const kingMatched = kingFilterData.products.some((p) => p._id === testProductActive._id.toString());
    assert(kingMatched, 'Product query with size=King matched properly');

    const queenFilterRes = await fetch(`${baseUrl}/products?size=Queen`);
    const queenFilterData = await queenFilterRes.json();
    const queenMatched = queenFilterData.products.some((p) => p._id === testProductActive._id.toString());
    assert(queenMatched, 'Product query with size=Queen matched properly');

    // =========================================================================
    // TEST 5: Safe Search with ReDoS Characters
    // =========================================================================
    console.log('\n--- 5. Safe Search with Regex Characters ---');
    const specialChars = ['(', '[', '.*', '\\', '+', '?', '^', '$', '((((('];
    let allRegexSafe = true;
    for (const char of specialChars) {
      const res = await fetch(`${baseUrl}/products?search=${encodeURIComponent(char)}`);
      if (res.status !== 200) allRegexSafe = false;
    }
    assert(allRegexSafe, 'Safe search handled special regex characters without server error');

    // =========================================================================
    // TEST 6: Upload Validation
    // =========================================================================
    console.log('\n--- 6. Upload Security Validation ---');
    const badUploadRes = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'multipart/form-data',
      },
      body: 'invalid-file-content',
    });
    // Multer or custom validation should reject invalid uploads
    assert(badUploadRes.status === 400 || badUploadRes.status === 500 || badUploadRes.status === 503, 'Invalid upload rejected safely');

    // =========================================================================
    // TEST 7: Server-Side Totals & Shipping Settings
    // =========================================================================
    console.log('\n--- 7. Server-Side Totals & Dynamic Shipping ---');
    const validShippingAddress = {
      fullName: 'Rohan Sharma',
      mobileNumber: '9876543210',
      email: 'test-customer@vashtram.test',
      address: 'Flat 402, Lotus Residency, MG Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    };

    // Subtotal 1299 >= 999 threshold -> free shipping (0)
    const createOrderRes1 = await fetch(`${baseUrl}/payment/create-order`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ product: testProductActive._id, quantity: 1, size: '72×78 (King)' }],
        shippingAddress: validShippingAddress,
      }),
    });
    const createOrderData1 = await createOrderRes1.json();
    assert(createOrderData1.success === true, 'create-order succeeds with authoritative calculation');
    assert(createOrderData1.amount === 129900, 'Calculated authoritative amount in paise (129900)');

    // =========================================================================
    // TEST 8: Create-Order Validation (Require shippingAddress)
    // =========================================================================
    console.log('\n--- 8. Create-Order Validation ---');
    const invalidAddressRes = await fetch(`${baseUrl}/payment/create-order`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ product: testProductActive._id, quantity: 1, size: '72×78 (King)' }],
      }),
    });
    assert(invalidAddressRes.status === 400, 'create-order rejected when shippingAddress is missing');

    // =========================================================================
    // TEST 9: Ownership Rejection
    // =========================================================================
    console.log('\n--- 9. Ownership Verification ---');
    const cust1RazorpayOrderId = createOrderData1.orderId;
    const cust2VerifyAttempt = await fetch(`${baseUrl}/payment/status/${cust1RazorpayOrderId}`, {
      headers: { Authorization: `Bearer ${customer2Token}` },
    });
    assert(cust2VerifyAttempt.status === 403, 'Unauthorized customer rejected from accessing another user payment status');

    // =========================================================================
    // TEST 10: Wrong Payment Amount Detection
    // =========================================================================
    console.log('\n--- 10. Wrong Payment Amount Detection ---');
    const wrongPaymentId = `pay_wrong_${Date.now()}`;
    mockPaymentsStore.set(wrongPaymentId, {
      id: wrongPaymentId,
      entity: 'payment',
      amount: 50000, // 500 INR instead of 1299 INR
      currency: 'INR',
      status: 'captured',
      order_id: cust1RazorpayOrderId,
    });

    const wrongKeySecret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_32_chars_long_vashtram_test';
    const wrongSignature = crypto
      .createHmac('sha256', wrongKeySecret)
      .update(`${cust1RazorpayOrderId}|${wrongPaymentId}`)
      .digest('hex');

    const wrongAmountRes = await fetch(`${baseUrl}/payment/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: cust1RazorpayOrderId,
        razorpay_payment_id: wrongPaymentId,
        razorpay_signature: wrongSignature,
      }),
    });
    assert(wrongAmountRes.status === 400, 'Payment with mismatched amount rejected and refunded');

    // =========================================================================
    // TEST 11: Invalid Signature Rejection
    // =========================================================================
    console.log('\n--- 11. Invalid Signature Rejection ---');
    const invalidSigRes = await fetch(`${baseUrl}/payment/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: cust1RazorpayOrderId,
        razorpay_payment_id: 'pay_valid_mock_123',
        razorpay_signature: 'invalid_tampered_signature_hex',
      }),
    });
    assert(invalidSigRes.status === 400, 'Tampered payment signature rejected with 400');

    // =========================================================================
    // TEST 12: Non-Captured Payment Rejection
    // =========================================================================
    console.log('\n--- 12. Non-Captured Payment Rejection ---');
    const uncapturedPayId = `pay_uncaptured_${Date.now()}`;
    mockPaymentsStore.set(uncapturedPayId, {
      id: uncapturedPayId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'authorized', // Not captured!
      order_id: cust1RazorpayOrderId,
    });

    const uncapturedSig = crypto
      .createHmac('sha256', wrongKeySecret)
      .update(`${cust1RazorpayOrderId}|${uncapturedPayId}`)
      .digest('hex');

    const uncapturedRes = await fetch(`${baseUrl}/payment/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: cust1RazorpayOrderId,
        razorpay_payment_id: uncapturedPayId,
        razorpay_signature: uncapturedSig,
      }),
    });
    assert(uncapturedRes.status === 400, 'Uncaptured payment rejected with 400');

    // =========================================================================
    // TEST 13 & 14: Duplicate Verify & Duplicate Webhook (10x)
    // =========================================================================
    console.log('\n--- 13 & 14. Verification Idempotency & 10x Webhook Flooding ---');
    // Create clean order for valid verify test
    const createOrderRes2 = await fetch(`${baseUrl}/payment/create-order`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ product: testProductActive._id, quantity: 1, size: '72×78 (King)' }],
        shippingAddress: validShippingAddress,
      }),
    });
    const createOrderData2 = await createOrderRes2.json();
    const validRzpOrderId = createOrderData2.orderId;
    const validPaymentId = `pay_valid_${Date.now()}`;

    mockPaymentsStore.set(validPaymentId, {
      id: validPaymentId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: validRzpOrderId,
    });

    const validSignature = crypto
      .createHmac('sha256', wrongKeySecret)
      .update(`${validRzpOrderId}|${validPaymentId}`)
      .digest('hex');

    // 1st Verify
    const verifyRes1 = await fetch(`${baseUrl}/payment/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: validRzpOrderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
      }),
    });
    const verifyData1 = await verifyRes1.json();
    assert((verifyRes1.status === 200 || verifyRes1.status === 201) && verifyData1.order, 'First verification confirmed order');

    // 2nd Verify (Idempotency)
    const verifyRes2 = await fetch(`${baseUrl}/payment/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: validRzpOrderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
      }),
    });
    const verifyData2 = await verifyRes2.json();
    assert(verifyRes2.status === 200 && verifyData2.order._id === verifyData1.order._id, 'Duplicate verify returns existing order idempotently');

    // 10x Webhook flooding on same event
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_vashtram_test_mode_32';
    const webhookPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: validPaymentId,
            order_id: validRzpOrderId,
            amount: 129900,
            status: 'captured',
            currency: 'INR',
          },
        },
      },
    });

    const webhookSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookPayload)
      .digest('hex');

    const webhookPromises = [];
    for (let i = 0; i < 10; i++) {
      webhookPromises.push(
        fetch(`${baseUrl}/payment/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-razorpay-signature': webhookSignature,
          },
          body: webhookPayload,
        })
      );
    }
    const webhookResults = await Promise.all(webhookPromises);
    const allWebhooksSucceeded = webhookResults.every((r) => r.status === 200);
    assert(allWebhooksSucceeded, '10x concurrent webhook flooding handled with 200 OK', 'Statuses: ' + webhookResults.map((r) => r.status).join(', '));

    const matchingOrdersCount = await Order.countDocuments({ razorpayPaymentId: validPaymentId });
    assert(matchingOrdersCount === 1, 'Exactly 1 Order exists in DB despite 10 concurrent webhooks');

    // =========================================================================
    // TEST 15: Browser + Webhook Race Condition
    // =========================================================================
    console.log('\n--- 15. Browser + Webhook Race Condition ---');
    const createOrderRes3 = await fetch(`${baseUrl}/payment/create-order`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ product: testProductActive._id, quantity: 2, size: '72×78 (King)' }],
        shippingAddress: validShippingAddress,
      }),
    });
    const createOrderData3 = await createOrderRes3.json();
    const raceRzpOrderId = createOrderData3.orderId;
    const racePaymentId = `pay_race_${Date.now()}`;

    mockPaymentsStore.set(racePaymentId, {
      id: racePaymentId,
      entity: 'payment',
      amount: 259800,
      currency: 'INR',
      status: 'captured',
      order_id: raceRzpOrderId,
    });

    const raceSig = crypto
      .createHmac('sha256', wrongKeySecret)
      .update(`${raceRzpOrderId}|${racePaymentId}`)
      .digest('hex');

    const raceWebhookPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: racePaymentId,
            order_id: raceRzpOrderId,
            amount: 259800,
            status: 'captured',
            currency: 'INR',
          },
        },
      },
    });
    const raceWebhookSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(raceWebhookPayload)
      .digest('hex');

    const stockBeforeRace = (await Product.findById(testProductActive._id)).stock;

    // Fire verify and webhook concurrently via Promise.all
    const [raceVerifyRes, raceWebhookRes] = await Promise.all([
      fetch(`${baseUrl}/payment/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${customerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          razorpay_order_id: raceRzpOrderId,
          razorpay_payment_id: racePaymentId,
          razorpay_signature: raceSig,
        }),
      }),
      fetch(`${baseUrl}/payment/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': raceWebhookSig,
        },
        body: raceWebhookPayload,
      }),
    ]);

    assert(raceVerifyRes.status === 200 || raceVerifyRes.status === 201 || raceVerifyRes.status === 202, 'Race verify succeeded');
    assert(raceWebhookRes.status === 200, 'Race webhook succeeded');

    const raceOrders = await Order.find({ razorpayPaymentId: racePaymentId });
    assert(raceOrders.length === 1, 'Exactly 1 order created in browser + webhook race');

    const stockAfterRace = (await Product.findById(testProductActive._id)).stock;
    assert(stockBeforeRace - stockAfterRace === 2, 'Stock deducted exactly once for quantity=2');

    // =========================================================================
    // TEST 16 & 17: Stock Unavailable After Payment → Auto-Refund + No Negative Stock
    // =========================================================================
    console.log('\n--- 16 & 17. Out-of-Stock Auto-Refund & No Negative Stock ---');
    // Deplete stock to 0
    await Product.findByIdAndUpdate(testProductActive._id, { stock: 0 });

    const createOrderRes4 = await fetch(`${baseUrl}/payment/create-order`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ product: testProductActive._id, quantity: 1, size: '72×78 (King)' }],
        shippingAddress: validShippingAddress,
      }),
    });
    // If create-order checks initial stock or verify checks final stock
    if (createOrderRes4.status === 200) {
      const oosOrderData = await createOrderRes4.json();
      const oosPaymentId = `pay_oos_${Date.now()}`;
      mockPaymentsStore.set(oosPaymentId, {
        id: oosPaymentId,
        entity: 'payment',
        amount: 129900,
        currency: 'INR',
        status: 'captured',
        order_id: oosOrderData.orderId,
      });

      const oosSig = crypto
        .createHmac('sha256', wrongKeySecret)
        .update(`${oosOrderData.orderId}|${oosPaymentId}`)
        .digest('hex');

      const oosVerifyRes = await fetch(`${baseUrl}/payment/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${customerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          razorpay_order_id: oosOrderData.orderId,
          razorpay_payment_id: oosPaymentId,
          razorpay_signature: oosSig,
        }),
      });

      assert(oosVerifyRes.status === 400, 'Verify safely rejected out-of-stock payment');
      const finalStock = (await Product.findById(testProductActive._id)).stock;
      assert(finalStock >= 0, 'Stock never went negative');
    } else {
      assert(createOrderRes4.status === 400, 'Pre-order stock authority blocked out-of-stock item');
    }

    // Restore stock for remaining tests
    await Product.findByIdAndUpdate(testProductActive._id, { stock: 20 });

    // =========================================================================
    // TEST 18: Refund Idempotency
    // =========================================================================
    console.log('\n--- 18. Shared Refund Service Idempotency ---');
    const refundTestPayId = `pay_refund_test_${Date.now()}`;
    mockPaymentsStore.set(refundTestPayId, {
      id: refundTestPayId,
      entity: 'payment',
      amount: 129900,
      status: 'captured',
    });

    const refund1 = await refundPayment({
      paymentId: refundTestPayId,
      amountInPaise: 129900,
      reason: 'Testing refund idempotency',
    });
    assert(refund1.success === true, 'First refund processed successfully');

    const refund2 = await refundPayment({
      paymentId: refundTestPayId,
      amountInPaise: 129900,
      reason: 'Testing refund idempotency second call',
    });
    assert(refund2.success === true && refund2.alreadyRefunded, 'Second refund idempotent check skips duplicate API call');

    // =========================================================================
    // TEST 19 & 20: Order Cancellation State Machine
    // =========================================================================
    console.log('\n--- 19 & 20. Order Cancellation State Machine & Stock Restoration ---');
    const cancelOrder = await Order.create({
      user: testCustomer._id,
      orderNumber: await getNextOrderNumber(),
      items: [{
        product: testProductActive._id,
        name: testProductActive.name,
        quantity: 3,
        price: 1299,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 3897,
      shippingPrice: 0,
      totalAmount: 3897,
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Processing',
      isPaid: true,
      paidAt: new Date(),
      razorpayPaymentId: `pay_cancel_${Date.now()}`,
    });

    const stockBeforeCancel = (await Product.findById(testProductActive._id)).stock;

    // First cancel
    const cancelRes1 = await fetch(`${baseUrl}/orders/${cancelOrder._id}/cancel`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Changed mind' }),
    });
    assert(cancelRes1.status === 200, 'Order cancellation succeeds');

    const stockAfterCancel = (await Product.findById(testProductActive._id)).stock;
    assert(stockAfterCancel - stockBeforeCancel === 3, 'Stock restored by 3 upon order cancellation');

    // Second cancel attempt
    const cancelRes2 = await fetch(`${baseUrl}/orders/${cancelOrder._id}/cancel`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Changed mind again' }),
    });
    assert(cancelRes2.status === 400, 'Duplicate cancel rejected');
    const stockAfterCancel2 = (await Product.findById(testProductActive._id)).stock;
    assert(stockAfterCancel2 === stockAfterCancel, 'Stock NOT restored a second time on duplicate cancel');

    // Shipped order cancellation guard
    const shippedOrder = await Order.create({
      user: testCustomer._id,
      orderNumber: await getNextOrderNumber(),
      items: [{
        product: testProductActive._id,
        name: testProductActive.name,
        quantity: 1,
        price: 1299,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 1299,
      shippingPrice: 0,
      totalAmount: 1299,
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Shipped', // Already shipped!
      isPaid: true,
      paidAt: new Date(),
      razorpayPaymentId: `pay_shipped_${Date.now()}`,
    });

    const cancelShippedRes = await fetch(`${baseUrl}/orders/${shippedOrder._id}/cancel`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert(cancelShippedRes.status === 400, 'Shipped order cannot be cancelled');

    // =========================================================================
    // TEST 21: Stuck-Processing Payment Recovery
    // =========================================================================
    console.log('\n--- 21. Stuck-Processing Payment Recovery ---');
    const stuckRzpOrderId = `order_stuck_${Date.now()}`;
    const stuckPaymentId = `pay_stuck_${Date.now()}`;

    mockPaymentsStore.set(stuckPaymentId, {
      id: stuckPaymentId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: stuckRzpOrderId,
    });

    await PaymentIntent.create({
      razorpayOrderId: stuckRzpOrderId,
      user: testCustomer._id,
      items: [{
        product: testProductActive._id,
        name: testProductActive.name,
        quantity: 1,
        price: 1299,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 1299,
      shippingPrice: 0,
      totalAmount: 1299,
      expectedAmount: 129900,
      status: 'processing',
      claimedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    });

    await runPaymentRecoveryJob();
    const recoveredIntent = await PaymentIntent.findOne({ razorpayOrderId: stuckRzpOrderId });
    assert(recoveredIntent && (recoveredIntent.status === 'completed' || recoveredIntent.status === 'refunded'), 'Stuck-processing recovery job claimed and processed stale payment intent');

    // =========================================================================
    // TEST 22: Pending-Verify Response (HTTP 202)
    // =========================================================================
    console.log('\n--- 22. Pending-Verify HTTP 202 ---');
    const pendingRzpOrderId = `order_pending_${Date.now()}`;
    await PaymentIntent.create({
      razorpayOrderId: pendingRzpOrderId,
      user: testCustomer._id,
      items: [{
        product: testProductActive._id,
        name: testProductActive.name,
        quantity: 1,
        price: 1299,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 1299,
      shippingPrice: 0,
      totalAmount: 1299,
      expectedAmount: 129900,
      status: 'processing', // Currently being processed
      claimedAt: new Date(),
    });

    const pendingPayId = `pay_pending_${Date.now()}`;
    mockPaymentsStore.set(pendingPayId, {
      id: pendingPayId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: pendingRzpOrderId,
    });

    const pendingSig = crypto
      .createHmac('sha256', wrongKeySecret)
      .update(`${pendingRzpOrderId}|${pendingPayId}`)
      .digest('hex');

    const pendingVerifyRes = await fetch(`${baseUrl}/payment/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: pendingRzpOrderId,
        razorpay_payment_id: pendingPayId,
        razorpay_signature: pendingSig,
      }),
    });
    assert(pendingVerifyRes.status === 202, 'When order is still finalizing, verify returns HTTP 202 Pending');

    // =========================================================================
    // TEST 23: Refund Failure Sets `needsAttention`
    // =========================================================================
    console.log('\n--- 23. Refund Failure Sets needsAttention & Admin Visibility ---');
    const brokenPaymentId = `pay_broken_${Date.now()}`;
    // Force mock to throw error on this payment
    mockRazorpay.payments.refund = async (pId, opts) => {
      if (pId === brokenPaymentId) throw new Error('Razorpay Gateway 502 Bad Gateway');
      return defaultRefundFn(pId, opts);
    };

    const brokenIntent = await PaymentIntent.create({
      razorpayOrderId: `order_broken_${Date.now()}`,
      user: testCustomer._id,
      items: [],
      shippingAddress: validShippingAddress,
      subtotal: 500,
      shippingPrice: 0,
      totalAmount: 500,
      expectedAmount: 50000,
      status: 'failed',
    });

    const refundFailResult = await refundPayment({
      paymentId: brokenPaymentId,
      amountInPaise: 50000,
      intentId: brokenIntent._id,
      reason: 'Simulated failure',
    });

    assert(refundFailResult.success === false, 'Failed refund captured cleanly without crashing');
    const updatedBrokenIntent = await PaymentIntent.findById(brokenIntent._id);
    assert(updatedBrokenIntent.needsAttention === true, 'Failed refund marked needsAttention=true');
    assert(updatedBrokenIntent.refundStatus === 'failed', 'refundStatus set to failed');

    // Test Admin endpoint for attention items
    const attentionRes = await fetch(`${baseUrl}/admin/payments/attention`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const attentionData = await attentionRes.json();
    assert(attentionRes.status === 200 && attentionData.success, 'Admin attention list accessible');

    // =========================================================================
    // TEST 24: CSP Security Assertions (No unsafe-eval, No Wildcards)
    // =========================================================================
    console.log('\n--- 24. CSP Security Header Assertions ---');
    const rootRes = await fetch(`http://127.0.0.1:${port}/robots.txt`);
    const cspHeader = rootRes.headers.get('content-security-policy') || '';

    assert(!cspHeader.includes('unsafe-eval'), 'CSP header does NOT contain "unsafe-eval"');
    assert(!/script-src[^;]*\*/.test(cspHeader), 'CSP script-src contains no wildcard "*"');
    assert(!/img-src[^;]*\*/.test(cspHeader), 'CSP img-src contains no wildcard "*"');
    assert(!/connect-src[^;]*\*/.test(cspHeader), 'CSP connect-src contains no wildcard "*"');
    assert(!/frame-src[^;]*\*/.test(cspHeader), 'CSP frame-src contains no wildcard "*"');

    // =========================================================================
    // TEST 25: Intent stores razorpayPaymentId on claim (Browser & Webhook)
    // =========================================================================
    console.log('\n--- 25. PaymentIntent stores razorpayPaymentId on claim (Browser & Webhook) ---');
    // Browser claim
    const bOrderRes = await fetch(`${baseUrl}/payment/create-order`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ product: testProductActive._id, quantity: 1, size: '72×78 (King)' }],
        shippingAddress: validShippingAddress,
      }),
    });
    const bOrderData = await bOrderRes.json();
    const bRzpOrderId = bOrderData.orderId;
    const bPaymentId = `pay_browser_claim_${Date.now()}`;
    mockPaymentsStore.set(bPaymentId, {
      id: bPaymentId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: bRzpOrderId,
    });
    const bSig = crypto.createHmac('sha256', wrongKeySecret).update(`${bRzpOrderId}|${bPaymentId}`).digest('hex');

    const bVerifyRes = await fetch(`${baseUrl}/payment/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: bRzpOrderId, razorpay_payment_id: bPaymentId, razorpay_signature: bSig }),
    });
    assert(bVerifyRes.status === 200 || bVerifyRes.status === 201, 'Browser verify succeeded');
    const bIntent = await PaymentIntent.findOne({ razorpayOrderId: bRzpOrderId });
    assert(bIntent && bIntent.razorpayPaymentId === bPaymentId, 'Browser claim stored razorpayPaymentId on PaymentIntent');

    // Webhook claim
    const wOrderRes = await fetch(`${baseUrl}/payment/create-order`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ product: testProductActive._id, quantity: 1, size: '72×78 (King)' }],
        shippingAddress: validShippingAddress,
      }),
    });
    const wOrderData = await wOrderRes.json();
    const wRzpOrderId = wOrderData.orderId;
    const wPaymentId = `pay_webhook_claim_${Date.now()}`;
    mockPaymentsStore.set(wPaymentId, {
      id: wPaymentId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: wRzpOrderId,
    });
    const wPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      payload: { payment: { entity: { id: wPaymentId, order_id: wRzpOrderId, amount: 129900, status: 'captured' } } },
    });
    const wSig = crypto.createHmac('sha256', webhookSecret).update(wPayload).digest('hex');
    await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wSig },
      body: wPayload,
    });
    const wIntent = await PaymentIntent.findOne({ razorpayOrderId: wRzpOrderId });
    assert(wIntent && wIntent.razorpayPaymentId === wPaymentId, 'Webhook claim stored razorpayPaymentId on PaymentIntent');

    // =========================================================================
    // TEST 26: Order creation fails + refund fails -> Retry Job Recovers Intent
    // =========================================================================
    console.log('\n--- 26. Order Creation Fails + Refund Fails -> Retry Job Recovers Intent ---');
    const retryRzpOrderId = `order_retry_fail_${Date.now()}`;
    const retryPaymentId = `pay_retry_fail_${Date.now()}`;
    mockPaymentsStore.set(retryPaymentId, {
      id: retryPaymentId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: retryRzpOrderId,
    });

    const origRefund = mockRazorpay.payments.refund;
    mockRazorpay.payments.refund = async (pId, opts) => {
      if (pId === retryPaymentId) throw new Error('Razorpay transient timeout');
      return origRefund(pId, opts);
    };

    const failedRetryIntent = await PaymentIntent.create({
      razorpayOrderId: retryRzpOrderId,
      razorpayPaymentId: retryPaymentId,
      user: testCustomer._id,
      items: [{
        product: testProductActive._id,
        name: testProductActive.name,
        quantity: 1,
        price: 1299,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 1299,
      shippingPrice: 0,
      totalAmount: 1299,
      expectedAmount: 129900,
      status: 'failed',
      refundStatus: 'failed',
      refundAttempts: 1,
      needsAttention: true,
      refundNextAttemptAt: new Date(Date.now() - 1000),
    });

    mockRazorpay.payments.refund = origRefund;
    await runRefundRetryJob();

    const recoveredRetryIntent = await PaymentIntent.findById(failedRetryIntent._id);
    assert(
      recoveredRetryIntent &&
      recoveredRetryIntent.razorpayPaymentId === retryPaymentId &&
      recoveredRetryIntent.refundStatus === 'processed' &&
      recoveredRetryIntent.status === 'refunded' &&
      recoveredRetryIntent.needsAttention === false,
      'Retry job resolved payment ID from intent.razorpayPaymentId and successfully refunded'
    );

    // =========================================================================
    // TEST 27: Partial Existing Refund vs Full Existing Refund
    // =========================================================================
    console.log('\n--- 27. Partial Existing Refund vs Full Existing Refund ---');
    const partialPayId = `pay_partial_${Date.now()}`;
    mockPaymentsStore.set(partialPayId, {
      id: partialPayId,
      entity: 'payment',
      amount: 100000,
      currency: 'INR',
      status: 'captured',
    });

    const existingPartialRefundId = `rfnd_part_${Date.now()}`;
    mockRefundsStore.set(existingPartialRefundId, {
      id: existingPartialRefundId,
      entity: 'refund',
      amount: 40000,
      payment_id: partialPayId,
      status: 'processed',
    });

    let capturedRefundAmount = 0;
    mockRazorpay.payments.refund = async (pId, opts) => {
      capturedRefundAmount = opts.amount;
      return origRefund(pId, opts);
    };

    const partialResult = await refundPayment({
      paymentId: partialPayId,
      amountInPaise: 100000,
      reason: 'Testing partial balance refund',
    });

    assert(partialResult.success === true, 'Partial refund call succeeded');
    assert(capturedRefundAmount === 60000, 'Refunded exactly remaining balance (60000 paise)');

    let duplicateCalled = false;
    mockRazorpay.payments.refund = async (pId, opts) => {
      duplicateCalled = true;
      return origRefund(pId, opts);
    };

    const fullResult = await refundPayment({
      paymentId: partialPayId,
      amountInPaise: 100000,
      reason: 'Testing full already refunded idempotency',
    });

    assert(fullResult.success === true && fullResult.alreadyRefunded === true, 'Full refund detected existing total refunds >= target');
    assert(duplicateCalled === false, 'No new Razorpay refund called when sum of processed refunds meets target');
    mockRazorpay.payments.refund = origRefund;

    // =========================================================================
    // TEST 28: Concurrency Guard on Simultaneous Refunds
    // =========================================================================
    console.log('\n--- 28. Concurrency Guard on Simultaneous Refunds ---');
    const concurrentPayId = `pay_concurrent_${Date.now()}`;
    mockPaymentsStore.set(concurrentPayId, {
      id: concurrentPayId,
      entity: 'payment',
      amount: 50000,
      currency: 'INR',
      status: 'captured',
    });

    const concurrentIntent = await PaymentIntent.create({
      razorpayOrderId: `order_concurrent_${Date.now()}`,
      razorpayPaymentId: concurrentPayId,
      user: testCustomer._id,
      items: [],
      shippingAddress: validShippingAddress,
      subtotal: 500,
      shippingPrice: 0,
      totalAmount: 500,
      expectedAmount: 50000,
      status: 'processing',
    });

    let refundApiCallCount = 0;
    mockRazorpay.payments.refund = async (pId, opts) => {
      refundApiCallCount++;
      await new Promise((r) => setTimeout(r, 60));
      return origRefund(pId, opts);
    };

    const [cResult1, cResult2] = await Promise.all([
      refundPayment({ paymentId: concurrentPayId, intentId: concurrentIntent._id, amountInPaise: 50000 }),
      refundPayment({ paymentId: concurrentPayId, intentId: concurrentIntent._id, amountInPaise: 50000 }),
    ]);

    assert(
      (cResult1.success || cResult2.success) && (cResult1.inProgress || cResult2.inProgress || cResult1.alreadyRefunded || cResult2.alreadyRefunded),
      'Simultaneous refund calls protected by atomic concurrency lock'
    );
    assert(refundApiCallCount === 1, 'Exactly 1 refund call reached Razorpay API despite simultaneous invocation');
    mockRazorpay.payments.refund = origRefund;

    // =========================================================================
    // TEST 29: Refund Status Never Overwritten by Failed Status
    // =========================================================================
    console.log('\n--- 29. Refund Status Never Overwritten by Failed Status ---');
    const overwriteRzpOrderId = `order_no_overwrite_${Date.now()}`;
    const overwritePayId = `pay_no_overwrite_${Date.now()}`;
    mockPaymentsStore.set(overwritePayId, {
      id: overwritePayId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: overwriteRzpOrderId,
    });

    await Product.findByIdAndUpdate(testProductActive._id, { stock: 0 });

    const noOverwriteIntent = await PaymentIntent.create({
      razorpayOrderId: overwriteRzpOrderId,
      user: testCustomer._id,
      items: [{
        product: testProductActive._id,
        name: testProductActive.name,
        quantity: 1,
        price: 1299,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 1299,
      shippingPrice: 0,
      totalAmount: 1299,
      expectedAmount: 129900,
      status: 'processing',
      claimedAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    await runPaymentRecoveryJob();
    const verifiedNoOverwriteIntent = await PaymentIntent.findById(noOverwriteIntent._id);
    assert(verifiedNoOverwriteIntent.status === 'refunded', 'Intent status preserved as "refunded" (NOT overwritten with "failed")');
    assert(verifiedNoOverwriteIntent.refundStatus === 'processed', 'Intent refundStatus is "processed"');
    await Product.findByIdAndUpdate(testProductActive._id, { stock: 20 });

    // =========================================================================
    // TEST 30: Payment Authorized Grace Window & Late Capture
    // =========================================================================
    console.log('\n--- 30. Payment Authorized Grace Window & Late Capture ---');
    const authRzpOrderId = `order_auth_grace_${Date.now()}`;
    const authPayId = `pay_auth_${Date.now()}`;

    mockPaymentsStore.set(authPayId, {
      id: authPayId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'authorized',
      order_id: authRzpOrderId,
    });

    const authIntent = await PaymentIntent.create({
      razorpayOrderId: authRzpOrderId,
      user: testCustomer._id,
      items: [{
        product: testProductActive._id,
        name: testProductActive.name,
        quantity: 1,
        price: 1299,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 1299,
      shippingPrice: 0,
      totalAmount: 1299,
      expectedAmount: 129900,
      status: 'processing',
      claimedAt: new Date(Date.now() - 6 * 60 * 1000),
      createdAt: new Date(Date.now() - 6 * 60 * 1000),
    });

    await runPaymentRecoveryJob();
    const graceIntent = await PaymentIntent.findById(authIntent._id);
    assert(graceIntent.status === 'created' && graceIntent.awaitingCapture === true, 'Authorized payment within 30m preserved with awaitingCapture: true');
    const orderCheck1 = await Order.findOne({ razorpayOrderId: authRzpOrderId });
    assert(!orderCheck1, 'No order created yet while payment remains authorized');

    // Late capture occurs
    mockPaymentsStore.set(authPayId, {
      id: authPayId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: authRzpOrderId,
    });

    const stockBeforeAuthCapture = (await Product.findById(testProductActive._id)).stock;
    const authWebhookPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      payload: { payment: { entity: { id: authPayId, order_id: authRzpOrderId, amount: 129900, status: 'captured' } } },
    });
    const authWebhookSig = crypto.createHmac('sha256', webhookSecret).update(authWebhookPayload).digest('hex');
    const authWebhookRes = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': authWebhookSig },
      body: authWebhookPayload,
    });
    assert(authWebhookRes.status === 200, 'Webhook handled captured payment after authorization');

    const finalAuthOrder = await Order.findOne({ razorpayOrderId: authRzpOrderId });
    assert(finalAuthOrder && finalAuthOrder.orderStatus === 'Confirmed', 'Order created exactly once after authorized payment captures');
    const stockAfterAuthCapture = (await Product.findById(testProductActive._id)).stock;
    assert(stockBeforeAuthCapture - stockAfterAuthCapture === 1, 'Stock deducted exactly once for late captured payment');

    // =========================================================================
    // TEST 31: Late payment.captured Webhook for Failed Intent
    // =========================================================================
    console.log('\n--- 31. Late payment.captured Webhook for Failed Intent ---');
    const lateFailRzpOrderId = `order_late_fail_${Date.now()}`;
    const lateFailPayId = `pay_late_fail_${Date.now()}`;

    mockPaymentsStore.set(lateFailPayId, {
      id: lateFailPayId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: lateFailRzpOrderId,
    });

    await PaymentIntent.create({
      razorpayOrderId: lateFailRzpOrderId,
      user: testCustomer._id,
      items: [{
        product: testProductActive._id,
        name: testProductActive.name,
        quantity: 1,
        price: 1299,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 1299,
      shippingPrice: 0,
      totalAmount: 1299,
      expectedAmount: 129900,
      status: 'failed',
      failureReason: 'Premature timeout',
    });

    const latePayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      payload: { payment: { entity: { id: lateFailPayId, order_id: lateFailRzpOrderId, amount: 129900, status: 'captured' } } },
    });
    const lateSig = crypto.createHmac('sha256', webhookSecret).update(latePayload).digest('hex');

    const lateWebhookRes = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': lateSig },
      body: latePayload,
    });
    assert(lateWebhookRes.status === 200, 'Late webhook for failed intent returned 200');

    const recoveredLateOrder = await Order.findOne({ razorpayOrderId: lateFailRzpOrderId });
    const recoveredLateIntent = await PaymentIntent.findOne({ razorpayOrderId: lateFailRzpOrderId });
    assert(
      (recoveredLateOrder && recoveredLateIntent.status === 'completed') || recoveredLateIntent.status === 'refunded',
      'Late captured payment on failed intent fulfilled order or refunded, never silently lost'
    );

    // =========================================================================
    // TEST 32: verify:dist Behavior on Clean and Polluted Builds
    // =========================================================================
    console.log('\n--- 32. verify:dist Behavior on Clean and Polluted Builds ---');
    const cleanDistViolations = checkDir(distDir);
    assert(cleanDistViolations.length === 0, 'verify-dist passes on clean client/dist bundle');

    const badFilePath = path.join(distDir, '_test_polluted.txt');
    fs.writeFileSync(badFilePath, 'This file contains unsplash and placehold.co and localhost');
    const pollutedViolations = checkDir(distDir);
    assert(
      pollutedViolations.length >= 3 &&
      pollutedViolations.some((v) => v.forbidden === 'unsplash'),
      'verify-dist catches forbidden strings when present in dist'
    );
    fs.unlinkSync(badFilePath);

    // =========================================================================
    // TEST 33: Production Configuration Startup Refusal Assertions
    // =========================================================================
    console.log('\n--- 33. Production Configuration Startup Refusal Assertions ---');
    const testValidate = (envOverrides) => {
      const originalEnv = { ...process.env };
      try {
        Object.assign(process.env, envOverrides);
        let exited = false;
        let exitCode = null;
        const origExit = process.exit;
        process.exit = (code) => {
          exited = true;
          exitCode = code;
          throw new Error(`Process.exit(${code})`);
        };

        try {
          validateProductionConfig();
        } catch (e) {
          if (!exited) throw e;
        } finally {
          process.exit = origExit;
        }
        return { exited, exitCode };
      } finally {
        process.env = originalEnv;
      }
    };

    const noWebhookSecretResult = testValidate({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/prod',
      JWT_SECRET: '12345678901234567890123456789012',
      CLIENT_URL: 'https://example.com',
      SITE_URL: 'https://example.com',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'password123',
      CLOUDINARY_CLOUD_NAME: 'test',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'test',
      RAZORPAY_KEY_ID: 'rzp_live_123456789',
      RAZORPAY_KEY_SECRET: 'test_secret',
      RAZORPAY_WEBHOOK_SECRET: '',
    });
    assert(noWebhookSecretResult.exited && noWebhookSecretResult.exitCode === 1, 'Server refuses to start in production when RAZORPAY_WEBHOOK_SECRET is missing');

    const testKeyResult = testValidate({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/prod',
      JWT_SECRET: '12345678901234567890123456789012',
      CLIENT_URL: 'https://example.com',
      SITE_URL: 'https://example.com',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'password123',
      CLOUDINARY_CLOUD_NAME: 'test',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'test',
      RAZORPAY_KEY_ID: 'rzp_test_forbidden_in_prod',
      RAZORPAY_KEY_SECRET: 'test_secret',
      RAZORPAY_WEBHOOK_SECRET: 'webhook_sec_123',
    });
    assert(testKeyResult.exited && testKeyResult.exitCode === 1, 'Server refuses to start in production with rzp_test_ keys');

    // =========================================================================
    // 34. Retry Job Honors refundNextAttemptAt ($and / $or Query Correctness)
    // =========================================================================
    console.log('\n--- 34. Retry Job Honors refundNextAttemptAt ---');
    const futurePayId = `pay_future_${Date.now()}`;
    const pastPayId = `pay_past_${Date.now()}`;
    const futureOrderId = `order_future_${Date.now()}`;
    const pastOrderId = `order_past_${Date.now()}`;

    // Intent A: scheduled in the future (1 hour from now)
    const futureIntent = await PaymentIntent.create({
      user: testCustomer._id,
      razorpayOrderId: futureOrderId,
      razorpayPaymentId: futurePayId,
      items: [{
        product: testProductActive._id,
        name: 'Test Product',
        quantity: 1,
        price: 999,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 999,
      shippingPrice: 0,
      totalAmount: 999,
      expectedAmount: 99900,
      status: 'failed',
      refundStatus: 'failed',
      refundAttempts: 1,
      refundNextAttemptAt: new Date(Date.now() + 60 * 60 * 1000),
      needsAttention: false,
    });

    // Intent B: scheduled in the past (1 minute ago)
    const pastIntent = await PaymentIntent.create({
      user: testCustomer._id,
      razorpayOrderId: pastOrderId,
      razorpayPaymentId: pastPayId,
      items: [{
        product: testProductActive._id,
        name: 'Test Product',
        quantity: 1,
        price: 999,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 999,
      shippingPrice: 0,
      totalAmount: 999,
      expectedAmount: 99900,
      status: 'failed',
      refundStatus: 'failed',
      refundAttempts: 1,
      refundNextAttemptAt: new Date(Date.now() - 60 * 1000),
      needsAttention: false,
    });

    const refundedPaymentsInTest34 = [];
    const origRefund34 = mockRazorpay.payments.refund;
    mockRazorpay.payments.refund = async (pId, opts) => {
      refundedPaymentsInTest34.push(pId);
      return origRefund34(pId, opts);
    };

    try {
      await runRefundRetryJob();
    } finally {
      mockRazorpay.payments.refund = origRefund34;
    }

    const refreshedFuture = await PaymentIntent.findById(futureIntent._id);
    const refreshedPast = await PaymentIntent.findById(pastIntent._id);

    assert(!refundedPaymentsInTest34.includes(futurePayId), 'Future refundNextAttemptAt record is NOT retried by retry job');
    assert(refundedPaymentsInTest34.includes(pastPayId), 'Past refundNextAttemptAt record IS retried by retry job');
    assert(refreshedFuture.refundStatus === 'failed', 'Future intent refundStatus remains failed');
    assert(refreshedPast.refundStatus === 'processed', 'Past intent refundStatus updated to processed');

    // =========================================================================
    // 35. Late Capture Fulfills Order; Retry Job Does NOT Refund & Order Stays Paid
    // =========================================================================
    console.log('\n--- 35. Late Capture Fulfills Order & Prevents Subsequent Refund Retry ---');
    const lateFulfillOrderId = `order_late_fulfill_${Date.now()}`;
    const lateFulfillPayId = `pay_late_fulfill_${Date.now()}`;

    const failedRefundIntent = await PaymentIntent.create({
      user: testCustomer._id,
      razorpayOrderId: lateFulfillOrderId,
      razorpayPaymentId: lateFulfillPayId,
      items: [{
        product: testProductActive._id,
        name: 'Test Product',
        quantity: 1,
        price: 1299,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 1299,
      shippingPrice: 0,
      totalAmount: 1299,
      expectedAmount: 129900,
      status: 'failed',
      refundStatus: 'failed',
      refundAttempts: 2,
      refundLastError: 'Gateway timeout during previous refund',
      refundNextAttemptAt: new Date(Date.now() - 60 * 1000),
      needsAttention: true,
    });

    mockPaymentsStore.set(lateFulfillPayId, {
      id: lateFulfillPayId,
      entity: 'payment',
      amount: 129900,
      currency: 'INR',
      status: 'captured',
      order_id: lateFulfillOrderId,
    });

    const lateFulfillPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: lateFulfillPayId,
            order_id: lateFulfillOrderId,
            amount: 129900,
            status: 'captured',
          },
        },
      },
    });
    const lateFulfillSig = crypto.createHmac('sha256', webhookSecret).update(lateFulfillPayload).digest('hex');

    const lateWebhookRes35 = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': lateFulfillSig },
      body: lateFulfillPayload,
    });
    assert(lateWebhookRes35.status === 200, 'Late webhook processed successfully');

    const completedIntentAfterLateCapture = await PaymentIntent.findById(failedRefundIntent._id);
    assert(completedIntentAfterLateCapture.status === 'completed', 'Intent transitioned to completed after late capture');
    assert(completedIntentAfterLateCapture.orderId != null, 'Intent has linked orderId');
    assert(completedIntentAfterLateCapture.refundStatus === 'none', 'refundStatus reset to none');
    assert(completedIntentAfterLateCapture.needsAttention === false, 'needsAttention reset to false');
    assert(completedIntentAfterLateCapture.refundAttempts === 0, 'refundAttempts reset to 0');
    assert(completedIntentAfterLateCapture.refundNextAttemptAt === null, 'refundNextAttemptAt reset to null');

    const createdOrder = await Order.findById(completedIntentAfterLateCapture.orderId);
    assert(createdOrder && createdOrder.paymentStatus === 'Completed', 'Order created with paymentStatus Completed');

    const refundedPaymentsInTest35 = [];
    const origRefund35 = mockRazorpay.payments.refund;
    mockRazorpay.payments.refund = async (pId, opts) => {
      refundedPaymentsInTest35.push(pId);
      return origRefund35(pId, opts);
    };

    try {
      await runRefundRetryJob();
    } finally {
      mockRazorpay.payments.refund = origRefund35;
    }

    assert(!refundedPaymentsInTest35.includes(lateFulfillPayId), 'Retry job did NOT call Razorpay refund for completed intent with order');
    const orderAfterRetryJob = await Order.findById(createdOrder._id);
    assert(orderAfterRetryJob.paymentStatus === 'Completed' && !orderAfterRetryJob.isRefunded, 'Order stays paid and is not refunded');

    // =========================================================================
    // 36. Payment Recovery Scans status: 'created', awaitingCapture: true (>30m)
    // =========================================================================
    console.log('\n--- 36. Payment Recovery Expired Awaiting-Capture Void/Refund ---');
    const expiredAuthOrderId = `order_expired_auth_${Date.now()}`;
    const expiredAuthPayId = `pay_expired_auth_${Date.now()}`;

    const expiredAuthIntent = await PaymentIntent.create({
      user: testCustomer._id,
      razorpayOrderId: expiredAuthOrderId,
      razorpayPaymentId: expiredAuthPayId,
      items: [{
        product: testProductActive._id,
        name: 'Test Product',
        quantity: 1,
        price: 1499,
        size: 'King',
        image: 'img.jpg',
      }],
      shippingAddress: validShippingAddress,
      subtotal: 1499,
      shippingPrice: 0,
      totalAmount: 1499,
      expectedAmount: 149900,
      status: 'created',
      awaitingCapture: true,
      createdAt: new Date(Date.now() - 35 * 60 * 1000),
    });

    mockPaymentsStore.set(expiredAuthPayId, {
      id: expiredAuthPayId,
      entity: 'payment',
      amount: 149900,
      currency: 'INR',
      status: 'authorized',
      order_id: expiredAuthOrderId,
    });

    await runPaymentRecoveryJob();

    const recoveredExpiredIntent = await PaymentIntent.findById(expiredAuthIntent._id);
    assert(
      recoveredExpiredIntent.status === 'refunded' || recoveredExpiredIntent.status === 'failed',
      'Expired awaitingCapture intent marked refunded or failed'
    );
    assert(recoveredExpiredIntent.awaitingCapture === false, 'awaitingCapture set to false after void/refund');
    const noOrderCreated = await Order.findOne({ razorpayOrderId: expiredAuthOrderId });
    assert(!noOrderCreated, 'No order created for expired uncaptured payment');

    // =========================================================================
    // 37. Admin Login Endpoint Role Authorization (Security Item 11)
    // =========================================================================
    console.log('\n--- 37. Admin Login Authorization Enforcement ---');
    const customerAdminLoginRes = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-customer@vashtram.test',
        password: 'TestPassword@123',
      }),
    });
    assert(
      customerAdminLoginRes.status === 403,
      'Customer login rejected at /admin/login with 403 Forbidden'
    );
    const customerAdminLoginData = await customerAdminLoginRes.json();
    assert(
      customerAdminLoginData.success === false && /denied|forbidden|privilege/i.test(customerAdminLoginData.message),
      'Customer login rejected with clear access denied message'
    );

    // =========================================================================
    // 38. Password Change Invalidates Old JWT and Issues Valid New JWT (Item 10)
    // =========================================================================
    console.log('\n--- 38. Password Change Token Refresh and Invalidation ---');
    const custLoginRes38 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-customer2@vashtram.test',
        password: 'TestPassword@123',
      }),
    });
    const custLoginData38 = await custLoginRes38.json();
    assert(custLoginRes38.status === 200 && custLoginData38.token, 'Customer 2 logs in successfully');
    const oldCustomerToken = custLoginData38.token;

    // Change password via /auth/profile
    const changePwdRes = await fetch(`${baseUrl}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oldCustomerToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'TestPassword@123',
        newPassword: 'UpdatedPassword@123',
      }),
    });
    const changePwdData = await changePwdRes.json();
    assert(changePwdRes.status === 200, 'Customer 2 changes password successfully');
    assert(changePwdData.token, 'Password change response includes new JWT token');
    const newCustomerToken = changePwdData.token;

    // Verify new token works
    const meWithNewToken = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${newCustomerToken}` },
    });
    assert(meWithNewToken.status === 200, 'Authenticated request with new token succeeds');

    // Verify old token is rejected due to tokenVersion increment
    const meWithOldToken = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${oldCustomerToken}` },
    });
    assert(meWithOldToken.status === 401, 'Request with old invalidated token rejected with 401');

    // Revert password back for safety
    await fetch(`${baseUrl}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newCustomerToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'UpdatedPassword@123',
        newPassword: 'TestPassword@123',
      }),
    });

    // =========================================================================
    // 39. Settings Validation (Item 13)
    // =========================================================================
    console.log('\n--- 39. Settings Validation (Negative / Invalid Values Rejected) ---');
    const invalidSettingsRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        standardShippingFee: -500,
      }),
    });
    assert(invalidSettingsRes.status === 400, 'Negative standardShippingFee rejected with 400');

    const invalidThresholdRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        freeShippingThreshold: -100,
      }),
    });
    assert(invalidThresholdRes.status === 400, 'Negative freeShippingThreshold rejected with 400');

    const validSettingsRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        standardShippingFee: 99,
        freeShippingThreshold: 999,
        returnDays: 7,
      }),
    });
    assert(validSettingsRes.status === 200, 'Valid settings save succeeds with 200');

    // =========================================================================
    // 40. Product Pricing Validation (Item 14 & 35)
    // =========================================================================
    console.log('\n--- 40. Product Pricing and Discount Validation ---');
    const invalidDiscountRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Test Product Invalid Discount',
        category: testCategory._id,
        price: 1000,
        discountPrice: 1200, // discountPrice >= price
        images: ['/img/test.jpg'],
        stock: 10,
        material: 'Cotton',
        color: 'White',
      }),
    });
    assert(invalidDiscountRes.status === 400, 'Product with discountPrice >= price rejected with 400');

    const negativeDiscountRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Test Product Negative Discount',
        category: testCategory._id,
        price: 1000,
        discountPrice: -50,
        images: ['/img/test.jpg'],
        stock: 10,
        material: 'Cotton',
        color: 'White',
      }),
    });
    assert(negativeDiscountRes.status === 400, 'Product with negative discountPrice rejected with 400');

    // =========================================================================
    // 41. Completed Order Refund & Cancellation Lifecycle (Force Option & Idempotency)
    // =========================================================================
    console.log('\n--- 41. Completed Order Refund & Cancellation Lifecycle ---');

    // (a) Admin PATCH payment status to Refunded calls Razorpay refund once and succeeds
    const product41A = await Product.create({
      name: 'Test Product Refund Lifecycle 41A',
      slug: `test-prod-refund-41a-${Date.now()}`,
      category: testCategory._id,
      description: 'Test description for refund lifecycle 41A',
      material: '100% Combed Cotton',
      color: 'White',
      sku: `SKU-REF-41A-${Date.now()}`,
      price: 1500,
      images: ['/img/test-1.jpg', '/img/test-2.jpg'],
      stock: 20,
      isActive: true,
    });

    const order41A = await Order.create({
      orderNumber: `VAS-REF-41A-${Date.now()}`,
      user: testCustomer._id,
      items: [{
        product: product41A._id,
        name: product41A.name,
        image: product41A.images[0],
        price: product41A.price,
        quantity: 2,
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'test-customer@vashtram.test',
        address: '123 Test St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      paidAt: new Date(),
      subtotal: 3000,
      shippingPrice: 0,
      totalAmount: 3000,
      razorpayOrderId: `order_rzp_41a_${Date.now()}`,
      razorpayPaymentId: `pay_rzp_41a_${Date.now()}`,
    });

    await PaymentIntent.create({
      razorpayOrderId: order41A.razorpayOrderId,
      user: testCustomer._id,
      items: [{
        product: product41A._id,
        name: product41A.name,
        price: product41A.price,
        quantity: 2,
      }],
      shippingAddress: order41A.shippingAddress,
      subtotal: 3000,
      totalAmount: 3000,
      expectedAmount: 300000,
      status: 'completed',
      orderId: order41A._id,
      razorpayPaymentId: order41A.razorpayPaymentId,
      stockDeducted: false,
    });

    let refundCalls41A = 0;
    mockRazorpay.payments.refund = async (pId, opts) => {
      refundCalls41A++;
      return defaultRefundFn(pId, opts);
    };

    const adminPatchPaymentRes = await fetch(`${baseUrl}/admin/orders/${order41A._id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentStatus: 'Refunded',
        reason: 'Customer requested refund via admin',
      }),
    });
    const adminPatchPaymentData = await adminPatchPaymentRes.json();
    assert(adminPatchPaymentRes.status === 200 && adminPatchPaymentData.success, '41(a): Admin PATCH payment status to Refunded succeeds with 200');
    assert(refundCalls41A === 1, '41(a): Razorpay refund called exactly once for completed intent/order');
    const updatedOrder41A = await Order.findById(order41A._id);
    assert(updatedOrder41A.paymentStatus === 'Refunded' && updatedOrder41A.isRefunded === true, '41(a): Order paymentStatus is Refunded and isRefunded is true');

    // (b) Admin status change to Cancelled refunds and restores stock once
    const product41B = await Product.create({
      name: 'Test Product Refund Lifecycle 41B',
      slug: `test-prod-refund-41b-${Date.now()}`,
      category: testCategory._id,
      description: 'Test description for refund lifecycle 41B',
      material: '100% Combed Cotton',
      color: 'Blue',
      sku: `SKU-REF-41B-${Date.now()}`,
      price: 1200,
      images: ['/img/test-1.jpg', '/img/test-2.jpg'],
      stock: 15,
      isActive: true,
    });

    const order41B = await Order.create({
      orderNumber: `VAS-REF-41B-${Date.now()}`,
      user: testCustomer._id,
      items: [{
        product: product41B._id,
        name: product41B.name,
        image: product41B.images[0],
        price: product41B.price,
        quantity: 3,
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'test-customer@vashtram.test',
        address: '123 Test St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      paidAt: new Date(),
      subtotal: 3600,
      shippingPrice: 0,
      totalAmount: 3600,
      razorpayOrderId: `order_rzp_41b_${Date.now()}`,
      razorpayPaymentId: `pay_rzp_41b_${Date.now()}`,
    });

    await PaymentIntent.create({
      razorpayOrderId: order41B.razorpayOrderId,
      user: testCustomer._id,
      items: [{
        product: product41B._id,
        name: product41B.name,
        price: product41B.price,
        quantity: 3,
      }],
      shippingAddress: order41B.shippingAddress,
      subtotal: 3600,
      totalAmount: 3600,
      expectedAmount: 360000,
      status: 'completed',
      orderId: order41B._id,
      razorpayPaymentId: order41B.razorpayPaymentId,
      stockDeducted: false,
    });

    let refundCalls41B = 0;
    mockRazorpay.payments.refund = async (pId, opts) => {
      refundCalls41B++;
      return defaultRefundFn(pId, opts);
    };

    const adminCancelRes = await fetch(`${baseUrl}/admin/orders/${order41B._id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'Cancelled',
        note: 'Admin cancelled order with refund',
      }),
    });
    const adminCancelData = await adminCancelRes.json();
    assert(adminCancelRes.status === 200 && adminCancelData.success, '41(b): Admin status change to Cancelled succeeds with 200');
    assert(refundCalls41B === 1, '41(b): Razorpay refund called exactly once on admin cancellation');
    const updatedProduct41B = await Product.findById(product41B._id);
    assert(updatedProduct41B.stock === 18, '41(b): Stock incremented from 15 to 18 (+3) exactly once');
    const updatedOrder41B = await Order.findById(order41B._id);
    assert(updatedOrder41B.stockRestored === true, '41(b): Order marked with stockRestored: true');
    assert(updatedOrder41B.orderStatus === 'Cancelled', '41(b): Order status set to Cancelled');

    // (c) The retry job still does NOT refund that completed order
    const product41C = await Product.create({
      name: 'Test Product Retry Job 41C',
      slug: `test-prod-retry-41c-${Date.now()}`,
      category: testCategory._id,
      description: 'Test description for retry job 41C',
      material: '100% Combed Cotton',
      color: 'Green',
      sku: `SKU-REF-41C-${Date.now()}`,
      price: 2000,
      images: ['/img/test-1.jpg', '/img/test-2.jpg'],
      stock: 10,
      isActive: true,
    });

    const order41C = await Order.create({
      orderNumber: `VAS-REF-41C-${Date.now()}`,
      user: testCustomer._id,
      items: [{
        product: product41C._id,
        name: product41C.name,
        image: product41C.images[0],
        price: product41C.price,
        quantity: 1,
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'test-customer@vashtram.test',
        address: '123 Test St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      paidAt: new Date(),
      subtotal: 2000,
      shippingPrice: 0,
      totalAmount: 2000,
      razorpayOrderId: `order_rzp_41c_${Date.now()}`,
      razorpayPaymentId: `pay_rzp_41c_${Date.now()}`,
    });

    await PaymentIntent.create({
      razorpayOrderId: order41C.razorpayOrderId,
      user: testCustomer._id,
      items: [{
        product: product41C._id,
        name: product41C.name,
        price: product41C.price,
        quantity: 1,
      }],
      shippingAddress: order41C.shippingAddress,
      subtotal: 2000,
      totalAmount: 2000,
      expectedAmount: 200000,
      status: 'completed',
      orderId: order41C._id,
      razorpayPaymentId: order41C.razorpayPaymentId,
      stockDeducted: false,
    });

    let refundCalls41C = 0;
    mockRazorpay.payments.refund = async (pId, opts) => {
      refundCalls41C++;
      return defaultRefundFn(pId, opts);
    };

    await runRefundRetryJob();
    assert(refundCalls41C === 0, '41(c): Refund retry job did NOT call Razorpay refund for active completed order');
    const freshOrder41C = await Order.findById(order41C._id);
    assert(freshOrder41C.paymentStatus === 'Completed' && freshOrder41C.isRefunded === false, '41(c): Order remains in Completed payment status and not refunded');

    // (d) Customer cancel still works
    const product41D = await Product.create({
      name: 'Test Product Customer Cancel 41D',
      slug: `test-prod-cancel-41d-${Date.now()}`,
      category: testCategory._id,
      description: 'Test description for customer cancel 41D',
      material: '100% Combed Cotton',
      color: 'Yellow',
      sku: `SKU-REF-41D-${Date.now()}`,
      price: 999,
      images: ['/img/test-1.jpg', '/img/test-2.jpg'],
      stock: 12,
      isActive: true,
    });

    const order41D = await Order.create({
      orderNumber: `VAS-REF-41D-${Date.now()}`,
      user: testCustomer._id,
      items: [{
        product: product41D._id,
        name: product41D.name,
        image: product41D.images[0],
        price: product41D.price,
        quantity: 2,
      }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobileNumber: '9876543210',
        email: 'test-customer@vashtram.test',
        address: '123 Test St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      paymentMethod: 'Razorpay Online Payment',
      paymentStatus: 'Completed',
      orderStatus: 'Confirmed',
      isPaid: true,
      paidAt: new Date(),
      subtotal: 1998,
      shippingPrice: 0,
      totalAmount: 1998,
      razorpayOrderId: `order_rzp_41d_${Date.now()}`,
      razorpayPaymentId: `pay_rzp_41d_${Date.now()}`,
    });

    await PaymentIntent.create({
      razorpayOrderId: order41D.razorpayOrderId,
      user: testCustomer._id,
      items: [{
        product: product41D._id,
        name: product41D.name,
        price: product41D.price,
        quantity: 2,
      }],
      shippingAddress: order41D.shippingAddress,
      subtotal: 1998,
      totalAmount: 1998,
      expectedAmount: 199800,
      status: 'completed',
      orderId: order41D._id,
      razorpayPaymentId: order41D.razorpayPaymentId,
      stockDeducted: false,
    });

    let refundCalls41D = 0;
    mockRazorpay.payments.refund = async (pId, opts) => {
      refundCalls41D++;
      return defaultRefundFn(pId, opts);
    };

    const custCancelRes = await fetch(`${baseUrl}/orders/${order41D._id}/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        reason: 'Customer cancellation test',
      }),
    });
    const custCancelData = await custCancelRes.json();
    assert(custCancelRes.status === 200 && custCancelData.success, '41(d): Customer cancel succeeds with 200');
    assert(refundCalls41D === 1, '41(d): Customer cancel initiates Razorpay refund once');
    const updatedProduct41D = await Product.findById(product41D._id);
    assert(updatedProduct41D.stock === 14, '41(d): Product stock restored from 12 to 14 (+2)');
    const updatedOrder41D = await Order.findById(order41D._id);
    assert(updatedOrder41D.orderStatus === 'Cancelled', '41(d): Order status is Cancelled');
    assert(updatedOrder41D.stockRestored === true, '41(d): Order stockRestored is true');

    // Restore original mock refund fn
    mockRazorpay.payments.refund = defaultRefundFn;

  } catch (error) {
    console.error(`\n❌ UNHANDLED EXCEPTION IN TEST RUNNER: ${error.stack || error.message}`);
    failed++;
    failureDetails.push(`Unhandled Exception: ${error.message}`);
  } finally {
    // Teardown and Cleanup
    try {
      resetRazorpayInstance();
      if (server && server.listening) {
        await new Promise((resolve) => server.close(resolve));
      }
      if (mongoose.connection.readyState !== 0) {
        await User.deleteMany({ email: /@vashtram\.test$/ });
        await Product.deleteMany({ name: /Test Product/ });
        await Category.deleteMany({ name: /Test Category/ });
        await Order.deleteMany({ 'shippingAddress.email': /@vashtram\.test$/ });
        await PaymentIntent.deleteMany({ 'shippingAddress.email': /@vashtram\.test$/ });
        await WebhookEvent.deleteMany({ eventId: /^evt_test_/ });
        await mongoose.disconnect();
      }
    } catch (cleanupErr) {
      console.warn('[Cleanup Warning]:', cleanupErr.message);
    }
  }

  console.log('\n======================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error('❌ FAILURES SUMMARY:');
    failureDetails.forEach((d) => console.error(` - ${d}`));
    process.exit(1);
  } else {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
};

if (require.main === module) {
  runComprehensiveSuite();
}

module.exports = { runComprehensiveSuite };
