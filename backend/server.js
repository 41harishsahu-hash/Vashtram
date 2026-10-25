const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables (supports server/.env and root .env)
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const connectDB = require('./config/db');
const { ensureDefaultUsers } = require('./utils/initUsers');
const { ensureDefaultFeatures } = require('./utils/initFeatures');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { startRefundRetryScheduler } = require('./services/refundService');
const { startPaymentRecoveryScheduler } = require('./services/paymentRecoveryService');
const { verifyIndexes } = require('./utils/verifyIndexes');

// Route files
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const heroRoutes = require('./routes/heroRoutes');
const inquiryRoutes = require('./routes/inquiryRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const featureRoutes = require('./routes/featureRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const aboutRoutes = require('./routes/aboutRoutes');

const app = express();

// Trust proxy configuration for reverse proxy deployments (Render, Railway, Nginx, ALB)
// Deployment proxy assumption: 1 reverse proxy hop by default.
// Setting trust proxy to integer N trusts N reverse proxy hops, extracting the authentic
// client IP from X-Forwarded-For while preventing arbitrary spoofed client headers.
const resolveTrustProxy = () => {
  if (process.env.TRUST_PROXY === 'false' || process.env.TRUST_PROXY === '0') {
    return false;
  }
  if (process.env.TRUST_PROXY && !isNaN(process.env.TRUST_PROXY)) {
    return parseInt(process.env.TRUST_PROXY, 10);
  }
  if (process.env.TRUST_PROXY === 'true') {
    return 1;
  }
  // Default to 1 hop (safe assumption for standard container/cloud deployments)
  return 1;
};
const trustProxyHops = resolveTrustProxy();
app.set('trust proxy', trustProxyHops);
console.log(`[VASHTRAM Proxy]: Trust proxy configured to ${trustProxyHops} hop(s)`);

// Startup diagnostic: logs req.ip and X-Forwarded-For chain on the first incoming API request
let proxyDiagnosticLogged = false;
app.use((req, res, next) => {
  if (!proxyDiagnosticLogged && req.path.startsWith('/api')) {
    proxyDiagnosticLogged = true;
    const xff = req.headers['x-forwarded-for'] || 'none';
    const remote = req.socket?.remoteAddress || 'none';
    console.log(
      `[Startup Proxy Diagnostic]: First API request resolved client IP: ${req.ip} | X-Forwarded-For: "${xff}" | Socket Remote: ${remote} | Trust Proxy: ${app.get('trust proxy')}`
    );
  }
  next();
});

// Helmet security headers (with restrictive CSP for Razorpay and Cloudinary)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          'https://checkout.razorpay.com',
        ],
        connectSrc: [
          "'self'",
          'https://api.razorpay.com',
          'https://lumberjack.razorpay.com',
          'https://cdn.razorpay.com',
          'https://res.cloudinary.com',
          'https://api.cloudinary.com',
        ],
        frameSrc: [
          "'self'",
          'https://checkout.razorpay.com',
          'https://api.razorpay.com',
        ],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://res.cloudinary.com',
          'https://checkout.razorpay.com',
          'https://cdn.razorpay.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
  })
);

// Request body size limits (prevents payload flood attacks, preserves raw body for webhook verification)
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Environment-based CORS configuration
const clientUrls = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = [...clientUrls];

// Include canonical storefront SITE_URL if defined
if (process.env.SITE_URL) {
  const normalizedSiteUrl = process.env.SITE_URL.trim().replace(/\/+$/, '');
  if (normalizedSiteUrl && !allowedOrigins.includes(normalizedSiteUrl)) {
    allowedOrigins.push(normalizedSiteUrl);
  }
}

if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:3000'
  );
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (such as mobile apps, curl, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // Allow any Vercel deployment for the project (*.vercel.app)
      if (/^https:\/\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.vercel\.app$/i.test(normalizedOrigin)) {
        return callback(null, true);
      }

      // In development mode, allow any localhost or 127.0.0.1 origin (handles dynamic Vite ports 5174, 5175, etc.)
      if (process.env.NODE_ENV !== 'production') {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
          return callback(null, true);
        }
      }

      console.warn(
        `[VASHTRAM CORS Blocked]: Origin "${origin}" rejected. Configured allowed origins:`,
        allowedOrigins
      );
      return callback(new Error('CORS policy: Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 200,
  })
);

