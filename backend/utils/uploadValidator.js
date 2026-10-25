const path = require('path');
const { isCloudinaryConfigured } = require('../config/cloudinary');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validates the file buffer magic bytes against expected image signatures
 */
const validateMagicBytes = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { valid: false, detectedType: null };
  }

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedType: 'image/jpeg' };
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedType: 'image/png' };
  }

  // WebP signature: RIFF .... WEBP
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { valid: true, detectedType: 'image/webp' };
  }

  return { valid: false, detectedType: null };
};

/**
 * Comprehensive upload validation helper.
 * Validates file presence, size, MIME type, extension, magic-byte file signature,
 * and enforces Cloudinary requirement in production.
 */
const validateUploadedFile = (file) => {
  if (!file) {
    const error = new Error('No image file provided for upload');
    error.statusCode = 400;
    throw error;
  }

  // 1. File size check
  if (file.size > MAX_FILE_SIZE || (file.buffer && file.buffer.length > MAX_FILE_SIZE)) {
    const error = new Error('Image size exceeds maximum limit of 5MB');
    error.statusCode = 400;
    throw error;
  }

  // 2. Extension check
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error('Invalid file extension. Only .jpg, .jpeg, .png, and .webp are allowed.');
    error.statusCode = 400;
    throw error;
  }

  // 3. MIME type check
  const mime = (file.mimetype || '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    const error = new Error('Invalid MIME type. Only image/jpeg, image/png, and image/webp are allowed.');
    error.statusCode = 400;
    throw error;
  }

  // 4. Magic-byte signature verification
  if (file.buffer) {
    const { valid, detectedType } = validateMagicBytes(file.buffer);
    if (!valid) {
      const error = new Error(
        'File content failed security validation. File binary signature does not match a valid JPEG, PNG, or WebP image.'
      );
      error.statusCode = 400;
      throw error;
    }

    if (detectedType !== mime && !(detectedType === 'image/jpeg' && (mime === 'image/jpg' || mime === 'image/jpeg'))) {
      const error = new Error('File content signature does not match declared MIME type.');
      error.statusCode = 400;
      throw error;
    }
  }

  // 5. Production constraint: Cloudinary is mandatory; local disk writes are strictly prohibited in production
  if (process.env.NODE_ENV === 'production' && !isCloudinaryConfigured()) {
    const error = new Error(
      'Cloudinary image storage is mandatory in production but is not configured. Local disk storage is strictly prohibited.'
    );
    error.statusCode = 503;
    throw error;
  }

  return true;
};

module.exports = {
  validateUploadedFile,
  validateMagicBytes,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
};
