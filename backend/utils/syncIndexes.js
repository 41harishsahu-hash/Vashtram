/**
 * VASHTRAM Explicit Database Index Synchronization CLI Script
 * 
 * Safely creates and synchronizes all critical production indexes in MongoDB:
 * - orders.razorpayPaymentId (unique partial)
 * - orders.orderNumber (unique)
 * - paymentintents.razorpayOrderId (unique)
 * - webhookevents.eventId (unique)
 * - users.email (unique)
 * - products.slug (unique)
 * - products.sku (unique)
 * 
 * Usage:
 *   npm run db:sync-indexes
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const { REQUIRED_INDEXES, verifyIndexes } = require('./verifyIndexes');

/**
 * Checks for existing duplicate values on a field that will be given a unique index.
 * Returns true if clean (no duplicates), or false with detailed diagnostic output if duplicates exist.
 */
async function checkDuplicates(collection, fieldName, { partial = false } = {}) {
  const matchStage = partial
    ? { [fieldName]: { $type: 'string' } }
    : { [fieldName]: { $exists: true, $ne: null } };

  const duplicates = await collection
    .aggregate([
      { $match: matchStage },
      { $group: { _id: `$${fieldName}`, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (duplicates.length > 0) {
    console.error(`\n❌ CONFLICT: Duplicate values detected in collection '${collection.collectionName}' on unique field '${fieldName}':`);
    duplicates.forEach((d) => {
      const idSample = d.ids.slice(0, 5).join(', ');
      const extra = d.ids.length > 5 ? ` (+${d.ids.length - 5} more)` : '';
      console.error(`   - Value: "${d._id}" (${d.count} occurrences). Document IDs: ${idSample}${extra}`);
    });
    console.error(`\n   Cannot create unique index until these duplicates are resolved.`);
    console.error(`   Please clean up or merge duplicate documents before retrying.\n`);
    return false;
  }
  return true;
}

async function syncIndexes({ checkOnly = false } = {}) {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log('📦 VASHTRAM DATABASE INDEX SYNCHRONIZATION');
  console.log('======================================================\n');

  try {
    await mongoose.connect(mongoUri, { readPreference: 'primary' });
    const db = mongoose.connection.db;
    console.log(`Connected to database: ${mongoose.connection.name}`);

    // Step 1: Pre-flight check for existing duplicate entries on unique fields
    console.log('Running pre-flight duplicate check across unique index targets...');
    const duplicateChecks = [
      await checkDuplicates(db.collection('orders'), 'razorpayPaymentId', { partial: true }),
      await checkDuplicates(db.collection('orders'), 'orderNumber'),
      await checkDuplicates(db.collection('paymentintents'), 'razorpayOrderId'),
      await checkDuplicates(db.collection('webhookevents'), 'eventId'),
      await checkDuplicates(db.collection('users'), 'email'),
      await checkDuplicates(db.collection('products'), 'slug'),
      await checkDuplicates(db.collection('products'), 'sku'),
    ];

    if (duplicateChecks.some((clean) => !clean)) {
      console.error('❌ Index synchronization aborted due to conflicting duplicate records.');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log('✓ Pre-flight duplicate check passed: Zero conflicting duplicates found.\n');

    if (checkOnly) {
      await mongoose.disconnect();
      return { success: true };
    }

    // 1. Orders collection indexes
    const ordersCol = db.collection('orders');
    console.log('Syncing orders indexes...');
    await ordersCol.createIndex(
      { razorpayPaymentId: 1 },
      {
        unique: true,
        partialFilterExpression: { razorpayPaymentId: { $type: 'string' } },
        name: 'razorpayPaymentId_1_partial',
        background: true,
      }
    );
    await ordersCol.createIndex({ orderNumber: 1 }, { unique: true, background: true });
    await ordersCol.createIndex({ needsAttention: 1 }, { background: true });

    // 2. PaymentIntents collection indexes
    const intentsCol = db.collection('paymentintents');
    console.log('Syncing paymentintents indexes...');
    await intentsCol.createIndex({ razorpayOrderId: 1 }, { unique: true, background: true });
    await intentsCol.createIndex({ razorpayPaymentId: 1 }, { sparse: true, background: true });
    await intentsCol.createIndex({ status: 1 }, { background: true });
    await intentsCol.createIndex({ needsAttention: 1 }, { background: true });

    // 3. WebhookEvents collection indexes
    const webhooksCol = db.collection('webhookevents');
    console.log('Syncing webhookevents indexes...');
    await webhooksCol.createIndex({ eventId: 1 }, { unique: true, background: true });
    await webhooksCol.createIndex({ eventType: 1 }, { background: true });

    // 4. Users collection indexes
    const usersCol = db.collection('users');
    console.log('Syncing users indexes...');
    await usersCol.createIndex({ email: 1 }, { unique: true, background: true });

    // 5. Products collection indexes
    const productsCol = db.collection('products');
    console.log('Syncing products indexes...');
    await productsCol.createIndex({ slug: 1 }, { unique: true, background: true });
    await productsCol.createIndex({ sku: 1 }, { unique: true, background: true });
    await productsCol.createIndex({ category: 1, isActive: 1 }, { background: true });
    await productsCol.createIndex({ isFeatured: 1, isActive: 1, rating: -1, createdAt: -1 }, { background: true });

    // 6. Categories collection indexes
    const categoriesCol = db.collection('categories');
    console.log('Syncing categories indexes...');
    await categoriesCol.createIndex({ isActive: 1, order: 1, name: 1 }, { background: true });

    console.log('\nVerifying synced indexes...');
    const verification = await verifyIndexes({ warnOnly: true });

    if (verification.success) {
      console.log('\n✅ All critical database indexes synchronized and verified successfully!\n');
    } else {
      console.warn('\n⚠️ Some indexes could not be verified. Check migration output above.\n');
    }

    await mongoose.disconnect();
    process.exit(verification.success ? 0 : 1);
  } catch (err) {
    console.error('❌ Index synchronization failed:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

if (require.main === module) {
  syncIndexes();
}

module.exports = { syncIndexes, checkDuplicates };
