# 🌿 VASHTRAM — Premium Bedsheet & Home Textile E-Commerce Platform

A production-ready, full-stack e-commerce web application for **VASHTRAM**, an artisanal Indian home textile and bedding brand. Built with a **React.js** frontend (Vite), **Node.js/Express** REST API backend, **MongoDB** database with **Mongoose** ODM, **Cloudinary** for persistent image storage, and **Razorpay** for online payment processing.

---

> [!IMPORTANT]
> **Release Directory Notice**: The `release/` folder is strictly machine-generated from the main source tree (`client/`, `server/`, `scripts/`) via `npm run package:release`. It must **never** be edited by hand. All changes, bug fixes, and configuration updates must be made in `main`. Cryptographic verification (`npm run verify:release`) enforces that `release/` matches the generator output with 100% SHA-256 accuracy.

---

## 📸 Overview & Features

### 🌟 Customer Experience
- **Luxury Brand Experience**: Warm serif typography, tranquil neutral palette, and curated bedroom aesthetics.
- **Dynamic Category Browsing**: King Size, Queen Size, Single Bed, 100% Pure Cotton, Printed Collection, and Luxury Sateen Collection.
- **Product Catalog & Search**: Real-time filtering by category, mattress size, price range slider, color swatches, and live regex-safe search.
- **Rich Product Details (`/product/:slug`)**: Multi-angle gallery, stock warning badges, thread count specs, wash care instructions, customer reviews, and related collection carousels.
- **Shopping Bag & Checkout**: Razorpay online payment integration with pre-order inventory validation, authoritative server-side totals, double-click protection, and automatic refund on stock failure.
- **Order Tracking (`/order/:id`)**: Multi-step fulfillment tracker (`Pending` → `Confirmed` → `Processing` → `Shipped` → `Delivered`).
- **Customer Account Portal (`/account`, `/orders`)**: Order history, status badges, profile updates, and saved addresses.

### 🛡️ Admin Management Portal (`/admin/*`)
- **Live Database Dashboard**: Real-time metrics from MongoDB: Total Products, Total Orders, Total Customers, Total Revenue, and Low Stock alerts.
- **Attention & Refund Tracking (`/admin/payments/attention`)**: Real-time visibility into any payments or orders requiring operator attention (e.g. failed automated refunds).
- **Product Management CRUD**: Add/edit bedsheets, upload images directly to Cloudinary, configure thread counts, prices, stock levels, and toggle visibility.
- **Category Management CRUD**: Add, edit, reorder, or deactivate bedsheet collections with automated product count sync.
- **Order Fulfillment & Cancellation**: Search orders, track status history, and update progression (`Pending` → `Delivered`). Race-safe single stock restoration and automated refunds upon cancellation.
- **Strict Role Security**: Backend JWT middleware enforcing `admin` role authorization; unauthorized users receive `403 Forbidden`.

### 🌓 Theme System (Light & Dark Mode)
- **Default Light Theme**: Elegant warm ivory (`#FAF9F5`), crisp white cards, refined camel tan accents (`#8B6239`), and readable typography.
- **Dark Mode**: Deep obsidian slate (`#121316`), warm charcoal surfaces (`#20232B`), and champagne gold accents (`#C5A880`).
- **Persistence**: Selected theme persists across sessions via `localStorage`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, React Router DOM, Axios, Lucide React, Vanilla CSS Design System |
| **Backend** | Node.js, Express.js REST API, Morgan HTTP Logger, Multer (Memory Storage), CORS |
| **Payment Gateway** | Razorpay SDK with atomic PaymentIntent claim, idempotency keys, and recovery workers |
| **Image Storage** | Cloudinary API (Production) / Local Uploads (Development Fallback) |
| **Database** | MongoDB with Mongoose ODM (unique partial indexes on Razorpay payment IDs) |
| **Security & Auth** | JSON Web Tokens (JWT), bcryptjs password hashing, Helmet CSP, express-rate-limit |
| **Testing** | Automated Comprehensive Integration Suite (`npm test`) |

---

## 📁 Project Architecture

