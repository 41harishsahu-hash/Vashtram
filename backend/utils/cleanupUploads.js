/**
 * VASHTRAM Uploads Cleanup Utility
 * 
 * Safely removes unreferenced local files from server/uploads.
 * Dry-run by default. Requires `--confirm` flag to delete files.
 * Always preserves and reports referenced files for migration to Cloudinary.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const { getUploadReferences } = require('./checkReferencedUploads');

const cleanupUploads = async () => {
  const isConfirmed = process.argv.includes('--confirm');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[Cleanup Uploads Error]: MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('[Cleanup Uploads]: Connected to database.');

    const db = mongoose.connection.db;
    const { referencesByModel, allReferencedFiles } = await getUploadReferences(db);

    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      console.log('[Cleanup Uploads]: server/uploads directory does not exist.');
      await mongoose.disconnect();
      return;
    }

    const filesOnDisk = fs.readdirSync(uploadsDir);
    const unreferencedFiles = filesOnDisk.filter((f) => !allReferencedFiles.has(f));
    const referencedFilesOnDisk = filesOnDisk.filter((f) => allReferencedFiles.has(f));

    console.log('\n======================================================');
    console.log('🧹 VASHTRAM SERVER UPLOADS CLEANUP REPORT');
    console.log('======================================================');
    console.log(`Total files currently on disk:    ${filesOnDisk.length}`);
    console.log(`Referenced files in database:     ${allReferencedFiles.size}`);
    console.log(`Unreferenced files to clean:      ${unreferencedFiles.length}`);

    // Print detailed referenced files report for Cloudinary migration
    console.log('\n--- REFERENCED FILES (PRESERVED FOR CLOUDINARY MIGRATION) ---');
    if (referencedFilesOnDisk.length === 0) {
      console.log('  No referenced files currently stored in local server/uploads.');
    } else {
      referencedFilesOnDisk.forEach((file) => {
        console.log(`  ✓ PRESERVED: ${file}`);
        // Find which models use it
        Object.entries(referencesByModel).forEach(([model, list]) => {
          const matches = list.filter((item) => item.filename === file);
          if (matches.length > 0) {
            console.log(`      Linked in "${model}": ${matches.map((m) => `${m.docId} (${m.field})`).join(', ')}`);
          }
        });
      });
    }

    if (!isConfirmed) {
      console.log('\n------------------------------------------------------');
      console.log('ℹ️  DRY RUN MODE: No files have been deleted.');
      console.log(`   WOULD DELETE ${unreferencedFiles.length} unreferenced file(s):`);
      unreferencedFiles.slice(0, 15).forEach((f) => console.log(`     - ${f}`));
      if (unreferencedFiles.length > 15) {
        console.log(`     ...and ${unreferencedFiles.length - 15} more.`);
      }
      console.log('\nTo permanently delete unreferenced files, run:');
      console.log('  node server/utils/cleanupUploads.js --confirm\n');
      await mongoose.disconnect();
      return;
    }

    // Execution mode: delete unreferenced files
    console.log('\n--- DELETING UNREFERENCED FILES (--confirm active) ---');
    let deletedCount = 0;
    for (const file of unreferencedFiles) {
      try {
        const filePath = path.join(uploadsDir, file);
        fs.unlinkSync(filePath);
        deletedCount++;
      } catch (err) {
        console.error(`  ✗ Error deleting ${file}:`, err.message);
      }
    }

    console.log(`\n✓ Successfully removed ${deletedCount} unreferenced file(s).`);
    console.log(`✓ Retained ${referencedFilesOnDisk.length} referenced file(s) for Cloudinary migration.`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('[Cleanup Uploads Exception]:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  cleanupUploads();
}

module.exports = { cleanupUploads };
