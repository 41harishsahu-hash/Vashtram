const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  size: { type: String, default: 'King' },
  sizeMeasurement: { type: String, default: '' },
  sizeName: { type: String, default: '' },
  color: { type: String, default: '' },
  stockRestored: { type: Boolean, default: false },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: { type: String, required: true, trim: true },
      mobileNumber: {
        type: String,
        required: true,
        match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'],
      },
      email: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
      },
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: {
        type: String,
        required: true,
        match: [/^\d{6}$/, 'Please enter a valid 6-digit pincode'],
      },
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['Razorpay Online Payment', 'Online Payment'],
      default: 'Razorpay Online Payment',
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
      default: 'Completed',
    },
    orderStatus: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
      default: 'Confirmed',
    },
    isPaid: {
      type: Boolean,
      default: true,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    razorpayOrderId: {
      type: String,
      default: undefined,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: undefined,
      index: {
        unique: true,
        partialFilterExpression: { razorpayPaymentId: { $type: 'string' } },
      },
    },
    razorpaySignature: {
      type: String,
      default: '',
    },
    isRefunded: {
      type: Boolean,
      default: false,
    },
    refundId: {
      type: String,
      default: null,
    },
    refundAmount: {
      type: Number,
      default: 0,
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
    refundedAt: {
      type: Date,
      default: null,
    },
    stockRestored: {
      type: Boolean,
      default: false,
    },
    stockRestoredAt: {
      type: Date,
      default: null,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    shippingPrice: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    notes: {
      type: String,
      default: '',
    },
    // Courier / tracking details shown to the customer on their order page
    shipment: {
      courierName: { type: String, default: '', trim: true, maxlength: 80 },
      trackingNumber: { type: String, default: '', trim: true, maxlength: 80 },
      trackingUrl: { type: String, default: '', trim: true, maxlength: 500 },
      shippedAt: { type: Date, default: null },
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        date: { type: Date, default: Date.now },
        note: { type: String, default: '' },
        // Only notes written for the customer are shown on the customer timeline.
        // System notes (payment IDs, refund details) always stay private.
        visibleToCustomer: { type: Boolean, default: false },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Order', orderSchema);
