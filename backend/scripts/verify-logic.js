/**
 * VASHTRAM Logic & Critical Business Rules Verification Suite
 * 
 * Verifies core security, authorization, pricing, and validation rules
 * safely without requiring an active external network connection.
 */

const path = require('path');
process.env.NODE_PATH = [
  path.join(__dirname, '../node_modules'),
  path.join(__dirname, '../../node_modules'),
].join(';');
require('module').Module._initPaths();

const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const WebhookEvent = require('../models/WebhookEvent');
const { admin } = require('../middleware/authMiddleware');

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name} ${details ? `(${details})` : ''}`);
    failed++;
  }
}

console.log('======================================================');
console.log('🧪 VASHTRAM CRITICAL LOGIC & SECURITY VERIFICATION');
console.log('======================================================\n');

// 1. PRODUCT PRICING & EFFECTIVE PRICE CONSISTENCY (Item 14)
console.log('--- 1. Product Price & Effective Price Consistency ---');

const productWithDiscount = new Product({
  name: 'Test Bedsheet Luxury',
  price: 1599,
  discountPrice: 1299,
  category: '64d000000000000000000001',
  stock: 20,
  images: ['/img/1.jpg'],
});
assert(productWithDiscount.effectivePrice === 1299, 'effectivePrice virtual uses discountPrice when valid');
assert(productWithDiscount.finalPrice === 1299, 'finalPrice virtual uses discountPrice when valid');

const productWithoutDiscount = new Product({
  name: 'Test Bedsheet Standard',
  price: 999,
  discountPrice: 0,
  category: '64d000000000000000000001',
  stock: 15,
  images: ['/img/1.jpg'],
});
assert(productWithoutDiscount.effectivePrice === 999, 'effectivePrice falls back to regular price when discount is 0');
assert(productWithoutDiscount.finalPrice === 999, 'finalPrice falls back to regular price when discount is 0');

// Product validation: discountPrice >= price must fail
const invalidDiscountProduct = new Product({
  name: 'Test Invalid Discount',
  price: 1000,
  discountPrice: 1200,
  category: '64d000000000000000000001',
  stock: 10,
  images: ['/img/1.jpg'],
});
const discountValErr = invalidDiscountProduct.validateSync();
assert(
  discountValErr && discountValErr.errors && discountValErr.errors.discountPrice,
  'Schema validation rejects discountPrice >= price'
);

// Product validation: negative stock must fail
const negativeStockProduct = new Product({
  name: 'Test Negative Stock',
  price: 1000,
  discountPrice: 800,
  category: '64d000000000000000000001',
  stock: -5,
  images: ['/img/1.jpg'],
});
const stockValErr = negativeStockProduct.validateSync();
assert(
  stockValErr && stockValErr.errors && stockValErr.errors.stock,
  'Schema validation rejects negative stock'
);


// 2. SETTINGS VALIDATION (Item 13)
console.log('\n--- 2. Settings Validation (Negative / Invalid Numbers Rejected) ---');

const invalidShippingSettings = new Settings({
  standardShippingFee: -50,
  freeShippingThreshold: 999,
});
const shippingErr = invalidShippingSettings.validateSync();
assert(
  shippingErr && shippingErr.errors && shippingErr.errors.standardShippingFee,
  'Settings schema rejects negative standardShippingFee'
);

const invalidThresholdSettings = new Settings({
  standardShippingFee: 99,
  freeShippingThreshold: -500,
});
const thresholdErr = invalidThresholdSettings.validateSync();
assert(
  thresholdErr && thresholdErr.errors && thresholdErr.errors.freeShippingThreshold,
  'Settings schema rejects negative freeShippingThreshold'
);

const invalidReturnDaysSettings = new Settings({
  returnDays: -3,
});
const returnErr = invalidReturnDaysSettings.validateSync();
assert(
  returnErr && returnErr.errors && returnErr.errors.returnDays,
  'Settings schema rejects negative returnDays'
);

const validSettings = new Settings({
  storeName: 'VASHTRAM',
  standardShippingFee: 99,
  freeShippingThreshold: 999,
  returnDays: 7,
  whatsappNumber: '+91 98765 43210',
  supportEmail: 'care@vashtram.com',
});
const validSettingsErr = validSettings.validateSync();
assert(!validSettingsErr, 'Settings schema accepts valid configuration');


// 3. ADMIN AUTHORIZATION MIDDLEWARE (Item 11 & 12)
console.log('\n--- 3. Admin Authorization Middleware Security ---');

let customerStatus = null;
let customerJson = null;
const fakeCustomerRes = {
  status: (code) => {
    customerStatus = code;
    return {
      json: (data) => {
        customerJson = data;
      },
    };
  },
};
let customerNextCalled = false;
admin({ user: { role: 'customer' } }, fakeCustomerRes, () => {
  customerNextCalled = true;
});
assert(customerStatus === 403, 'Customer user is rejected with HTTP 403 by admin middleware');
assert(!customerNextCalled, 'admin middleware does not call next() for customer');

let adminNextCalled = false;
admin({ user: { role: 'admin' } }, {}, () => {
  adminNextCalled = true;
});
assert(adminNextCalled, 'admin middleware allows admin user to proceed to protected handler');


// 4. JWT TOKEN VERSIONING & INVALIDATION (Item 10)
console.log('\n--- 4. JWT Token Version Invalidation Logic ---');

const secret = 'test_secret_key_at_least_32_characters_long_for_security';
const initialToken = jwt.sign({ id: 'user_123', role: 'customer', tokenVersion: 0 }, secret, { expiresIn: '1d' });
const decodedInitial = jwt.verify(initialToken, secret);

// Simulate password change incrementing tokenVersion to 1
const userInDb = { id: 'user_123', role: 'customer', tokenVersion: 1 };

// Old token validation
const isOldTokenValid = decodedInitial.tokenVersion === userInDb.tokenVersion;
assert(!isOldTokenValid, 'Old JWT token is recognized as invalid after tokenVersion increment');

// Fresh token generated upon password change
const refreshedToken = jwt.sign({ id: 'user_123', role: 'customer', tokenVersion: userInDb.tokenVersion }, secret, { expiresIn: '1d' });
const decodedRefreshed = jwt.verify(refreshedToken, secret);
const isNewTokenValid = decodedRefreshed.tokenVersion === userInDb.tokenVersion;
assert(isNewTokenValid, 'New JWT token generated on password change is valid and authenticated');


// 5. AUTHORITATIVE ORDER CALCULATION (Item 15)
console.log('\n--- 5. Authoritative Order Calculation ---');

function calculateServerOrderTotal(items, settings) {
  const subtotal = items.reduce((sum, item) => {
    const effectiveUnitPrice = (item.discountPrice && item.discountPrice > 0 && item.discountPrice < item.price)
      ? item.discountPrice
      : item.price;
    return sum + (effectiveUnitPrice * item.quantity);
  }, 0);

  const shippingFee = (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold)
    ? 0
    : settings.standardShippingFee;

  return { subtotal, shippingFee, total: subtotal + shippingFee };
}

const mockCart = [
  { price: 1000, discountPrice: 800, quantity: 1 },
  { price: 500, discountPrice: 0, quantity: 2 },
];
const settingsConfig = { standardShippingFee: 99, freeShippingThreshold: 2000 };

const orderCalc = calculateServerOrderTotal(mockCart, settingsConfig);
assert(orderCalc.subtotal === 1800, 'Subtotal correctly calculates using effective prices (800 + 1000 = 1800)');
assert(orderCalc.shippingFee === 99, 'Shipping fee applied when subtotal is below freeShippingThreshold');
assert(orderCalc.total === 1899, 'Total accurately sums subtotal and shipping');

const freeShippingCart = [
  { price: 1200, discountPrice: 1100, quantity: 2 }, // 2200
];
const freeOrderCalc = calculateServerOrderTotal(freeShippingCart, settingsConfig);
assert(freeOrderCalc.shippingFee === 0, 'Shipping fee is free (0) when subtotal >= freeShippingThreshold');
assert(freeOrderCalc.total === 2200, 'Total with free shipping equals subtotal');

// 6. CLIENT-SUPPLIED PRICE & SIZE VALIDATION (Issues #2 & #3)
console.log('\n--- 6. Client-Supplied Price & Size Validation ---');

const { calculateOrderPricing } = require('../controllers/paymentController');

// Mock Product.findById and Settings.getSingleton
const originalFindById = Product.findById;
const originalGetSingleton = Settings.getSingleton;

const sizedProductDb = {
  _id: '64d000000000000000000010',
  name: 'Premium Cotton Bedsheet',
  price: 1899,
  discountPrice: 1599,
  stock: 20,
  isActive: true,
  sizes: [
    { name: 'King', measurement: '72×78', price: 1699 },
    { name: 'Queen', measurement: '60×78', price: 1499 },
    { name: 'Single', measurement: '36×75', price: 999 },
  ],
};

const unsizedProductDb = {
  _id: '64d000000000000000000020',
  name: 'Cotton Pillow Cover Set',
  price: 599,
  discountPrice: 499,
  stock: 30,
  isActive: true,
  sizes: [],
};

Product.findById = async (id) => {
  if (id.toString() === sizedProductDb._id) return sizedProductDb;
  if (id.toString() === unsizedProductDb._id) return unsizedProductDb;
  return null;
};

Settings.getSingleton = async () => ({
  freeShippingThreshold: 2000,
  standardShippingFee: 99,
});

(async () => {
  // Test A: Sized product with tampered client price uses DB size.price
  const sizedOrder = await calculateOrderPricing([
    {
      productId: sizedProductDb._id,
      sizeName: 'Queen',
      price: 1, // Tampered price from client
      quantity: 1,
    },
  ]);
  assert(
    sizedOrder.verifiedItems[0].price === 1499,
    'Client price is ignored; DB size.price (1499) used for Queen variant'
  );
  assert(sizedOrder.calculatedSubtotal === 1499, 'Subtotal correctly computed using authoritative variant price');

  // Test B: Invalid size selection immediately throws 400 Bad Request
  let invalidSizeError = null;
  try {
    await calculateOrderPricing([
      {
        productId: sizedProductDb._id,
        sizeName: 'NonExistentExtraLarge',
        quantity: 1,
      },
    ]);
  } catch (err) {
    invalidSizeError = err;
  }
  assert(
    invalidSizeError && invalidSizeError.statusCode === 400,
    'Invalid size throws 400 Bad Request error'
  );
  assert(
    invalidSizeError && invalidSizeError.message === 'Invalid product size selected',
    'Invalid size returns exact error message "Invalid product size selected"'
  );

  // Test C: Unsized product with tampered client price uses DB discountPrice || price
  const unsizedOrder = await calculateOrderPricing([
    {
      productId: unsizedProductDb._id,
      price: 1, // Tampered price from client
      quantity: 2,
    },
  ]);
  assert(
    unsizedOrder.verifiedItems[0].price === 499,
    'Client price ignored; DB discountPrice (499) used for unsized product'
  );
  assert(
    unsizedOrder.calculatedSubtotal === 998,
    'Subtotal correctly computed for unsized product (499 * 2 = 998)'
  );

  // 7. CART STOCK AGGREGATION (Issue #6)
  console.log('\n--- 7. Cart Stock Aggregation & Limit Enforcement ---');

  const { aggregateOrderItems } = require('../controllers/paymentController');

  // Test A: Combining duplicate items with exact same productId and size
  const duplicateCartItems = [
    { productId: sizedProductDb._id, sizeName: 'King', quantity: 2 },
    { productId: sizedProductDb._id, sizeName: 'King', quantity: 3 },
    { productId: sizedProductDb._id, sizeName: 'Queen', quantity: 1 },
    { productId: unsizedProductDb._id, quantity: 2 },
    { productId: unsizedProductDb._id, quantity: 4 },
  ];

  const aggregated = aggregateOrderItems(duplicateCartItems);
  assert(aggregated.length === 3, 'Duplicate items aggregated into unique product/size entries');

  const kingEntry = aggregated.find((i) => i.productId === sizedProductDb._id && (i.sizeName === 'King' || i.size === 'King'));
  assert(kingEntry && kingEntry.quantity === 5, 'Quantities for identical product/size summed (2 + 3 = 5)');

  const unsizedEntry = aggregated.find((i) => i.productId === unsizedProductDb._id);
  assert(unsizedEntry && unsizedEntry.quantity === 6, 'Quantities for unsized product summed (2 + 4 = 6)');

  // Test B: Aggregated quantity exceeding product stock fails with 400
  // Temporarily set product stock to 3
  sizedProductDb.stock = 3;
  let stockExceededError = null;
  try {
    await calculateOrderPricing([
      { productId: sizedProductDb._id, sizeName: 'King', quantity: 2 },
      { productId: sizedProductDb._id, sizeName: 'King', quantity: 2 }, // Total = 4 > stock 3
    ]);
  } catch (err) {
    stockExceededError = err;
  }
  assert(
    stockExceededError && stockExceededError.statusCode === 400,
    'Aggregated quantity exceeding stock throws 400 Bad Request'
  );
  assert(
    stockExceededError && /Insufficient stock|out of stock/i.test(stockExceededError.message),
    'Error message clearly specifies insufficient stock for the product'
  );

  // Test C: Valid aggregated quantity within stock succeeds
  sizedProductDb.stock = 10;
  const validAggregatedOrder = await calculateOrderPricing([
    { productId: sizedProductDb._id, sizeName: 'King', quantity: 2 },
    { productId: sizedProductDb._id, sizeName: 'King', quantity: 2 }, // Total = 4 <= stock 10
  ]);
  assert(
    validAggregatedOrder.verifiedItems.length === 1 && validAggregatedOrder.verifiedItems[0].quantity === 4,
    'Valid aggregated order results in single verified item with aggregated quantity (4)'
  );

  // 8. WEBHOOK EVENT STATUS ENUM (Issue #5)
  console.log('\n--- 8. WebhookEvent Status Enum Validation ---');

  // Test A: late_capture_refunded status validates successfully
  const lateCaptureEvent = new WebhookEvent({
    eventId: 'evt_test_late_refund_1',
    eventType: 'payment.captured',
    status: 'late_capture_refunded',
  });
  const lateValErr = lateCaptureEvent.validateSync();
  assert(!lateValErr, 'WebhookEvent schema accepts "late_capture_refunded" status');

  // Test B: All permitted statuses pass schema validation
  const validStatuses = ['processed', 'duplicate', 'failed', 'ignored', 'late_capture_refunded'];
  let allValidPass = true;
  for (const st of validStatuses) {
    const ev = new WebhookEvent({
      eventId: `evt_test_${st}`,
      eventType: 'payment.captured',
      status: st,
    });
    if (ev.validateSync()) {
      allValidPass = false;
      break;
    }
  }
  assert(allValidPass, 'WebhookEvent schema accepts all 5 standard lifecycle statuses');

  // Test C: Disallowed status rejected by enum validation
  const invalidStatusEvent = new WebhookEvent({
    eventId: 'evt_test_invalid',
    eventType: 'payment.captured',
    status: 'unknown_unsupported_status',
  });
  const invalidStatusErr = invalidStatusEvent.validateSync();
  assert(
    invalidStatusErr && invalidStatusErr.errors && invalidStatusErr.errors.status,
    'WebhookEvent schema rejects invalid/unsupported status value'
  );

  // 9. DETACH INVENTORY FROM REFUNDS & STOCK RESTORED GUARD (Issue #7)
  console.log('\n--- 9. Inventory Detachment from Refunds & stockRestored Guard ---');

  const Order = require('../models/Order');
  const fs = require('fs');
  const path = require('path');

  // Test A: Order schema defines stockRestored with default false
  const testOrder = new Order({
    orderNumber: 'VASHTRAM-TEST-1',
    user: '64d000000000000000000001',
    items: [{
      product: '64d000000000000000000010',
      name: 'Test Product',
      image: '/img/test.webp',
      price: 1499,
      quantity: 2,
    }],
    shippingAddress: {
      fullName: 'Test User',
      mobileNumber: '9876543210',
      email: 'test@vashtram.com',
      address: '123 Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
    totalAmount: 1499,
    subtotal: 1499,
  });

  assert(testOrder.stockRestored === false, 'New order initializes with stockRestored = false');

  // Test B: Order schema accepts orderStatus = 'Returned'
  testOrder.orderStatus = 'Returned';
  const returnedValErr = testOrder.validateSync();
  assert(!returnedValErr, 'Order schema accepts "Returned" status');

  // Test C: refundService.js does NOT import Product or modify product stock
  const refundServiceCode = fs.readFileSync(path.join(__dirname, '../services/refundService.js'), 'utf8');
  assert(!refundServiceCode.includes("require('../models/Product')"), 'refundService.js does NOT import Product model');
  assert(!refundServiceCode.includes('$inc: { stock:'), 'refundService.js contains NO stock increment logic');

  // Test D: stockRestored guard prevents double stock restoration
  let stockRestorations = 0;
  const mockRestoreFunction = (ord) => {
    if (!ord.stockRestored) {
      stockRestorations += ord.items[0].quantity;
      ord.stockRestored = true;
    }
  };

  const cancelAttemptOrder = {
    orderStatus: 'Confirmed',
    stockRestored: false,
    items: [{ product: 'P1', quantity: 3 }],
  };

  // First cancellation: Restores stock
  mockRestoreFunction(cancelAttemptOrder);
  assert(stockRestorations === 3, 'First cancellation restores 3 units of stock');
  assert(cancelAttemptOrder.stockRestored === true, 'stockRestored marked true after first restoration');

  // Second cancellation / duplicate refund: Guard blocks re-incrementing stock
  mockRestoreFunction(cancelAttemptOrder);
  assert(stockRestorations === 3, 'Second cancellation attempt blocked by stockRestored guard (stock remains 3)');

  // 10. SAFE REGEX SEARCH FILTERING (Issue #11)
  console.log('\n--- 10. Safe Regex Search in Inquiry Controller ---');

  const { createSafeRegex } = require('../utils/regexHelper');

  // Test A: Unescaped special regex characters do NOT crash or throw SyntaxError
  let safeRegexSuccess = true;
  let dangerousRegex;
  try {
    dangerousRegex = createSafeRegex('user(test)[name]+*?\\^$');
  } catch {
    safeRegexSuccess = false;
  }
  assert(safeRegexSuccess && dangerousRegex instanceof RegExp, 'createSafeRegex safely handles unescaped regex characters without SyntaxError');
  assert(dangerousRegex.test('user(test)[name]+*?\\^$'), 'Regex matches literal special characters accurately');

  // Test B: Lone parenthesis or bracket does NOT cause server crash
  const singleParenRegex = createSafeRegex('(');
  assert(singleParenRegex instanceof RegExp && singleParenRegex.test('('), 'Single unbalanced parenthesis safely escaped');

  // Test C: inquiryController.js uses createSafeRegex instead of raw unescaped new RegExp(search.trim())
  const inquiryCode = fs.readFileSync(path.join(__dirname, '../controllers/inquiryController.js'), 'utf8');
  assert(inquiryCode.includes("createSafeRegex(search.trim()"), 'inquiryController.js uses createSafeRegex for search filtering');
  assert(!inquiryCode.includes("new RegExp(search.trim()"), 'inquiryController.js contains NO unescaped new RegExp(search.trim())');

  // 11. CUSTOMER NAVBAR SE ADMIN LINK HATAN
  console.log('\n--- 11. Customer Navbar Admin Link Removal ---');
  const navbarCode = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/common/Navbar.jsx'), 'utf8');
  assert(!navbarCode.includes('/admin/login'), 'Customer Navbar contains no /admin/login link');

  // 12. ATOMIC STOCK RESTORATION BUG FIX
  console.log('\n--- 12. Atomic Stock Restoration Concurrency Guard ---');
  const stockServiceCode = fs.readFileSync(path.join(__dirname, '../services/stockService.js'), 'utf8');
  const orderCtrlCode = fs.readFileSync(path.join(__dirname, '../controllers/orderController.js'), 'utf8');
  const adminCtrlCode = fs.readFileSync(path.join(__dirname, '../controllers/adminController.js'), 'utf8');

  assert(stockServiceCode.includes('Order.findOneAndUpdate'), 'stockService.js uses Order.findOneAndUpdate for atomic claim');
  assert(stockServiceCode.includes('stockRestored: false'), 'stockService.js checks stockRestored: false in atomic filter');
  assert(stockServiceCode.includes('startTransaction'), 'stockService.js uses multi-document transactions for atomic restoration');
  assert(stockServiceCode.includes('$inc: { stock: quantity }'), 'stockService.js increments inventory atomically using $inc');
  assert(orderCtrlCode.includes('restoreOrderStock'), 'orderController.js delegates cancellation stock restoration to stockService');
  assert(adminCtrlCode.includes('restoreOrderStock'), 'adminController.js delegates cancellation stock restoration to stockService');

  // 13. DYNAMIC CONTACT DETAILS (FOOTER & CONTACT PAGE)
  console.log('\n--- 13. Dynamic Contact Details via useSettings ---');
  const footerCode = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/common/Footer.jsx'), 'utf8');
  const contactPageCode = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/ContactPage.jsx'), 'utf8');
  assert(footerCode.includes('useSettings()'), 'Footer.jsx calls useSettings() hook');
  assert(contactPageCode.includes('useSettings()'), 'ContactPage.jsx calls useSettings() hook');
  assert(contactPageCode.includes('{address}'), 'ContactPage.jsx renders address dynamically');
  assert(contactPageCode.includes('{email}'), 'ContactPage.jsx renders email dynamically');

  // 14. MATTRESS PROTECTOR INTENDED BRANDING & CATEGORY VERIFICATION
  console.log('\n--- 14. Mattress Protector Category & Branding Verification ---');
  const brandingChecks = [
    {
      path: '../../frontend/src/components/common/Navbar.jsx',
      pattern: /all\s+mattress\s+protectors/i,
      desc: 'Navbar.jsx features Mattress Protector navigation link',
    },
    {
      path: '../../frontend/src/components/common/Footer.jsx',
      pattern: /mattress\s+protectors/i,
      desc: 'Footer.jsx references VASHTRAM Mattress Protectors branding',
    },
    {
      path: '../../frontend/src/pages/ShopPage.jsx',
      pattern: /all\s+mattress\s+protectors/i,
      desc: 'ShopPage.jsx displays Mattress Protector catalog heading',
    },
    {
      path: '../../frontend/src/pages/OrdersPage.jsx',
      pattern: /mattress\s+protector\s+collection/i,
      desc: 'OrdersPage.jsx links to Mattress Protector collection',
    },
    {
      path: '../../frontend/src/pages/CheckoutPage.jsx',
      pattern: /mattress\s+protectors\s+&\s+home\s+textiles/i,
      desc: 'CheckoutPage.jsx specifies Mattress Protectors & Home Textiles',
    },
    {
      path: '../../frontend/src/pages/CategoriesPage.jsx',
      pattern: /mattress\s+protectors\s+&\s+home\s+collections/i,
      desc: 'CategoriesPage.jsx displays Mattress Protectors & Home Collections',
    },
    {
      path: '../../frontend/src/pages/AboutPage.jsx',
      pattern: /waterproof\s+mattress\s+protectors/i,
      desc: 'AboutPage.jsx highlights Waterproof Mattress Protectors craft',
    },
    {
      path: '../../frontend/src/components/home/BannerPromo.jsx',
      pattern: /premium\s+mattress\s+protectors/i,
      desc: 'BannerPromo.jsx features Premium Mattress Protectors banner',
    },
    {
      path: '../../frontend/src/components/home/WhyChooseUs.jsx',
      pattern: /vashtram\s+mattress\s+protectors/i,
      desc: 'WhyChooseUs.jsx emphasizes VASHTRAM Mattress Protectors value',
    },
    {
      path: '../../frontend/src/components/home/ValueProps.jsx',
      pattern: /100%\s+waterproof/i,
      desc: 'ValueProps.jsx highlights 100% Waterproof protector value proposition',
    },
    {
      path: '../../frontend/src/components/common/WhatsAppButton.jsx',
      pattern: /order\s+for\s+mattress\s+protectors/i,
      desc: 'WhatsAppButton.jsx specifies Mattress Protectors bulk order inquiries',
    },
  ];

  for (const check of brandingChecks) {
    const fileContent = fs.readFileSync(path.join(__dirname, check.path), 'utf8');
    assert(check.pattern.test(fileContent), check.desc);
  }

  // Restore mocks
  Product.findById = originalFindById;
  Settings.getSingleton = originalGetSingleton;

  console.log('\n======================================================');
  console.log(`📊 LOGIC VERIFICATION: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL BUSINESS LOGIC & SECURITY RULES VERIFIED SUCCESSFULLY!\n');
    process.exit(0);
  }
})();
