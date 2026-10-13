/**
 * Migration 002: Backfill razorpayPaymentId onto PaymentIntent records from Orders
 * 
 * Rules:
 * - Idempotent and safe to rerun multiple times.
 * - Matches Order to PaymentIntent by razorpayOrderId.
 * - Copies order.razorpayPaymentId to paymentintent.razorpayPaymentId when intent has no payment ID or mismatched ID.
 * - Never drops or deletes data.
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

const runMigration = async () => {
  console.log('======================================================');
  console.log('🔄 RUNNING MIGRATION 002: BACKFILL INTENT PAYMENT IDS');
  console.log('======================================================\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[Migration Error]: MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('[1/3] Connected to MongoDB database successfully.');

    const db = mongoose.connection.db;
    const ordersCol = db.collection('orders');
    const intentsCol = db.collection('paymentintents');

    console.log('[2/3] Scanning orders with valid razorpayPaymentId and razorpayOrderId...');
    const cursor = ordersCol.find({
      razorpayPaymentId: { $exists: true, $ne: null, $type: 'string' },
      razorpayOrderId: { $exists: true, $ne: null, $type: 'string' },
    });

    let totalOrdersExamined = 0;
    let intentsUpdated = 0;
    let intentsAlreadySet = 0;
    let intentsMissing = 0;

    while (await cursor.hasNext()) {
      const order = await cursor.next();
      totalOrdersExamined++;

      const intent = await intentsCol.findOne({ razorpayOrderId: order.razorpayOrderId });
      if (!intent) {
        intentsMissing++;
        continue;
      }

      if (intent.razorpayPaymentId === order.razorpayPaymentId) {
        intentsAlreadySet++;
      } else {
        await intentsCol.updateOne(
          { _id: intent._id },
          { $set: { razorpayPaymentId: order.razorpayPaymentId } }
        );
        intentsUpdated++;
      }
    }

    console.log('[3/3] Migration summary:');
    console.log(`  ✓ Total orders checked:        ${totalOrdersExamined}`);
    console.log(`  ✓ PaymentIntents backfilled:   ${intentsUpdated}`);
    console.log(`  ✓ Already up-to-date:          ${intentsAlreadySet}`);
    console.log(`  ✓ Orders without matching intent: ${intentsMissing}`);

    console.log('\n✅ MIGRATION 002 COMPLETED SUCCESSFULLY.\n');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED WITH ERROR:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
