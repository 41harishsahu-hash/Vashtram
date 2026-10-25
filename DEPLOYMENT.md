# 🚀 VASHTRAM Production Deployment Guide

This document outlines the step-by-step procedure for deploying the **VASHTRAM MERN E-Commerce Platform** to production environments (such as Render, Railway, AWS, DigitalOcean, Vercel, or Netlify).

---

> [!IMPORTANT]
> **Single Source of Truth Notice**: The `release/` folder is strictly machine-generated from the main source repository (`frontend/`, `backend/`) using `npm run package:release`. It must **never** be manually edited. CI/CD checks (`npm run verify:release`) verify release consistency by SHA-256 hash comparison against fresh builds.

---

## 📋 Table of Contents
1. [Security Notice & Secret Rotation](#1-security-notice--secret-rotation)
2. [Required Production Environment Variables](#2-required-production-environment-variables)
3. [Production Release Checklist](#3-production-release-checklist)
4. [MongoDB Atlas Setup & Backup](#4-mongodb-atlas-setup--backup)
5. [Cloudinary Image Storage Setup](#5-cloudinary-image-storage-setup)
6. [Razorpay Live Payment & Webhook Configuration](#6-razorpay-live-payment--webhook-configuration)
7. [Database Index Migration & Deploy Order](#7-database-index-migration--deploy-order)
8. [Backend Deployment](#8-backend-deployment)
9. [Reverse Proxy & Rate Limiting Configuration](#9-reverse-proxy--rate-limiting-configuration)
10. [Administrator Password Recovery](#10-administrator-password-recovery)
11. [Frontend Deployment](#11-frontend-deployment)
12. [CORS & Domain Configuration](#12-cors--domain-configuration)
13. [Post-Deployment Verification](#13-post-deployment-verification)

---

## 1. Security Notice & Secret Rotation

> [!WARNING]
> If any environment variables or credentials have been committed or shared previously in development repositories, they **must be treated as compromised**.
> Prior to launching your production site, generate **brand new, unique, cryptographically strong secrets** in each provider's dashboard.

Never commit `.env` files to git. Use hosting platform dashboards (e.g. Render Environment Variables, Vercel Project Settings) to supply values securely.

---

## 2. Required Production Environment Variables

### Backend Environment Variables (Render / Railway / Cloud Host)
All backend variables are strictly server-side and must **NEVER** be exposed to the frontend or committed to Git:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=
JWT_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SITE_URL=
CLIENT_URL=
```

* **`NODE_ENV`**: Set to `production` (enforces strict security headers, CORS origin checks, and production error masking).
* **`PORT`**: Assigned automatically by your cloud host (defaults to `5000`).
* **`MONGODB_URI`**: **Backend-only.** Your production MongoDB Atlas connection string (e.g. `mongodb+srv://<user>:<password>@cluster0.mongodb.net/vashtram?retryWrites=true&w=majority`).
* **`JWT_SECRET`**: **Backend-only.** Cryptographically generated random hexadecimal key (minimum 32 characters, 64+ bytes recommended).
* **`ADMIN_EMAIL`**: **Backend-only.** Primary email for admin dashboard authentication.
* **`ADMIN_PASSWORD`**: **Backend-only.** Strong, unique administrator password (hashed with bcrypt on storage).
* **`RAZORPAY_KEY_ID`**: **Backend-only.** Razorpay Live Key ID (`rzp_live_...`).
* **`RAZORPAY_KEY_SECRET`**: **Backend-only.** Razorpay Live Key Secret.
* **`RAZORPAY_WEBHOOK_SECRET`**: **Backend-only (REQUIRED in production).** Secret string generated in Razorpay Dashboard for webhook signature verification. The production server will refuse to start without it.
* **`CLOUDINARY_CLOUD_NAME`**, **`CLOUDINARY_API_KEY`**, **`CLOUDINARY_API_SECRET`**: **Backend-only (REQUIRED in production).** Cloudinary credentials for cloud storage. The server returns HTTP 503 for uploads if unconfigured.
* **`SITE_URL`**: Public-facing canonical storefront URL (e.g. `https://<your-domain>`). Used by the server for canonical URLs, sitemaps (`/sitemap.xml`), robots (`/robots.txt`), and OpenGraph metadata.
* **`CLIENT_URL`**: Allowed frontend origin for backend CORS and redirects (e.g. `https://<your-domain>`). Comma-separated if multiple origins exist.

### Frontend Environment Variables (Vercel / Netlify / Client Host)
Configured in your frontend deployment settings:

```env
VITE_API_URL=
VITE_SITE_URL=
```

* **`VITE_API_URL`**: The public HTTPS API URL of your deployed backend ending in `/api` (e.g., `https://<your-domain>/api` or empty string if behind a reverse proxy).
* **`VITE_SITE_URL`**: Public canonical storefront URL (e.g., `https://<your-domain>`). **REQUIRED at build time** (`npm run build`); Vite injects this into `<link rel="canonical">` and OpenGraph tags in `index.html`.
* **CRITICAL**: Never add backend secrets, database connection strings, admin passwords, or Cloudinary API secrets to frontend variables.

---

## 3. Production Release Checklist

Follow these steps in strict sequential order before taking traffic:

1. **Rotate all secrets**: Generate new secrets in MongoDB Atlas, Cloudinary, and Razorpay dashboards. Generate a new `JWT_SECRET` (at least 32 characters).
2. **Set host environment variables**: Configure backend and frontend variables in provider dashboards as detailed in Section 2.
3. **Back up Atlas database**: Create a snapshot backup in MongoDB Atlas before running migrations.
4. **Run database index migration**:
   ```bash
   npm run migrate:indexes
   ```
5. **Run payment intent backfill migration**:
   ```bash
   npm run migrate:intents
   ```
6. **Clean up demo accounts**:
   ```bash
   npm run cleanup:demo -- --confirm
   ```
7. **Verify no demo accounts exist**:
   ```bash
   npm run verify:no-demo-accounts
   ```
8. **Verify all production database indexes**:
   ```bash
   npm run verify:indexes
   ```
9. **Verify client production build bundle**:
   ```bash
   npm run verify:dist
   ```
10. **Configure Razorpay webhook**: Set webhook endpoint to `https://<your-domain>/api/payment/webhook` with events `payment.captured` and `order.paid` and configure the matching `RAZORPAY_WEBHOOK_SECRET`.
11. **Perform end-to-end verification**: Execute one real small payment in Razorpay Live mode, verify stock deduction, and perform a refund via Admin Panel (`/admin/orders`).

---

## 4. MongoDB Atlas Setup & Backup

1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Under **Security → Database Access**, create a user with read/write permissions.
3. Under **Security → Network Access**, add the IP address of your backend host (or allow `0.0.0.0/0` for dynamic cloud providers like Render/Railway).
4. Obtain your connection URI:
   ```text
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/vashtram?retryWrites=true&w=majority
   ```
5. Ensure automated daily backups are active in Atlas (under **Backup** tab).

---

## 5. Cloudinary Image Storage Setup

1. Sign up or log into [Cloudinary](https://cloudinary.com/).
2. On your Cloudinary Dashboard, obtain **Cloud Name**, **API Key**, and **API Secret**.
3. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on your backend server.

---

## 6. Razorpay Live Payment & Webhook Configuration

1. In Razorpay Dashboard, complete business KYC and switch to **Live Mode**.
2. Under **Settings → API Keys**, generate a Live Key ID (`rzp_live_...`) and Secret.
3. Under **Settings → Webhooks**, click **Add New Webhook**:
   - **Webhook URL**: `https://<your-domain>/api/payment/webhook`
   - **Secret**: Generate a random 32-character secret string.
   - **Active Events**:
     - `payment.captured`
     - `order.paid`
4. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in your backend environment variables.

---

## 7. Mandatory Deployment Sequence (Deploy Order)

To ensure zero downtime, prevent race conditions, and guarantee that unique constraint indexes are active before traffic hits the database:

1. **Step 1: Configure Production Environment Variables**
   Ensure all required backend variables (`MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CLOUDINARY_*`, `RAZORPAY_*`, `CLIENT_URL`) are populated in your hosting dashboard.
2. **Step 2: Sync Database Indexes (Pre-Deployment)**
   Before booting the production backend for the first time or after schema changes, run:
   ```bash
   npm run db:sync-indexes
   ```
   * **Duplicate Pre-Flight Check**: This command audits for existing duplicates on `orders.razorpayPaymentId`, `orders.orderNumber`, `paymentintents.razorpayOrderId`, `webhookevents.eventId`, `users.email`, and `products.sku/slug`. If duplicates exist, it prints document IDs and counts and cleanly halts deployment.
   * **Index Creation**: If clean, it creates all required unique and partial production indexes.
   * **Startup Guard**: If the backend boots in production with missing critical indexes, startup will fail immediately with code 1.
3. **Step 3: Deploy Backend Server**
   Start the Node.js API service (`node server/server.js`). It verifies configuration, checks that indexes are active, and connects to MongoDB.
4. **Step 4: Deploy Frontend Client**
   Build and deploy the React client application (`npm run build`).

---

## 8. Backend Deployment

* **Build Command**: `cd server && npm install --production`
* **Start Command**: `node server/server.js` (or `npm start` from root)
* **Health Check Endpoint**: `GET /api/health` returns `200 OK` with database connection status.

---

## 9. Reverse Proxy & Rate Limiting Configuration

### Reverse Proxy Hop Count (`TRUST_PROXY`)

Express uses the `trust proxy` setting to determine how many reverse proxy hops to strip from the right-hand side of the `X-Forwarded-For` header in order to accurately identify the real client's IP address.

Configure `TRUST_PROXY` in your backend environment:

| Deployment Topology | `TRUST_PROXY` Value | Description |
| :--- | :--- | :--- |
| **Direct to hosting platform** | `1` *(default)* | Standard Render, Railway, AWS ALB, Heroku, or single Nginx fronting the app. |
| **Cloudflare + hosting platform** | `2` | Traffic routes through Cloudflare edge network, then through platform reverse proxy to Node.js. |
| **Vercel rewrite + hosting platform** | `2` | Client requests hit Vercel API rewrite proxy, then route through hosting platform reverse proxy to Node.js. |
| **Direct / bare metal (no proxy)** | `0` or `false` | Node.js listens directly on public internet port (not recommended in production). |

#### Startup Log & Diagnostics:
1. **Startup log line**: On boot, the server logs the active hop count:
   ```text
   [VASHTRAM Proxy]: Trust proxy configured to 1 hop(s)
   ```
2. **First request startup log**: The server automatically logs the client IP resolution for the very first API request:
   ```text
   [Startup Proxy Diagnostic]: First API request resolved client IP: 203.0.113.195 | X-Forwarded-For: "203.0.113.195, 10.0.0.1" | Socket Remote: 10.0.0.1 | Trust Proxy: 1
   ```
3. **Admin Diagnostic Endpoint (`ENABLE_PROXY_DIAGNOSTIC`)**:
   By default, the diagnostic endpoint is disabled (`ENABLE_PROXY_DIAGNOSTIC=false`) to minimize exposure.
   **Verification workflow**:
   - Set `ENABLE_PROXY_DIAGNOSTIC=true` in backend environment settings.
   - Deploy and authenticate as administrator.
   - Query the diagnostic route:
     ```http
     GET /api/admin/proxy-diagnostic
     Authorization: Bearer <ADMIN_JWT_TOKEN>
     ```
     Returns:
     ```json
     {
       "success": true,
       "resolvedClientIp": "203.0.113.195",
       "xForwardedForChain": "203.0.113.195, 10.0.0.1",
       "socketRemoteAddress": "10.0.0.1",
       "trustProxyHops": 1,
       "timestamp": "2026-10-07T12:00:00.000Z"
     }
     ```
   - **Verification Check**: If `resolvedClientIp` matches your public client IP rather than the internal proxy IP (`10.x.x.x`), `TRUST_PROXY` is verified.
   - **Disable endpoint**: Set `ENABLE_PROXY_DIAGNOSTIC=false` (or remove the variable) once verification is complete. The endpoint returns `404 Not Found` when disabled.

---

### Rate Limiting Architecture & Login Lockout Trade-Offs

All VASHTRAM rate limiters (`apiLimiter`, `loginLimiter`, `loginEmailLimiter`, `adminLoginLimiter`, `adminLoginEmailLimiter`, `registerLimiter`, etc.) currently utilize Express's default **in-memory store**.

#### Customer vs. Admin Login Rate Limiting Trade-Off:
- **Customer Login (`/api/auth/login`)**:
  - Uses `loginLimiter` (IP+email, 10 per 15 min) and `loginEmailLimiter` (per-email, 20 per 15 min).
  - This stops automated credential stuffing against customer accounts.
- **Admin Login (`/api/admin/login`)**:
  - Uses separate, dedicated limiters: `adminLoginLimiter` (`ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS=300000`, max 10) and `adminLoginEmailLimiter` (`ADMIN_EMAIL_RATE_LIMIT_WINDOW_MS=300000`, max 30).
  - **The Trade-Off**:
    * If the admin endpoint used a long 15-minute per-email lockout, a distributed botnet rotating many IP addresses could continuously submit bad passwords for the known administrator email and **permanently deny access (account-level DoS)** to the real administrator.
    * By isolating `/api/admin/login` with a **shorter 5-minute lockout window** and higher per-email threshold (30 attempts) combined with strict IP-compound throttling, brute force attacks remain computationally infeasible while ensuring the real administrator is not locked out of store operations for extended periods.

#### Horizontal Scaling & Redis Migration:
> [!IMPORTANT]
> **Single vs Multiple Instances**:
> - **Single-instance deployments**: In-memory rate limiting is completely self-contained and zero-dependency.
> - **Multi-instance horizontal scaling**: In-memory counters are local to each Node.js process and **are not shared** across cluster instances or autoscaled containers.
> - **Transitioning to Multi-Instance / Redis**:
>   If horizontal scaling is enabled with multiple backend replicas:
>   1. Install `rate-limit-redis` and `ioredis`:
>      ```bash
>      npm install rate-limit-redis ioredis
>      ```
>   2. In `server/server.js`, configure a shared Redis client and pass `store: new RedisStore({ sendCommand: (...args) => redisClient.call(...args) })` inside `createRateLimiter()`.
>   3. Set `REDIS_URL=redis://...` in environment variables.

---

## 10. Administrator Password Recovery

In the event that administrator credentials are lost or need emergency rotation:

> [!WARNING]
> Never pass administrator passwords as command-line arguments (such as `node reset.js user pass`). Command-line arguments are recorded in OS process listings (`ps -ef`) and shell command history (`.bash_history`).

### Recovery Steps (Requires Direct Server Shell Access):

1. Connect to your production container/server shell.
2. Run the recovery tool specifying only the administrator email:
   ```bash
   npm run admin:reset-password admin@yourdomain.com
   # Or directly:
   node backend/utils/resetAdminPassword.js admin@yourdomain.com
   ```
3. When prompted, type the new administrator password (keystrokes are hidden and not echoed to terminal) and confirm it.
4. **Automated/CI Execution**:
   To execute non-interactively without prompting:
   ```bash
   ADMIN_NEW_PASSWORD="YourStrongNewPassword2026!" npm run admin:reset-password admin@yourdomain.com
   ```
5. **Security Enforcements**:
   * Password policy is strictly enforced (min. 8 characters, mix of letters and numbers, common passwords blacklisted).
   * Automatically increments `tokenVersion`, instantly invalidating any prior active JWT sessions across all devices.

---

## 11. Frontend Deployment

* **Root Directory**: `frontend` (formerly `client` — update in Vercel / Netlify dashboard settings)
* **Build Command**: `npm run build` (requires `VITE_SITE_URL=https://<your-domain>`)
* **Output Directory**: `dist`
* **SPA Routing & Security Headers**:
  - Netlify: `frontend/public/_headers` provides CSP and frame guards.
  - Vercel: `frontend/vercel.json` provides route rewrites and security headers.

---

## 12. CORS & Domain Configuration

Set `CLIENT_URL` to your production frontend domain:
```env
CLIENT_URL=https://<your-domain>
```
If supporting both apex domain and `www`, separate with a comma:
```env
CLIENT_URL=https://<your-domain>,https://www.<your-domain>
```

---

## 13. Post-Deployment Verification

Verify the following items on your live production domain:
- [ ] Backend `/api/health` returns `HTTP 200` with `status: "online"`.
- [ ] Helmet security headers (`cross-origin-resource-policy: cross-origin`, `nosniff`, CSP) are present on responses.
- [ ] Unauthorized origins trigger CORS protection.
- [ ] Frontend loads without console errors or missing assets.
- [ ] Live Razorpay Checkout modal opens properly.
- [ ] Test order completes successfully in live mode and decrements stock.
- [ ] Test refund processes cleanly via Admin Panel.
- [ ] Admin panel is accessible with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- [ ] Rate limiting rejects excessive brute-force attempts on `/api/auth/login` (HTTP 429).

---

## 14. Financial Totals, Refund Accounting & Returned Orders Policy

All financial computations across the platform adhere to the centralized authoritative rules defined in `server/utils/financialMetrics.js`.

### Single Source of Truth
Every query calculating sales, revenue, or customer spending utilizes the identical aggregation expression (`getRevenueAggregationExpr()`):
1. **Admin Dashboard Total Revenue**: `/api/admin/dashboard`
2. **Admin Dashboard Monthly Revenue Series**: `/api/admin/dashboard`
3. **Admin Customer Lifetime Spending**: `/api/admin/customers`

### Currency & Unit Precision
* `order.totalAmount`: Stored in **Rupees (INR)**.
* `order.refundAmount`: Stored in **Rupees (INR)** (e.g. ₹500 is stored as `500`, not `50000`).
* Razorpay gateways deliver event payloads in paise (`amount: 50000`). The backend webhook and refund services strictly divide by 100 before storing in MongoDB.

### Exact Rule for Returned Orders
* **Full Return**: If `orderStatus === 'Returned'` and either `refundAmount >= totalAmount` OR `refundAmount === 0` (return accepted and goods returned to atelier; refund pending warehouse inspection), net retained revenue is strictly **₹0** (return accepted, revenue voided).
* **Partial Return**: If `orderStatus === 'Returned'` and `0 < refundAmount < totalAmount` (customer kept part of a multi-item order and received a partial refund for returned items), net retained revenue is strictly **(totalAmount - refundAmount) INR**.
* **Cancelled & Fully Refunded**: Orders with `orderStatus === 'Cancelled'` or `paymentStatus === 'Refunded'` or `isRefunded === true` contribute **₹0**.
* **Active Paid Orders**: Unreturned paid orders contribute **totalAmount - (refundAmount || 0)**.

---

## 15. Session Revocation & Global Logout Architecture

VASHTRAM enforces server-enforced JWT session revocation via `tokenVersion`:
* **Global Session Invalidation on Logout**: When a customer or administrator clicks "Sign Out", the server increments `user.tokenVersion`, invalidating all active JWTs for that account across all devices and browsers.
* **Security Events**: Password reset, password change, and administrator deactivation likewise bump `tokenVersion`, terminating existing sessions immediately.
* **User Feedback**: The frontend notifies the user upon sign out with: *"Signed out from all devices."*

