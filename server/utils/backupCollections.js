const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

async function runBackup() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not found in environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  console.log(`Connected to: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const collections = ['products', 'categories', 'abouts', 'heroes'];
  const backupData = {
    timestamp: new Date().toISOString(),
    database: mongoose.connection.name,
    collections: {},
  };

  for (const collName of collections) {
    const docs = await db.collection(collName).find().toArray();
    backupData.collections[collName] = docs;
    console.log(`Backed up ${collName}: ${docs.length} documents`);
  }

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `backup-${timestampStr}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`Backup successfully written to: ${backupFilePath}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  runBackup().catch((err) => {
    console.error('Backup failed:', err.message);
    process.exit(1);
  });
}

module.exports = { runBackup };
