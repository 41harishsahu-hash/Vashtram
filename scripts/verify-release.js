/**
 * VASHTRAM Release Verification Script (verify:release)
 * 
 * Rebuilds the production release package into a clean isolated temporary
 * directory, computes the cryptographic SHA-256 hash of every single file,
 * and compares it against the existing `release/` directory.
 * 
 * Fails fast with exit code 1 if:
 * - Any extra files exist in release/
 * - Any missing files are absent from release/
 * - Any file content has drifted (hash mismatch)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { packageRelease } = require('./package-release');

const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');

function computeFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function collectFiles(dir, baseDir = dir) {
  const fileMap = new Map();
  if (!fs.existsSync(dir)) return fileMap;

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        walk(full);
      } else {
        const relPath = path.relative(baseDir, full).replace(/\\/g, '/');
        fileMap.set(relPath, computeFileHash(full));
      }
    }
  }

  walk(dir);
  return fileMap;
}

console.log('======================================================');
console.log('🔍 VASHTRAM — REBUILD & VERIFY RELEASE DRIFT (SHA-256)');
console.log('======================================================\n');

if (!fs.existsSync(RELEASE_DIR)) {
  console.error('❌ Error: release/ directory does not exist. Run "npm run package:release" first.');
  process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vashtram-verify-release-'));

try {
  console.log('[1/3] Packaging fresh reference build to temporary directory...');
  packageRelease(tempDir, { silent: true });

  console.log('[2/3] Computing SHA-256 hashes of release/ vs reference build...');
  const releaseFiles = collectFiles(RELEASE_DIR);
  const referenceFiles = collectFiles(tempDir);

  const missingInRelease = [];
  const extraInRelease = [];
  const differingFiles = [];

  // Check files that should be in release
  for (const [relPath, refHash] of referenceFiles.entries()) {
    if (!releaseFiles.has(relPath)) {
      missingInRelease.push(relPath);
    } else {
      const relHash = releaseFiles.get(relPath);
      if (relHash !== refHash) {
        differingFiles.push({ file: relPath, refHash, relHash });
      }
    }
  }

  // Check unexpected extra files in release
  for (const relPath of releaseFiles.keys()) {
    if (!referenceFiles.has(relPath)) {
      extraInRelease.push(relPath);
    }
  }

  console.log('[3/3] Analyzing release consistency results...\n');

  let hasErrors = false;

  if (missingInRelease.length > 0) {
    hasErrors = true;
    console.error(`❌ MISSING IN RELEASE (${missingInRelease.length} files):`);
    missingInRelease.forEach((f) => console.error(`   - ${f}`));
    console.error('');
  }

  if (extraInRelease.length > 0) {
    hasErrors = true;
    console.error(`❌ UNEXPECTED / EXTRA IN RELEASE (${extraInRelease.length} files):`);
    extraInRelease.forEach((f) => console.error(`   + ${f}`));
    console.error('');
  }

  if (differingFiles.length > 0) {
    hasErrors = true;
    console.error(`❌ CONTENT DRIFT / HASH MISMATCH (${differingFiles.length} files):`);
    differingFiles.forEach((d) => console.error(`   ~ ${d.file} (expected: ${d.refHash.slice(0, 8)}..., got: ${d.relHash.slice(0, 8)}...)`));
    console.error('');
  }

  if (hasErrors) {
    console.error('======================================================');
    console.error('❌ RELEASE VERIFICATION FAILED: release/ has drifted from main source.');
    console.error('Run "npm run package:release" to regenerate a clean release/ from main.');
    console.error('======================================================\n');
    process.exit(1);
  }

  console.log('======================================================');
  console.log(`✅ RELEASE VERIFICATION PASSED: 100% Match!`);
  console.log(`✓ Total Verified Files: ${releaseFiles.size}`);
  console.log(`✓ Zero drift: Every file matches reference build SHA-256 hash.`);
  console.log(`✓ Zero extra or missing files.`);
  console.log('======================================================\n');
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
