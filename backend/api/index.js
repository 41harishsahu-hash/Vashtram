const { app, validateStartupConfig } = require('../server');
const connectDB = require('../config/db');
const { ensureDefaultUsers } = require('../utils/initUsers');
const { ensureDefaultFeatures } = require('../utils/initFeatures');

let isInitialized = false;
let initPromise = null;

const initServerless = async () => {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      validateStartupConfig();
      await connectDB();
      try {
        await ensureDefaultUsers();
      } catch (userErr) {
        console.warn('[Vercel Serverless]: ensureDefaultUsers warning:', userErr.message);
      }
      try {
        await ensureDefaultFeatures();
      } catch (featErr) {
        console.warn('[Vercel Serverless]: ensureDefaultFeatures warning:', featErr.message);
      }
      isInitialized = true;
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};

module.exports = async (req, res) => {
  try {
    await initServerless();
    return app(req, res);
  } catch (err) {
    console.error('[Vercel Serverless Handler Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Serverless initialization error: ' + err.message,
    });
  }
};
