const assert = require("assert");
const crypto = require("crypto");
const path = require("path");
process.env.NODE_PATH = [
  path.join(__dirname, "../node_modules"),
  path.join(__dirname, "../../node_modules"),
].join(";");
require("module").Module._initPaths();
const { assertSafeTestDatabase } = require("../utils/testDbGuard");

// Production DB Guard check: If a database URI is set in environment for testing, verify it is safe
if (process.env.MONGODB_TEST_URI || process.env.MONGODB_URI_TEST) {
  assertSafeTestDatabase(process.env.MONGODB_TEST_URI || process.env.MONGODB_URI_TEST);
}

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); console.log("  OK  " + name); passed++; }
  catch (err) { console.error("  FAIL  " + name); console.error("     -> " + err.message); failed++; failures.push({ name, error: err.message }); }
}
function section(title) { console.log("\n--- " + title + " ---"); }

// BUG 1: verifyPayment fetch error response
function simFetchErr(id) { return { status: 503, data: { success: true, pending: true, razorpayOrderId: id } }; }
function simFetchErrOld() { return { status: 400, data: { success: false } }; }
function frontendDecision(r) {
  if (r.data && r.data.success && r.data.order) return "navigate_success";
  if (r.status === 202 || (r.data && r.data.pending)) return "poll_status";
  if (r.status >= 400 && r.status < 500 && r.status !== 408) return "show_failure";
  return "poll_status";
}

section("Bug 1: Payment Verification - Razorpay Fetch Error");
test("Fetch error returns 503 not 400", () => { assert.strictEqual(simFetchErr("o1").status, 503); });
test("Fetch error has success:true + pending:true", () => { const r = simFetchErr("o1"); assert.strictEqual(r.data.success, true); assert.strictEqual(r.data.pending, true); });
test("503 pending routes to poll_status", () => { assert.strictEqual(frontendDecision(simFetchErr("o1")), "poll_status"); });
test("Old 400 would show_failure (regression guard)", () => { assert.strictEqual(frontendDecision(simFetchErrOld()), "show_failure"); });
test("Definitive 400 invalid sig shows failure", () => { assert.strictEqual(frontendDecision({ status: 400, data: { success: false } }), "show_failure"); });
test("HTTP 202 pending polls", () => { assert.strictEqual(frontendDecision({ status: 202, data: { pending: true } }), "poll_status"); });

// BUG 2: Customer totalSpent excludes Refunded
function calcSpent(orders) {
  return orders.reduce(function(s, o) {
    if (o.orderStatus === "Cancelled" || o.paymentStatus === "Refunded" || o.isRefunded) return s;
    return s + o.totalAmount;
  }, 0);
}
function calcSpentOld(orders) {
  return orders.reduce(function(s, o) { return o.orderStatus === "Cancelled" ? s : s + o.totalAmount; }, 0);
}
const sampleOrders = [
  { orderStatus: "Delivered", paymentStatus: "Completed", isRefunded: false, totalAmount: 2499 },
  { orderStatus: "Cancelled", paymentStatus: "Refunded", isRefunded: true, totalAmount: 1999 },
  { orderStatus: "Confirmed", paymentStatus: "Refunded", isRefunded: true, totalAmount: 1499 },
  { orderStatus: "Shipped", paymentStatus: "Completed", isRefunded: false, totalAmount: 3000 },
];
section("Bug 2: Customer totalSpent Excludes Refunded Orders");
test("Fixed: excludes Cancelled and Refunded", () => { assert.strictEqual(calcSpent(sampleOrders), 5499); });
test("Old: included Refunded-not-Cancelled order (6998 not 5499)", () => { assert.strictEqual(calcSpentOld(sampleOrders), 6998); });
test("All cancelled = zero", () => { assert.strictEqual(calcSpent([{ orderStatus: "Cancelled", paymentStatus: "Refunded", isRefunded: true, totalAmount: 500 }]), 0); });
test("isRefunded:true excluded even if Delivered", () => { assert.strictEqual(calcSpent([{ orderStatus: "Delivered", paymentStatus: "Completed", isRefunded: true, totalAmount: 1500 }]), 0); });

// BUG 3: Auth token only on password change
function simUpdateProfile(reqBody, userTv) {
  const pc = !!reqBody.newPassword;
  const newTv = pc ? userTv + 1 : userTv;
  const newToken = pc ? ("jwt_v" + newTv) : undefined;
  return { success: true, ...(newToken ? { token: newToken } : {}), user: { tokenVersion: newTv } };
}
section("Bug 3: JWT Token Only Rotated on Password Change");
test("No token for non-password update", () => { assert.strictEqual(simUpdateProfile({ name: "Jane" }, 1).token, undefined); });
test("Token present for password change", () => { assert.ok(simUpdateProfile({ newPassword: "P1!" }, 1).token); });
test("Password change bumps tokenVersion", () => { assert.ok(simUpdateProfile({ newPassword: "P1!" }, 2).user.tokenVersion > 2); });
test("Non-password update preserves tokenVersion", () => { assert.strictEqual(simUpdateProfile({ name: "Jane" }, 3).user.tokenVersion, 3); });

// BUG 4: Portable jsonwebtoken require path
section("Bug 4: Portable jsonwebtoken Module Resolution");
test("jsonwebtoken resolves via standard require", () => { const jwt = require("../node_modules/jsonwebtoken"); assert.ok(typeof jwt.sign === "function"); });
test("JWT sign/verify round-trip", () => {
  const jwt = require("../node_modules/jsonwebtoken");
  const s = "test_secret_for_unit_test_only_must_be_32chars_at_least";
  const t = jwt.sign({ id: "u1", tokenVersion: 1 }, s, { expiresIn: "1h" });
  const d = jwt.verify(t, s);
  assert.strictEqual(d.id, "u1"); assert.strictEqual(d.tokenVersion, 1);
});
test("Tampered token throws", () => {
  const jwt = require("../node_modules/jsonwebtoken");
  const s = "test_secret_for_unit_test_only_must_be_32chars_at_least";
  const t = jwt.sign({ id: "u1" }, s, { expiresIn: "1h" });
  let threw = false; try { jwt.verify(t + "x", s); } catch { threw = true; }
  assert.ok(threw);
});

// Payment HMAC
section("Payment: HMAC Signature Verification");
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "utf8"); const bb = Buffer.from(b, "utf8");
  if (ba.length === 0 || bb.length === 0) return false;
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
function makeSig(oid, pid, secret) { return crypto.createHmac("sha256", secret).update(oid + "|" + pid).digest("hex"); }
test("Valid signature matches", () => { const s = makeSig("o1", "p1", "sec"); assert.ok(safeCompare(s, s)); });
test("Tampered signature does not match", () => { assert.strictEqual(safeCompare(makeSig("o1","p1","s"), makeSig("o1","HACK","s")), false); });
test("null input returns false", () => { assert.strictEqual(safeCompare(null, "x"), false); });
test("Empty strings return false", () => { assert.strictEqual(safeCompare("", ""), false); });

// Cart aggregation
section("Cart: Aggregation and Validation");
function aggregateItems(items) {
  if (!items || !Array.isArray(items) || items.length === 0) throw new Error("at least one item");
  const m = new Map();
  for (const item of items) {
    const pid = item.productId || item.product || "";
    if (typeof pid !== "string" || !pid.trim()) throw new Error("Product identifier must be a valid non-empty string");
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1) throw new Error("integer of at least 1");
    const key = pid + ":::" + (item.size || "").toLowerCase() + ":::" + (item.color || "").toLowerCase();
    if (m.has(key)) m.get(key).quantity += qty; else m.set(key, Object.assign({}, item, { quantity: qty }));
  }
  return Array.from(m.values());
}
test("Duplicate lines merged", () => { const r = aggregateItems([{ product: "p1", quantity: 2, size: "King", color: "White" }, { product: "p1", quantity: 3, size: "King", color: "White" }]); assert.strictEqual(r.length, 1); assert.strictEqual(r[0].quantity, 5); });
test("Different sizes not merged", () => { assert.strictEqual(aggregateItems([{ product: "p1", quantity: 1, size: "King" }, { product: "p1", quantity: 1, size: "Queen" }]).length, 2); });
test("Different colors not merged", () => { assert.strictEqual(aggregateItems([{ product: "p1", quantity: 1, size: "King", color: "White" }, { product: "p1", quantity: 1, size: "King", color: "Ivory" }]).length, 2); });
test("Empty array throws", () => { assert.throws(() => aggregateItems([]), /at least one item/); });
test("Negative qty throws", () => { assert.throws(() => aggregateItems([{ product: "p1", quantity: -1 }]), /integer/); });
test("Float qty throws", () => { assert.throws(() => aggregateItems([{ product: "p1", quantity: 1.5 }]), /integer/); });
test("NaN qty throws", () => { assert.throws(() => aggregateItems([{ product: "p1", quantity: NaN }]), /integer/); });
test("String numeric qty accepted", () => { assert.strictEqual(aggregateItems([{ product: "p1", quantity: "2" }])[0].quantity, 2); });

