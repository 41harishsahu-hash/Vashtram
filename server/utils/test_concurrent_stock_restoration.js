const assert = require('assert');
const path = require('path');

// Test Suite for VASHTRAM Concurrent Stock Restoration
console.log('=== VASHTRAM CONCURRENT STOCK RESTORATION TEST SUITE ===\n');

// 1. In-memory Mock Database to test concurrency and atomic operations
class MockDatabase {
  constructor() {
    this.orders = new Map();
    this.products = new Map();
    this.orderIdCounter = 1000;
  }

  createProduct({ name, stock }) {
    const id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const product = { _id: id, name, stock: Number(stock) || 0 };
    this.products.set(id, product);
    return { ...product };
  }

  createOrder({ items, orderStatus = 'Confirmed', paymentStatus = 'Completed', stockRestored = false }) {
    const id = `ord_${++this.orderIdCounter}`;
    const order = {
      _id: id,
      orderNumber: `ORD-${id}`,
      items: items.map((it) => ({
        product: it.product._id || it.product,
        name: it.name || 'Sample Product',
        quantity: it.quantity || 1,
      })),
      orderStatus,
      paymentStatus,
      stockRestored,
      stockRestoredAt: null,
      statusHistory: [],
    };
    this.orders.set(id, order);
    return { ...order };
  }

  // Atomic findOneAndUpdate simulation (matches MongoDB's single-document atomic write lock)
  async orderFindOneAndUpdate(filter, update, options = {}) {
    // Atomic synchronization: synchronous block simulates Mongo engine row-level mutex
    const orderId = filter._id ? filter._id.toString() : null;
    const order = this.orders.get(orderId);
    if (!order) return null;

    if (filter.stockRestored !== undefined && order.stockRestored !== filter.stockRestored) {
      return null; // Condition not met
    }

    if (update.$set) {
      Object.assign(order, update.$set);
    }
    return options.new ? { ...order } : order;
  }

  async productFindByIdAndUpdate(id, update, options = {}) {
    const prodId = id ? id.toString() : null;
    const product = this.products.get(prodId);
    if (!product) return null; // Product no longer exists

    if (update.$inc && update.$inc.stock !== undefined) {
      product.stock += update.$inc.stock;
    }
    return options.new ? { ...product } : product;
  }

  getProductStock(id) {
    const prod = this.products.get(id);
    return prod ? prod.stock : null;
  }

  getOrder(id) {
    const ord = this.orders.get(id);
    return ord ? { ...ord } : null;
  }
}

// Implement Stock Restoration function using the mock DB
async function runRestoreStock(db, orderOrId, options = {}) {
  if (!orderOrId) {
    return { success: false, restored: false, reason: 'NO_ORDER_PROVIDED' };
  }

  const orderId = orderOrId._id ? orderOrId._id.toString() : orderOrId.toString();

  // 1. ATOMIC CLAIM: Exactly one concurrent caller can change stockRestored: false -> true
  const claimedOrder = await db.orderFindOneAndUpdate(
    { _id: orderId, stockRestored: false },
    { $set: { stockRestored: true, stockRestoredAt: new Date() } },
    { new: true }
  );

  // 2. If claim failed, stock was already restored or claimed by concurrent request
  if (!claimedOrder) {
    if (typeof orderOrId === 'object' && orderOrId !== null) {
      orderOrId.stockRestored = true;
    }
    const existing = db.getOrder(orderId);
    if (!existing) {
      return { success: false, restored: false, reason: 'ORDER_NOT_FOUND' };
    }
    return { success: true, restored: false, reason: 'ALREADY_RESTORED', orderId };
  }

  if (typeof orderOrId === 'object' && orderOrId !== null) {
    orderOrId.stockRestored = true;
    orderOrId.stockRestoredAt = claimedOrder.stockRestoredAt;
  }

  // 3. EXECUTE INVENTORY RESTORATION
  const restoredItems = [];
  const missingProducts = [];
  const items = claimedOrder.items || (orderOrId.items ? orderOrId.items : []);

  for (const item of items) {
    if (!item || !item.product) continue;
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) continue;

    const productId = item.product._id ? item.product._id : item.product;

    const updated = await db.productFindByIdAndUpdate(
      productId,
      { $inc: { stock: quantity } },
      { new: true }
    );

    if (updated) {
      restoredItems.push({ productId: productId.toString(), quantity, newStock: updated.stock });
    } else {
      missingProducts.push({ productId: productId.toString(), quantity });
    }
  }

  return {
    success: true,
    restored: true,
    orderId: claimedOrder._id.toString(),
    orderNumber: claimedOrder.orderNumber,
    restoredItems,
    missingProducts,
  };
}

