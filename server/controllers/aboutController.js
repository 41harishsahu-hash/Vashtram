const path = require('path');
const fs = require('fs');
const About = require('../models/About');
const {
  isCloudinaryConfigured,
  uploadToCloudinary,
} = require('../config/cloudinary');

// @desc    Get About page data (public)
// @route   GET /api/about
// @access  Public
const getAbout = async (req, res, next) => {
  try {
    const about = await About.getSingleton();
    res.status(200).json({
      success: true,
      about,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update About page details / image URL
// @route   PUT /api/about
// @access  Private/Admin
const updateAbout = async (req, res, next) => {
  try {
    const about = await About.getSingleton();
    const { imageUrl, altText, heading, subheading } = req.body;

    if (imageUrl !== undefined) {
      if (!imageUrl || !imageUrl.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Image URL cannot be empty',
        });
      }
      about.imageUrl = imageUrl.trim();
    }

    if (altText !== undefined) about.altText = altText.trim();
    if (heading !== undefined) about.heading = heading.trim();
    if (subheading !== undefined) about.subheading = subheading.trim();

    await about.save();

    res.status(200).json({
      success: true,
      message: 'About page details updated successfully',
      about,
    });
  } catch (error) {
    next(error);
  }
};

const { validateUploadedFile } = require('../utils/uploadValidator');

// @desc    Upload About page image directly from device
// @route   POST /api/about/upload
// @access  Private/Admin
const uploadAboutImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided for upload',
      });
    }

    validateUploadedFile(req.file);

    let finalImageUrl = '';

    // 1. If Cloudinary is configured, upload to Cloudinary
    if (isCloudinaryConfigured()) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, {
          folder: 'vastram/about',
        });
        finalImageUrl = uploadResult.url;
      } catch (cloudErr) {
        console.error('[Cloudinary Upload Error]:', cloudErr.message);
        if (process.env.NODE_ENV === 'production') {
          return res.status(502).json({
            success: false,
            message: `Failed to upload image to cloud storage: ${cloudErr.message || 'Service unavailable'}`,
          });
        }
      }
    }

    // 2. Reject in production if Cloudinary could not be used
    if (process.env.NODE_ENV === 'production' && !finalImageUrl) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary image storage is mandatory in production. Local disk writes are prohibited.',
      });
    }

    // 3. Local disk fallback ONLY for development mode
    if (!finalImageUrl) {
      const uploadDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const uniqueName = `about-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filePath = path.join(uploadDir, uniqueName);

      fs.writeFileSync(filePath, req.file.buffer);

      finalImageUrl = `/uploads/${uniqueName}`;
    }

    // Update About document in MongoDB
    const about = await About.getSingleton();
    about.imageUrl = finalImageUrl;
    if (req.body.altText && req.body.altText.trim()) {
      about.altText = req.body.altText.trim();
    }
    await about.save();

    res.status(200).json({
      success: true,
      message: 'About image uploaded and saved successfully',
      imageUrl: finalImageUrl,
      about,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset About image to default brand heritage image
// @route   POST /api/about/reset
// @access  Private/Admin
const resetAboutImage = async (req, res, next) => {
  try {
    const about = await About.getSingleton();
    about.imageUrl = '/img/About/About.jpeg';
    await about.save();

    res.status(200).json({
      success: true,
      message: 'About page image reset to default brand heritage image',
      about,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAbout,
  updateAbout,
  uploadAboutImage,
  resetAboutImage,
};
