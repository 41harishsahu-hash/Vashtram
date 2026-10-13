/**
 * Migration 001: Fix Razorpay Indexes & Ensure Partial Uniqueness
 * 
 * Rules:
 * (a) Convert orders.razorpayPaymentId: '' -> unset / null
 * (b) Detect duplicate non-null razorpayPaymentId and razorpayOrderId values and STOP with report if any exist (no auto-deletion)
 * (c) Drop old non-unique razorpayPaymentId_1 index if it conflicts
 * (d) Create partial unique index on orders.razorpayPaymentId where value is string
 * (e) Create unique index on paymentintents.razorpayOrderId and webhookevents.eventId
 * (f) Print resulting index list
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

const runMigration = async () => {
  console.log('======================================================');
  console.log('🔄 RUNNING MIGRATION 001: RAZORPAY INDEX FIXES');
  console.log('======================================================\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[Migration Error]: MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('[1/6] Connected to MongoDB database successfully.');

    const db = mongoose.connection.db;
    const ordersCol = db.collection('orders');
    const intentsCol = db.collection('paymentintents');
    const webhooksCol = db.collection('webhookevents');

    // (a) Convert orders.razorpayPaymentId: '' -> unset
    console.log('[2/6] Converting empty string razorpayPaymentId values to unset/null...');
    const unsetResult = await ordersCol.updateMany(
      { razorpayPaymentId: '' },
      { $unset: { razorpayPaymentId: '' } }
    );
    console.log(`  ✓ Updated ${unsetResult.modifiedCount} order(s) with empty razorpayPaymentId.`);

    // Also convert empty razorpayOrderId: '' to unset if any
    await ordersCol.updateMany(
      { razorpayOrderId: '' },
      { $unset: { razorpayOrderId: '' } }
    );

    // (b) Detect duplicate non-null razorpayPaymentId and razorpayOrderId values
    console.log('[3/6] Detecting any duplicate payment or order IDs across orders...');
    const dupPayments = await ordersCol
      .aggregate([
        { $match: { razorpayPaymentId: { $exists: true, $ne: null, $type: 'string' } } },
        {
          $group: {
            _id: '$razorpayPaymentId',
            count: { $sum: 1 },
            orders: { $push: { id: '$_id', orderNumber: '$orderNumber', createdAt: '$createdAt' } },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    const dupOrders = await ordersCol
      .aggregate([
        { $match: { razorpayOrderId: { $exists: true, $ne: null, $type: 'string' } } },
        {
          $group: {
            _id: '$razorpayOrderId',
            count: { $sum: 1 },
            orders: { $push: { id: '$_id', orderNumber: '$orderNumber', createdAt: '$createdAt' } },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (dupPayments.length > 0 || dupOrders.length > 0) {
      console.error('\n🚨 [CRITICAL STOP]: Duplicate non-null Razorpay identifiers detected in orders collection!');
      console.error('Migration aborted without modifying indexes or deleting data.\n');

      if (dupPayments.length > 0) {
        console.error('Duplicate razorpayPaymentId details:');
        console.error(JSON.stringify(dupPayments, null, 2));
      }
      if (dupOrders.length > 0) {
        console.error('Duplicate razorpayOrderId details:');
        console.error(JSON.stringify(dupOrders, null, 2));
      }

      console.error('\nPlease inspect and resolve these duplicate records before rerunning this migration.\n');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log('  ✓ Zero duplicates detected. Safe to apply unique indexes.');

    // (c) Inspect existing indexes and drop conflicting ones
    console.log('[4/6] Inspecting and reconciling existing indexes...');
    const existingOrderIndexes = await ordersCol.indexes();
    const paymentIdIdx = existingOrderIndexes.find((idx) => idx.name === 'razorpayPaymentId_1');

    if (paymentIdIdx) {
      const isCompliant =
        paymentIdIdx.unique === true &&
        paymentIdIdx.partialFilterExpression &&
        paymentIdIdx.partialFilterExpression.razorpayPaymentId?.$type === 'string';

      if (!isCompliant) {
        console.log('  - Dropping legacy/conflicting razorpayPaymentId_1 index...');
        await ordersCol.dropIndex('razorpayPaymentId_1');
        console.log('  ✓ Legacy razorpayPaymentId_1 dropped.');
      } else {
        console.log('  ✓ Existing razorpayPaymentId_1 already compliant.');
      }
    }

    // (d) Create partial unique index on orders.razorpayPaymentId
    console.log('[5/6] Creating unique indexes on collections...');
    await ordersCol.createIndex(
      { razorpayPaymentId: 1 },
      {
        name: 'razorpayPaymentId_1',
        unique: true,
        partialFilterExpression: { razorpayPaymentId: { $type: 'string' } },
        background: true,
      }
    );
    console.log('  ✓ Created unique partial index on orders.razorpayPaymentId.');

    // (e) paymentintents.razorpayOrderId and webhookevents.eventId
    await intentsCol.createIndex(
      { razorpayOrderId: 1 },
      { name: 'razorpayOrderId_1', unique: true, background: true }
    );
    console.log('  ✓ Created unique index on paymentintents.razorpayOrderId.');

    await webhooksCol.createIndex(
      { eventId: 1 },
      { name: 'eventId_1', unique: true, background: true }
    );
    console.log('  ✓ Created unique index on webhookevents.eventId.');

    // (f) Print resulting index list
    console.log('\n[6/6] Resulting Index Verification Summary:');

    const printIndexes = async (colName, col) => {
      console.log(`\nCollection: "${colName}"`);
      const idxs = await col.indexes();
      idxs.forEach((idx) => {
        const uniqueFlag = idx.unique ? '[UNIQUE]' : '[INDEX]';
        const partialFlag = idx.partialFilterExpression
          ? `(partial: ${JSON.stringify(idx.partialFilterExpression)})`
          : '';
        console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${uniqueFlag} ${partialFlag}`);
      });
    };

    await printIndexes('orders', ordersCol);
    await printIndexes('paymentintents', intentsCol);
    await printIndexes('webhookevents', webhooksCol);

    await mongoose.disconnect();
    console.log('\n======================================================');
    console.log('✓ MIGRATION 001 COMPLETED SUCCESSFULLY');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Migration failed with error:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
