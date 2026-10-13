const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

const originalMrpMap = {
  'VST-FB-101': 2499,
  'VST-SC-102': 2199,
  'VST-GB-103': 2799,
  'VST-AM-113': 1499,
  'VST-AM-115': 1499,
};

const fixProductPrices = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in server/.env');
    }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const products = await Product.find();
    console.log(`Found ${products.length} products to check.`);

    let fixedCount = 0;
    for (const prod of products) {
      let modified = false;

      // Restore true original MRP if it was crushed to variant price 344
      if (originalMrpMap[prod.sku] && prod.price < originalMrpMap[prod.sku]) {
        console.log(`Restoring original MRP for ${prod.name} (${prod.sku}): ${prod.price} -> ${originalMrpMap[prod.sku]}`);
        prod.price = originalMrpMap[prod.sku];
        modified = true;
      }

      // If discountPrice exceeds or equals original price, or is leftover from single-size pricing
      if (prod.discountPrice !== null && prod.discountPrice !== undefined) {
        if (prod.discountPrice >= prod.price || (prod.sizes && prod.sizes.length > 0)) {
          console.log(`Clearing stale/conflicting discountPrice (${prod.discountPrice}) for ${prod.name}`);
          prod.discountPrice = null;
          modified = true;
        }
      }

      if (modified) {
        await prod.save();
        fixedCount++;
      }
    }

    console.log(`Successfully fixed ${fixedCount} products.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

fixProductPrices();