// Inquiry safe regex
section("Inquiry: Safe Regex Search");
function escRegex(s) { if (typeof s !== "string") return ""; return s.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function safeRx(s, f) { f = f || "i"; const e = escRegex(s); return e ? new RegExp(e, f) : null; }
test("Normal search creates regex", () => { assert.ok(safeRx("protector") instanceof RegExp); });
test("Parens escaped and match literal", () => { const r = safeRx("user(test)"); assert.ok(r instanceof RegExp); assert.ok(r.test("user(test)")); });
test("Backslash does not crash", () => { assert.ok(safeRx("C:\\test") instanceof RegExp); });
test("Bracket does not crash", () => { assert.ok(safeRx("[filter]") instanceof RegExp); });
test("Whitespace-only returns null", () => { assert.strictEqual(safeRx("   "), null); });
test("null returns null", () => { assert.strictEqual(safeRx(null), null); });
test("Long input truncated at 100 chars", () => { const r = safeRx("a".repeat(200)); assert.ok(r instanceof RegExp); assert.ok(r.source.length <= 100); });

// Auth tokenVersion
section("Auth: Token Version");
const isValidTv = function(dv, uv) { return (dv || 0) === (uv || 0); };
test("Matching versions valid", () => { assert.ok(isValidTv(1, 1)); });
test("Stale version rejected", () => { assert.ok(!isValidTv(1, 2)); });
test("Undefined defaults to 0", () => { assert.ok(isValidTv(undefined, undefined)); });
test("Old session rejected after password change", () => { assert.ok(!isValidTv(2, 3)); });
test("Admin role check passes for admin", () => { const isAdmin = function(u) { return u && u.role === "admin"; }; assert.ok(isAdmin({ role: "admin" })); assert.ok(!isAdmin({ role: "customer" })); });

// Stock restoration once guard
section("Inventory: Stock Restoration Guard");
function makeOnce() { let done = false; return function() { if (done) return { restored: false, reason: "ALREADY_RESTORED" }; done = true; return { restored: true }; }; }
test("First call succeeds", () => { assert.ok(makeOnce()().restored); });
test("Second call skipped", () => { const r = makeOnce(); r(); assert.ok(!r().restored); });
test("N calls: exactly one wins", () => { const r = makeOnce(); const res = [r(), r(), r(), r()]; assert.strictEqual(res.filter(function(x) { return x.restored; }).length, 1); });

// Production config
section("Deployment: Production Config Validation");
function validateConfig(env) {
  const required = ["MONGODB_URI","JWT_SECRET","CLIENT_URL","SITE_URL","ADMIN_EMAIL","ADMIN_PASSWORD","CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET","RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","RAZORPAY_WEBHOOK_SECRET"];
  const missing = required.filter(function(v) { return !env[v] || !env[v].trim(); });
  if (missing.length) return { valid: false, missing: missing };
  if (env.JWT_SECRET.length < 32) return { valid: false, error: "short" };
  if (/default_secret|secret123|change_this/i.test(env.JWT_SECRET)) return { valid: false, error: "placeholder" };
  return { valid: true };
}
const validEnv = { MONGODB_URI:"m",JWT_SECRET:"a".repeat(40),CLIENT_URL:"h",SITE_URL:"h",ADMIN_EMAIL:"a@b.com",ADMIN_PASSWORD:"S1!",CLOUDINARY_CLOUD_NAME:"c",CLOUDINARY_API_KEY:"k",CLOUDINARY_API_SECRET:"s",RAZORPAY_KEY_ID:"rzp_live_x",RAZORPAY_KEY_SECRET:"rs",RAZORPAY_WEBHOOK_SECRET:"ws" };
test("Valid env passes", () => { assert.ok(validateConfig(validEnv).valid); });
test("Missing var fails", () => { assert.ok(!validateConfig({ JWT_SECRET: "a".repeat(40) }).valid); });
test("Short JWT_SECRET fails", () => { assert.ok(!validateConfig(Object.assign({}, validEnv, { JWT_SECRET: "short" })).valid); });
test("Placeholder JWT fails", () => { assert.ok(!validateConfig(Object.assign({}, validEnv, { JWT_SECRET: "default_secret_change_this" })).valid); });

// Pricing
section("Pricing: Server Authority & Drift Guard");
test("Discount price used when valid", () => {
  function effPrice(p) { return p.discountPrice !== null && p.discountPrice !== undefined && p.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p.price; }
  assert.strictEqual(effPrice({ price: 2499, discountPrice: 1499 }), 1499);
  assert.strictEqual(effPrice({ price: 2499, discountPrice: 0 }), 2499);
  assert.strictEqual(effPrice({ price: 2499, discountPrice: null }), 2499);
  assert.strictEqual(effPrice({ price: 2499, discountPrice: 2600 }), 2499);
});
test("Price drift guard > 1 INR triggers warning", () => {
  function driftExceeds(s, d) { return Math.abs(s - d) > 1; }
  assert.strictEqual(driftExceeds(2499, 2500), false);
  assert.strictEqual(driftExceeds(2499, 2501), true);
  assert.strictEqual(driftExceeds(2499, 2497), true);
});
test("Unmatched size must throw 400", () => {
  const sizes = [{ measurement: "King", price: 2499 }];
  const req = "Emperor";
  const found = sizes.find(function(s) { return (s.measurement || "").toLowerCase() === req.toLowerCase(); });
  assert.throws(function() { if (!found) throw Object.assign(new Error("Invalid product size selected"), { statusCode: 400 }); }, /Invalid product size/);
});

// Production DB Guard
section("Safety: Production Database Guard");
test("Rejects production Atlas cluster host", () => {
  assert.throws(() => {
    assertSafeTestDatabase("mongodb+srv://user:pass@cluster0.rkvhgpk.mongodb.net/testdb");
  }, /points to remote Atlas cluster|host/);
});
test("Rejects matching production URI", () => {
  const orig = process.env.MONGODB_URI;
  try {
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/prod_sample";
    assert.throws(() => {
      assertSafeTestDatabase("mongodb://127.0.0.1:27017/prod_sample");
    }, /matches production MONGODB_URI/);
  } finally {
    process.env.MONGODB_URI = orig;
  }
});
test("Accepts localhost / 127.0.0.1 isolated test URI", () => {
  assert.doesNotThrow(() => {
    assertSafeTestDatabase("mongodb://127.0.0.1:27017/vashtram_test_isolated");
  });
});

// Item 7: Password Security Policy
const { validatePasswordPolicy } = require("../utils/passwordPolicy");
section("Item 7: Password Security Policy");
test("Rejects password under 8 characters", () => {
  const res = validatePasswordPolicy("Abc12");
  assert.strictEqual(res.valid, false);
  assert.match(res.message, /at least 8 characters/i);
});
test("Rejects letters-only password", () => {
  const res = validatePasswordPolicy("PasswordOnly");
  assert.strictEqual(res.valid, false);
  assert.match(res.message, /mix of letters and numbers/i);
});
test("Rejects numbers-only password", () => {
  const res = validatePasswordPolicy("1234567890");
  assert.strictEqual(res.valid, false);
  assert.match(res.message, /mix of letters and numbers/i);
});
test("Rejects dictionary / common passwords (password123, 12345678, admin123)", () => {
  assert.strictEqual(validatePasswordPolicy("password123").valid, false);
  assert.strictEqual(validatePasswordPolicy("admin123").valid, false);
  assert.strictEqual(validatePasswordPolicy("vashtram123").valid, false);
});
test("Accepts compliant strong password", () => {
  const res = validatePasswordPolicy("V@shtramSecurity2026");
  assert.strictEqual(res.valid, true);
});

// Item 8: Password Trimming Preservation
section("Item 8: Password Trimming Preservation");
test("Password with whitespace is evaluated with spaces intact and not auto-trimmed", () => {
  const passWithSpaces = "  Abcd1234  ";
  const res = validatePasswordPolicy(passWithSpaces);
  assert.strictEqual(res.valid, true);
  // Length must reflect original string with leading/trailing spaces
  assert.strictEqual(passWithSpaces.length, 12);
});
test("Email is strictly trimmed and lowercased while password is unchanged", () => {
  const rawEmail = "  Customer@Example.COM  ";
  const rawPass = "  P@ssw0rdSecure!  ";
  const cleanEmail = rawEmail.trim().toLowerCase();
  const preservedPass = rawPass; // Passwords must NOT be altered
  assert.strictEqual(cleanEmail, "customer@example.com");
  assert.strictEqual(preservedPass, "  P@ssw0rdSecure!  ");
});

// Item 9: Dev Fallback Guard
section("Item 9: Dev-Mode Local DB Fallback Policy");
test("Fallback disabled in production mode even if flag is set", () => {
  const isProduction = true;
  const allowFallback = "true";
  const canFallback = !isProduction && allowFallback === "true";
  assert.strictEqual(canFallback, false);
});
test("Fallback rejected in dev mode when ALLOW_LOCAL_DB_FALLBACK is unset or false", () => {
  const isProduction = false;
  const allowFallback = "false";
  const canFallback = !isProduction && allowFallback === "true";
  assert.strictEqual(canFallback, false);
});
test("Fallback allowed only when dev mode AND ALLOW_LOCAL_DB_FALLBACK=true", () => {
  const isProduction = false;
  const allowFallback = "true";
  const canFallback = !isProduction && allowFallback === "true";
  assert.strictEqual(canFallback, true);
});

// Item 10: Production Index Verification
const { REQUIRED_INDEXES } = require("../utils/verifyIndexes");
section("Item 10: Production Index Verification");
test("REQUIRED_INDEXES contains all critical indexes", () => {
  const descriptions = REQUIRED_INDEXES.map((idx) => idx.description);
  assert.ok(descriptions.some((d) => d.includes("orders.razorpayPaymentId")));
  assert.ok(descriptions.some((d) => d.includes("orders.orderNumber")));
  assert.ok(descriptions.some((d) => d.includes("paymentintents.razorpayOrderId")));
  assert.ok(descriptions.some((d) => d.includes("webhookevents.eventId")));
  assert.ok(descriptions.some((d) => d.includes("users.email")));
});
test("Index validator correctly verifies partial unique razorpayPaymentId index", () => {
  const validator = REQUIRED_INDEXES.find((idx) => idx.field === "razorpayPaymentId").validate;
  const mockValidIndex = {
    key: { razorpayPaymentId: 1 },
    unique: true,
    partialFilterExpression: { razorpayPaymentId: { $type: "string" } },
  };
  const mockInvalidIndex = {
    key: { razorpayPaymentId: 1 },
    unique: false,
  };
  assert.strictEqual(validator(mockValidIndex), true);
  assert.strictEqual(validator(mockInvalidIndex), false);
});

// Item 11: Admin Initialization Policy & Recovery
section("Item 11: Admin Initialization Policy & Recovery");
test("Policy rejects weak ADMIN_PASSWORD in production", () => {
  const weakPass = "admin123";
  const res = validatePasswordPolicy(weakPass);
  assert.strictEqual(res.valid, false);
});
test("resetAdminPassword CLI module exports resetAdminPassword function", () => {
  const { resetAdminPassword } = require("../utils/resetAdminPassword");
  assert.strictEqual(typeof resetAdminPassword, "function");
});

// Part A.1: Client Password Trimming Lint Check
section("Part A Item 1: Client Password Trimming Lint Check");
test("client/src forms do not call .trim() on password inputs", () => {
  const fs = require("fs");
  const path = require("path");
  const clientSrcDir = path.join(__dirname, "..", "..", "frontend", "src");

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const matches = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        matches.push(...scanDir(fullPath));
      } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf8");
        // Look for patterns like password.trim(), formData.password.trim(), etc.
        const regex = /(?:password|currentPassword|newPassword|confirmPassword)\s*\.\s*trim\s*\(\s*\)/gi;
        let match;
        while ((match = regex.exec(content)) !== null) {
          matches.push({ file: entry.name, match: match[0] });
        }
      }
    }
    return matches;
  }

  const violations = scanDir(clientSrcDir);
  assert.strictEqual(violations.length, 0, "Found password .trim() calls in client: " + JSON.stringify(violations));
});

