const mongoose = require('mongoose');

const paymentIntentSchema = new mongoose.Schema(
  {
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: { type: String, required: true },
        image: { type: String, default: '' },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        size: { type: String, default: 'King' },
        sizeMeasurement: { type: String, default: '' },
        sizeName: { type: String, default: '' },
        color: { type: String, default: '' },
      },
    ],
    shippingAddress: {
      fullName: { type: String, required: true },
      mobileNumber: { type: String, required: true },
      email: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    subtotal: {
      type: Number,
      required: true,
    },
    shippingPrice: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true, // In Rupees
    },
    expectedAmount: {
      type: Number,
      required: true, // In Paise (e.g. 149900)
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['created', 'processing', 'completed', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    refundId: {
      type: String,
      default: null,
    },
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'processed', 'failed'],
      default: 'none',
    },
    refundAttempts: {
      type: Number,
      default: 0,
    },
    refundLastError: {
      type: String,
      default: null,
    },
    refundLockedAt: {
      type: Date,
      default: null,
    },
    refundNextAttemptAt: {
      type: Date,
      default: null,
    },
    needsAttention: {
      type: Boolean,
      default: false,
      index: true,
    },
    stockDeducted: {
      type: Boolean,
      default: false,
    },
    awaitingCapture: {
      type: Boolean,
      default: false,
    },
    failureReason: {
      type: String,
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
