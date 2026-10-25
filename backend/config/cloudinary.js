const path = require('path');
const dotenv = require('dotenv');

// Ensure server/.env is loaded
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const cloudinary = require('cloudinary').v2;

const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME.trim() &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_KEY.trim() &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_API_SECRET.trim()
  );
};

const configureCloudinary = () => {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
      secure: true,
    });
    return true;
  }
  return false;
};

// Initial configuration
configureCloudinary();

/**
 * Upload a file buffer to Cloudinary using upload_stream
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {Object} options - Cloudinary upload options
 * @returns {Promise<{ url: string, publicId: string }>}
 */
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!configureCloudinary()) {
      return reject(new Error('Cloudinary credentials are not configured'));
    }

    const uploadOptions = {
      folder: 'vastram/products',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [
        { quality: 'auto:good', fetch_format: 'auto' },
        { width: 2000, height: 2000, crop: 'limit' },
      ],
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        return reject(error);
      }
      resolve({
        url: result.secure_url,
        publicId: result.public_id,
        bytes: result.bytes,
        format: result.format,
      });
    });

    stream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary
 * @param {string} publicId - Cloudinary asset public ID
 * @returns {Promise<Object>}
 */
const deleteFromCloudinary = async (publicId) => {
  if (!configureCloudinary() || !publicId) {
    return null;
  }
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`[Cloudinary Delete Error]: ${err.message}`);
    return null;
  }
};

/**
 * Helper to extract public ID from a Cloudinary URL
 * @param {string} url - Cloudinary asset URL
 * @returns {string|null}
 */
const extractPublicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }
  try {
    // Cloudinary URLs typically look like: .../upload/v1234567890/vastram/products/xyz.webp
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    let pathAfterUpload = url.substring(uploadIndex + 8);
    // Remove version tag if present (e.g. v1700000000/)
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');
    // Strip file extension
    const lastDotIndex = pathAfterUpload.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      pathAfterUpload = pathAfterUpload.substring(0, lastDotIndex);
    }
    return pathAfterUpload;
  } catch {
    return null;
  }
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
};
