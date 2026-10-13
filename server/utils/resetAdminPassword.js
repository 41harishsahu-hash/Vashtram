/**
 * VASHTRAM Admin Password Reset & Recovery CLI Tool
 *
 * Emergency recovery tool for server administrators.
 * Requires direct server shell access and database connection.
 *
 * Usage:
 *   node server/utils/resetAdminPassword.js <email> <new_password>
 *   npm run admin:reset-password <email> <new_password>
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const User = require('../models/User');
const { validatePasswordPolicy } = require('./passwordPolicy');

async function resetAdminPassword(email, newPassword, { ownConnection = true } = {}) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new Error('Admin email is required');
  }

  if (!newPassword || typeof newPassword !== 'string') {
    throw new Error('New password is required');
  }

  const cleanEmail = email.trim().toLowerCase();
  const rawPassword = newPassword; // Never trim or alter passwords

  // Validate against password security policy
  const policy = validatePasswordPolicy(rawPassword);
  if (!policy.valid) {
    throw new Error(`Password policy violation: ${policy.message}`);
  }

  let connectedHere = false;
  if (ownConnection && mongoose.connection.readyState !== 1) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is missing');
    }
    await mongoose.connect(mongoUri, { readPreference: 'primary' });
    connectedHere = true;
  }

  try {
    let user = await User.findOne({ email: cleanEmail }).select('+password');

    if (user) {
      user.password = rawPassword;
      user.role = 'admin';
      user.isActive = true;
      user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all prior active sessions
      await user.save();
      console.log(`[Admin Recovery]: Successfully updated password and rotated tokenVersion for admin <${cleanEmail}>.`);
      return { success: true, action: 'updated', user: { _id: user._id, email: user.email, role: user.role } };
    } else {
      user = await User.create({
        name: 'Store Administrator',
        email: cleanEmail,
        password: rawPassword,
        role: 'admin',
        isActive: true,
      });
      console.log(`[Admin Recovery]: Created new administrator account for <${cleanEmail}>.`);
      return { success: true, action: 'created', user: { _id: user._id, email: user.email, role: user.role } };
    }
  } finally {
    if (connectedHere && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

const readline = require('readline');

function promptHidden(query) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    const stdin = process.stdin;
    process.stdout.write(query);

    let password = '';
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(wasRaw || false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(1);
      } else if (char === '\u0008' || char === '\u007f') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
      } else {
        password += char;
      }
    };

    stdin.on('data', onData);
  });
}

async function runCli() {
  const [,, emailArg, passArg] = process.argv;

  if (passArg) {
    console.error('\n❌ Security Error: Do NOT provide the admin password as a command-line argument.');
    console.error('   Command-line arguments are exposed in process listings (ps -ef) and shell history.');
    console.error('   Please provide the password interactively via prompt or set the ADMIN_NEW_PASSWORD environment variable.\n');
    console.error('Usage:');
    console.error('   node server/utils/resetAdminPassword.js <admin_email>');
    console.error('   or: ADMIN_NEW_PASSWORD="your-secure-password" node server/utils/resetAdminPassword.js <admin_email>\n');
    process.exit(1);
  }

  const email = emailArg || process.env.ADMIN_EMAIL;
  if (!email) {
    console.error('\n❌ Error: Admin email is required.');
    console.error('Usage: node server/utils/resetAdminPassword.js <admin_email>\n');
    process.exit(1);
  }

  let newPassword = process.env.ADMIN_NEW_PASSWORD;
  if (!newPassword) {
    newPassword = await promptHidden(`Enter new password for admin <${email}>: `);
    const confirm = await promptHidden('Confirm new password: ');
    if (newPassword !== confirm) {
      console.error('\n❌ Error: Passwords do not match.\n');
      process.exit(1);
    }
  }

  try {
    const result = await resetAdminPassword(email, newPassword);
    console.log(`\n✅ Administrator password ${result.action} successfully for <${result.user.email}>.`);
    console.log('   All prior user sessions and JWT tokens have been invalidated.');
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Password reset failed: ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = { resetAdminPassword, runCli };
