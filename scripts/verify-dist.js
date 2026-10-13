/**
 * Production Dist Verification Script
 * 
 * Verifies that client/dist contains NO:
 * - __SITE_URL__ (must be fully resolved at build time or served dynamically)
 * - unsplash
 * - placehold.co
 * - localhost
 * - unsafe-eval
 * - rzp_test_
 */

const fs = require('fs');
const path = require('path');

const FORBIDDEN_STRINGS = [
  '__SITE_URL__',
  'unsplash',
  'placehold.co',
  'localhost',
  'unsafe-eval',
  'rzp_test_',
];

const distDir = path.resolve(__dirname, '../client/dist');

const checkDir = (dir, results = []) => {
  if (!fs.existsSync(dir)) {
    return null;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      checkDir(fullPath, results);
    } else if (entry.isFile()) {
      // Only examine text/code files
      const ext = path.extname(entry.name).toLowerCase();
      const textExtensions = ['.html', '.js', '.mjs', '.css', '.svg', '.json', '.txt', '.map'];

      if (textExtensions.includes(ext) || entry.name.startsWith('_')) {
        const content = fs.readFileSync(fullPath, 'utf8');

        for (const forbidden of FORBIDDEN_STRINGS) {
          if (content.toLowerCase().includes(forbidden.toLowerCase())) {
            results.push({
              file: path.relative(path.resolve(__dirname, '..'), fullPath),
              forbidden,
            });
          }
        }
      }
    }
  }

  return results;
};

const runVerification = (opts = {}) => {
  const { throwOnError = false } = opts;
  console.log('======================================================');
  console.log('🔍 VERIFYING CLIENT PRODUCTION BUILD (client/dist)');
  console.log('======================================================\n');

  const violations = checkDir(distDir);
  if (violations === null) {
    console.log('ℹ️ client/dist not present. Skipping pre-built dist verification (release packages raw source tree).');
    return { success: true, violations: [], skipped: true };
  }

  if (violations.length > 0) {
    if (throwOnError) {
      throw new Error(`Prohibited strings found: ${violations.map((v) => v.forbidden).join(', ')}`);
    }
    console.error(`❌ Verification failed! Found ${violations.length} prohibited string(s) in client/dist:\n`);
    for (const v of violations) {
      console.error(`  - Found "${v.forbidden}" in: ${v.file}`);
    }
    console.error('\nPlease remove all prohibited strings before releasing.\n');
    process.exit(1);
  }

  console.log('✓ Verified: Zero occurrences of forbidden strings in client/dist:');
  for (const str of FORBIDDEN_STRINGS) {
    console.log(`  ✓ No "${str}" found`);
  }
  console.log('\n✅ DIST VERIFICATION PASSED.\n');
  return { success: true, violations: [] };
};

if (require.main === module) {
  runVerification();
}

module.exports = { runVerification, checkDir, FORBIDDEN_STRINGS, distDir };

