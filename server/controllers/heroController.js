const Hero = require('../models/Hero');

// @desc    Get Hero Section content
// @route   GET /api/hero
// @access  Public
const getHero = async (req, res, next) => {
  try {
    const hero = await Hero.getSingleton();

    // Sort images by order ascending
    if (hero.images && hero.images.length > 0) {
      hero.images.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    res.status(200).json({
      success: true,
      hero,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Hero Text and Buttons
// @route   PUT /api/hero/text
// @access  Private/Admin
const updateHeroText = async (req, res, next) => {
  try {
    const {
      smallLabel,
      heading,
      description,
      button1,
      button2,
      floatingCard,
    } = req.body;

    const hero = await Hero.getSingleton();

    if (smallLabel !== undefined) hero.smallLabel = smallLabel.trim();
    if (heading !== undefined) hero.heading = heading.trim();
    if (description !== undefined) hero.description = description.trim();

    if (button1) {
      hero.button1 = {
        text: button1.text !== undefined ? button1.text.trim() : hero.button1.text,
        link: button1.link !== undefined ? button1.link.trim() : hero.button1.link,
      };
    }

    if (button2) {
      hero.button2 = {
        text: button2.text !== undefined ? button2.text.trim() : hero.button2.text,
        link: button2.link !== undefined ? button2.link.trim() : hero.button2.link,
      };
    }

    if (floatingCard) {
      hero.floatingCard = {
        title: floatingCard.title !== undefined ? floatingCard.title.trim() : hero.floatingCard.title,
        subtitle: floatingCard.subtitle !== undefined ? floatingCard.subtitle.trim() : hero.floatingCard.subtitle,
        badge: floatingCard.badge !== undefined ? floatingCard.badge.trim() : hero.floatingCard.badge,
        show: floatingCard.show !== undefined ? Boolean(floatingCard.show) : hero.floatingCard.show,
      };
    }

    await hero.save();

    res.status(200).json({
      success: true,
      message: 'Hero text content updated successfully',
      hero,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a new Hero image
// @route   POST /api/hero/images
// @access  Private/Admin
const addHeroImage = async (req, res, next) => {
  try {
    const { url, altText, isActive, order } = req.body;

    if (!url || !url.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid image URL',
      });
    }

    const hero = await Hero.getSingleton();

    // Determine default order (highest current order + 1)
    let nextOrder = 1;
    if (hero.images && hero.images.length > 0) {
      const maxOrder = Math.max(...hero.images.map((img) => img.order || 0));
      nextOrder = maxOrder + 1;
    }

    const newImage = {
      url: url.trim(),
      altText: altText ? altText.trim() : 'VASHTRAM Premium Mattress Protector',
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      order: order !== undefined && order !== '' ? Number(order) : nextOrder,
    };

    hero.images.push(newImage);
    await hero.save();

    // Return with sorted images
    hero.images.sort((a, b) => (a.order || 0) - (b.order || 0));

    res.status(201).json({
      success: true,
      message: 'Hero image added successfully',
      hero,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update / Replace an existing Hero image
// @route   PUT /api/hero/images/:id
// @access  Private/Admin
const updateHeroImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { url, altText, isActive, order } = req.body;

    const hero = await Hero.getSingleton();
    const image = hero.images.id(id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Hero image not found',
      });
    }

    if (url !== undefined && url.trim()) image.url = url.trim();
    if (altText !== undefined) image.altText = altText.trim();
    if (isActive !== undefined) image.isActive = Boolean(isActive);
    if (order !== undefined && order !== '') image.order = Number(order);

    await hero.save();

    hero.images.sort((a, b) => (a.order || 0) - (b.order || 0));

    res.status(200).json({
      success: true,
      message: 'Hero image updated successfully',
      hero,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a Hero image
// @route   DELETE /api/hero/images/:id
// @access  Private/Admin
const deleteHeroImage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const hero = await Hero.getSingleton();
    const imageIndex = hero.images.findIndex((img) => img._id.toString() === id);

    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Hero image not found',
      });
    }

    hero.images.splice(imageIndex, 1);
    await hero.save();

    hero.images.sort((a, b) => (a.order || 0) - (b.order || 0));

    res.status(200).json({
      success: true,
      message: 'Hero image removed successfully',
      hero,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder Hero images
// @route   PUT /api/hero/images/reorder
// @access  Private/Admin
const reorderHeroImages = async (req, res, next) => {
  try {
    const { imageIds, imageOrders } = req.body;

    const hero = await Hero.getSingleton();

    if (Array.isArray(imageIds)) {
      // Reorder sequentially based on index in array
      imageIds.forEach((id, index) => {
        const img = hero.images.id(id);
        if (img) {
          img.order = index + 1;
        }
      });
    } else if (Array.isArray(imageOrders)) {
      // Reorder based on explicit id-order pairs
      imageOrders.forEach((item) => {
        const img = hero.images.id(item.id);
        if (img && item.order !== undefined) {
          img.order = Number(item.order);
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide imageIds or imageOrders array for reordering',
      });
    }

    await hero.save();
    hero.images.sort((a, b) => (a.order || 0) - (b.order || 0));

    res.status(200).json({
      success: true,
      message: 'Hero images reordered successfully',
      hero,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Hero content to brand defaults
// @route   POST /api/hero/reset
// @access  Private/Admin
const resetHeroDefaults = async (req, res, next) => {
  try {
    await Hero.deleteMany({});
    const hero = await Hero.create({});

    res.status(200).json({
      success: true,
      message: 'Hero content reset to default brand configuration',
      hero,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHero,
  updateHeroText,
  addHeroImage,
  updateHeroImage,
  deleteHeroImage,
  reorderHeroImages,
  resetHeroDefaults,
};
