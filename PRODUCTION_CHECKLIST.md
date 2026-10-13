# 🚀 VASHTRAM Production Release Checklist

This document provides the mandatory pre-flight verification checklist for releasing VASHTRAM E-Commerce to production.

---

## 🔒 1. Secrets & Environment Configuration

- [ ] **Secrets Rotated Before Production Launch**:
  - Treat all development credentials as compromised.
  - Generate a new, random 64+ char `JWT_SECRET`.
  - Set a strong, unique `ADMIN_PASSWORD` (min 12 characters, uppercase, lowercase, numbers, special characters).
  - Provision unique production MongoDB Atlas database user credentials.
  - Rotate Cloudinary API key and secret.
  - Provision Razorpay LIVE API keys.
- [ ] **`NODE_ENV=production`**:
  - Ensure `NODE_ENV=production` is set in hosting dashboard (Render / Railway / AWS / Docker).
  - Confirm development stack traces and verbose logging are disabled in production.
- [ ] **MongoDB Configured**:
  - Production Atlas URI configured in `MONGODB_URI`.
  - Database connection verified with TLS/SSL and IP access list enabled.
  - Unique indexes verified (`npm run verify:indexes`).
- [ ] **Razorpay LIVE Credentials Configured**:
  - `RAZORPAY_KEY_ID` starts with `rzp_live_` (server startup strictly rejects `rzp_test_` in production).
  - `RAZORPAY_KEY_SECRET` configured safely on backend only.
  - `RAZORPAY_WEBHOOK_SECRET` configured for payment capture recovery.
- [ ] **Cloudinary Configured**:
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` set in server environment.
- [ ] **`CLIENT_URL` Configured**:
  - Configured to the exact production frontend domain (e.g. `https://<your-domain>`).
  - No wildcard `*` CORS in production.
- [ ] **`SITE_URL` Configured**:
  - Configured for canonical URLs, sitemaps (`/sitemap.xml`), and robots (`/robots.txt`).

---

## 🛠️ 2. Build & Package Verification

- [ ] **No Secrets in Repository**:
  - `.env` and `server/.env` are in `.gitignore`.
  - `.env.example` contains only safe placeholder values.
  - Verified no hardcoded tokens, passwords, or secrets exist in git history or client bundles.
- [ ] **Fresh Production Build**:
  - `npm run build` executed and succeeded with 0 errors.
  - `node scripts/verify-dist.js` passed: verified zero forbidden strings (`localhost`, `rzp_test_`, `unsplash`, `placehold.co`) in `client/dist`.
- [ ] **No Stale Dist Overriding Source**:
  - Build regenerated cleanly from source code.
- [ ] **Clean Release ZIP / Container**:
  - `node_modules`, `.env`, temporary logs, and debug files excluded from deployment bundle.

---

## 🧪 3. Runtime & API Verification

- [ ] **Backend Startup Successful**:
  - Starts cleanly and logs `[VASHTRAM Server Running]` on configured port.
  - MongoDB connects cleanly without warning.
  - Health endpoint `GET /api/health` returns `{ success: true, status: 'ok', database: { connected: true } }`.
- [ ] **Customer Authentication Tested**:
  - Signup, login, session persistence, and logout function correctly.
- [ ] **Admin Authentication & Authorization Tested**:
  - `POST /api/admin/login` verifies `role === 'admin'`. Non-admin accounts rejected with 403.
  - Admin APIs (`/api/admin/*`, `/api/products`, `/api/settings`, `/api/orders`) protected by `protect, admin` middleware.
- [ ] **Password Change Flow Tested**:
  - Password update in customer Account page increments `tokenVersion`, returns fresh JWT.
  - Frontend persists fresh token, session remains uninterrupted.
  - Old invalidated JWT returns 401 on subsequent requests.
- [ ] **Product Price & Discount Consistency**:
  - Authoritative rule enforced: `if discountPrice > 0 && discountPrice < price => discountPrice else price`.
  - Backend recalculates totals from database; client-supplied prices are ignored.
- [ ] **Payment & Order Security Tested**:
  - Razorpay order amounts computed server-side.
  - Payment signature verified with HMAC SHA256 before order confirmation.
  - Webhooks verified with constant-time HMAC check.
  - Idempotent processing prevents duplicate order creation.
- [ ] **Atomic Stock Protection Tested**:
  - Atomic stock decrements (`$inc: { stock: -qty }`, `stock: { $gte: qty }`) prevent overselling.
  - Stock never drops below zero.
- [ ] **Admin Settings Validated**:
  - Negative shipping fees, thresholds, or malformed email/phone numbers rejected with 400 Bad Request.
  - Dynamic WhatsApp number configured in admin appears immediately in customer storefront.
- [ ] **Z-Index Layering Verified**:
  - WhatsApp floating button sits at `--z-whatsapp: 1100`.
  - Toast notifications, modals, dropdowns, and drawers render cleanly above floating buttons without overlap.
- [ ] **Mobile Responsiveness Tested**:
  - Responsive layouts verified at 320px, 375px, 414px, 768px, 1024px, 1440px.
  - No horizontal page overflow.
