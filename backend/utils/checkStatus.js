const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const products = await db.collection('products').find().toArray();
  const categories = await db.collection('categories').find().toArray();
  const abouts = await db.collection('abouts').find().toArray();
  const heroes = await db.collection('heroes').find().toArray();

  let counts = {
    cloudinary: 0,
    uploads: 0,
    img: 0,
    other: 0,
  };

  const classify = (url) => {
    if (!url || typeof url !== 'string') return;
    if (url.includes('cloudinary.com')) counts.cloudinary++;
    else if (url.includes('/uploads/')) counts.uploads++;
    else if (url.includes('/img/')) counts.img++;
    else counts.other++;
  };

  products.forEach(p => (p.images || []).forEach(classify));
  categories.forEach(c => {
    classify(c.image);
    (c.images || []).forEach(classify);
  });
  abouts.forEach(a => {
    classify(a.imageUrl);
    classify(a.image);
  });
  heroes.forEach(h => {
    classify(h.image);
    (h.images || []).forEach(img => classify(img?.url || img));
  });

  console.log('TOTAL_IMAGE_COUNTS:');
  console.log(JSON.stringify(counts, null, 2));

  console.log('\nPRODUCTS_REPORT:');
  products.forEach(p => {
    const nonCloud = (p.images || []).filter(img => typeof img === 'string' && !img.includes('cloudinary.com'));
    if (nonCloud.length > 0) {
      console.log(`[ATTENTION] ${p.name} | SKU: ${p.sku}`);
      console.log('   All images:', p.images);
    } else {
      console.log(`[OK - MIGRATED] ${p.name} | SKU: ${p.sku} (${p.images.length} images on Cloudinary)`);
      p.images.forEach(img => console.log(`   - ${img}`));
    }
  });

  console.log('\nCATEGORIES_REPORT:');
  categories.forEach(c => {
    const isCloud = c.image && c.image.includes('cloudinary.com');
    console.log(`- ${c.name}: ${isCloud ? 'Cloudinary OK' : c.image}`);
  });

  console.log('\nABOUT_REPORT:');
  abouts.forEach(a => {
    const isCloud = a.imageUrl && a.imageUrl.includes('cloudinary.com');
    console.log(`- About imageUrl: ${isCloud ? 'Cloudinary OK' : a.imageUrl}`);
  });

  await mongoose.disconnect();
})();
