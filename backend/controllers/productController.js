const crypto = require('crypto');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const { deleteFromCloudinary, extractPublicIdFromUrl } = require('../config/cloudinary');
const { createSafeRegex, createExactRegex } = require('../utils/regexHelper');

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

// @desc    Get all products with filtering, search, sorting and pagination
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      size,
      material,
      pattern,
      color,
      minPrice,
      maxPrice,
      inStock,
      featured,
      sort,
      page = 1,
      limit = 12,
      includeInactive,
    } = req.query;

    const query = {};

    // Inactive filter: Only authenticated admins can view inactive products
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin || includeInactive !== 'true') {
      query.isActive = true;
    }

    // Search keyword with ReDoS-safe regex
    if (search && search.trim() !== '') {
      const searchRegex = createSafeRegex(search.trim(), 'i');
      if (searchRegex) {
        query.$or = [
          { name: searchRegex },
          { description: searchRegex },
          { material: searchRegex },
          { pattern: searchRegex },
          { color: searchRegex },
          { sku: searchRegex },
        ];
      }
    }

    // Category filter (support category ObjectId or slug)
    if (category && category !== 'all') {
      if (category.match(/^[0-9a-fA-F]{24}$/)) {
        query.category = category;
      } else {
        const cat = await Category.findOne({ slug: category.toLowerCase() });
        if (cat) {
          query.category = cat._id;
        }
      }
    }

    // Size filter with safe regex
    if (size && size !== 'all') {
      const sizes = Array.isArray(size) ? size : size.split(',');
      const sizeRegexes = sizes
        .map((s) => createExactRegex(s.trim(), 'i'))
        .filter(Boolean);
      if (sizeRegexes.length > 0) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { size: { $in: sizeRegexes } },
            { 'sizes.name': { $in: sizeRegexes } },
            { 'sizes.measurement': { $in: sizeRegexes } },
          ],
        });
      }
    }

    // Material filter with safe regex
    if (material && material !== 'all') {
      const materials = Array.isArray(material) ? material : material.split(',');
      const matRegexes = materials
        .map((m) => createSafeRegex(m.trim(), 'i'))
        .filter(Boolean);
      if (matRegexes.length > 0) {
        query.material = { $in: matRegexes };
      }
    }

    // Pattern filter with safe regex
    if (pattern && pattern !== 'all') {
      const patRegex = createSafeRegex(pattern.trim(), 'i');
      if (patRegex) {
        query.pattern = patRegex;
      }
    }

    // Color filter with safe regex
    if (color && color !== 'all') {
      const colRegex = createSafeRegex(color.trim(), 'i');
      if (colRegex) {
        query.color = colRegex;
      }
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.$and = query.$and || [];
      if (minPrice) {
        query.$and.push({
          $or: [
            { discountPrice: { $gte: Number(minPrice) } },
            { $and: [{ discountPrice: null }, { price: { $gte: Number(minPrice) } }] },
          ],
        });
      }
      if (maxPrice) {
        query.$and.push({
          $or: [
            { discountPrice: { $lte: Number(maxPrice) } },
            { $and: [{ discountPrice: null }, { price: { $lte: Number(maxPrice) } }] },
          ],
        });
      }
    }

    // In Stock filter
    if (inStock === 'true') {
      query.stock = { $gt: 0 };
    }

    // Featured filter
    if (featured === 'true') {
      query.isFeatured = true;
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // default newest
    if (sort === 'price-low') {
      sortOption = { price: 1 };
    } else if (sort === 'price-high') {
      sortOption = { price: -1 };
    } else if (sort === 'popular') {
      sortOption = { rating: -1, numReviews: -1 };
    } else if (sort === 'rating') {
      sortOption = { rating: -1 };
    } else if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    }

    // Pagination
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const pageNum = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limitNum = isNaN(parsedLimit) ? 12 : Math.min(100, Math.max(1, parsedLimit));
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name slug')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      total,
      count: products.length,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured products for homepage
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isFeatured: true, isActive: true })
      .populate('category', 'name slug')
      .limit(8)
      .sort({ rating: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by slug or id with related products
// @route   GET /api/products/:identifier
// @access  Public
const getProduct = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let product;

    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(identifier).populate('category', 'name slug');
    } else {
      product = await Product.findOne({ slug: identifier.toLowerCase() }).populate('category', 'name slug');
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const isAdmin = req.user && req.user.role === 'admin';
    if (!product.isActive && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or currently unavailable',
      });
    }

    // Find related products in same category safely
    let relatedProducts = [];
    if (product.category && product.category._id) {
      relatedProducts = await Product.find({
        category: product.category._id,
        _id: { $ne: product._id },
        isActive: true,
      })
        .populate('category', 'name slug')
        .limit(4);
    }

    res.status(200).json({
      success: true,
      product,
      relatedProducts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      discountPrice,
      category,
      material,
      size,
      sizes,
      color,
      colorHex,
      pattern,
      images,
      stock,
      sku,
      threadCount,
      dimensions,
      pillowCovers,
      careInstructions,
      isFeatured,
      isActive,
    } = req.body;

    let cleanSizes = [];
    if (sizes !== undefined && sizes !== null) {
      let rawSizes = sizes;
      if (typeof sizes === 'string') {
        try {
          rawSizes = JSON.parse(sizes);
        } catch {
          rawSizes = [];
        }
      }
      if (Array.isArray(rawSizes)) {
        cleanSizes = rawSizes
          .map((s) => ({
            measurement: (s.measurement || '').toString().trim(),
            name: (s.name || '').toString().trim(),
            price: Number(s.price),
          }))
          .filter((s) => s.name && !isNaN(s.price) && s.price >= 0);
      }
    }

    let numPrice = Number(price);
    if ((price === undefined || price === '' || isNaN(numPrice)) && cleanSizes.length > 0) {
      numPrice = cleanSizes[0].price;
    }

    if (!name || isNaN(numPrice) || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, price, and category',
      });
    }

    const cleanImages = (Array.isArray(images) ? images : (typeof images === 'string' ? images.split(',').map(s => s.trim()) : []))
      .map((img) => (typeof img === 'string' ? img.trim() : ''))
      .filter(Boolean);

    if (cleanImages.length < 2 || cleanImages.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Every product must have between 2 and 4 images (minimum 2, maximum 4)',
      });
    }

    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid positive number',
      });
    }

    let numDiscountPrice = null;
    if (discountPrice !== undefined && discountPrice !== null && discountPrice !== '') {
      numDiscountPrice = Number(discountPrice);
      if (isNaN(numDiscountPrice) || numDiscountPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Discount price must be a valid positive number greater than 0',
        });
      }
      if (numDiscountPrice >= numPrice) {
        return res.status(400).json({
          success: false,
          message: 'Discount price must be strictly less than the original price',
        });
      }
    }

    const numStock = stock !== undefined ? Number(stock) : 10;
    if (isNaN(numStock) || numStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock must be a valid non-negative number',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Category ID format',
      });
    }

    // Check category exists
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(400).json({
        success: false,
        message: 'Provided category does not exist',
      });
    }

    // Generate slug and SKU if not provided
    let baseSlug = slugify(name);
    let finalSlug = baseSlug;
    let counter = 1;
    while (await Product.findOne({ slug: finalSlug })) {
      finalSlug = `${baseSlug}-${counter++}`;
    }

    const generatedSku = sku
      ? sku.toUpperCase().trim()
      : `VST-${Math.floor(1000 + Math.random() * 9000)}`;

    const chosenSize = size || (cleanSizes.length > 0 ? cleanSizes[0].name : 'King');

    const product = await Product.create({
      name: name.trim(),
      slug: finalSlug,
      description: description ? description.trim() : '',
      price: numPrice,
      discountPrice: numDiscountPrice,
      category,
      material: material || '100% Pure Cotton',
      size: chosenSize,
      sizes: cleanSizes,
      color: color || 'Natural',
      colorHex: colorHex || '#C5A880',
      pattern: pattern || 'Floral',
      images: cleanImages,
      stock: numStock,
      sku: generatedSku,
      threadCount: threadCount ? Number(threadCount) : 300,
      dimensions: dimensions || '108 x 108 inches',
      pillowCovers: pillowCovers || 'Includes 2 Matching Pillow Covers (18 x 28 inches)',
      careInstructions: careInstructions || 'Machine wash cold. Line dry in shade.',
      isFeatured: isFeatured === true || isFeatured === 'true',
      isActive: isActive !== undefined ? isActive === true || isActive === 'true' : true,
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Product ID format' });
    }

    let product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Validation for prices and stock if provided
    if (req.body.price !== undefined) {
      const numP = Number(req.body.price);
      if (isNaN(numP) || numP < 0) {
        return res.status(400).json({ success: false, message: 'Price must be a valid positive number' });
      }
      // If price is updated but discountPrice is not provided, and existing discountPrice is >= new price, clear it
      if (product.discountPrice && product.discountPrice >= numP && req.body.discountPrice === undefined) {
        product.discountPrice = null;
      }
    }

    if (req.body.discountPrice !== undefined && req.body.discountPrice !== null && req.body.discountPrice !== '') {
      const numD = Number(req.body.discountPrice);
      const effectivePrice = req.body.price !== undefined ? Number(req.body.price) : product.price;
      if (isNaN(numD) || numD <= 0) {
        return res.status(400).json({ success: false, message: 'Discount price must be a valid positive number greater than 0' });
      }
      if (numD >= effectivePrice) {
        return res.status(400).json({ success: false, message: 'Discount price must be strictly less than the original price' });
      }
    }

    if (req.body.stock !== undefined) {
      const numS = Number(req.body.stock);
      if (isNaN(numS) || numS < 0) {
        return res.status(400).json({ success: false, message: 'Stock must be a valid non-negative number' });
      }
    }

    if (req.body.category && !mongoose.Types.ObjectId.isValid(req.body.category)) {
      return res.status(400).json({ success: false, message: 'Invalid Category ID format' });
    }

    // Validate 2 to 4 images if images are provided
    if (req.body.images !== undefined) {
      const cleanImages = (Array.isArray(req.body.images) ? req.body.images : (typeof req.body.images === 'string' ? req.body.images.split(',').map(s => s.trim()) : []))
        .map((img) => (typeof img === 'string' ? img.trim() : ''))
        .filter(Boolean);

      if (cleanImages.length < 2 || cleanImages.length > 4) {
        return res.status(400).json({
          success: false,
          message: 'Every product must have between 2 and 4 images (minimum 2, maximum 4)',
        });
      }
      req.body.images = cleanImages;
    }

    // If images are updated, remember removed images to clean up AFTER successful save
    let removedImages = [];
    if (req.body.images && Array.isArray(req.body.images)) {
      const oldImages = product.images || [];
      const newImages = req.body.images;
      removedImages = oldImages.filter((img) => !newImages.includes(img));
    }

    // If name changed, update slug
    if (req.body.name && req.body.name.trim() !== product.name) {
      let baseSlug = slugify(req.body.name.trim());
      let finalSlug = baseSlug;
      let counter = 1;
      while (await Product.findOne({ slug: finalSlug, _id: { $ne: product._id } })) {
        finalSlug = `${baseSlug}-${counter++}`;
      }
      product.slug = finalSlug;
    }

    const fields = [
      'name',
      'description',
      'price',
      'discountPrice',
      'category',
      'material',
      'size',
      'color',
      'colorHex',
      'pattern',
      'images',
      'stock',
      'sku',
      'threadCount',
      'dimensions',
      'pillowCovers',
      'careInstructions',
      'isFeatured',
      'isActive',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'price' || field === 'stock' || field === 'threadCount') {
          product[field] = Number(req.body[field]);
        } else if (field === 'discountPrice') {
          product[field] = req.body[field] ? Number(req.body[field]) : null;
        } else {
          product[field] = req.body[field];
        }
      }
    });

    if (req.body.sizes !== undefined) {
      let rawSizes = req.body.sizes;
      if (typeof rawSizes === 'string') {
        try {
          rawSizes = JSON.parse(rawSizes);
        } catch {
          rawSizes = [];
        }
      }
      if (Array.isArray(rawSizes)) {
        product.sizes = rawSizes
          .map((s) => ({
            measurement: (s.measurement || '').toString().trim(),
            name: (s.name || '').toString().trim(),
            price: Number(s.price),
          }))
          .filter((s) => s.name && !isNaN(s.price) && s.price >= 0);

        if (product.sizes.length > 0) {
          if (req.body.price === undefined && (!product.price || product.price === 0)) {
            product.price = product.sizes[0].price;
          }
          if (req.body.size === undefined && !product.size) {
            product.size = product.sizes[0].name;
          }
        }
      }
    }

    if (product.discountPrice !== null && product.discountPrice !== undefined) {
      if (product.discountPrice > product.price) {
        product.discountPrice = null;
      }
    }

    await product.save();

    // Clean up removed Cloudinary images ONLY after save succeeds
    // and ONLY if not referenced by any order or another product
    if (removedImages.length > 0) {
      for (const removed of removedImages) {
        try {
          const isUsedInOrder = await Order.exists({ 'items.image': removed });
          const isUsedInProduct = await Product.exists({ _id: { $ne: product._id }, images: removed });
          if (!isUsedInOrder && !isUsedInProduct) {
            const publicId = extractPublicIdFromUrl(removed);
            if (publicId) {
              await deleteFromCloudinary(publicId);
            }
          }
        } catch (cleanupErr) {
          console.error('Failed to clean up Cloudinary image on update:', cleanupErr);
        }
      }
    }

    const updated = await Product.findById(id).populate('category', 'name slug');

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Product ID format' });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // If product has any orders, soft-delete it instead of removing it
    const hasOrders = await Order.exists({ 'items.product': id });
    if (hasOrders) {
      product.isActive = false;
      await product.save();
      return res.status(200).json({
        success: true,
        message: 'Product has associated orders; it has been deactivated rather than deleted',
        product,
      });
    }

    const imagesToCheck = product.images || [];
    await product.deleteOne();

    // Clean up associated Cloudinary images only after delete succeeds
    // and only for images not referenced by any order or another product
    for (const imgUrl of imagesToCheck) {
      try {
        const isUsedInOrder = await Order.exists({ 'items.image': imgUrl });
        const isUsedInProduct = await Product.exists({ images: imgUrl });
        if (!isUsedInOrder && !isUsedInProduct) {
          const publicId = extractPublicIdFromUrl(imgUrl);
          if (publicId) {
            await deleteFromCloudinary(publicId);
          }
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up Cloudinary image on delete:', cleanupErr);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

const findSizeVariant = (sizes, label) => {
  const t = String(label || '').trim().toLowerCase();
  if (!t) return null;
  return sizes.find((s) => {
    const n = (s.name || '').trim().toLowerCase();
    const m = (s.measurement || '').trim().toLowerCase();
    const formatted = m && n ? `${m} (${n})` : (m || n);
    return formatted === t || n === t || m === t;
  }) || null;
};


// @desc    Validate cart items against live catalog
// @route   POST /api/products/validate-cart
// @access  Public
const validateCart = async (req, res, next) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Cart items array expected' });
    }
    if (items.length > 50) {
      return res.status(400).json({ success: false, message: 'Too many cart items' });
    }

    const validated = [];
    for (const item of items) {
      if (!item || !item.product) continue;
      const productId = typeof item.product === 'object' && item.product._id ? item.product._id : item.product;
      if (!mongoose.Types.ObjectId.isValid(productId)) continue;

      const product = await Product.findById(productId).select('name price discountPrice stock isActive sizes size');
      if (!product) {
        validated.push({
          product: productId,
          size: item.size,
          color: item.color || '',
          exists: false,
          isActive: false,
          price: 0,
          discountPrice: null,
          stock: 0,
        });
        continue;
      }

      let currentPrice = product.price;
      let currentDiscount = (product.discountPrice > 0 && product.discountPrice < product.price) ? product.discountPrice : null;
      let sizeValid = true;
      if (product.sizes && product.sizes.length > 0) {
        const variant = findSizeVariant(product.sizes, item.size);
        if (variant && Number.isFinite(Number(variant.price))) {
          currentPrice = Number(variant.price);
        } else {
          sizeValid = false;
        }
      }

      validated.push({
        product: product._id,
        size: item.size,
        color: item.color || '',
        exists: true,
        name: product.name,
        isActive: Boolean(product.isActive) && sizeValid,
        price: currentPrice,
        discountPrice: currentDiscount,
        stock: product.stock,
      });
    }

    res.status(200).json({
      success: true,
      items: validated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getFeaturedProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  validateCart,
};