```
vashtram/
├── client/                     # React Frontend Application (Vite)
│   ├── src/
│   │   ├── components/         # Navbar, Footer, ProductCard, Toast, ProtectedRoute, Home sections
│   │   ├── context/            # useAuth, useCart, useTheme, useSettings & Context definitions
│   │   ├── pages/              # Storefront pages & /admin management pages
│   │   ├── services/           # api.js (Axios instance with JWT interceptor & 401 handling)
│   │   ├── utils/              # imageUrl, sizeHelper, validationHelper
│   │   └── index.css           # VASHTRAM luxury design system & theme tokens
│   ├── public/                 # Static assets, local image fallbacks, _headers (Netlify CSP)
│   ├── vercel.json             # Vercel SPA routing & CSP security headers
│   ├── vite.config.js          # Build-time __SITE_URL__ injection plugin
│   └── package.json
│
├── server/                     # Node.js / Express Backend API
│   ├── config/                 # db.js, razorpay.js, cloudinary.js, validateConfig.js
│   ├── controllers/            # auth, product, category, order, admin, payment controllers
│   ├── middleware/             # authMiddleware, errorMiddleware, uploadValidator
│   ├── models/                 # User, Product, Category, Order, PaymentIntent, WebhookEvent
│   ├── routes/                 # Express API routes & uploadRoutes
│   ├── services/               # refundService (shared race-safe refunds), paymentRecoveryService
│   ├── utils/                  # migrations, verifyIndexes, cleanupDemoAccounts, verifyNoDemoAccounts
│   ├── server.js               # Express application entry point (Helmet, Rate Limiter, CORS)
│   └── package.json
│
├── scripts/                    # Release packaging, verify-dist, verify-syntax, zip-source
├── DEPLOYMENT.md               # Step-by-step production deployment & Atlas/Cloudinary guide
└── package.json                # Cross-platform orchestration scripts
```

---

## ⚡ Local Development Setup

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **MongoDB** running locally on `mongodb://127.0.0.1:27017` (or MongoDB Atlas connection URI)

### 2. Install Dependencies
Run from the project root:
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 3. Environment Variables
Create `.env` in `server/` and `client/` based on the example templates:

**`server/.env`**:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/vashtram
JWT_SECRET=
CLIENT_URL=http://localhost:5173
SITE_URL=http://localhost:5173

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

**`client/.env`**:
```env
# Relative /api for production reverse proxy, or empty in development
VITE_API_URL=/api
VITE_SITE_URL=http://localhost:5173
```

### 4. Start Development Servers
Run frontend and backend simultaneously:
```bash
npm run dev
```

Visit:
- **Storefront**: [http://localhost:5173](http://localhost:5173)
- **Admin Portal**: [http://localhost:5173/admin/login](http://localhost:5173/admin/login)
- **API Health**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🧪 Automated Testing & Verification

Run the test suite against an isolated test database (tests will **never** run against production):
```bash
npm test
```

Run production verification checks:
```bash
# Verify client build has no prohibited domains or tokens
npm run verify:dist

# Verify required database indexes are active
npm run verify:indexes

# Verify no prohibited demo accounts exist in database
npm run verify:no-demo-accounts
```

---

## 🌐 Production Release Checklist

Follow the full step-by-step instructions in [DEPLOYMENT.md](DEPLOYMENT.md):
1. Rotate all secrets (Atlas, JWT, Admin, Cloudinary, Razorpay).
2. Set production environment variables on your cloud hosting dashboard.
3. Back up the MongoDB Atlas database.
4. Run `npm run migrate:indexes`.
5. Run `npm run migrate:intents`.
6. Run `npm run cleanup:demo -- --confirm`.
7. Run `npm run verify:no-demo-accounts`.
8. Run `npm run verify:indexes`.
9. Run `npm run verify:dist`.
10. Configure Razorpay webhook (`payment.captured`, `order.paid`).
11. Execute one real live payment and verify refund via Admin Panel.

---

## 🔒 Session Security & Global Logout

VASHTRAM uses server-enforced JWT session revocation via `tokenVersion`. When a user (customer or administrator) logs out, the backend increments their `tokenVersion`, invalidating active sessions across all devices and browsers immediately. Password changes, resets, and account deactivations similarly revoke all outstanding sessions.
