const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const User = require('../models/User');

const DEMO_EMAILS = [
  'admin@vashtram.com',
  'admin@vastram.com',
  'customer@vashtram.com',
  'customer@vastram.com',
];

const verifyNoDemoAccounts = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('[Verify No Demo Accounts]: MONGODB_URI is not set in environment.');
      process.exit(1);
    }

    await mongoose.connect(mongoUri, { readPreference: 'primary' });

    const foundUsers = await User.find(
      { email: { $in: DEMO_EMAILS } },
      { email: 1, role: 1 }
    ).lean();

    if (foundUsers.length > 0) {
      console.error(`\n[FAIL]: Found ${foundUsers.length} prohibited demo account(s) in database:`);
      foundUsers.forEach((u) => console.error(`  - ${u.email} (${u.role})`));
      console.error('\nPlease run: npm run cleanup:demo -- --confirm\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('[PASS]: No prohibited demo accounts detected in database.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[Verify No Demo Accounts Error]:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  verifyNoDemoAccounts();
}

module.exports = { verifyNoDemoAccounts };
