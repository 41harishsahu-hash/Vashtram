const Feature = require('../models/Feature');
const { DEFAULT_FEATURES, ensureDefaultFeatures } = require('../utils/initFeatures');

// @desc    Get features (public gets active by default, admin can query ?all=true)
// @route   GET /api/features
// @access  Public
const getFeatures = async (req, res, next) => {
  try {
    const filter = req.query.all === 'true' ? {} : { isActive: true };
    let features = await Feature.find(filter).sort({ displayOrder: 1, createdAt: 1 }).lean();

    // If no features exist yet, auto-seed defaults only when empty
    if (features.length === 0 && req.query.all !== 'true') {
      const totalCount = await Feature.countDocuments();
      if (totalCount === 0) {
        await ensureDefaultFeatures();
        features = await Feature.find(filter).sort({ displayOrder: 1, createdAt: 1 }).lean();
      }
    }

    res.status(200).json({
      success: true,
      count: features.length,
      features,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all features including inactive ones for Admin Panel
// @route   GET /api/features/admin
// @access  Private/Admin
const getAdminFeatures = async (req, res, next) => {
  try {
    const totalCount = await Feature.countDocuments();
    if (totalCount === 0) {
      await ensureDefaultFeatures();
    }

    const features = await Feature.find({}).sort({ displayOrder: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      count: features.length,
      features,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single feature by ID
// @route   GET /api/features/:id
// @access  Private/Admin
const getFeatureById = async (req, res, next) => {
  try {
    const feature = await Feature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found',
      });
    }

    res.status(200).json({
      success: true,
      feature,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new feature
// @route   POST /api/features
// @access  Private/Admin
const createFeature = async (req, res, next) => {
  try {
    const { title, description, icon, displayOrder, isActive } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Feature title is required',
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Feature description is required',
      });
    }

    // Determine default displayOrder if not specified
    let finalOrder = Number(displayOrder);
    if (isNaN(finalOrder)) {
      const highest = await Feature.findOne().sort({ displayOrder: -1 }).select('displayOrder');
      finalOrder = highest && highest.displayOrder !== undefined ? highest.displayOrder + 1 : 1;
    }

    const feature = await Feature.create({
      title: title.trim(),
      description: description.trim(),
      icon: (icon && icon.trim()) || 'Feather',
      displayOrder: finalOrder,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.status(201).json({
      success: true,
      message: `Feature "${feature.title}" created successfully`,
      feature,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update feature
// @route   PUT /api/features/:id
// @access  Private/Admin
const updateFeature = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, icon, displayOrder, isActive } = req.body;

    const feature = await Feature.findById(id);
    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found',
      });
    }

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Feature title cannot be empty',
        });
      }
      feature.title = title.trim();
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Feature description cannot be empty',
        });
      }
      feature.description = description.trim();
    }

    if (icon !== undefined && icon.trim()) {
      feature.icon = icon.trim();
    }

    if (displayOrder !== undefined && !isNaN(Number(displayOrder))) {
      feature.displayOrder = Number(displayOrder);
    }

    if (isActive !== undefined) {
      feature.isActive = Boolean(isActive);
    }

    await feature.save();

    res.status(200).json({
      success: true,
      message: `Feature "${feature.title}" updated successfully`,
      feature,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle feature Active/Inactive status
// @route   PUT /api/features/:id/toggle or PATCH /api/features/:id/status
// @access  Private/Admin
const toggleFeatureStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const feature = await Feature.findById(id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found',
      });
    }

    if (req.body.isActive !== undefined) {
      feature.isActive = Boolean(req.body.isActive);
    } else {
      feature.isActive = !feature.isActive;
    }

    await feature.save();

    res.status(200).json({
      success: true,
      message: `Feature "${feature.title}" is now ${feature.isActive ? 'Active' : 'Inactive'}`,
      feature,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a feature
// @route   DELETE /api/features/:id
// @access  Private/Admin
const deleteFeature = async (req, res, next) => {
  try {
    const { id } = req.params;
    const feature = await Feature.findById(id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found',
      });
    }

    const title = feature.title;
    await Feature.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Feature "${title}" deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch reorder features
// @route   PUT /api/features/reorder
// @access  Private/Admin
const reorderFeatures = async (req, res, next) => {
  try {
    const { orders, orderedIds } = req.body;

    if (Array.isArray(orderedIds) && orderedIds.length > 0) {
      const updates = orderedIds.map((id, index) =>
        Feature.findByIdAndUpdate(id, { displayOrder: index + 1 })
      );
      await Promise.all(updates);
    } else if (Array.isArray(orders) && orders.length > 0) {
      const updates = orders.map((item) =>
        Feature.findByIdAndUpdate(item.id, { displayOrder: Number(item.displayOrder) || 0 })
      );
      await Promise.all(updates);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either orderedIds or orders array for reordering',
      });
    }

    const features = await Feature.find({}).sort({ displayOrder: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      message: 'Features reordered successfully',
      features,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset features to default 4 items
// @route   POST /api/features/reset
// @access  Private/Admin
const resetFeatureDefaults = async (req, res, next) => {
  try {
    await Feature.deleteMany({});
    await Feature.insertMany(DEFAULT_FEATURES);
    const features = await Feature.find({}).sort({ displayOrder: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      message: 'Features reset to defaults successfully',
      features,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFeatures,
  getAdminFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  toggleFeatureStatus,
  deleteFeature,
  reorderFeatures,
  resetFeatureDefaults,
};