async function runAllTests() {
  const db = new MockDatabase();

  // TEST 1: Normal Cancellation
  console.log('--- Test 1: Normal Cancellation ---');
  const p1 = db.createProduct({ name: 'Egyptian Cotton King Bedsheet', stock: 10 });
  const o1 = db.createOrder({ items: [{ product: p1, quantity: 2 }] });
  assert.strictEqual(db.getProductStock(p1._id), 10);

  const res1 = await runRestoreStock(db, o1);
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.restored, true);
  assert.strictEqual(db.getProductStock(p1._id), 12, 'Stock should increase from 10 to 12');
  assert.strictEqual(db.getOrder(o1._id).stockRestored, true);
  console.log('✓ PASS: Normal cancellation restores stock by quantity=2 (Stock: 10 -> 12)');

  // TEST 2: Repeated Cancellation
  console.log('\n--- Test 2: Repeated Cancellation ---');
  const res2 = await runRestoreStock(db, o1);
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.restored, false, 'Repeated cancellation must NOT restore stock again');
  assert.strictEqual(res2.reason, 'ALREADY_RESTORED');
  assert.strictEqual(db.getProductStock(p1._id), 12, 'Stock must stay 12, not increment again');
  console.log('✓ PASS: Repeated cancellation skips restoration (Stock remains 12)');

  // TEST 3: Two Simultaneous Cancellation Attempts (Race Condition Test)
  console.log('\n--- Test 3: Two Simultaneous Cancellation Attempts ---');
  const p3 = db.createProduct({ name: 'Sateen Fitted Sheet', stock: 20 });
  const o3 = db.createOrder({ items: [{ product: p3, quantity: 3 }] });
  assert.strictEqual(db.getProductStock(p3._id), 20);

  // Fire both requests concurrently
  const [race1, race2] = await Promise.all([
    runRestoreStock(db, o3),
    runRestoreStock(db, o3),
  ]);

  const restoredCount = (race1.restored ? 1 : 0) + (race2.restored ? 1 : 0);
  assert.strictEqual(restoredCount, 1, 'Exactly ONE request must succeed in restoring stock');
  assert.strictEqual(db.getProductStock(p3._id), 23, 'Stock must be incremented by 3 exactly once (20 -> 23)');
  console.log('✓ PASS: Simultaneous race condition handled: exactly 1 claim won, stock restored once (Stock: 20 -> 23)');

  // TEST 4: Admin Cancellation
  console.log('\n--- Test 4: Admin Cancellation ---');
  const p4 = db.createProduct({ name: 'Linen Duvet', stock: 5 });
  const o4 = db.createOrder({ items: [{ product: p4, quantity: 4 }], orderStatus: 'Confirmed' });
  const res4 = await runRestoreStock(db, o4, { reason: 'Order cancelled by Admin' });
  assert.strictEqual(res4.success, true);
  assert.strictEqual(res4.restored, true);
  assert.strictEqual(db.getProductStock(p4._id), 9, 'Stock should increase from 5 to 9');
  console.log('✓ PASS: Admin cancellation restores stock once (Stock: 5 -> 9)');

  // TEST 5: Refund Retry
  console.log('\n--- Test 5: Refund Retry ---');
  // First refund attempt restored stock
  const p5 = db.createProduct({ name: 'Waterproof Sheet', stock: 15 });
  const o5 = db.createOrder({ items: [{ product: p5, quantity: 2 }] });
  await runRestoreStock(db, o5);
  assert.strictEqual(db.getProductStock(p5._id), 17);

  // Subsequent refund retry
  const res5 = await runRestoreStock(db, o5, { reason: 'Refund retry succeeded' });
  assert.strictEqual(res5.restored, false, 'Refund retry must NOT double restore');
  assert.strictEqual(res5.reason, 'ALREADY_RESTORED');
  assert.strictEqual(db.getProductStock(p5._id), 17);
  console.log('✓ PASS: Refund retry on already restored order safely skips (Stock: 17)');

  // TEST 6: Already-Restored Stock Flag Pre-set
  console.log('\n--- Test 6: Already-Restored Stock Flag Pre-set ---');
  const p6 = db.createProduct({ name: 'Pillow Cover Pair', stock: 30 });
  const o6 = db.createOrder({ items: [{ product: p6, quantity: 5 }], stockRestored: true });
  const res6 = await runRestoreStock(db, o6);
  assert.strictEqual(res6.restored, false);
  assert.strictEqual(res6.reason, 'ALREADY_RESTORED');
  assert.strictEqual(db.getProductStock(p6._id), 30);
  console.log('✓ PASS: Pre-restored order is untouched');

  // TEST 7: Product No Longer Exists (Graceful Handling)
  console.log('\n--- Test 7: Product No Longer Exists ---');
  const p7Existing = db.createProduct({ name: 'Active Product', stock: 8 });
  const o7 = db.createOrder({
    items: [
      { product: p7Existing, quantity: 2 },
      { product: 'prod_deleted_from_catalog', quantity: 3 }, // Deleted product
    ],
  });

  const res7 = await runRestoreStock(db, o7);
  assert.strictEqual(res7.success, true);
  assert.strictEqual(res7.restored, true);
  assert.strictEqual(res7.restoredItems.length, 1, 'Only active product restored');
  assert.strictEqual(res7.missingProducts.length, 1, 'Deleted product recorded in missingProducts');
  assert.strictEqual(db.getProductStock(p7Existing._id), 10, 'Existing product stock restored from 8 to 10');
  console.log('✓ PASS: Deleted product gracefully handled without throwing; active item restored (Stock: 8 -> 10)');

  // TEST 8: Multiple Products in One Order
  console.log('\n--- Test 8: Multiple Products in One Order ---');
  const mA = db.createProduct({ name: 'Product A', stock: 10 });
  const mB = db.createProduct({ name: 'Product B', stock: 25 });
  const mC = db.createProduct({ name: 'Product C', stock: 1 });

  const oMulti = db.createOrder({
    items: [
      { product: mA, quantity: 3 },
      { product: mB, quantity: 5 },
      { product: mC, quantity: 2 },
    ],
  });

  const resMulti = await runRestoreStock(db, oMulti);
  assert.strictEqual(resMulti.success, true);
  assert.strictEqual(resMulti.restored, true);
  assert.strictEqual(resMulti.restoredItems.length, 3);
  assert.strictEqual(db.getProductStock(mA._id), 13, 'Product A: 10 -> 13 (+3)');
  assert.strictEqual(db.getProductStock(mB._id), 30, 'Product B: 25 -> 30 (+5)');
  assert.strictEqual(db.getProductStock(mC._id), 3, 'Product C: 1 -> 3 (+2)');
  console.log('✓ PASS: Multiple products in single order all restored accurately (+3, +5, +2)');

  console.log('\n======================================================');
  console.log('ALL 8 CONCURRENT STOCK RESTORATION SCENARIOS PASSED!');
  console.log('======================================================');
}

runAllTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
