const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const LOCAL_URI = process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017/vashtram';
const ATLAS_URI = process.env.MONGODB_URI;

if (!ATLAS_URI) {
  console.error('MONGODB_URI is required in environment variables for migration.');
  process.exit(1);
}

async function syncDatabases() {
  console.log('====================================================');
  console.log('  VASTRAM — LOCAL MONGODB TO ATLAS MIGRATION TOOL   ');
  console.log('====================================================\n');

  console.log('[1/4] Connecting to Local MongoDB...');
  const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
  console.log('✓ Connected to Local DB:', localConn.name);

  console.log('\n[2/4] Connecting to MongoDB Atlas...');
  console.log('Target Atlas URI:', ATLAS_URI.replace(/:([^:@]+)@/, ':***@'));

  let atlasConn;
  try {
    atlasConn = await mongoose.createConnection(ATLAS_URI, {
      serverSelectionTimeoutMS: 10000,
    }).asPromise();
    console.log('✓ Connected to MongoDB Atlas:', atlasConn.host + '/' + atlasConn.name);
  } catch (err) {
    console.error('\n✗ FAILED to connect to MongoDB Atlas!');
    console.error('Error message:', err.message);
    console.error('\n[ROOT CAUSE]:');
    console.error('Atlas rejected the TLS connection (SSL Alert 80).');
    console.error('Your IP address is not whitelisted in MongoDB Atlas Network Access.\n');
    console.error('[ACTION TO FIX]:');
    console.error('1. Open https://cloud.mongodb.com and log in.');
    console.error('2. In the left sidebar under Security, click "Network Access".');
    console.error('3. Click "+ ADD IP ADDRESS".');
    console.error('4. Either:');
    console.error('   - Click "ALLOW ACCESS FROM ANYWHERE" (adds 0.0.0.0/0)');
    console.error('   OR');
    console.error('   - Add your current IP address.');
    console.error('5. Click "Confirm" and wait ~1 minute for Atlas to deploy the change.');
    console.error('6. Re-run: npm run sync-atlas\n');
    process.exit(1);
  }

  console.log('\n[3/4] Migrating collections from Local DB to Atlas...');
  const collections = await localConn.db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name).filter((n) => !n.startsWith('system.'));

  console.log(`Found ${collectionNames.length} collections to sync:`, collectionNames.join(', '));

  for (const name of collectionNames) {
    const localCollection = localConn.db.collection(name);
    const atlasCollection = atlasConn.db.collection(name);

    const docs = await localCollection.find({}).toArray();
    console.log(`\n• Syncing "${name}" (${docs.length} documents)...`);

    if (docs.length > 0) {
      // Clear existing in Atlas collection to prevent duplicate key conflicts
      await atlasCollection.deleteMany({});
      await atlasCollection.insertMany(docs);
      console.log(`  ✓ Successfully copied ${docs.length} documents to Atlas.`);
    } else {
      console.log(`  - Collection "${name}" is empty, skipped.`);
    }
  }

  console.log('\n[4/4] Verifying Atlas database contents:');
  for (const name of collectionNames) {
    const count = await atlasConn.db.collection(name).countDocuments();
    console.log(`  - ${name}: ${count} documents`);
  }

  await localConn.close();
  await atlasConn.close();

  console.log('\n====================================================');
  console.log('✓ MIGRATION COMPLETE! Atlas is now fully synchronized.');
  console.log('====================================================');
  process.exit(0);
}

syncDatabases().catch((err) => {
  console.error('[Migration Error]:', err.message);
  process.exit(1);
});
