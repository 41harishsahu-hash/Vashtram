const mongoose = require('mongoose');

const sizeOptionSchema = new mongoose.Schema(
  {
    measurement: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Please provide size name'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Please provide individual price for this size option'],
      min: [0, 'Price must be positive'],
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide product name'],
      trim: true,
      maxlength: [120, 'Product name cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide product description'],
    },
    price: {
      type: Number,
      required: [true, 'Please provide original price'],
      min: [0, 'Price must be positive'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price must be positive'],
      validate: {
        validator: function (val) {
          if (val == null || val === 0) return true;
          return typeof this.price === 'number' ? val < this.price : true;
        },
        message: 'Discount price must be less than the regular price',
      },
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product must belong to a category'],
    },
    material: {
      type: String,
      required: [true, 'Please provide material'],
      trim: true,
      default: '100% Pure Cotton',
    },
    size: {
      type: String,
      default: 'King',
      trim: true,
    },
    sizes: {
      type: [sizeOptionSchema],
      default: [],
    },
    color: {
      type: String,
      required: [true, 'Please provide color'],
      trim: true,
    },
    colorHex: {
      type: String,
      default: '#C5A880',
    },
    pattern: {
      type: String,
      required: [true, 'Please provide pattern'],
      trim: true,
      default: 'Floral',
    },
    images: {
      type: [String],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length >= 2 && v.length <= 4;
        },
        message: 'Product must have between 2 and 4 images',
      },
    },
    stock: {
      type: Number,
      required: [true, 'Please provide stock quantity'],
      min: [0, 'Stock cannot be negative'],
      default: 10,
    },
    sku: {
      type: String,
      required: [true, 'Please provide SKU'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 18,
    },
    threadCount: {
      type: Number,
      default: 300,
    },
    dimensions: {
      type: String,
      default: '108 x 108 inches (274 x 274 cm)',
    },
    pillowCovers: {
      type: String,
      default: 'Includes 2 Matching Pillow Covers (18 x 28 inches)',
    },
    careInstructions: {
      type: String,
      default: 'Machine wash cold on gentle cycle. Tumble dry low or line dry in shade. Warm iron if needed. Do not bleach.',
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for effective price (discountPrice if present, positive, and lower than price, else price)
productSchema.virtual('finalPrice').get(function () {
  if (this.discountPrice !== null && this.discountPrice !== undefined && this.discountPrice > 0 && this.discountPrice < this.price) {
    return this.discountPrice;
  }
  return this.price;
});

productSchema.virtual('effectivePrice').get(function () {
  if (this.discountPrice !== null && this.discountPrice !== undefined && this.discountPrice > 0 && this.discountPrice < this.price) {
    return this.discountPrice;
  }
  return this.price;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Text index for search
productSchema.index({ name: 'text', description: 'text', material: 'text', pattern: 'text' });

// Performance indexes for storefront queries
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, isActive: 1, rating: -1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
