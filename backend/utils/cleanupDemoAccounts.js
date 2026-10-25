const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const User = require('../models/User');
const Order = require('../models/Order');

const DEMO_EMAILS = [
  'admin@vashtram.com',
  'admin@vastram.com',
  'customer@vashtram.com',
  'customer@vastram.com',
];

const cleanup = async () => {
  const isConfirmed = process.argv.includes('--confirm');

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('[Cleanup Demo Error]: MONGODB_URI is not set in environment.');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('[Cleanup Demo]: Connected to database');

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

    // 1. Never delete the account matching ADMIN_EMAIL
    const targetEmails = DEMO_EMAILS.filter(
      (email) => !configuredAdminEmail || email.toLowerCase() !== configuredAdminEmail
    );

    // 2. Find matching demo accounts in database
    const demoUsers = await User.find({ email: { $in: targetEmails } });

    if (demoUsers.length === 0) {
      console.log('[Cleanup Demo]: No target demo accounts found. Database is clean.');
      await mongoose.disconnect();
      return;
    }

    console.log(`[Cleanup Demo]: Identified ${demoUsers.length} legacy/demo account(s):`);
    demoUsers.forEach((u) => console.log(`  - Email: ${u.email} | Role: ${u.role}`));

    // 3. Safety check: ensure at least one other administrator exists
    const demoAdminIds = demoUsers.filter((u) => u.role === 'admin').map((u) => u._id);
    const remainingAdmins = await User.find({
      role: 'admin',
      _id: { $nin: demoAdminIds },
    });

    if (remainingAdmins.length === 0) {
      console.error(
        '[Cleanup Demo Aborted]: Cannot delete demo admin account because no other administrator exists in the database. Create a primary admin first.'
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    const primaryAdmin =
      (configuredAdminEmail && remainingAdmins.find((a) => a.email.toLowerCase() === configuredAdminEmail)) ||
      remainingAdmins[0];

    // 4. Check for linked orders
    const demoIds = demoUsers.map((u) => u._id);
    const linkedOrders = await Order.find({ user: { $in: demoIds } });
    console.log(`[Cleanup Demo]: Found ${linkedOrders.length} order(s) associated with demo accounts.`);

    if (!isConfirmed) {
      console.log('\n[DRY RUN MODE]: No database modifications made.');
      console.log(`  - WOULD re-link ${linkedOrders.length} order(s) to primary admin (${primaryAdmin.email})`);
      console.log(`  - WOULD delete ${demoUsers.length} user account(s): ${demoUsers.map((u) => u.email).join(', ')}`);
      console.log('To apply these changes permanently, rerun with: npm run cleanup:demo -- --confirm\n');
      await mongoose.disconnect();
      return;
    }

    // 5. Apply changes (confirmed)
    if (linkedOrders.length > 0) {
      console.log(`[Cleanup Demo]: Re-linking ${linkedOrders.length} order(s) to primary admin ${primaryAdmin.email}...`);
      await Order.updateMany(
        { user: { $in: demoIds } },
        { $set: { user: primaryAdmin._id } }
      );
      console.log('✓ Orders successfully re-linked to preserve customer history and accounting records.');
    }

    const deleteResult = await User.deleteMany({ _id: { $in: demoIds } });
    console.log(`✓ Deleted ${deleteResult.deletedCount} demo account(s).`);

    // Verify remaining users
    const remainingUsers = await User.find({}, { name: 1, email: 1, role: 1 });
    console.log(`[Cleanup Demo]: Remaining users count: ${remainingUsers.length}`);

    await mongoose.disconnect();
    console.log('✓ Demo accounts cleanup completed successfully.');
  } catch (err) {
    console.error('[Cleanup Demo Error]:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  cleanup();
}

module.exports = { cleanup, DEMO_EMAILS };
