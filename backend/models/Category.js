const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide category name'],
      unique: true,
      trim: true,
      maxlength: [50, 'Category name cannot exceed 50 characters'],
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
      default: '',
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    image: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
      validate: [
        (val) => !val || (Array.isArray(val) && val.length <= 4),
        'Category can have at most 4 images',
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to ensure image and images stay synchronized
categorySchema.pre('save', function (next) {
  if (Array.isArray(this.images) && this.images.length > 0) {
    this.images = this.images
      .filter((img) => img && typeof img === 'string' && img.trim() !== '')
      .slice(0, 4);
    this.image = this.images[0] || '';
  } else if (this.image && (!this.images || this.images.length === 0)) {
    this.images = [this.image];
  }
  next();
});

// Performance index for active category listings
categorySchema.index({ isActive: 1, order: 1, name: 1 });

module.exports = mongoose.model('Category', categorySchema);
