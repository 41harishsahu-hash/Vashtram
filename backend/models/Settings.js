const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      default: 'VASHTRAM Mattress Protectors',
      trim: true,
    },
    supportEmail: {
      type: String,
      default: 'vashtramclothsy.info@gmail.com',
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid support email address'],
    },
    supportPhone: {
      type: String,
      default: '+91 7691841583',
      trim: true,
    },
    storeAddress: {
      type: String,
      default: 'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021',
      trim: true,
    },
    whatsappNumber: {
      type: String,
      default: '+91 7691841583',
      trim: true,
      required: [true, 'WhatsApp business number is required'],
      match: [/^\+?[0-9\s\-()]{7,20}$/, 'Please provide a valid WhatsApp phone number'],
    },
    currency: {
      type: String,
      default: 'INR (₹)',
      trim: true,
    },
    freeShippingThreshold: {
      type: Number,
      default: 999,
      min: [0, 'Free shipping threshold cannot be negative'],
    },
    standardShippingFee: {
      type: Number,
      default: 99,
      min: [0, 'Standard shipping fee cannot be negative'],
    },
    enableReturns: {
      type: Boolean,
      default: true,
    },
    returnDays: {
      type: Number,
      default: 7,
      min: [0, 'Return days cannot be negative'],
      max: [365, 'Return days cannot exceed 365'],
    },
  },
  {
    timestamps: true,
  }
);

// Helper static method to get or create the singleton settings document
settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      storeName: 'VASHTRAM Mattress Protectors',
      supportEmail: 'vashtramclothsy.info@gmail.com',
      supportPhone: '+91 7691841583',
      storeAddress: 'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021',
      whatsappNumber: '+91 7691841583',
      currency: 'INR (₹)',
      freeShippingThreshold: 999,
      standardShippingFee: 99,
      enableReturns: true,
      returnDays: 7,
    });
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