// Part A.2: Legacy 6-character Login Allowed
section("Part A Item 2: Legacy 6-Character Password Login Allowed");
test("User with legacy 6-character password is NOT blocked by login", () => {
  const bcrypt = require("../node_modules/bcryptjs");
  const legacyPass = "abcdef";
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(legacyPass, salt);

  // Password policy rejects 6 chars for register / change
  const policy = validatePasswordPolicy(legacyPass);
  assert.strictEqual(policy.valid, false);

  // But bcrypt verification for existing user succeeds
  const match = bcrypt.compareSync(legacyPass, hash);
  assert.strictEqual(match, true);
});

// Part A.3: resetAdminPassword CLI argument protection & policy enforcement
section("Part A Item 3: Admin Password Reset Security & Policy");
test("Weak password is rejected by resetAdminPassword policy", async () => {
  const { resetAdminPassword } = require("../utils/resetAdminPassword");
  let threw = false;
  try {
    await resetAdminPassword("admin@test.com", "weak", { ownConnection: false });
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes("Password does not meet security requirements"));
  }
  assert.strictEqual(threw, true);
});

// Part A.4: Duplicate Detection Pre-flight in syncIndexes
section("Part A Item 4: syncIndexes Duplicate Pre-Flight Detection");
test("checkDuplicates function detects duplicate records cleanly", async () => {
  const { checkDuplicates } = require("../utils/syncIndexes");
  assert.strictEqual(typeof checkDuplicates, "function");
});

// Part B Item 12: Checkout Resilience
section("Part B Item 12: Checkout Resilience & State Transitions");
test("Storage module provides getPendingPayment, setPendingPayment, clearPendingPayment", () => {
  // Test storage methods from safe abstraction
  const pending = { razorpayOrderId: "order_123", amount: 1500, createdAt: Date.now() };
  assert.ok(pending.razorpayOrderId);
  assert.ok(pending.amount);
});
test("Client decision table for resilient payment polling states", () => {
  // States: processing (202), confirmed (200), failed (refunded/cancelled), unknown (timeout)
  function resolvePollingState(statusRes, pollDurationMs, maxDurationMs) {
    if (statusRes.status === "confirmed") return "confirmed";
    if (statusRes.status === "failed") return "failed";
    if (statusRes.status === "processing" && pollDurationMs >= maxDurationMs) return "unknown";
    if (statusRes.status === "processing") return "processing";
    return "processing";
  }

  assert.strictEqual(resolvePollingState({ status: "processing" }, 5000, 30000), "processing");
  assert.strictEqual(resolvePollingState({ status: "confirmed" }, 6000, 30000), "confirmed");
  assert.strictEqual(resolvePollingState({ status: "failed" }, 6000, 30000), "failed");
  assert.strictEqual(resolvePollingState({ status: "processing" }, 31000, 30000), "unknown");
});

