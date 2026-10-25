const Feature = require('../models/Feature');

const DEFAULT_FEATURES = [
  {
    icon: 'Feather',
    title: 'Premium Fabric',
    description:
      'Soft & Breathable 100% pure combed cotton that feels gentle on sensitive skin all year round.',
    displayOrder: 1,
    isActive: true,
  },
  {
    icon: 'Palette',
    title: 'Elegant Designs',
    description:
      'Sophisticated botanical and geometric patterns thoughtfully created to complement modern bedrooms.',
    displayOrder: 2,
    isActive: true,
  },
  {
    icon: 'Clock',
    title: 'Long Lasting',
    description:
      'Durable quality weave and color-fast dyes that resist pilling and fading through dozens of washes.',
    displayOrder: 3,
    isActive: true,
  },
  {
    icon: 'HeartHandshake',
    title: 'Customer First',
    description:
      'Dedicated support, 100% secure online checkout via Razorpay, and effortless 7-day returns for total peace of mind.',
    displayOrder: 4,
    isActive: true,
  },
];

/**
 * Ensures the 4 default features exist in MongoDB.
 * Only inserts if the Feature collection is currently empty to prevent duplicates.
 */
const ensureDefaultFeatures = async () => {
  try {
    const count = await Feature.countDocuments();
    if (count === 0) {
      await Feature.insertMany(DEFAULT_FEATURES);
      console.log('[Init Features]: Seeded default 4 "Why Choose Us" features successfully.');
    }
  } catch (error) {
    console.error(`[Init Features Error]: Failed to initialize default features: ${error.message}`);
  }
};

module.exports = {
  DEFAULT_FEATURES,
  ensureDefaultFeatures,
};
