const Counter = require('../models/Counter');
const Order = require('../models/Order');

let isInitialized = false;
let initPromise = null;

/**
 * Initializes the orderNumber counter by scanning existing orders
 * so the sequence never collides with any existing order.
 */
const initOrderCounter = async () => {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const existingCounter = await Counter.findById('orderNumber');
        let currentSeq = existingCounter ? existingCounter.seq : 0;

        // Scan existing orders to find the highest numeric sequence
        const orders = await Order.find({}, { orderNumber: 1 }).lean();
        let maxExistingNum = 0;

        for (const ord of orders) {
          if (ord.orderNumber) {
            const match = ord.orderNumber.match(/\d+/);
            if (match) {
              const num = parseInt(match[0], 10);
              if (num > maxExistingNum) {
                maxExistingNum = num;
              }
            }
          }
        }

        if (maxExistingNum > currentSeq) {
          await Counter.findByIdAndUpdate(
            'orderNumber',
            { $set: { seq: maxExistingNum } },
            { upsert: true }
          );
        }

        isInitialized = true;
      } catch (err) {
        console.error('[OrderCounter]: Error initializing counter:', err.message);
      }
    })();
  }
  await initPromise;
};

/**
 * Atomically generates the next unique sequential order number (e.g. VST-0002).
 * Concurrency-safe across multiple parallel requests.
 */
const getNextOrderNumber = async () => {
  if (!isInitialized) {
    await initOrderCounter();
  }

  const counter = await Counter.findByIdAndUpdate(
    'orderNumber',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const nextNum = counter.seq.toString().padStart(4, '0');
  return `VST-${nextNum}`;
};

module.exports = {
  getNextOrderNumber,
  initOrderCounter,
};
