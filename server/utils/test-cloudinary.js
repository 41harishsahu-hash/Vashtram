const path = require('path');
const dotenv = require('dotenv');

// Ensure server/.env is loaded regardless of current working directory
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
} catch (e) {
  console.error('The "cloudinary" package is not installed. Run: npm install cloudinary dotenv');
  process.exit(1);
}

const cloudName = process.env.CLOUDINARY_CLOUD_NAME ? process.env.CLOUDINARY_CLOUD_NAME.trim() : '';
const apiKey = process.env.CLOUDINARY_API_KEY ? process.env.CLOUDINARY_API_KEY.trim() : '';
const apiSecret = process.env.CLOUDINARY_API_SECRET ? process.env.CLOUDINARY_API_SECRET.trim() : '';

// Uses CLOUDINARY_URL if set, otherwise the three separate variables.
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

const cfg = cloudinary.config();
console.log('Cloud name :', cfg.cloud_name || '(missing)');
console.log('API key    :', cfg.api_key ? cfg.api_key.slice(0, 4) + '****' : '(missing)');
console.log('API secret :', cfg.api_secret ? 'set' : '(missing)');

// Check if cloud_name appears to be a display name or project name rather than the exact cloud name
const rawName = cfg.cloud_name || '';
const hasSpaces = /\s/.test(rawName);
const hasUppercase = /[A-Z]/.test(rawName);
const looksLikeProjectName = /^(vashtram|vastram|root|project|app)$/i.test(rawName);

if (hasSpaces || hasUppercase || looksLikeProjectName) {
  console.warn('\n[!] Cloud name format notice:');
  console.warn('    Cloud name must be copied exactly from Cloudinary Dashboard > API Keys > Cloud name.');
}

if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
  console.error('\nCredentials missing. Check your .env file (run from the folder that contains it).');
  process.exit(1);
}

(async () => {
  try {
    const ping = await cloudinary.api.ping();
    console.log('\nPing OK:', ping);

    // Upload a tiny 1x1 test image, then delete it.
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const up = await cloudinary.uploader.upload(png, { folder: 'vastram-test' });
    console.log('Upload OK:', up.secure_url);

    await cloudinary.uploader.destroy(up.public_id);
    console.log('Cleanup OK. Cloudinary is working.');
  } catch (err) {
    const e = err.error || err;
    console.error('Cloudinary test failed:', e.message || 'unknown error', e.http_code || '');
    process.exit(1);
  }
})();

