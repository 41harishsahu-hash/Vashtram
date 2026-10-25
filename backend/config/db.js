const mongoose = require('mongoose');

const sanitizeMongoError = (message) => {
  return (message || 'Connection failed').replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

// Global Mongoose event listeners
let listenersAttached = false;
const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB Atlas Notice]: Connection disconnected. Attempting automatic reconnection...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB Atlas Notice]: Reconnected successfully to MongoDB Atlas.');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`[MongoDB Error]: ${sanitizeMongoError(err.message)}`);
  });
};

const connectDB = async () => {
  // Reuse existing connection if already connected (vital for serverless cold/warm starts)
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  attachConnectionListeners();

  const isProduction = process.env.NODE_ENV === 'production';
  const configuredUri = process.env.MONGODB_URI;
  const localFallbackUri = process.env.MONGODB_LOCAL_URI || (isProduction ? null : 'mongodb://127.0.0.1:27017/vashtram');

  // 1. Direct local database request if explicitly configured
  if (process.env.USE_LOCAL_DB === 'true') {
    if (isProduction) {
      console.error('[Security Error]: USE_LOCAL_DB is strictly forbidden when NODE_ENV=production.');
      process.exit(1);
    }
    try {
      const conn = await mongoose.connect(localFallbackUri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`[MongoDB Connected (Local)]: ${conn.connection.host}/${conn.connection.name}`);
      return;
    } catch (localError) {
      console.error(`[Local MongoDB Error]: ${sanitizeMongoError(localError.message)}`);
      process.exit(1);
    }
  }

  // Determine initial URI to attempt
  const targetUri = configuredUri || (isProduction ? null : (process.env.ALLOW_LOCAL_DB_FALLBACK === 'true' ? localFallbackUri : null));

  if (!targetUri) {
    console.error('[Configuration Error]: MONGODB_URI is required in environment.');
    process.exit(1);
  }

  const isAtlas = targetUri.includes('.mongodb.net');
  // Use 15s in development (prevents false timeouts while Atlas firewall propagates after IP changes)
  const timeoutMs = isProduction ? 30000 : 15000;

  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: timeoutMs,
    });
    console.log(`[MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    let lastError = error;
    // If Atlas connection failed, retry once after 2.5s in case Atlas IP whitelist rule is still propagating
    if (isAtlas) {
      console.warn(`[MongoDB Atlas Notice]: Initial connection attempt failed (${sanitizeMongoError(error.message)}). Retrying in 2.5s for firewall rule propagation...`);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      try {
        const retryConn = await mongoose.connect(targetUri, {
          serverSelectionTimeoutMS: timeoutMs,
        });
        console.log(`[MongoDB Connected on Retry]: ${retryConn.connection.host}/${retryConn.connection.name}`);
        return;
      } catch (retryError) {
        lastError = retryError;
      }
    }

    const sanitizedError = sanitizeMongoError(lastError.message);
    console.error(`[MongoDB Connection Error]: ${sanitizedError}`);

    // If in development mode and connecting to Atlas failed
    if (!isProduction && isAtlas && targetUri !== localFallbackUri) {
      if (process.env.ALLOW_LOCAL_DB_FALLBACK === 'true') {
        console.warn('\n⚠️ ============================================================');
        console.warn('⚠️  [DEV-MODE DATABASE FALLBACK WARNING]');
        console.warn('⚠️ ============================================================');
        console.warn('⚠️  MongoDB Atlas connection failed or timed out.');
        console.warn('⚠️  ALLOW_LOCAL_DB_FALLBACK=true is explicitly set in environment.');
        console.warn('⚠️  Attempting fallback to local MongoDB instance...');
        console.warn('⚠️  CAUTION: Data will be saved LOCALLY and NOT to MongoDB Atlas!');
        console.warn('⚠️ ============================================================\n');

        try {
          const localConn = await mongoose.connect(localFallbackUri, {
            serverSelectionTimeoutMS: 5000,
          });
          console.warn(`⚠️  [MongoDB ACTIVE DATABASE (LOCAL DEV FALLBACK)]: Host: ${localConn.connection.host}, Database: ${localConn.connection.name}`);
          console.warn('⚠️  [VASHTRAM Backend]: Running with local database fallback.\n');
          return;
        } catch (localError) {
          console.error(`[Local MongoDB Fallback Failed]: ${sanitizeMongoError(localError.message)}`);
          console.error('[MongoDB Diagnosis]: Neither MongoDB Atlas nor local MongoDB could be reached.');
        }
      } else {
        console.error('\n============================================================');
        console.error('❌ [MongoDB Connection Error]: Atlas connection failed.');
        console.error('❌ Data will NOT be silently saved to a different local database.');
        console.error('❌ To allow local database fallback during development, explicitly set:');
        console.error('❌   ALLOW_LOCAL_DB_FALLBACK=true');
        console.error('❌ in your server/.env file.');
        console.error('============================================================\n');
      }
    }

    console.error('\n[MongoDB Action Required]:');
    console.error('  1. Check your internet connection.');
    console.error('  2. Verify credentials in server/.env (username, password, cluster URL).');
    console.error('  3. In MongoDB Atlas, go to "Network Access" -> add your current IP or 0.0.0.0/0.\n');
    process.exit(1);
  }
};

module.exports = connectDB;
