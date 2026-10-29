const Category = require('../models/Category');
const Product = require('../models/Product');
const crypto = require('crypto');
// Helper to create URL slug from string
const slugify = (text) => {
  if (!text) return `item-${crypto.randomBytes(3).toString('hex')}`;
  let slug = text
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug || /^[-]+$/.test(slug)) {
    slug = `item-${crypto.randomBytes(3).toString('hex')}`;
  }
  return slug;
};

// @desc    Get all categories (public gets active, admin can get all)
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
    const filter = req.query.all === 'true' ? {} : { isActive: true };

    const [categories, productCounts] = await Promise.all([
      Category.find(filter).sort({ order: 1, name: 1 }).lean(),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map();
    for (const item of productCounts) {
      if (item._id) {
        countMap.set(item._id.toString(), item.count);
      }
    }

    const categoriesWithCount = categories.map((cat) => {
      const catId = cat._id ? cat._id.toString() : '';
      const count = countMap.get(catId) || 0;
      const images =
        Array.isArray(cat.images) && cat.images.length > 0
          ? cat.images
          : cat.image
            ? [cat.image]
            : [];
      return {
        ...cat,
        images,
        image: images[0] || cat.image || '',
        productCount: count,
      };
    });

    res.status(200).json({
      success: true,
      count: categoriesWithCount.length,
      categories: categoriesWithCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category by slug or id
// @route   GET /api/categories/:identifier
// @access  Public
const getCategory = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let category;

    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(identifier).lean();
    } else {
      category = await Category.findOne({ slug: identifier.toLowerCase() }).lean();
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const productCount = await Product.countDocuments({
      category: category._id,
      isActive: true,
    });

    const images =
      Array.isArray(category.images) && category.images.length > 0
        ? category.images
        : category.image
          ? [category.image]
          : [];

    res.status(200).json({
      success: true,
      category: {
        ...category,
        images,
        image: images[0] || category.image || '',
        productCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = async (req, res, next) => {
  try {
    const { name, description, image, images, order, isActive } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    const slug = slugify(name);

    // Check duplicate slug/name
    const existing = await Category.findOne({ $or: [{ name }, { slug }] });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name or slug already exists',
      });
    }

    // Process images (up to 4 images)
    let cleanImages = [];
    if (Array.isArray(images)) {
      cleanImages = images
        .filter((img) => img && typeof img === 'string' && img.trim() !== '');
      if (cleanImages.length > 4) {
        return res.status(400).json({
          success: false,
          message: 'A category can have at most 4 images.',
        });
      }
    } else if (image && typeof image === 'string' && image.trim() !== '') {
      cleanImages = [image.trim()];
    }

    const primaryImage = cleanImages[0] || (typeof image === 'string' ? image.trim() : '');

    const category = await Category.create({
      name,
      slug,
      description: description || '',
      image: primaryImage,
      images: cleanImages,
      order: order !== undefined ? Number(order) : 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    let category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    if (req.body.name && req.body.name !== category.name) {
      category.name = req.body.name;
      category.slug = slugify(req.body.name);
    }
    if (req.body.description !== undefined) category.description = req.body.description;

    // Handle images array & cover image
    if (req.body.images !== undefined) {
      let cleanImages = [];
      if (Array.isArray(req.body.images)) {
        cleanImages = req.body.images
          .filter((img) => img && typeof img === 'string' && img.trim() !== '');
        if (cleanImages.length > 4) {
          return res.status(400).json({
            success: false,
            message: 'A category can have at most 4 images.',
          });
        }
      }
      category.images = cleanImages;
      category.image = cleanImages[0] || '';
    } else if (req.body.image !== undefined) {
      category.image = req.body.image;
      if (!category.images || category.images.length === 0) {
        category.images = req.body.image ? [req.body.image] : [];
      }
    }

    if (req.body.order !== undefined) category.order = Number(req.body.order);
    if (req.body.isActive !== undefined) category.isActive = req.body.isActive;

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Check if products exist in category
    const productsUsing = await Product.countDocuments({ category: id });
    if (productsUsing > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category because it has ${productsUsing} product(s) assigned to it. Please reassign or delete them first.`,
      });
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
