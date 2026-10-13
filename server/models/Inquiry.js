const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email address'],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    subject: {
      type: String,
      required: [true, 'Please provide an inquiry subject'],
      trim: true,
      minlength: [2, 'Subject must be at least 2 characters'],
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Please enter your message'],
      trim: true,
      minlength: [5, 'Message must be at least 5 characters'],
      maxlength: [3000, 'Message cannot exceed 3000 characters'],
    },
    status: {
      type: String,
      enum: ['New', 'In Progress', 'Resolved', 'Archived'],
      default: 'New',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast admin queries, filtering, and search
inquirySchema.index({ createdAt: -1 });
inquirySchema.index({ status: 1 });
inquirySchema.index({ name: 'text', email: 'text', subject: 'text', message: 'text' });

module.exports = mongoose.model('Inquiry', inquirySchema);