// Rate Limiting Helper & Handlers
const createRateLimiter = (options) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  return rateLimit({
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (req, res, _next, opts) => {
      const retryAfter = Math.ceil(opts.windowMs / 1000);
      res.setHeader('Retry-After', retryAfter);
      const msg =
        typeof opts.message === 'string'
          ? opts.message
          : opts.message?.message || 'Too many requests. Please slow down and try again later.';
      return res.status(429).json({
        success: false,
        message: msg,
        retryAfter,
      });
    },
    ...options,
  });
};

// 1. Global API Limiter (Excludes Razorpay webhook so gateway deliveries are not blocked by client IP limits)
const apiLimiter = createRateLimiter({
  windowMs: process.env.API_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.API_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.API_RATE_LIMIT_MAX ? parseInt(process.env.API_RATE_LIMIT_MAX, 10) : 500,
  message: 'Too many requests from this IP. Please try again after 15 minutes.',
  skip: (req) => {
    // Razorpay webhook is protected by cryptographic HMAC signature verification and dedicated high-cap limiter
    return req.originalUrl?.includes('/payment/webhook') || req.path === '/payment/webhook' || req.path === '/webhook';
  },
});
app.use('/api', apiLimiter);

// 2a. Customer Login Limiter: Per IP + Per Email compound key prevents credential stuffing
const loginLimiter = createRateLimiter({
  windowMs: process.env.LOGIN_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.LOGIN_RATE_LIMIT_MAX ? parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) : 10,
  keyGenerator: (req) => {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    return `${req.ip}_${email}`;
  },
  message: 'Too many login attempts for this account or IP. Please try again after 15 minutes.',
});
app.use('/api/auth/login', loginLimiter);

// 2b. Customer Per-Email Limiter: Blocks distributed brute-force attacks across rotating IPs against a customer account
const loginEmailLimiter = createRateLimiter({
  windowMs: process.env.EMAIL_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.EMAIL_RATE_LIMIT_MAX ? parseInt(process.env.EMAIL_RATE_LIMIT_MAX, 10) : 20,
  keyGenerator: (req) => {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    return email || req.ip || 'anonymous';
  },
  message: 'Too many login attempts for this account across multiple locations. Please try again after 15 minutes.',
});
app.use('/api/auth/login', loginEmailLimiter);

// 2c. Admin Login Limiters: Dedicated, independently configurable limiters for administrator login
// Trade-off: Uses a shorter lockout window (default 5 min vs 15 min) and separate threshold so distributed
// attackers cannot easily lock the real store administrator out of the management dashboard for long periods.
const adminLoginLimiter = createRateLimiter({
  windowMs: process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS, 10) : 5 * 60 * 1000,
  max: process.env.ADMIN_LOGIN_RATE_LIMIT_MAX ? parseInt(process.env.ADMIN_LOGIN_RATE_LIMIT_MAX, 10) : 10,
  keyGenerator: (req) => {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    return `admin_${req.ip}_${email}`;
  },
  message: 'Too many admin login attempts from this location. Please try again after 5 minutes.',
});
app.use('/api/admin/login', adminLoginLimiter);

const adminLoginEmailLimiter = createRateLimiter({
  windowMs: process.env.ADMIN_EMAIL_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.ADMIN_EMAIL_RATE_LIMIT_WINDOW_MS, 10) : 5 * 60 * 1000,
  max: process.env.ADMIN_EMAIL_RATE_LIMIT_MAX ? parseInt(process.env.ADMIN_EMAIL_RATE_LIMIT_MAX, 10) : 30,
  keyGenerator: (req) => {
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    return `admin_email_${email || req.ip}`;
  },
  message: 'Too many administrator login attempts for this account across multiple locations. Please try again after 5 minutes.',
});
app.use('/api/admin/login', adminLoginEmailLimiter);

// 3. Customer Registration Limiter
const registerLimiter = createRateLimiter({
  windowMs: process.env.REGISTER_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.REGISTER_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.REGISTER_RATE_LIMIT_MAX ? parseInt(process.env.REGISTER_RATE_LIMIT_MAX, 10) : 10,
  message: 'Too many registration attempts from this IP. Please try again after 15 minutes.',
});
app.use('/api/auth/register', registerLimiter);

// 4. Password Change Limiter (Only throttles when newPassword is present in PUT /api/auth/profile)
const passwordChangeLimiter = createRateLimiter({
  windowMs: process.env.PASSWORD_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.PASSWORD_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.PASSWORD_RATE_LIMIT_MAX ? parseInt(process.env.PASSWORD_RATE_LIMIT_MAX, 10) : 5,
  skip: (req) => !req.body?.newPassword,
  message: 'Too many password update attempts. Please try again after 15 minutes.',
});
app.use('/api/auth/profile', passwordChangeLimiter);

