const Razorpay = require('razorpay');

let mockInstance = null;

/**
 * Extracts and sanitizes Razorpay credentials from backend environment variables only.
 * Secret keys remain strictly on the backend.
 */
const getRazorpayCredentials = () => {
  const keyId = (
    process.env.RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_TEST_KEY_ID ||
    process.env.RAZORPAY_KEY ||
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '');

  const keySecret = (
    process.env.RAZORPAY_KEY_SECRET ||
    process.env.RAZORPAY_TEST_KEY_SECRET ||
    process.env.RAZORPAY_SECRET ||
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '');

  const isConfigured = Boolean(
    keyId &&
    keySecret &&
    keyId !== 'rzp_test_placeholder' &&
    keySecret !== 'placeholder_secret' &&
    keyId !== 'YOUR_RAZORPAY_TEST_KEY_ID' &&
    keySecret !== 'YOUR_RAZORPAY_TEST_KEY_SECRET'
  );

  return { keyId, keySecret, isConfigured };
};

/**
 * Instantiates the Razorpay SDK instance or returns injected mock
 */
const getRazorpayInstance = () => {
  if (mockInstance) {
    return mockInstance;
  }

  const { keyId, keySecret, isConfigured } = getRazorpayCredentials();

  if (!isConfigured) {
    const error = new Error(
      'Razorpay credentials are not configured yet. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment.'
    );
    error.statusCode = 500;
    throw error;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/**
 * Injects a mock Razorpay client for testing (dependency injection)
 */
const setMockRazorpayInstance = (mock) => {
  mockInstance = mock;
};

const resetRazorpayInstance = () => {
  mockInstance = null;
};

module.exports = {
  getRazorpayCredentials,
  getRazorpayInstance,
  setMockRazorpayInstance,
  resetRazorpayInstance,
};