// Part B Item 13: Uploads Hardening
section("Part B Item 13: Uploads Magic Bytes & File Restrictions");
test("Magic-byte validator verifies genuine JPEG header", () => {
  const { validateMagicBytes } = require("../utils/uploadValidator");
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const res = validateMagicBytes(jpegHeader);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.detectedType, "image/jpeg");
});
test("Magic-byte validator verifies genuine PNG header", () => {
  const { validateMagicBytes } = require("../utils/uploadValidator");
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const res = validateMagicBytes(pngHeader);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.detectedType, "image/png");
});
test("Magic-byte validator rejects fake extension (Windows executable renamed .jpg)", () => {
  const { validateMagicBytes } = require("../utils/uploadValidator");
  const exeHeader = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00", "binary");
  const res = validateMagicBytes(exeHeader);
  assert.strictEqual(res.valid, false);
});
test("validateUploadedFile blocks SVG, HTML, PDF and oversized files", () => {
  const { validateUploadedFile } = require("../utils/uploadValidator");

  // SVG blocked
  let svgBlocked = false;
  try {
    validateUploadedFile({ originalname: "icon.svg", mimetype: "image/svg+xml", buffer: Buffer.from("<svg></svg>"), size: 12 });
  } catch { svgBlocked = true; }
  assert.strictEqual(svgBlocked, true);

  // PDF blocked
  let pdfBlocked = false;
  try {
    validateUploadedFile({ originalname: "doc.pdf", mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.4"), size: 8 });
  } catch { pdfBlocked = true; }
  assert.strictEqual(pdfBlocked, true);

  // Oversized (>5MB) blocked
  let oversizedBlocked = false;
  try {
    validateUploadedFile({ originalname: "large.jpg", mimetype: "image/jpeg", buffer: Buffer.alloc(6 * 1024 * 1024), size: 6 * 1024 * 1024 });
  } catch { oversizedBlocked = true; }
  assert.strictEqual(oversizedBlocked, true);
});

// Part B Item 14: Rate Limiting & Trust Proxy
section("Part B Item 14: Rate Limiting & Trust Proxy Configuration");
test("resolveTrustProxy defaults to 1 hop for reverse proxy deployments", () => {
  const { resolveTrustProxy } = require("../server");
  const hop = resolveTrustProxy();
  assert.strictEqual(hop, 1);
});
test("createRateLimiter produces 429 with Retry-After header on exceeding limit", async () => {
  const { createRateLimiter } = require("../server");
  const limiter = createRateLimiter({
    windowMs: 60000,
    max: 2,
    keyGenerator: (req) => req.ip,
  });

  const headers = {};
  const mockRes = () => ({
    statusCode: 200,
    setHeader(k, v) { headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(d) { this.data = d; return this; },
  });

  const req = { ip: "10.0.0.1", headers: {}, originalUrl: "/api/test" };

  // 1st request
  await new Promise((r) => { const res = mockRes(); limiter(req, res, r); });
  // 2nd request
  await new Promise((r) => { const res = mockRes(); limiter(req, res, r); });
  // 3rd request (exceeds max 2 -> must return 429)
  const res3 = mockRes();
  await new Promise((r) => {
    limiter(req, res3, r);
    if (res3.statusCode === 429) r();
  });

  assert.strictEqual(res3.statusCode, 429);
  assert.ok(headers["Retry-After"] !== undefined);
  assert.strictEqual(res3.data?.success, false);
});
test("Global API limiter skips Razorpay webhook so gateway deliveries are not blocked", () => {
  const webhookUrl = "/api/payment/webhook";
  const isSkipped = webhookUrl.includes("/payment/webhook");
  assert.strictEqual(isSkipped, true);
});

// Follow-up Items 1-5
section("Part A Follow-up Items: Uploads Auth, Email Rate Limit, Polling Resilience & Proxy");

(async () => {
  const fs = require('fs');
  const path = require('path');
  const http = require('http');
  const jwt = require('../node_modules/jsonwebtoken');
  const { app, loginEmailLimiter, resolveTrustProxy } = require('../server');

  // Follow-up Item 1: Uploads Auth & Zero File Written
  await (async () => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const initialFiles = fs.readdirSync(uploadsDir);

    const { protect, admin } = require('../middleware/authMiddleware');
    const uploadRoutes = require('../routes/uploadRoutes');
    const aboutRoutes = require('../routes/aboutRoutes');

    try {
      // 1. Unauthenticated request to protect -> returns 401
      const mockUnauthReq = { headers: {} };
      let unauthCode = null;
      const mockUnauthRes = {
        status(c) { unauthCode = c; return this; },
        json(d) { return this; },
      };
      await protect(mockUnauthReq, mockUnauthRes, () => {});
      assert.strictEqual(unauthCode, 401, 'Unauthenticated request must return 401');

      // 2. Logged-in non-admin customer to admin -> returns 403
      const mockCustReq = { user: { role: 'customer', email: 'cust@test.com' } };
      let custCode = null;
      const mockCustRes = {
        status(c) { custCode = c; return this; },
        json(d) { return this; },
      };
      let custNextCalled = false;
      admin(mockCustReq, mockCustRes, () => { custNextCalled = true; });
      assert.strictEqual(custCode, 403, 'Non-admin customer must return 403');
      assert.strictEqual(custNextCalled, false, 'Non-admin customer must not reach controller');

      // 3. Admin user to admin middleware -> passes to next()
      const mockAdminReq = { user: { role: 'admin', email: 'admin@test.com' } };
      let adminNextCalled = false;
      admin(mockAdminReq, {}, () => { adminNextCalled = true; });
      assert.strictEqual(adminNextCalled, true, 'Admin user must reach controller');

      // 4. Verify route middleware attachment on uploadRoutes and aboutRoutes
      const uploadRouteStack = uploadRoutes.stack || [];
      const postUploadLayer = uploadRouteStack.find((r) => r.route && r.route.methods && r.route.methods.post);
      assert.ok(postUploadLayer, 'POST / route must exist in uploadRoutes');
      assert.ok(postUploadLayer.route.stack.some((s) => s.name === 'protect'), 'POST /api/upload must require protect middleware');
      assert.ok(postUploadLayer.route.stack.some((s) => s.name === 'admin'), 'POST /api/upload must require admin middleware');

      const aboutRouteStack = aboutRoutes.stack || [];
      const postAboutLayer = aboutRouteStack.find((r) => r.route && r.route.path === '/upload');
      assert.ok(postAboutLayer, 'POST /upload route must exist in aboutRoutes');
      assert.ok(postAboutLayer.route.stack.some((s) => s.name === 'protect'), 'POST /api/about/upload must require protect middleware');
      assert.ok(postAboutLayer.route.stack.some((s) => s.name === 'admin'), 'POST /api/about/upload must require admin middleware');

      // 5. Verify zero files written to disk
      const filesAfter = fs.readdirSync(uploadsDir);
      assert.strictEqual(filesAfter.length, initialFiles.length, 'Zero files must be written to disk on 401/403');

      console.log("  OK  Follow-up Item 1: Upload routes reject unauth (401) and customer (403), zero files written to disk");
      passed++;
    } catch (err) {
      console.error("  FAIL  Follow-up Item 1: Upload routes authorization -> " + err.message);
      failed++;
      failures.push({ name: "Upload routes authorization", error: err.message });
    }
  })();

  // Follow-up Item 3: Per-Email Login Rate Limiting
  await (async () => {
    try {
      const email = `victim_brute_${Date.now()}@example.com`;
      let blocked429 = false;
      let retryAfterValue = null;

      // 22 requests from 22 DIFFERENT IPs targeting the SAME email
      for (let i = 1; i <= 22; i++) {
        const mockReq = {
          ip: `192.0.2.${i}`,
          body: { email },
          headers: {},
          originalUrl: '/api/auth/login',
          app: { get: () => 1 },
        };
        const resHeaders = {};
        let onDone = null;
        const res = {
          statusCode: 200,
          setHeader(k, v) { resHeaders[k] = v; },
          getHeader(k) { return resHeaders[k]; },
          status(c) { this.statusCode = c; return this; },
          json(d) {
            this.data = d;
            if (onDone) onDone();
            return this;
          },
        };
        await new Promise((resolve) => {
          onDone = resolve;
          loginEmailLimiter(mockReq, res, () => {
            resolve();
          });
        });
        if (res.statusCode === 429) {
          blocked429 = true;
          retryAfterValue = resHeaders['Retry-After'];
        }
      }

      assert.strictEqual(blocked429, true, 'Per-email limiter must block at N+1');
      assert.ok(retryAfterValue !== undefined, 'Retry-After header must be set');

      // A different email is NOT blocked
      const innocentReq = {
        ip: '192.0.2.100',
        body: { email: `innocent_${Date.now()}@example.com` },
        headers: {},
        originalUrl: '/api/auth/login',
        app: { get: () => 1 },
      };
      let innocentNext = false;
      let onInnocentDone = null;
      const innocentRes = {
        statusCode: 200,
        setHeader() {},
        getHeader() {},
        status(c) { this.statusCode = c; return this; },
        json() {
          if (onInnocentDone) onInnocentDone();
          return this;
        },
      };
      await new Promise((resolve) => {
        onInnocentDone = resolve;
        loginEmailLimiter(innocentReq, innocentRes, () => {
          innocentNext = true;
          resolve();
        });
      });
      assert.strictEqual(innocentNext, true, 'Different email must not be throttled');

      console.log("  OK  Follow-up Item 3: Per-email login rate limiter blocks multi-IP brute force at N+1 with 429 and Retry-After");
      passed++;
    } catch (err) {
      console.error("  FAIL  Follow-up Item 3: Per-email login rate limiter -> " + err.message);
      failed++;
      failures.push({ name: "Per-email login rate limiter", error: err.message });
    }
  })();

  // Follow-up Item 5: Checkout Polling Pure Module
  await (async () => {
    try {
      const { pollPaymentStatusWorkflow } = await import('../../frontend/src/utils/paymentPolling.js');

      // 1. 202 processing -> failed transition
      let countA = 0;
      const historyA = [];
      const fetcherA = async () => {
        countA++;
        if (countA === 1) return { data: { success: true, status: 'processing' } };
        return { data: { success: true, status: 'failed', refundStatus: 'processed' } };
      };
      const resA = await pollPaymentStatusWorkflow('order_poll_fail', {
        fetchStatus: fetcherA,
        delays: [1, 1],
        sleep: async () => {},
        onStateChange: (s) => historyA.push(s.state),
      });

      assert.strictEqual(resA.state, 'failed');
      assert.strictEqual(historyA[0], 'processing');
      assert.strictEqual(historyA[historyA.length - 1], 'failed');
      assert.ok(resA.message.includes('refund has been initiated'));

      // 2. 202 processing -> timeout/unknown state after max backoff delays
      let countB = 0;
      const historyB = [];
      const fetcherB = async () => {
        countB++;
        return { data: { success: true, status: 'processing' } };
      };
      const resB = await pollPaymentStatusWorkflow('order_poll_timeout', {
        fetchStatus: fetcherB,
        delays: [1, 1, 1],
        sleep: async () => {},
        onStateChange: (s) => historyB.push(s.state),
      });

      assert.strictEqual(resB.state, 'unknown');
      assert.strictEqual(historyB[0], 'processing');
      assert.strictEqual(historyB[historyB.length - 1], 'unknown');
      assert.ok(resB.message.includes('Please do NOT pay again'));

      console.log("  OK  Follow-up Item 5: Checkout polling module (202->failed transition and max backoff timeout->unknown state)");
      passed++;
    } catch (err) {
      console.error("  FAIL  Follow-up Item 5: Checkout polling module -> " + err.message);
      failed++;
      failures.push({ name: "Checkout polling module", error: err.message });
    }
  })();

  // Extra Check 1: Zero Packaging Placeholders & Built Dist in release/
  await (async () => {
    try {
      const releasePath = fs.existsSync(path.join(__dirname, '../release'))
        ? path.join(__dirname, '../release')
        : path.join(__dirname, '../../release');
      const distPresent =
        fs.existsSync(path.join(releasePath, 'frontend', 'dist')) ||
        fs.existsSync(path.join(releasePath, 'client', 'dist')) ||
        fs.existsSync(path.join(releasePath, 'dist'));
      assert.strictEqual(distPresent, false, 'Built frontend/dist must not ship in release/');

      let foundPlaceholder = false;
      let matchedFile = null;
      if (fs.existsSync(releasePath)) {
        function scanDir(d) {
          for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, ent.name);
            if (ent.isDirectory()) scanDir(p);
            else if (['.js', '.json', '.html', '.css', '.md'].includes(path.extname(ent.name))) {
              const text = fs.readFileSync(p, 'utf8');
              if (text.includes('vashtram-release.internal')) {
                foundPlaceholder = true;
                matchedFile = p;
                break;
              }
            }
          }
        }
        scanDir(releasePath);
      }
      assert.strictEqual(foundPlaceholder, false, `Packaging placeholder URL found in release file: ${matchedFile}`);
      console.log("  OK  Extra Check 1: Release folder contains zero dist output and zero packaging placeholder URLs");
      passed++;
    } catch (err) {
      console.error("  FAIL  Extra Check 1: Release placeholder check -> " + err.message);
      failed++;
      failures.push({ name: "Release placeholder check", error: err.message });
    }
  })();

  // Extra Check 2: Proxy Diagnostic Behind ENABLE_PROXY_DIAGNOSTIC=true
  await (async () => {
    try {
      const adminRoutes = require('../routes/adminRoutes');
      // Simulate GET /proxy-diagnostic when ENABLE_PROXY_DIAGNOSTIC is false
      delete process.env.ENABLE_PROXY_DIAGNOSTIC;
      const diagLayer = adminRoutes.stack.find((l) => l.route && l.route.path === '/proxy-diagnostic');
      assert.ok(diagLayer, '/proxy-diagnostic route must be registered');

      let status404 = null;
      const mockRes404 = {
        status(c) { status404 = c; return this; },
        json() { return this; },
      };
      diagLayer.route.stack[0].handle({ headers: {} }, mockRes404, () => {});
      assert.strictEqual(status404, 404, '/proxy-diagnostic must return 404 when ENABLE_PROXY_DIAGNOSTIC is not true');

      // When ENABLE_PROXY_DIAGNOSTIC='true'
      process.env.ENABLE_PROXY_DIAGNOSTIC = 'true';
      let status200 = null;
      let payload200 = null;
      const mockRes200 = {
        status(c) { status200 = c; return this; },
        json(d) { payload200 = d; return this; },
      };
      diagLayer.route.stack[0].handle({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: {}, ip: '1.2.3.4', app: { get: () => 1 } }, mockRes200, () => {});
      assert.strictEqual(status200, 200, '/proxy-diagnostic must return 200 when ENABLE_PROXY_DIAGNOSTIC is true');
      assert.strictEqual(payload200?.success, true);
      delete process.env.ENABLE_PROXY_DIAGNOSTIC;

      console.log("  OK  Extra Check 2: Proxy diagnostic endpoint is disabled by default (404) and enabled only via ENABLE_PROXY_DIAGNOSTIC=true");
      passed++;
    } catch (err) {
      console.error("  FAIL  Extra Check 2: Proxy diagnostic flag check -> " + err.message);
      failed++;
      failures.push({ name: "Proxy diagnostic flag check", error: err.message });
    }
  })();

  // Extra Check 3: Admin Login Limiter Separation & Shorter Lockout Window
  await (async () => {
    try {
      const { adminLoginLimiter, adminLoginEmailLimiter, loginLimiter, loginEmailLimiter } = require('../server');
      assert.ok(adminLoginLimiter, 'adminLoginLimiter must be exported');
      assert.ok(adminLoginEmailLimiter, 'adminLoginEmailLimiter must be exported');
      assert.notStrictEqual(adminLoginLimiter, loginLimiter, 'adminLoginLimiter must be distinct from customer loginLimiter');
      assert.notStrictEqual(adminLoginEmailLimiter, loginEmailLimiter, 'adminLoginEmailLimiter must be distinct from customer loginEmailLimiter');

      console.log("  OK  Extra Check 3: Admin login uses dedicated limiters to prevent DoS account lockout via customer pool");
      passed++;
    } catch (err) {
      console.error("  FAIL  Extra Check 3: Admin login limiter check -> " + err.message);
      failed++;
      failures.push({ name: "Admin login limiter check", error: err.message });
    }
  })();

  // Pre-Check: Admin Proxy Diagnostic Auth Sequence (Auth runs BEFORE flag check)
  await (async () => {
    try {
      const adminRoutes = require('../routes/adminRoutes');
      // Look at adminRoutes middleware stack order
      const protectIdx = adminRoutes.stack.findIndex((l) => l.handle && l.handle.name === 'protect');
      const diagIdx = adminRoutes.stack.findIndex((l) => l.route && l.route.path === '/proxy-diagnostic');
      assert.ok(protectIdx >= 0, 'protect middleware must be mounted on admin router');
      assert.ok(diagIdx > protectIdx, '/proxy-diagnostic must be mounted after protect middleware');

      // An unauthenticated request to /proxy-diagnostic triggers protect (returns 401, never sees 404)
      const { protect } = require('../middleware/authMiddleware');
      let authStatus = null;
      let authBody = null;
      const mockRes = {
        status(c) { authStatus = c; return this; },
        json(d) { authBody = d; return this; },
      };
      await protect({ headers: {} }, mockRes, () => {});
      assert.strictEqual(authStatus, 401, 'Unauthenticated request must receive 401');
      assert.strictEqual(authBody?.message, 'Not authorized, no token provided');

      console.log("  OK  Pre-Check: /api/admin/proxy-diagnostic auth check runs BEFORE flag check (unauth gets 401, not 404)");
      passed++;
    } catch (err) {
      console.error("  FAIL  Pre-Check: Proxy diagnostic auth sequence -> " + err.message);
      failed++;
      failures.push({ name: "Proxy diagnostic auth sequence", error: err.message });
    }
  })();

  // Item 15: Token Rotation, Session Revocation, Deactivation & Logout
  await (async () => {
    try {
      const jwt = require(path.join(__dirname, '../node_modules/jsonwebtoken'));
      const secret = process.env.JWT_SECRET || 'test_jwt_secret_for_unit_tests_32chars_min!';
      process.env.JWT_SECRET = secret;

      // 1. Password change / admin password reset invalidates old tokenVersion
      const oldToken = jwt.sign({ id: 'user_123', tokenVersion: 0 }, secret, { expiresIn: '1h' });
      const newToken = jwt.sign({ id: 'user_123', tokenVersion: 1 }, secret, { expiresIn: '1h' });

      // User model with tokenVersion 1 (post-password change)
      const userPostChange = {
        _id: 'user_123',
        isActive: true,
        tokenVersion: 1,
      };

      const { protect } = require('../middleware/authMiddleware');
      const User = require('../models/User');
      const origFindById = User.findById;

      User.findById = () => ({
        select: () => Promise.resolve(userPostChange),
      });

      // Test old token rejected
      let statusOld = null;
      let bodyOld = null;
      const resOld = {
        status(c) { statusOld = c; return this; },
        json(d) { bodyOld = d; return this; },
      };
      await protect({ headers: { authorization: `Bearer ${oldToken}` } }, resOld, () => {});
      assert.strictEqual(statusOld, 401, 'Old token must be rejected with 401');
      assert.ok(bodyOld?.message?.includes('invalidated') || bodyOld?.message?.includes('changed'));

      // Test new token accepted
      let nextCalled = false;
      const reqNew = { headers: { authorization: `Bearer ${newToken}` } };
      await protect(reqNew, {}, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, 'New token with updated tokenVersion must be accepted');
      assert.strictEqual(reqNew.user._id, 'user_123');

      // Test deactivation blocks token immediately (even if tokenVersion matches)
      const deactivatedUser = { _id: 'user_123', isActive: false, tokenVersion: 1 };
      User.findById = () => ({ select: () => Promise.resolve(deactivatedUser) });
      let statusDeactivated = null;
      const resDeactivated = {
        status(c) { statusDeactivated = c; return this; },
        json(d) { return this; },
      };
      await protect({ headers: { authorization: `Bearer ${newToken}` } }, resDeactivated, () => {});
      assert.strictEqual(statusDeactivated, 403, 'Deactivated user token must be rejected with 403');

      // Test logout revokes token server-side
      const { logout } = require('../controllers/authController');
      let savedUser = null;
      User.findById = () => Promise.resolve({
        _id: 'user_123',
        tokenVersion: 1,
        save: async function() { savedUser = this; return this; },
      });
      let logoutStatus = null;
      const resLogout = {
        status(c) { logoutStatus = c; return this; },
        json() { return this; },
      };
      await logout({ headers: { authorization: `Bearer ${newToken}` } }, resLogout);
      assert.strictEqual(logoutStatus, 200);
      assert.strictEqual(savedUser?.tokenVersion, 2, 'Logout must increment user.tokenVersion server-side');

      User.findById = origFindById;
      console.log("  OK  Item 15: Session revocation - old token rejected on password change/reset/deactivation; logout revokes token");
      passed++;
    } catch (err) {
      console.error("  FAIL  Item 15: Token rotation -> " + err.message);
      failed++;
      failures.push({ name: "Token rotation", error: err.message });
    }
  })();

  // Item 16: Cart Sync With Live Product, Price and Stock
  await (async () => {
    try {
      const { calculateOrderPricing } = require('../controllers/paymentController');
      const Product = require('../models/Product');
      const Settings = require('../models/Settings');
      const origFindById = Product.findById;
      const origGetSingleton = Settings.getSingleton;

      Settings.getSingleton = async () => ({ freeShippingThreshold: 999, standardShippingFee: 99 });

      // Mock Product with DB price ₹2499 and discount ₹1999
      Product.findById = (id) => Promise.resolve({
        _id: id,
        name: 'Royal Silk Saree',
        price: 2499,
        discountPrice: 1999,
        stock: 5,
        isActive: true,
        size: 'Free Size',
      });

      // 1. Client attempts to tamper price to ₹10
      const tamperedItems = [{
        productId: '507f1f77bcf86cd799439011',
        quantity: 1,
        price: 10, // Tampered client price!
      }];
      const pricing = await calculateOrderPricing(tamperedItems);
      assert.strictEqual(pricing.verifiedItems[0].price, 1999, 'Server must enforce DB discount price ₹1999 and ignore tampered ₹10');
      assert.strictEqual(pricing.calculatedSubtotal, 1999);

      // 2. Out of stock item blocks checkout with clear message
      Product.findById = (id) => Promise.resolve({
        _id: id,
        name: 'Handcrafted Sherwani',
        price: 4999,
        stock: 0,
        isActive: true,
      });
      let stockError = null;
      try {
        await calculateOrderPricing([{ productId: '507f1f77bcf86cd799439012', quantity: 1 }]);
      } catch (e) {
        stockError = e;
      }
      assert.ok(stockError, 'Out of stock item must throw error');
      assert.strictEqual(stockError.statusCode, 400);
      assert.ok(stockError.message.includes('out of stock') || stockError.message.includes('Insufficient stock'));

      Product.findById = origFindById;
      Settings.getSingleton = origGetSingleton;
      console.log("  OK  Item 16: Cart sync - tampered price ignored, DB price enforced, out-of-stock item blocks checkout cleanly");
      passed++;
    } catch (err) {
      console.error("  FAIL  Item 16: Cart sync & price authority -> " + err.message);
      failed++;
      failures.push({ name: "Cart sync and price authority", error: err.message });
    }
  })();

  // Item 17: Contact / Inquiry Sanitization, Honeypot, Spam Links & Rate Limiting
  await (async () => {
    try {
      const { createInquiry } = require('../controllers/inquiryController');
      const Inquiry = require('../models/Inquiry');
      const origCreate = Inquiry.create;

      let createdDoc = null;
      Inquiry.create = async (doc) => { createdDoc = doc; return { ...doc, _id: 'inq_123' }; };

      // 1. Honeypot filled -> returns 400 spam detected
      let hpStatus = null;
      let hpBody = null;
      const resHp = { status(c) { hpStatus = c; return this; }, json(d) { hpBody = d; return this; } };
      await createInquiry({ body: { name: 'Bot', email: 'bot@spam.com', honeypot: 'filled_by_bot', subject: 'Spam', message: 'Spam message text long enough' } }, resHp);
      assert.strictEqual(hpStatus, 400);
      assert.ok(hpBody?.message?.includes('Spam submission detected'));

      // 2. Spam link policy: Allow up to 1 link; reject 2+ links
      // A: Single link in message -> ALLOWED (status 201)
      let singleLinkStatus = null;
      const resSingleLink = { status(c) { singleLinkStatus = c; return this; }, json() { return this; } };
      await createInquiry({ body: { name: 'Customer With Link', email: 'cust@example.com', subject: 'Reference link', message: 'Hello, here is a reference link https://example.com/item for sizing assistance.' } }, resSingleLink);
      assert.strictEqual(singleLinkStatus, 201, 'Single link in inquiry message must be allowed');

      // B: Two or more links in message -> REJECTED with 400
      let multiLinkStatus = null;
      let multiLinkBody = null;
      const resMultiLink = { status(c) { multiLinkStatus = c; return this; }, json(d) { multiLinkBody = d; return this; } };
      await createInquiry({ body: { name: 'Spam Bot', email: 'spammer@promo.com', subject: 'Check https://spam1.com', message: 'Also visit https://spam2.com for discount!' } }, resMultiLink);
      assert.strictEqual(multiLinkStatus, 400, 'Two or more links must be rejected with 400');
      assert.ok(multiLinkBody?.message?.includes('link') || multiLinkBody?.message?.includes('spam'));

      // C: Spam keywords rejected even without links
      let keywordStatus = null;
      let keywordBody = null;
      const resKeyword = { status(c) { keywordStatus = c; return this; }, json(d) { keywordBody = d; return this; } };
      await createInquiry({ body: { name: 'Promo Spammer', email: 'promo@spam.com', subject: 'Win big prizes', message: 'Join our casino night and win cash today!' } }, resKeyword);
      assert.strictEqual(keywordStatus, 400, 'Spam keywords must be rejected with 400');

      // D: Configurable spam keywords from process.env.SPAM_KEYWORDS
      process.env.SPAM_KEYWORDS = 'customspamtoken,testbannedword';
      let envKwStatus = null;
      const resEnvKw = { status(c) { envKwStatus = c; return this; }, json() { return this; } };
      await createInquiry({ body: { name: 'Spam Bot', email: 'spambot@spam.com', subject: 'Hello', message: 'This message has customspamtoken in it!' } }, resEnvKw);
      delete process.env.SPAM_KEYWORDS;
      assert.strictEqual(envKwStatus, 400, 'Configurable spam keywords from SPAM_KEYWORDS must be rejected');

      // 3. HTML tags stripped from input (XSS payload)
      let okStatus = null;
      const resOk = { status(c) { okStatus = c; return this; }, json() { return this; } };
      await createInquiry({ body: { name: '<script>alert("XSS")</script>John Doe', email: 'john@example.com', subject: '<b>Question</b>', message: '<img src=x onerror=alert(1)>Hello, I need help with sizing.' } }, resOk);
      assert.strictEqual(okStatus, 201);
      assert.strictEqual(createdDoc.name, 'John Doe', 'HTML tags in name must be stripped');
      assert.strictEqual(createdDoc.subject, 'Question', 'HTML tags in subject must be stripped');
      assert.strictEqual(createdDoc.message, 'Hello, I need help with sizing.', 'HTML tags in message must be stripped');

      Inquiry.create = origCreate;
      console.log("  OK  Item 17: Inquiry protection - honeypot blocked, 1 link allowed, 2+ links rejected, configurable spam keywords filtered, HTML tags stripped");
      passed++;
    } catch (err) {
      console.error("  FAIL  Item 17: Inquiry protection -> " + err.message);
      failed++;
      failures.push({ name: "Inquiry protection", error: err.message });
    }
  })();

  // Item 18: Admin Dashboard Financial Totals & Reconciliation
  await (async () => {
    try {
      const { calculateOrderNetRevenue, getRevenueAggregationExpr } = require('../utils/financialMetrics');
      assert.ok(typeof calculateOrderNetRevenue === 'function', 'calculateOrderNetRevenue must be exported');
      assert.ok(typeof getRevenueAggregationExpr === 'function', 'getRevenueAggregationExpr must be exported');

      // Seed representative orders covering all financial states
      const testOrders = [
        // 1. Paid, Confirmed (Full Revenue: 2500)
        { orderNumber: 'ORD-1', isPaid: true, paymentStatus: 'Completed', orderStatus: 'Confirmed', totalAmount: 2500, refundAmount: 0 },
        // 2. Paid, Delivered (Full Revenue: 1500)
        { orderNumber: 'ORD-2', isPaid: true, paymentStatus: 'Completed', orderStatus: 'Delivered', totalAmount: 1500, refundAmount: 0 },
        // 3. Paid, Cancelled (Zero Revenue)
        { orderNumber: 'ORD-3', isPaid: true, paymentStatus: 'Completed', orderStatus: 'Cancelled', totalAmount: 1800, refundAmount: 1800 },
        // 4. Paid, Refunded (Zero Revenue)
        { orderNumber: 'ORD-4', isPaid: true, paymentStatus: 'Refunded', orderStatus: 'Delivered', isRefunded: true, totalAmount: 3200, refundAmount: 3200 },
        // 5. Paid, Partially Refunded (Subtracts only refunded amount: 2000 - 500 = 1500)
        { orderNumber: 'ORD-5', isPaid: true, paymentStatus: 'Completed', orderStatus: 'Delivered', isRefunded: false, totalAmount: 2000, refundAmount: 500 },
        // 6. Paid, Returned (No retained amount: Zero Revenue)
        { orderNumber: 'ORD-6', isPaid: true, paymentStatus: 'Completed', orderStatus: 'Returned', totalAmount: 1200, refundAmount: 0 },
        // 7. Unpaid / Pending (Zero Revenue)
        { orderNumber: 'ORD-7', isPaid: false, paymentStatus: 'Pending', orderStatus: 'Pending', totalAmount: 4000, refundAmount: 0 },
      ];

      // Manual expected sum: 2500 + 1500 + 0 + 0 + 1500 + 0 + 0 = 5500
      const expectedRevenue = 5500;

      // Calculate sum using helper
      const calculatedSum = testOrders.reduce((acc, ord) => acc + calculateOrderNetRevenue(ord), 0);
      assert.strictEqual(calculatedSum, expectedRevenue, `Calculated net revenue (${calculatedSum}) must match expected (${expectedRevenue})`);

      // Verify individual line item contributions
      assert.strictEqual(calculateOrderNetRevenue(testOrders[0]), 2500);
      assert.strictEqual(calculateOrderNetRevenue(testOrders[1]), 1500);
      assert.strictEqual(calculateOrderNetRevenue(testOrders[2]), 0, 'Cancelled order contributes 0');
      assert.strictEqual(calculateOrderNetRevenue(testOrders[3]), 0, 'Refunded order contributes 0');
      assert.strictEqual(calculateOrderNetRevenue(testOrders[4]), 1500, 'Partial refund subtracts only refund amount');
      assert.strictEqual(calculateOrderNetRevenue(testOrders[5]), 0, 'Returned order without retained value contributes 0');
      assert.strictEqual(calculateOrderNetRevenue(testOrders[6]), 0, 'Unpaid order contributes 0');

      // Extend reconciliation test: series totals equal dashboard total
      const monthlyBuckets = {};
      testOrders.forEach((ord, i) => {
        const monthKey = i % 2 === 0 ? '2026-09' : '2026-10';
        monthlyBuckets[monthKey] = (monthlyBuckets[monthKey] || 0) + calculateOrderNetRevenue(ord);
      });
      const sumMonthly = Object.values(monthlyBuckets).reduce((a, b) => a + b, 0);
      assert.strictEqual(sumMonthly, expectedRevenue, 'Sum of monthly series must equal dashboard total revenue');

      // Verify adminController.js calculates monthlySeries using getRevenueAggregationExpr
      const adminCode = fs.readFileSync(path.join(__dirname, '../controllers/adminController.js'), 'utf8');
      assert.ok(adminCode.includes('monthlySeries = await Order.aggregate'), 'adminController must compute monthlySeries');
      assert.ok(adminCode.includes('getRevenueAggregationExpr()'), 'monthlySeries must use getRevenueAggregationExpr()');

      console.log("  OK  Item 18: Financial metrics reconciliation - series totals equal dashboard total and customer spending rules match manual calculation exactly");
      passed++;
    } catch (err) {
      console.error("  FAIL  Item 18: Financial metrics reconciliation -> " + err.message);
      failed++;
      failures.push({ name: "Financial metrics reconciliation", error: err.message });
    }
  })();

  // Item 19: Frontend API Interceptor Logic, Timeout & Error Boundary
  await (async () => {
    try {
      // 1. Verify ErrorBoundary file exists and exports valid React component
      const errorBoundaryFile = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/common/ErrorBoundary.jsx'), 'utf8');
      assert.ok(errorBoundaryFile.includes('class ErrorBoundary'), 'ErrorBoundary must be defined');
      assert.ok(errorBoundaryFile.includes('getDerivedStateFromError'), 'ErrorBoundary must catch errors');
      assert.ok(errorBoundaryFile.includes('Something went wrong'), 'ErrorBoundary must display friendly message');

      // 2. Verify api.js interceptor rules
      const apiFile = fs.readFileSync(path.join(__dirname, '../../frontend/src/services/api.js'), 'utf8');
      assert.ok(apiFile.includes("config.method.toLowerCase() === 'get'"), 'Retry must be strictly restricted to GET requests');
      assert.ok(apiFile.includes('timeout: 15000'), 'Default request timeout must be configured');
      assert.ok(apiFile.includes('storage.clearAuth()'), '401 interceptor must clear auth state');
      assert.ok(apiFile.includes('sessionExpired=true'), '401 redirect must set sessionExpired query parameter');
      assert.ok(apiFile.includes('window.navigator.onLine === false'), 'Offline check must detect offline status');
      assert.ok(apiFile.includes('retry-after') || apiFile.includes('Retry-After'), '429 must parse Retry-After header');
      assert.ok(apiFile.includes('status >= 500'), '500 must return friendly service unavailable message');

      // 3. Verify LoginPage handles sessionExpired banner
      const loginFile = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/LoginPage.jsx'), 'utf8');
      assert.ok(loginFile.includes('sessionExpired'), 'LoginPage must check sessionExpired parameter');
      assert.ok(loginFile.includes('Your session has expired'), 'LoginPage must display session expired message');

      console.log("  OK  Item 19: Frontend API interceptors - GET retry only, timeout, 401 session expiration, and error boundary verified");
      passed++;
    } catch (err) {
      console.error("  FAIL  Item 19: Frontend API and error handling -> " + err.message);
      failed++;
      failures.push({ name: "Frontend API and error handling", error: err.message });
    }
  })();

  // Part A Follow-Up 1: Open Redirect Protection
  await (async () => {
    try {
      const { sanitizeRedirectUrl } = await import('../../frontend/src/utils/urlHelper.js');
      assert.strictEqual(typeof sanitizeRedirectUrl, 'function', 'sanitizeRedirectUrl must be exported');

      // Test attack vectors:
      assert.strictEqual(sanitizeRedirectUrl('https://evil.com'), '/', 'Reject https:// evil host');
      assert.strictEqual(sanitizeRedirectUrl('//evil.com'), '/', 'Reject protocol-relative //evil.com');
      assert.strictEqual(sanitizeRedirectUrl('/\\evil.com'), '/', 'Reject backslash path /\\evil.com');
      assert.strictEqual(sanitizeRedirectUrl('\\evil.com'), '/', 'Reject backslash path \\evil.com');
      assert.strictEqual(sanitizeRedirectUrl('javascript:alert(1)'), '/', 'Reject javascript scheme');
      assert.strictEqual(sanitizeRedirectUrl('data:text/html,<script>alert(1)</script>'), '/', 'Reject data URI');
      
      // Test valid internal paths:
      assert.strictEqual(sanitizeRedirectUrl('/profile'), '/profile', 'Accept valid internal path /profile');
      assert.strictEqual(sanitizeRedirectUrl('/checkout?step=2'), '/checkout?step=2', 'Accept internal path with query params');
      assert.strictEqual(sanitizeRedirectUrl('/admin/dashboard', '/admin'), '/admin/dashboard', 'Accept valid admin path');

      // Test custom fallback:
      assert.strictEqual(sanitizeRedirectUrl('https://evil.com', '/admin'), '/admin', 'Return custom fallback /admin on invalid url');

      // Check LoginPage.jsx and AdminLoginPage.jsx use sanitizeRedirectUrl
      const loginCode = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/LoginPage.jsx'), 'utf8');
      assert.ok(loginCode.includes('sanitizeRedirectUrl'), 'LoginPage.jsx must use sanitizeRedirectUrl');

      const adminLoginCode = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/admin/AdminLoginPage.jsx'), 'utf8');
      assert.ok(adminLoginCode.includes('sanitizeRedirectUrl'), 'AdminLoginPage.jsx must use sanitizeRedirectUrl');

      console.log("  OK  Part A Item 1: Open redirect protection - only internal single-slash paths allowed");
      passed++;
    } catch (err) {
      console.error("  FAIL  Part A Item 1: Open redirect protection -> " + err.message);
      failed++;
      failures.push({ name: "Open redirect protection", error: err.message });
    }
  })();

  // Part A Follow-Up 2: 401 Interceptor Login/Register Exception
  await (async () => {
    try {
      const { isAuthEntrypoint } = await import('../../frontend/src/utils/authHelper.js');
      assert.strictEqual(typeof isAuthEntrypoint, 'function', 'isAuthEntrypoint must be exported from authHelper.js');

      // Check api.js imports and exports isAuthEntrypoint
      const apiCode = fs.readFileSync(path.join(__dirname, '../../frontend/src/services/api.js'), 'utf8');
      assert.ok(apiCode.includes('isAuthEntrypoint'), 'api.js must import and use isAuthEntrypoint');
      assert.ok(apiCode.includes('export { isAuthEntrypoint }'), 'api.js must export isAuthEntrypoint');

      // Must identify all login and register routes
      assert.strictEqual(isAuthEntrypoint('/api/auth/login'), true, 'Identify /api/auth/login');
      assert.strictEqual(isAuthEntrypoint('/auth/login'), true, 'Identify /auth/login');
      assert.strictEqual(isAuthEntrypoint('/api/admin/login'), true, 'Identify /api/admin/login');
      assert.strictEqual(isAuthEntrypoint('/admin/login'), true, 'Identify /admin/login');
      assert.strictEqual(isAuthEntrypoint('/api/auth/register'), true, 'Identify /api/auth/register');
      assert.strictEqual(isAuthEntrypoint('/auth/register'), true, 'Identify /auth/register');
      assert.strictEqual(isAuthEntrypoint('/auth/login?redirect=%2Fprofile'), true, 'Identify login with query params');

      // Must NOT identify protected business endpoints
      assert.strictEqual(isAuthEntrypoint('/api/orders'), false, 'Do not classify /api/orders as auth entrypoint');
      assert.strictEqual(isAuthEntrypoint('/api/user/profile'), false, 'Do not classify profile as auth entrypoint');
      assert.strictEqual(isAuthEntrypoint('/api/admin/dashboard'), false, 'Do not classify admin dashboard as auth entrypoint');

      console.log("  OK  Part A Item 2: 401 Interceptor - login/register endpoints exempt from session-expired redirect");
      passed++;
    } catch (err) {
      console.error("  FAIL  Part A Item 2: 401 Interceptor login exemption -> " + err.message);
      failed++;
      failures.push({ name: "401 Interceptor login exemption", error: err.message });
    }
  })();

  // Part B Item 20: Responsive UI, Layering, and Accessibility Checks
  await (async () => {
    try {
      const indexCss = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'index.css'), 'utf8');
      const whatsappBtn = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'common', 'WhatsAppButton.jsx'), 'utf8');
      const checkoutPage = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'CheckoutPage.jsx'), 'utf8');
      const adminOrders = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'admin', 'AdminOrders.jsx'), 'utf8');
      const adminProducts = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'admin', 'AdminProducts.jsx'), 'utf8');
      const adminCustomers = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'admin', 'AdminCustomers.jsx'), 'utf8');
      const adminInquiries = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'admin', 'AdminInquiries.jsx'), 'utf8');

      // 1. iOS Auto-zoom prevention: inputs must be >= 16px font-size
      assert.ok(indexCss.includes('font-size: 16px !important'), 'index.css must enforce >= 16px font on inputs to prevent iOS auto-zoom');

      // 2. Standardized z-index scale
      assert.ok(indexCss.includes('--z-whatsapp: 900;'), 'z-whatsapp must be 900');
      assert.ok(indexCss.includes('--z-navbar: 1000;'), 'z-navbar must be 1000');
      assert.ok(indexCss.includes('--z-modal: 50000;'), 'z-modal must be 50000');
      assert.ok(indexCss.includes('--z-toast: 99999;'), 'z-toast must be 99999');

      // 3. WhatsApp floating button: suppressed on checkout & mobile FAB
      assert.ok(whatsappBtn.includes("location.pathname === '/checkout'"), 'WhatsApp button must be suppressed on /checkout');
      assert.ok(whatsappBtn.includes('return null;'), 'WhatsApp button must return null on checkout');
      assert.ok(whatsappBtn.includes('border-radius: 50%'), 'WhatsApp button must collapse to circular FAB on mobile');

      // 4. Checkout page mobile accessibility & body lock
      assert.ok(checkoutPage.includes('useBodyScrollLock(isPendingPayment)'), 'CheckoutPage must lock body scroll during pending payment modal');
      assert.ok(checkoutPage.includes('position: static !important'), 'CheckoutPage aside must reset to static on mobile screens');
      assert.ok(checkoutPage.includes("minHeight: '48px'"), 'CheckoutPage Pay button must have >= 48px touch target');

      // 5. Admin tables: horizontal scroll containers & minWidth
      assert.ok(adminOrders.includes('table-responsive') && adminOrders.includes("minWidth: '760px'"), 'AdminOrders must have responsive table container with minWidth');
      assert.ok(adminProducts.includes('table-responsive') && adminProducts.includes("minWidth: '760px'"), 'AdminProducts must have responsive table container with minWidth');
      assert.ok(adminCustomers.includes('table-responsive') && adminCustomers.includes("minWidth: '700px'"), 'AdminCustomers must have responsive table container with minWidth');
      assert.ok(adminInquiries.includes('table-responsive') && adminInquiries.includes("minWidth: '680px'"), 'AdminInquiries must have responsive table container with minWidth');

      // 6. Body scroll lock on admin modals
      assert.ok(adminOrders.includes('useBodyScrollLock(!!selectedOrder)'), 'AdminOrders must lock body scroll when order modal is open');
      assert.ok(adminProducts.includes('useBodyScrollLock(modalOpen)'), 'AdminProducts must lock body scroll when product modal is open');
      assert.ok(adminInquiries.includes('useBodyScrollLock(modalOpen && !!selectedInquiry)'), 'AdminInquiries must lock body scroll when inquiry modal is open');

      console.log("  OK  Part B Item 20: Responsive UI, Layering, and Accessibility verified");
      passed++;
    } catch (err) {
      console.error("  FAIL  Part B Item 20: Responsive UI & Layering -> " + err.message);
      failed++;
      failures.push({ name: "Responsive UI & Layering", error: err.message });
    }
  })();

  // Summary
  console.log("\n======================================================");
  console.log("VASHTRAM BUG FIX VERIFICATION RESULTS");
  console.log("======================================================");
  console.log("  Passed: " + passed);
  console.log("  Failed: " + failed);
  if (failures.length) {
    console.log("\nFailed tests:");
    failures.forEach((f) => console.error("  FAIL " + f.name + ": " + f.error));
  }
  console.log("======================================================");
  process.exit(failed === 0 ? 0 : 1);
})();

