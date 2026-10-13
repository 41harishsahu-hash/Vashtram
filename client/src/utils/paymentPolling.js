/**
 * VASHTRAM Payment Polling Engine
 * 
 * Coordinates resilient polling against /api/payment/status/:orderId
 * with progressive exponential backoff and definitive state transitions.
 */

export const DEFAULT_BACKOFF_DELAYS = [2000, 3000, 4500, 6000, 8000, 10000];

/**
 * Poll payment status with configurable delays and mockable fetcher.
 * 
 * @param {string} orderId - Razorpay order ID to poll
 * @param {Object} options - Configuration options
 * @param {Function} options.fetchStatus - async (orderId) => ({ data, status })
 * @param {number[]} [options.delays] - Array of delays in ms between attempts
 * @param {Function} [options.sleep] - async (ms) => Promise
 * @param {Function} [options.onStateChange] - (bannerState) => void
 * @returns {Promise<Object>} Final state object { state, orderId, confirmedOrderId, message }
 */
export async function pollPaymentStatusWorkflow(orderId, options = {}) {
  const {
    fetchStatus,
    delays = DEFAULT_BACKOFF_DELAYS,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onStateChange = () => {},
  } = options;

  if (!orderId) {
    throw new Error('orderId is required for polling');
  }

  // 1. Initial processing state
  const processingState = {
    state: 'processing',
    message: 'Payment verification in progress. We are communicating with your bank. Please do not close or refresh this page.',
    orderId,
  };
  onStateChange(processingState);

  for (let i = 0; i < delays.length; i++) {
    await sleep(delays[i]);

    try {
      const response = await fetchStatus(orderId);
      const data = response?.data || response;

      if (data?.success) {
        const { status, orderId: confirmedOrderId, refundStatus } = data;

        // Confirmed transition
        if ((status === 'confirmed' || status === 'completed') && confirmedOrderId) {
          const confirmedState = {
            state: 'confirmed',
            message: 'Payment confirmed! Redirecting to your order receipt...',
            orderId,
            confirmedOrderId,
          };
          onStateChange(confirmedState);
          return confirmedState;
        }

        // Failed transition
        if (status === 'failed' || status === 'refunded') {
          const refundMsg =
            refundStatus === 'processed'
              ? 'A refund has been initiated to your original payment method.'
              : 'We could not complete the order; please check your bank account or contact support.';
          const failedState = {
            state: 'failed',
            message: `Payment could not be completed. ${refundMsg} Your cart items have been preserved.`,
            orderId,
            refundStatus,
          };
          onStateChange(failedState);
          return failedState;
        }

        // 202 Accepted / processing: continue next backoff loop
      }
    } catch (pollErr) {
      const statusCode = pollErr?.status || pollErr?.response?.status;
      if (statusCode === 404 || statusCode === 403) {
        const authFailedState = {
          state: 'failed',
          message: pollErr.message || 'Payment intent could not be verified.',
          orderId,
        };
        onStateChange(authFailedState);
        return authFailedState;
      }
      // On network errors, continue loop
    }
  }

  // 2. Reached maximum polling duration without resolution -> unknown state
  const timeoutState = {
    state: 'unknown',
    message:
      'Payment verification is taking longer than usual. Please do NOT pay again. We are verifying your transaction with your bank. Check "My Orders" in a few minutes, or we will notify you by email once confirmed.',
    orderId,
  };
  onStateChange(timeoutState);
  return timeoutState;
}
