/**
 * VASHTRAM Source-Only Zip Packaging Script
 * 
 * Generates a clean source-only zip archive strictly excluding:
 * - node_modules
 * - frontend/dist, client/dist, build/
 * - release/
 * - backend/uploads, server/uploads and user uploads
 * - any .env files (except .env.example templates)
 * - backups, dumps, *.bak, *.sql, backup-*.json
 * - existing *.zip, *.tar, archive files
 * - git and IDE cache artifacts
 * 
 * Includes pre-pack security scan and post-pack archive verification.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT_DIR = path.resolve(__dirname, '../..');
const ZIP_NAME = 'vashtram-source.zip';
const ZIP_PATH = path.join(ROOT_DIR, ZIP_NAME);

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
  'build',
  '.system_generated',
  'scratch',
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

function shouldExcludeFile(baseName) {
  // Exclude non-example environment files
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

function copyCleanFiles(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const baseName = path.basename(src);
    if (EXCLUDED_DIRS.has(baseName)) return;

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyCleanFiles(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    const baseName = path.basename(src);
    if (shouldExcludeFile(baseName)) return;

    fs.copyFileSync(src, dest);
  }
}

function scanStagedForSecrets(dir) {
  const violations = [];
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else {
        const name = ent.name;
        if (name.includes('.env') && !name.endsWith('.example')) {
          violations.push(`Unsanitized env file: ${full}`);
        }
        if (shouldExcludeFile(name)) {
          violations.push(`Unsanitized backup/archive file: ${full}`);
        }
        // Scan text files line by line for secrets
        const ext = path.extname(name).toLowerCase();
        if (['.js', '.json', '.html', '.css', '.md'].includes(ext)) {
          try {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split(/\r?\n/);
            for (const line of lines) {
              if (/rzp_live_[a-zA-Z0-9]{14,}/.test(line) && !line.includes('dummy')) {
                violations.push(`Live Razorpay key in staged source: ${full}`);
                break;
              }
              if (/mongodb(\+srv)?:\/\/[^:\s'"]+:[^@\s'"]+@/i.test(line)) {
                if (!/<(?:user|username|password)>/.test(line) && !/dummy_/.test(line)) {
                  violations.push(`Hardcoded MongoDB credentials in staged source: ${full}`);
                  break;
                }
              }
            }
          } catch {}
        }
      }
    }
  }
  walk(dir);
  if (violations.length > 0) {
    throw new Error(`Security Violations in Staged Source:\n  - ${violations.join('\n  - ')}`);
  }
}

function verifyZipArchive(zipPath) {
  const output = execSync(`tar -tf "${zipPath}"`, { encoding: 'utf8' });
  const entries = output.split(/\r?\n/).filter(Boolean);
  const violations = [];

  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, '/');
    const baseName = path.basename(normalized);

    if (normalized.includes('.env') && !normalized.endsWith('.example')) {
      violations.push(`Prohibited env file in ZIP: ${entry}`);
    }
    if (normalized.includes('backups/') || normalized.includes('dump/')) {
      violations.push(`Prohibited backup path in ZIP: ${entry}`);
    }
    if (/^backup-.*\.json$/i.test(baseName)) {
      violations.push(`Prohibited backup dump in ZIP: ${entry}`);
    }
    const ext = path.extname(baseName).toLowerCase();
    if (EXCLUDED_EXTENSIONS.has(ext)) {
      violations.push(`Prohibited archive/backup extension in ZIP: ${entry}`);
    }
    if (normalized.includes('node_modules/')) {
      violations.push(`Prohibited node_modules in ZIP: ${entry}`);
    }
    if (normalized.includes('uploads/')) {
      violations.push(`Prohibited uploads in ZIP: ${entry}`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`ZIP Archive Verification Failed:\n  - ${violations.join('\n  - ')}`);
  }

  return entries.length;
}

console.log('======================================================');
console.log('🔒 VASHTRAM — SECURE SOURCE-ONLY ARCHIVE BUILDER');
console.log('======================================================\n');

const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vashtram-source-staging-'));

try {
  if (fs.existsSync(ZIP_PATH)) {
    fs.unlinkSync(ZIP_PATH);
  }

  console.log('[1/4] Staging clean source tree with strict security exclusions...');
  copyCleanFiles(ROOT_DIR, stagingDir);

  console.log('[2/4] Scanning staged files for accidental secrets and backups...');
  scanStagedForSecrets(stagingDir);

  console.log(`[3/4] Packaging clean archive: ${ZIP_NAME}...`);
  // Tar archive creation from staging directory
  const tarCmd = `tar -a -c -f "${ZIP_PATH}" *`;
  execSync(tarCmd, { cwd: stagingDir, stdio: 'inherit' });

  console.log('[4/4] Verifying generated ZIP archive integrity...');
  const totalEntries = verifyZipArchive(ZIP_PATH);

  const stats = fs.statSync(ZIP_PATH);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n✓ SUCCESS: Created clean source archive "${ZIP_NAME}" (${sizeMb} MB) with ${totalEntries} entries.`);
  console.log('✓ Verified: Zero .env files (except .env.example)');
  console.log('✓ Verified: Zero backups, dumps, *.bak, *.sql, or *.zip files');
  console.log('✓ Verified: Zero hardcoded secrets detected');
} catch (err) {
  if (fs.existsSync(ZIP_PATH)) {
    try { fs.unlinkSync(ZIP_PATH); } catch {}
  }
  console.error('\n✗ Error creating secure source archive:', err.message);
  process.exit(1);
} finally {
  try {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  } catch {}
}
