/**
 * One-time Migration Utility: Local Uploads to Cloudinary
 * 
 * Safely migrates local disk /uploads/ referenced images to Cloudinary.
 * Updates MongoDB database URLs with the persistent Cloudinary secure URLs.
 * 
 * Dry-run by default. Requires `--confirm` flag to execute uploads and database updates.
 * Idempotent: skips images that already use Cloudinary URLs.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const { getUploadReferences } = require('./checkReferencedUploads');
const { isCloudinaryConfigured, uploadToCloudinary } = require('../config/cloudinary');

const migrateUploadsToCloudinary = async () => {
  const isConfirmed = process.argv.includes('--confirm');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[Migration Error]: MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  if (!isCloudinaryConfigured()) {
    console.error('\n[Migration Aborted]: Cloudinary credentials are not configured in environment.');
    console.error('Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.\n');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('[Migration]: Connected to MongoDB database.');

    const db = mongoose.connection.db;
    const { allReferencedFiles } = await getUploadReferences(db);

    const uploadsDir = path.join(__dirname, '../uploads');
    const existingReferencedFiles = [...allReferencedFiles].filter((file) =>
      fs.existsSync(path.join(uploadsDir, file))
    );

    console.log('\n======================================================');
    console.log('☁️  VASHTRAM LOCAL UPLOADS TO CLOUDINARY MIGRATION');
    console.log('======================================================');
    console.log(`Total unique files referenced in DB:   ${allReferencedFiles.size}`);
    console.log(`Referenced files physically on disk:   ${existingReferencedFiles.length}`);

    if (existingReferencedFiles.length === 0) {
      console.log('✓ No referenced local files found on disk to migrate.');
      await mongoose.disconnect();
      return;
    }

    if (!isConfirmed) {
      console.log('\n------------------------------------------------------');
      console.log('ℹ️  DRY RUN MODE: No files will be uploaded or DB updated.');
      console.log(`   WOULD UPLOAD ${existingReferencedFiles.length} file(s) to Cloudinary:`);
      existingReferencedFiles.forEach((file) => console.log(`     - ${file}`));
      console.log('\nTo execute Cloudinary uploads and database URL updates, run:');
      console.log('  node server/utils/migrateUploadsToCloudinary.js --confirm\n');
      await mongoose.disconnect();
      return;
    }

    console.log('\n--- UPLOADING TO CLOUDINARY & UPDATING DATABASE ---');
    const fileToCloudinaryUrl = new Map();

    for (const filename of existingReferencedFiles) {
      const filePath = path.join(uploadsDir, filename);
      const buffer = fs.readFileSync(filePath);

      console.log(`Uploading ${filename} to Cloudinary...`);
      try {
        const uploadRes = await uploadToCloudinary(buffer, { folder: 'vastram/migrated' });
        fileToCloudinaryUrl.set(filename, uploadRes.url);
        console.log(`  ✓ Uploaded -> ${uploadRes.url}`);
      } catch (uploadErr) {
        console.error(`  ✗ Failed to upload ${filename}:`, uploadErr.message);
      }
    }

    console.log('\n--- UPDATING DATABASE COLLECTIONS WITH CLOUDINARY URLS ---');
    let totalUpdated = 0;

    for (const [filename, cloudUrl] of fileToCloudinaryUrl.entries()) {
      const regexTarget = new RegExp(`(?:/)?uploads/${filename.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`);

      // 1. Update Products
      const prodRes = await db.collection('products').updateMany(
        { images: { $regex: regexTarget } },
        [{
          $set: {
            images: {
              $map: {
                input: '$images',
                as: 'img',
                in: {
                  $cond: [
                    { $regexMatch: { input: '$$img', regex: regexTarget } },
                    cloudUrl,
                    '$$img',
                  ],
                },
              },
            },
          },
        }]
      );
      if (prodRes.modifiedCount > 0) {
        console.log(`  ✓ Updated ${prodRes.modifiedCount} product(s) for ${filename}`);
        totalUpdated += prodRes.modifiedCount;
      }

      // 2. Update Categories (main image and images gallery)
      const catRes = await db.collection('categories').updateMany(
        { image: { $regex: regexTarget } },
        { $set: { image: cloudUrl } }
      );
      if (catRes.modifiedCount > 0) {
        console.log(`  ✓ Updated ${catRes.modifiedCount} category(s) main image for ${filename}`);
        totalUpdated += catRes.modifiedCount;
      }

      const catGalleryRes = await db.collection('categories').updateMany(
        { images: { $regex: regexTarget } },
        [{
          $set: {
            images: {
              $map: {
                input: { $ifNull: ['$images', []] },
                as: 'img',
                in: {
                  $cond: [
                    { $regexMatch: { input: '$$img', regex: regexTarget } },
                    cloudUrl,
                    '$$img',
                  ],
                },
              },
            },
          },
        }]
      );
      if (catGalleryRes.modifiedCount > 0) {
        console.log(`  ✓ Updated ${catGalleryRes.modifiedCount} category(s) gallery for ${filename}`);
        totalUpdated += catGalleryRes.modifiedCount;
      }

      // 3. Update About
      const aboutRes = await db.collection('abouts').updateMany(
        { imageUrl: { $regex: regexTarget } },
        { $set: { imageUrl: cloudUrl } }
      );
      if (aboutRes.modifiedCount > 0) {
        console.log(`  ✓ Updated ${aboutRes.modifiedCount} about page record(s) for ${filename}`);
        totalUpdated += aboutRes.modifiedCount;
      }

      // 4. Update Hero
      const heroDocs = await db.collection('heroes').find().toArray();
      for (const h of heroDocs) {
        let changed = false;
        const newImages = (h.images || []).map((img) => {
          if (img?.url && regexTarget.test(img.url)) {
            changed = true;
            return { ...img, url: cloudUrl };
          }
          return img;
        });
        if (changed) {
          await db.collection('heroes').updateOne({ _id: h._id }, { $set: { images: newImages } });
          console.log(`  ✓ Updated hero carousel for ${filename}`);
          totalUpdated++;
        }
      }
    }

    console.log(`\n✓ Migration complete. Successfully updated ${totalUpdated} database document(s).`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('[Migration Exception]:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  migrateUploadsToCloudinary();
}

module.exports = { migrateUploadsToCloudinary };
