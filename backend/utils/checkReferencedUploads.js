const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

/**
 * Scans MongoDB collections (products, categories, abouts, heroes)
 * and returns all local /uploads/ file references with entity associations.
 */
async function getUploadReferences(db) {
  const referencesByModel = {
    products: [],
    categories: [],
    about: [],
    hero: [],
  };

  const allReferencedFiles = new Set();

  const extract = (str, model, docId, field) => {
    if (typeof str === 'string') {
      const match = str.match(/(?:^|\/)uploads\/([^"'?#\s]+)/i);
      if (match) {
        const filename = match[1];
        allReferencedFiles.add(filename);
        referencesByModel[model].push({
          filename,
          rawUrl: str,
          docId: docId ? docId.toString() : null,
          field,
        });
      }
    }
  };

  // 1. Products
  const products = await db.collection('products').find().toArray();
  products.forEach((p) => {
    (p.images || []).forEach((img, idx) => extract(img, 'products', p._id, `images[${idx}]`));
  });

  // 2. Categories
  const categories = await db.collection('categories').find().toArray();
  categories.forEach((c) => {
    extract(c.image, 'categories', c._id, 'image');
    (c.images || []).forEach((img, idx) => extract(img, 'categories', c._id, `images[${idx}]`));
  });

  // 3. About
  const abouts = await db.collection('abouts').find().toArray();
  abouts.forEach((a) => {
    extract(a.imageUrl, 'about', a._id, 'imageUrl');
    extract(a.image, 'about', a._id, 'image');
  });

  // 4. Hero
  const heroes = await db.collection('heroes').find().toArray();
  heroes.forEach((h) => {
    extract(h.image, 'hero', h._id, 'image');
    (h.images || []).forEach((img, idx) => {
      extract(img?.url || img, 'hero', h._id, `images[${idx}].url`);
    });
  });

  return { referencesByModel, allReferencedFiles };
}

async function check() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URI_TEST;
  if (!mongoUri) {
    console.error('[Check Uploads Error]: Neither MONGODB_URI nor MONGODB_URI_TEST is configured.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('[Check Uploads]: Connected to MongoDB database.');

  const db = mongoose.connection.db;
  const { referencesByModel, allReferencedFiles } = await getUploadReferences(db);

  const uploadsDir = path.join(__dirname, '../uploads');
  const filesOnDisk = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];

  console.log('\n======================================================');
  console.log('📊 DATABASE /UPLOADS/ REFERENCE AUDIT REPORT');
  console.log('======================================================');
  console.log(`Total files stored in server/uploads: ${filesOnDisk.length}`);
  console.log(`Unique filenames referenced in DB:   ${allReferencedFiles.size}`);

  console.log('\nBreakdown by Collection:');
  console.log(`  • Products:   ${referencesByModel.products.length} reference(s)`);
  referencesByModel.products.forEach((r) => console.log(`      - ${r.filename} (Doc ID: ${r.docId})`));

  console.log(`  • Categories: ${referencesByModel.categories.length} reference(s)`);
  referencesByModel.categories.forEach((r) => console.log(`      - ${r.filename} (Doc ID: ${r.docId})`));

  console.log(`  • About:      ${referencesByModel.about.length} reference(s)`);
  referencesByModel.about.forEach((r) => console.log(`      - ${r.filename} (Doc ID: ${r.docId})`));

  console.log(`  • Hero:       ${referencesByModel.hero.length} reference(s)`);
  referencesByModel.hero.forEach((r) => console.log(`      - ${r.filename} (Doc ID: ${r.docId})`));

  const unreferenced = filesOnDisk.filter((f) => !allReferencedFiles.has(f));
  console.log(`\nUnreferenced files on disk: ${unreferenced.length}`);
  if (unreferenced.length > 0) {
    console.log(`  ${unreferenced.slice(0, 10).join(', ')}${unreferenced.length > 10 ? ` ...and ${unreferenced.length - 10} more` : ''}`);
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  check().catch((err) => {
    console.error('[Check Uploads Exception]:', err.message);
    process.exit(1);
  });
}

module.exports = { getUploadReferences, check };
