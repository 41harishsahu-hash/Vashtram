const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Feature title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Feature description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    icon: {
      type: String,
      required: [true, 'Feature icon is required'],
      default: 'Feather',
      trim: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
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

// Ensure index on displayOrder and isActive for fast query sorting
featureSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('Feature', featureSchema);
