/**
 * VASHTRAM Release Packaging Script
 * 
 * Creates a clean production-ready release package excluding:
 * - node_modules
 * - .env* (except .env.example files)
 * - server/uploads and user uploads
 * - backups, dumps, *.bak, *.sql, backup-*.json
 * - *.zip, *.tar, archive files
 * - dev/diagnostic test scripts:
 *     test_e2e.js, comprehensive_test.js, test_concurrent_stock_restoration.js,
 *     test-cloudinary.js, checkStatus.js, backupCollections.js, testAtlasHealth.js,
 *     checkReferencedUploads.js, test-bug-fixes.js, verify-release.js
 * 
 * Fails loudly if any file matching .env, backup, or secret is detected.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_RELEASE_DIR = path.join(ROOT_DIR, 'release');

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'uploads',
  'backups',
  'dumps',
  'dump',
  'release',
  '.git',
  '.vscode',
  '.idea',
  'dist',
  '.system_generated',
  'scratch',
]);

const EXCLUDED_FILES = new Set([
  'test_e2e.js',
  'comprehensive_test.js',
  'test_concurrent_stock_restoration.js',
  'test-cloudinary.js',
  'checkStatus.js',
  'backupCollections.js',
  'testAtlasHealth.js',
  'checkReferencedUploads.js',
  'test-bug-fixes.js',
  'verify-release.js',
  'test-payment-flows.js',
  'testDbGuard.js',
  'seeder.js',
  'syncLocalToAtlas.js',
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.zip',
  '.tar',
  '.gz',
  '.tgz',
  '.rar',
  '.7z',
  '.bak',
  '.backup',
  '.dump',
  '.sql',
  '.tmp',
  '.log',
]);

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function shouldExcludeFile(baseName) {
  if (EXCLUDED_FILES.has(baseName)) return true;

  // Exclude any environment file unless it is an explicit .env.example
  if (baseName.includes('.env') && !baseName.endsWith('.example')) {
    return true;
  }

  // Exclude database backup JSON dumps
  if (/^backup-.*\.json$/i.test(baseName) || /^dump-.*\.json$/i.test(baseName)) {
    return true;
  }

  const ext = path.extname(baseName).toLowerCase();
  if (EXCLUDED_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

function copyRecursive(src, dest, targetDir) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const baseName = path.basename(src);
    if (EXCLUDED_DIRS.has(baseName)) return;
    if (path.resolve(src) === path.resolve(targetDir)) return;

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry), targetDir);
    }
  } else {
    const baseName = path.basename(src);
    if (shouldExcludeFile(baseName)) return;

    fs.copyFileSync(src, dest);
  }
}

function verifyReleaseIntegrity(dir) {
  let fileCount = 0;
  const violations = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        if (EXCLUDED_DIRS.has(ent.name)) {
          violations.push(`Forbidden directory included: ${full}`);
        }
        walk(full);
      } else {
        fileCount++;
        const name = ent.name;

        // Verify no prohibited env file
        if (name.includes('.env') && !name.endsWith('.example')) {
          violations.push(`Forbidden env file found: ${full}`);
        }

        // Verify no backup/dump/sql file
        if (shouldExcludeFile(name)) {
          violations.push(`Forbidden archive/backup file found: ${full}`);
        }

        // Scan text files line by line for embedded real secret patterns
        const ext = path.extname(name).toLowerCase();
        if (['.js', '.json', '.html', '.css', '.md'].includes(ext)) {
          try {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split(/\r?\n/);
            for (const line of lines) {
              if (/rzp_live_[a-zA-Z0-9]{14,}/.test(line) && !line.includes('dummy') && !line.includes('your_')) {
                violations.push(`Live payment key detected in release file: ${full}`);
                break;
              }
              if (/mongodb(\+srv)?:\/\/[^:\s'"]+:[^@\s'"]+@/i.test(line)) {
                if (!/<(?:user|username|password)>/.test(line) && !/dummy_/.test(line)) {
                  violations.push(`Embedded MongoDB credentials detected in release file: ${full}`);
                  break;
                }
              }
              if (name !== 'package-release.js' && /vashtram-release\.internal/i.test(line)) {
                violations.push(`Packaging placeholder URL detected in release file: ${full}`);
                break;
              }
            }
          } catch {}
        }
      }
    }
  }

  walk(dir);

  if (fs.existsSync(path.join(dir, 'client', 'dist')) || fs.existsSync(path.join(dir, 'dist'))) {
    violations.push(`Built output directory (client/dist) must never ship inside release`);
  }

  if (violations.length > 0) {
    throw new Error(`Integrity Check Failed:\n  - ${violations.join('\n  - ')}`);
  }

  return fileCount;
}

function packageRelease(targetDir = DEFAULT_RELEASE_DIR, options = {}) {
  const silent = Boolean(options.silent);
  const log = (...args) => { if (!silent) console.log(...args); };

  log('======================================================');
  log('📦 VASHTRAM — PACKAGING PRODUCTION RELEASE DISTRIBUTION');
  log('======================================================\n');

  log('[1/4] Running client/dist verification...');
  const { runVerification } = require('./verify-dist');
  runVerification();

  log(`[2/4] Preparing output directory: ${targetDir}...`);
  cleanDir(targetDir);

  log('[3/4] Copying clean source tree with strict security exclusions...');
  copyRecursive(ROOT_DIR, targetDir, targetDir);

  log('[4/4] Verifying release integrity for prohibited secrets or env files...');
  const totalFiles = verifyReleaseIntegrity(targetDir);

  log(`\n✓ SUCCESS: Release bundle generated with ${totalFiles} clean files.`);
  log(`✓ Verified: Zero non-example .env files present in ${targetDir}.`);
  log(`✓ Verified: Zero backup files, dev test scripts, archives, dumps, or secrets present.`);

  return { totalFiles, targetDir };
}

if (require.main === module) {
  const destArg = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_RELEASE_DIR;
  try {
    packageRelease(destArg);
  } catch (err) {
    console.error('\n✗ PACKAGING FAILED:', err.message);
    process.exit(1);
  }
}

module.exports = { packageRelease, verifyReleaseIntegrity, shouldExcludeFile };