// 5. Payment Orders & Verification Limiters
const createOrderLimiter = createRateLimiter({
  windowMs: process.env.ORDER_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.ORDER_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.ORDER_RATE_LIMIT_MAX ? parseInt(process.env.ORDER_RATE_LIMIT_MAX, 10) : 30,
  message: 'Too many order creation attempts. Please try again after 15 minutes.',
});
app.use('/api/payment/create-order', createOrderLimiter);

const verifyPaymentLimiter = createRateLimiter({
  windowMs: process.env.VERIFY_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.VERIFY_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.VERIFY_RATE_LIMIT_MAX ? parseInt(process.env.VERIFY_RATE_LIMIT_MAX, 10) : 30,
  message: 'Too many payment verification attempts. Please try again after 15 minutes.',
});
app.use('/api/payment/verify', verifyPaymentLimiter);

// 6. Inquiry & Contact Form Limiter (Anti-Spam)
const inquiryLimiter = createRateLimiter({
  windowMs: process.env.INQUIRY_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.INQUIRY_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.INQUIRY_RATE_LIMIT_MAX ? parseInt(process.env.INQUIRY_RATE_LIMIT_MAX, 10) : 15,
  message: 'Too many inquiry submissions. Please try again after 15 minutes.',
});
app.use('/api/inquiries', inquiryLimiter);

// 7. Admin Routes Limiter
const adminRoutesLimiter = createRateLimiter({
  windowMs: process.env.ADMIN_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.ADMIN_RATE_LIMIT_MAX ? parseInt(process.env.ADMIN_RATE_LIMIT_MAX, 10) : 100,
  message: 'Too many admin operations. Please slow down and try again later.',
});
app.use('/api/admin', adminRoutesLimiter);

// 8. File Uploads Limiter
const uploadLimiter = createRateLimiter({
  windowMs: process.env.UPLOAD_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.UPLOAD_RATE_LIMIT_MAX ? parseInt(process.env.UPLOAD_RATE_LIMIT_MAX, 10) : 25,
  message: 'Too many file upload requests. Please wait a few minutes before trying again.',
});
app.use('/api/upload', uploadLimiter);
app.use('/api/about/upload', uploadLimiter);

// 9. Razorpay Webhook High Safety Cap (Protects against webhook flooding without blocking legitimate traffic)
const webhookLimiter = createRateLimiter({
  windowMs: process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000,
  max: process.env.WEBHOOK_RATE_LIMIT_MAX ? parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX, 10) : 1500,
  message: 'Webhook rate limit safety threshold exceeded.',
});
app.use('/api/payment/webhook', webhookLimiter);

// Logging (non-production only)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Static folder for uploaded files (local dev compatibility with nosniff security header)
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(path.join(__dirname, 'uploads'))
);

// Serverless DB connection initialization middleware (reused across warm invocations)
let isServerlessDbReady = false;
let serverlessDbPromise = null;

const initServerlessDb = async () => {
  if (isServerlessDbReady && mongoose.connection.readyState >= 1) return;
  if (!serverlessDbPromise) {
    serverlessDbPromise = (async () => {
      validateStartupConfig();
      await connectDB();
      try {
        await ensureDefaultUsers();
      } catch (userErr) {
        console.warn('[Serverless Init]: ensureDefaultUsers warning:', userErr.message);
      }
      try {
        await ensureDefaultFeatures();
      } catch (featErr) {
        console.warn('[Serverless Init]: ensureDefaultFeatures warning:', featErr.message);
      }
      isServerlessDbReady = true;
    })().catch((err) => {
      serverlessDbPromise = null; // Allow retry on subsequent requests if connection failed
      throw err;
    });
  }
  return serverlessDbPromise;
};

// Ensure MongoDB connection is initialized for serverless requests (warm lambdas reuse connection)
app.use(async (req, res, next) => {
  if (
    mongoose.connection.readyState >= 1 ||
    req.path === '/' ||
    req.path === '/api/health' ||
    req.path === '/robots.txt' ||
    req.path === '/sitemap.xml'
  ) {
    return next();
  }
  try {
    await initServerlessDb();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database connection is not active');
    }
    next();
  } catch (err) {
    console.error('[Serverless DB Error]:', err.message);
    return res.status(503).json({
      success: false,
      message: 'Database service is currently unavailable. Please try again shortly.',
    });
  }
});

