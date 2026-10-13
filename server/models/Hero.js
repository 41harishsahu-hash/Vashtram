const mongoose = require('mongoose');

const heroImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Hero image URL is required'],
      trim: true,
    },
    altText: {
      type: String,
      default: 'VASHTRAM Premium Mattress Protector',
      trim: true,
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

const heroSchema = new mongoose.Schema(
  {
    smallLabel: {
      type: String,
      default: 'Handcrafted Luxury Living',
      trim: true,
      maxlength: [100, 'Small label cannot exceed 100 characters'],
    },
    heading: {
      type: String,
      default: 'Bring Comfort & Elegance Home',
      trim: true,
      maxlength: [200, 'Heading cannot exceed 200 characters'],
    },
    description: {
      type: String,
      default:
        'Premium mattress protectors designed for everyday protection and comfort. Waterproof, breathable, and crafted to extend the life of your mattress with timeless quality.',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    button1: {
      text: {
        type: String,
        default: 'Shop Now',
        trim: true,
      },
      link: {
        type: String,
        default: '/shop',
        trim: true,
      },
    },
    button2: {
      text: {
        type: String,
        default: 'Explore Cotton',
        trim: true,
      },
      link: {
        type: String,
        default: '/shop?category=cotton',
        trim: true,
      },
    },
    floatingCard: {
      title: {
        type: String,
        default: 'Signature Heritage Weave',
        trim: true,
      },
      subtitle: {
        type: String,
        default: '100% Combed Cotton • 300+ Thread Count',
        trim: true,
      },
      badge: {
        type: String,
        default: 'In Stock',
        trim: true,
      },
      show: {
        type: Boolean,
        default: true,
      },
    },
    images: {
      type: [heroImageSchema],
      default: [
        {
          url: '/img/HeroCrousel1.jpeg',
          altText: 'VASHTRAM Premium Mattress Protector',
          isActive: true,
          order: 1,
        },
        {
          url: '/img/HeroCrousel2.jpeg',
          altText: 'VASHTRAM Waterproof Mattress Protector Collection',
          isActive: true,
          order: 2,
        },
        {
          url: '/img/HeroCrousel3.jpeg',
          altText: 'VASHTRAM Breathable King Size Mattress Protector',
          isActive: true,
          order: 3,
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Helper static method to get or create the default Hero document
heroSchema.statics.getSingleton = async function () {
  let hero = await this.findOne();
  if (!hero) {
    hero = await this.create({});
  }
  return hero;
};

module.exports = mongoose.model('Hero', heroSchema);
