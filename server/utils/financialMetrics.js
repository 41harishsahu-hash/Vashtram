/**
 * VASHTRAM Authoritative Financial Metrics Engine
 * 
 * UNIT OF refundAmount:
 * - Stored in RUPEES (INR), exactly matching order.totalAmount (e.g. ₹500 is stored as 500, not 50000).
 * - Razorpay API and Webhook payloads send amounts in paise (1 INR = 100 paise).
 *   Before saving to order.refundAmount, Razorpay amounts MUST be divided by 100.
 * 
 * EXACT RULES FOR NET REVENUE & CUSTOMER TOTAL SPENDING:
 * 1. Must be Paid: Order must have paymentStatus === 'Completed' or isPaid === true.
 *    Unpaid, Pending, or Failed orders contribute 0 INR.
 * 2. Not Cancelled: Orders with orderStatus === 'Cancelled' contribute 0 INR.
 * 3. Not Fully Refunded: Orders with paymentStatus === 'Refunded', isRefunded === true,
 *    or refundAmount >= totalAmount contribute 0 INR.
 * 4. Partial Refunds on Active Orders:
 *    For active paid orders with 0 < refundAmount < totalAmount, net retained revenue is:
 *    (totalAmount - refundAmount) INR. Only the refunded portion is deducted.
 * 5. EXACT RULE FOR RETURNED ORDERS:
 *    When order.orderStatus === 'Returned':
 *    - Full return: If refundAmount >= totalAmount, or refundAmount === 0 (return accepted,
 *      goods returned, refund pending warehouse inspection), net revenue is strictly 0 INR.
 *    - Partial return: If the customer returned only a portion of a multi-item order and kept
 *      the rest, and a partial refund was processed (0 < refundAmount < totalAmount),
 *      net retained revenue is strictly (totalAmount - refundAmount) INR.
 */

/**
 * Calculates net revenue for a single order document or object.
 * @param {Object} order 
 * @returns {number} Net revenue in INR (>= 0)
 */
function calculateOrderNetRevenue(order) {
  if (!order) return 0;

  // Rule 1: Must be paid
  const isPaid = order.isPaid === true || order.paymentStatus === 'Completed';
  if (!isPaid) return 0;

  // Rule 2: Cancelled orders contribute zero
  if (order.orderStatus === 'Cancelled') return 0;

  const total = Number(order.totalAmount) || 0;
  const refunded = Number(order.refundAmount) || 0;

  // Rule 3: Fully refunded orders contribute zero
  if (
    order.paymentStatus === 'Refunded' ||
    order.isRefunded === true ||
    (refunded >= total && total > 0)
  ) {
    return 0;
  }

  // Rule 5: Returned orders handled explicitly
  if (order.orderStatus === 'Returned') {
    // If order was returned with partial retained value (e.g. partial return)
    if (refunded > 0 && refunded < total) {
      return Math.max(0, total - refunded);
    }
    // Full return accepted => voided from net revenue
    return 0;
  }

  // Rule 4: Partial refunds on active orders
  if (refunded > 0 && refunded < total) {
    return Math.max(0, total - refunded);
  }

  return Math.max(0, total);
}

/**
 * Returns a MongoDB Aggregation expression equivalent to calculateOrderNetRevenue.
 * Can be used in $group or $project across Order collections.
 */
function getRevenueAggregationExpr() {
  return {
    $cond: [
      {
        $and: [
          // 1. Paid check
          {
            $or: [
              { $eq: ['$isPaid', true] },
              { $eq: ['$paymentStatus', 'Completed'] },
            ],
          },
          // 2. Not Cancelled
          { $ne: ['$orderStatus', 'Cancelled'] },
          // 3. Not marked fully refunded
          { $ne: ['$paymentStatus', 'Refunded'] },
          { $ne: ['$isRefunded', true] },
          // 4. Returned handled explicitly:
          // Either orderStatus !== 'Returned', OR it is Returned with partial refund (refundAmount > 0 and < totalAmount)
          {
            $or: [
              { $ne: ['$orderStatus', 'Returned'] },
              {
                $and: [
                  { $eq: ['$orderStatus', 'Returned'] },
                  { $gt: [{ $ifNull: ['$refundAmount', 0] }, 0] },
                  { $lt: [{ $ifNull: ['$refundAmount', 0] }, '$totalAmount'] },
                ],
              },
            ],
          },
          // 5. Total must exceed refund amount
          { $gt: ['$totalAmount', { $ifNull: ['$refundAmount', 0] }] },
        ],
      },
      // Net retained revenue = totalAmount - refundAmount
      {
        $max: [
          0,
          { $subtract: ['$totalAmount', { $ifNull: ['$refundAmount', 0] }] },
        ],
      },
      0,
    ],
  };
}

module.exports = {
  calculateOrderNetRevenue,
  getRevenueAggregationExpr,
};
