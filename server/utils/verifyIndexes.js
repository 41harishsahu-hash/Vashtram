/**
 * Index Verification Script for VASHTRAM Database
 * 
 * Verifies that required production indexes exist:
 * 1. orders: razorpayPaymentId (unique partial), orderNumber (unique)
 * 2. paymentintents: razorpayOrderId (unique)
 * 3. webhookevents: eventId (unique)
 * 4. users: email (unique)
 * 5. products: slug (unique), sku (unique)
 * 
 * Exits non-zero when run directly via CLI if any required index is missing.
 * Supports warnOnly mode when called during production server startup.
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const REQUIRED_INDEXES = [
  {
    collection: 'orders',
    field: 'razorpayPaymentId',
    unique: true,
    partial: true,
    validate: (idx) =>
      idx.key.razorpayPaymentId === 1 &&
      idx.unique === true &&
      Boolean(idx.partialFilterExpression?.razorpayPaymentId),
    description: 'orders.razorpayPaymentId (unique partial on string)',
  },
  {
    collection: 'orders',
    field: 'orderNumber',
    unique: true,
    validate: (idx) => idx.key.orderNumber === 1 && idx.unique === true,
    description: 'orders.orderNumber (unique)',
  },
  {
    collection: 'paymentintents',
    field: 'razorpayOrderId',
    unique: true,
    validate: (idx) => idx.key.razorpayOrderId === 1 && idx.unique === true,
    description: 'paymentintents.razorpayOrderId (unique)',
  },
  {
    collection: 'webhookevents',
    field: 'eventId',
    unique: true,
    validate: (idx) => idx.key.eventId === 1 && idx.unique === true,
    description: 'webhookevents.eventId (unique)',
  },
  {
    collection: 'users',
    field: 'email',
    unique: true,
    validate: (idx) => idx.key.email === 1 && idx.unique === true,
    description: 'users.email (unique)',
  },
  {
    collection: 'products',
    field: 'slug',
    unique: true,
    validate: (idx) => idx.key.slug === 1 && idx.unique === true,
    description: 'products.slug (unique)',
  },
  {
    collection: 'products',
    field: 'sku',
    unique: true,
    validate: (idx) => idx.key.sku === 1 && idx.unique === true,
    description: 'products.sku (unique)',
  },
];

const verifyIndexes = async ({ warnOnly = false } = {}) => {
  let ownConnection = false;

  try {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        console.error('[Verify Indexes Error]: MONGODB_URI is not set.');
        if (!warnOnly) process.exit(1);
        return { success: false, error: 'MONGODB_URI is missing' };
      }
      await mongoose.connect(mongoUri, { readPreference: 'primary' });
      ownConnection = true;
    }

    const db = mongoose.connection.db;
    const missing = [];
    const verified = [];

    for (const req of REQUIRED_INDEXES) {
      try {
        const col = db.collection(req.collection);
        const indexes = await col.indexes();
        const found = indexes.some(req.validate);

        if (found) {
          verified.push(req.description);
        } else {
          missing.push(req.description);
        }
      } catch (colErr) {
        missing.push(`${req.description} (collection query error: ${colErr.message})`);
      }
    }

    if (missing.length > 0) {
      console.warn('\n======================================================');
      console.warn('⚠️  DATABASE INDEX VERIFICATION WARNING');
      console.warn('======================================================');
      console.warn(`Missing or non-compliant required index(es) detected:`);
      missing.forEach((item) => console.warn(`  ✗ ${item}`));
      console.warn('\nRecommendation: Run database migration via:');
      console.warn('  npm run migrate:indexes');
      console.warn('======================================================\n');

      if (!warnOnly) {
        if (ownConnection) await mongoose.disconnect();
        process.exit(1);
      }
      return { success: false, missing, verified };
    }

    console.log('[Index Verification]: ✓ All required database indexes are verified and active:');
    verified.forEach((item) => console.log(`  ✓ ${item}`));

    if (ownConnection) await mongoose.disconnect();
    return { success: true, verified };
  } catch (err) {
    console.error('[Verify Indexes Error]:', err.message);
    if (ownConnection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (!warnOnly) process.exit(1);
    return { success: false, error: err.message };
  }
};

if (require.main === module) {
  verifyIndexes({ warnOnly: false });
}

module.exports = { verifyIndexes, REQUIRED_INDEXES };