// API Health Check (Safe, does not expose internal host, credentials, or filesystem info)
app.get('/api/health', async (req, res) => {
  let isDbConnected = mongoose.connection.readyState === 1;

  // In serverless cold starts, initialize connection if not already established
  if (!isDbConnected) {
    try {
      await initServerlessDb();
      isDbConnected = mongoose.connection.readyState === 1;
    } catch (dbErr) {
      console.warn('[Health Check Notice]: Database connection attempt failed:', dbErr.message);
    }
  }

  res.status(isDbConnected ? 200 : 503).json({
    success: true,
    status: isDbConnected ? 'ok' : 'degraded',
    service: 'VASHTRAM E-Commerce API',
    database: {
      connected: isDbConnected,
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/hero', heroRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/about', aboutRoutes);
// Dynamic SEO routes using centralized SITE_URL (Issue 31)
app.get('/robots.txt', (req, res) => {
  const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/*\nDisallow: /checkout\nDisallow: /order/*\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const today = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${siteUrl}/shop</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${siteUrl}/categories</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${siteUrl}/about</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${siteUrl}/contact</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>${siteUrl}/privacy-policy</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>${siteUrl}/terms</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>${siteUrl}/shipping-policy</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>${siteUrl}/return-policy</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
</urlset>`;
  res.type('application/xml');
  res.send(xml);
});

// Serve built frontend SPA if dist folder exists, otherwise redirect in dev
const clientDistPath = fs.existsSync(path.join(__dirname, '../frontend/dist'))
  ? path.join(__dirname, '../frontend/dist')
  : path.join(__dirname, '../client/dist');
const renderIndexHtml = (req) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  if (!fs.existsSync(indexPath)) return null;
  const raw = fs.readFileSync(indexPath, 'utf8');
  const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return raw.replaceAll('__SITE_URL__', siteUrl);
};

// Minimal root status endpoint for API deployments (serves simple JSON status or defers to frontend SPA if present)
app.get('/', (req, res, next) => {
  if (fs.existsSync(clientDistPath) && req.accepts('html')) {
    return next();
  }
  res.status(200).json({
    success: true,
    service: 'VASHTRAM E-Commerce API',
    status: 'active',
  });
});

if (fs.existsSync(clientDistPath)) {
  // Use index: false so requests to '/' hit the templating route
  app.use(express.static(clientDistPath, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    const html = renderIndexHtml(req);
    if (!html) return next();
    res.type('html').send(html);
  });
} else {
  // Redirect direct browser requests for admin routes to client UI in dev
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  app.get(['/admin', '/admin/*'], (req, res) => {
    res.redirect(`${clientUrl}${req.originalUrl}`);
  });
}

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

// Environment validation before startup
const validateProductionConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    const requiredVars = [
      'MONGODB_URI',
      'JWT_SECRET',
      'CLIENT_URL',
      'SITE_URL',
      'ADMIN_EMAIL',
      'ADMIN_PASSWORD',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ];

    const missing = requiredVars.filter(
      (varName) => !process.env[varName] || !process.env[varName].trim()
    );

    if (missing.length > 0) {
      console.error(
        `[Production Configuration Error]: Missing required environment variables in production: ${missing.join(', ')}`
      );
      console.error(
        '[Production Configuration Error]: Please configure these variables in your hosting provider dashboard before deploying.'
      );
      if (process.env.VERCEL) {
        throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
      }
      process.exit(1);
    }

    if (process.env.JWT_SECRET.length < 32 || /vastram_super_secret|secret123|change_this|default_secret/i.test(process.env.JWT_SECRET)) {
      console.error(
        '[Production Configuration Error]: JWT_SECRET must be at least 32 characters long and cryptographically strong (cannot be a default placeholder).'
      );
      if (process.env.VERCEL) {
        throw new Error('JWT_SECRET must be at least 32 characters long and cryptographically strong.');
      }
      process.exit(1);
    }

    if (process.env.ADMIN_PASSWORD) {
      const pwd = process.env.ADMIN_PASSWORD;
      const isStrong =
        pwd.length >= 12 &&
        /[A-Z]/.test(pwd) &&
        /[a-z]/.test(pwd) &&
        /[0-9]/.test(pwd) &&
        /[^A-Za-z0-9]/.test(pwd);

      if (!isStrong) {
        console.error(
          '[Production Configuration Error]: ADMIN_PASSWORD must be at least 12 characters long and contain uppercase, lowercase, number, and special character.'
        );
        if (process.env.VERCEL) {
          throw new Error('ADMIN_PASSWORD must be at least 12 characters long and contain uppercase, lowercase, number, and special character.');
        }
        process.exit(1);
      }
    }

    if (process.env.RAZORPAY_KEY_ID) {
      if (process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_') || !process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_')) {
        console.error(
          '[Production Configuration Error]: RAZORPAY_KEY_ID must be a live mode key in production (must start with rzp_live_).'
        );
        if (process.env.VERCEL) {
          throw new Error('RAZORPAY_KEY_ID must be a live mode key in production (must start with rzp_live_).');
        }
        process.exit(1);
      }
    }
  }
};

const validateStartupConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    validateProductionConfig();
    return;
  }

  // Development and test environment checks
  const missing = [];
  const hasMongoUri = Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim());
  const hasLocalMongoUri = Boolean(process.env.MONGODB_LOCAL_URI && process.env.MONGODB_LOCAL_URI.trim());

  if (!hasMongoUri && !hasLocalMongoUri) {
    missing.push('MONGODB_URI (or MONGODB_LOCAL_URI)');
  }

  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    missing.push('JWT_SECRET');
  }

  if (missing.length > 0) {
    console.error('\n============================================================');
    console.error('❌ [FATAL CONFIGURATION ERROR]: Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error('');
    console.error('Please configure these variables in server/.env or your system environment.');
    console.error('A template is available at .env.example');
    console.error('============================================================\n');
    process.exit(1);
  }
};

// Helper to terminate lingering stale processes on the development port
const freePortIfInUse = (port) => {
  if (process.env.NODE_ENV === 'production') return;
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = output.trim().split(/\r?\n/);
      const killed = new Set();
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (pid && pid !== process.pid && !killed.has(pid)) {
            killed.add(pid);
            console.log(`[Port Resolver]: Freeing busy port ${port} by terminating PID ${pid}...`);
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            } catch {}
          }
        }
      }
    } else {
      execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch {
    // Port not in use or netstat returned exit 1
  }
};

// Start Server after connecting to Database
const startServer = async () => {
  validateStartupConfig();
  await connectDB();
  const isProduction = process.env.NODE_ENV === 'production';
  const indexVerification = await verifyIndexes({ warnOnly: !isProduction });
  if (isProduction && !indexVerification.success) {
    console.error('\n❌ FATAL STARTUP ERROR: Required production database indexes are missing.');
    console.error('❌ Missing critical indexes:');
    (indexVerification.missing || []).forEach((idx) => console.error(`  - ${idx}`));
    console.error('\n❌ Run "npm run db:sync-indexes" or "npm run migrate:indexes" before starting the server.\n');
    process.exit(1);
  }
  await ensureDefaultUsers();
  await ensureDefaultFeatures();

  // Start automated background resilience services
  startRefundRetryScheduler();
  startPaymentRecoveryScheduler();

  const PORT = parseInt(process.env.PORT, 10) || 5000;
  const server = http.createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Port Conflict]: Port ${PORT} is busy (EADDRINUSE). Auto-recovering port in 1s...`);
        freePortIfInUse(PORT);
        setTimeout(() => {
          try {
            server.close();
          } catch {}
          server.listen(PORT, () => {
            console.log(`[VASHTRAM Server Running]: http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
          });
        }, 1200);
        return;
      }
      console.error(`[Fatal]: Port ${PORT} is already in use by another service.`);
      process.exit(1);
    } else {
      console.error(`[Server Error]: ${err.message}`);
      process.exit(1);
    }
  });

  // Pre-emptively clear any stale orphan process in dev before binding
  if (process.env.NODE_ENV !== 'production') {
    freePortIfInUse(PORT);
  }

  server.listen(PORT, () => {
    console.log(`[VASHTRAM Server Running]: http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });

  // Graceful shutdown handlers to ensure the socket and DB connection are always released cleanly
  const shutdown = async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        console.log('[VASHTRAM Server]: Closing database connection...');
        await mongoose.connection.close(false);
        console.log('[VASHTRAM Server]: MongoDB connection closed cleanly.');
      }
    } catch (dbErr) {
      console.error('[VASHTRAM Server]: Error closing MongoDB connection:', dbErr.message);
    }

    if (server.listening) {
      server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
};

if (require.main === module && !process.env.VERCEL) {
  startServer();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[Unhandled Rejection]: ${err.message}`);
});

// Attach all named exports and helpers to the Express application function
// for full backward compatibility with destructuring and submodules
app.app = app;
app.startServer = startServer;
app.validateProductionConfig = validateProductionConfig;
app.validateStartupConfig = validateStartupConfig;
app.resolveTrustProxy = resolveTrustProxy;
app.createRateLimiter = createRateLimiter;
app.loginLimiter = loginLimiter;
app.loginEmailLimiter = loginEmailLimiter;
app.adminLoginLimiter = adminLoginLimiter;
app.adminLoginEmailLimiter = adminLoginEmailLimiter;
app.default = app;

module.exports = app;
