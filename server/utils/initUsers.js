const User = require('../models/User');
const { validatePasswordPolicy } = require('./passwordPolicy');

/**
 * Production-ready Admin initialization.
 * 
 * Rules:
 * 1. Checks whether ANY admin already exists in the database.
 * 2. If an admin exists, do nothing (never overwrite passwords or recreate accounts).
 * 3. If no admin exists, create exactly one initial admin using ADMIN_EMAIL and ADMIN_PASSWORD
 *    from server environment variables.
 * 4. Never use a fallback password. If env vars are missing, log an informative warning and exit.
 * 5. Never create demo customers automatically.
 * 6. Never expose passwords in logs.
 */
const ensureDefaultUsers = async () => {
  try {
    // 1. Check if ANY admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      // Admin already exists, do not overwrite or modify anything
      return;
    }

    // 2. If no admin exists, verify required environment variables
    const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : null;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.warn(
        '[Init Users]: No admin account exists, and ADMIN_EMAIL/ADMIN_PASSWORD are not fully configured in environment variables. Initial admin creation skipped.'
      );
      return;
    }

    const DEMO_EMAILS = [
      'admin@vashtram.com',
      'admin@vastram.com',
      'customer@vashtram.com',
      'customer@vastram.com',
    ];
    if (DEMO_EMAILS.includes(adminEmail)) {
      console.warn('[Init Users]: Configured ADMIN_EMAIL matches a prohibited demo email. Skipping creation.');
      return;
    }

    // Validate admin password against password policy
    const policy = validatePasswordPolicy(adminPassword);
    if (!policy.valid) {
      if (process.env.NODE_ENV === 'production') {
        const errorMsg = `Configured ADMIN_PASSWORD does not satisfy production security policy: ${policy.message}`;
        console.error(`\n❌ [Init Users Error]: ${errorMsg}.`);
        console.error('❌ Refusing to initialize administrator with weak password in production.\n');
        throw new Error(errorMsg);
      } else {
        console.warn(`[Init Users Warning]: Configured ADMIN_PASSWORD does not meet full policy: ${policy.message}`);
      }
    }

    // 3. Create exactly one initial administrator
    await User.create({
      name: 'Store Administrator',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      isActive: true,
    });

    console.log(`[Init Users]: Initial administrator created for ${adminEmail}.`);
  } catch (error) {
    console.error(`[Init Users Error]: Failed to initialize admin account: ${error.message}`);
  }
};

module.exports = { ensureDefaultUsers };
