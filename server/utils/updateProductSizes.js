const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

const defaultSizeOptions = [
  { measurement: '48×75', name: 'Double', price: 344 },
  { measurement: '60×75', name: 'Queen', price: 481 },
  { measurement: '60×78', name: 'Queen', price: 471 },
  { measurement: '72×72', name: 'King', price: 501 },
  { measurement: '72×75', name: 'King', price: 501 },
  { measurement: '72×78', name: 'King', price: 449 },
  { measurement: '72×84', name: 'King', price: 549 },
  { measurement: '', name: 'Free Size', price: 525 },
];

const updateProducts = async () => {
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

    let updatedCount = 0;
    for (const prod of products) {
      if (!prod.sizes || prod.sizes.length === 0) {
        prod.sizes = defaultSizeOptions;
        if (!prod.price || prod.price === 0) {
          prod.price = defaultSizeOptions[0].price;
        }
        if (prod.discountPrice && prod.discountPrice >= prod.price) {
          prod.discountPrice = null;
        }
        await prod.save();
        updatedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount} products with multiple size options.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

updateProducts();
