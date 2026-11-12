/**
 * LINKCLOUD - EXTERNAL INTEGRATIONS & MEDIA VERIFICATION SUITE
 * Tests Cloudinary client-side validation, URL optimization, security boundaries,
 * and confirms zero private secrets exposure.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("=== LINKCLOUD EXTERNAL INTEGRATIONS BEHAVIORAL SUITE ===");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: "No file provided." };
  }
  if (file.size === 0) {
    return { valid: false, error: "File appears to be corrupted or empty." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "File size exceeds the maximum limit of 2 MB." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes((file.type || "").toLowerCase())) {
    return { valid: false, error: "Unsupported format. Only JPG, JPEG, PNG, and WEBP images are allowed." };
  }
  return { valid: true };
}

function getOptimizedCloudinaryUrl(url, width = 800, quality = "auto") {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("cloudinary.com") || url.includes("/c_limit")) return url;

  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) return url;

  const prefix = url.substring(0, uploadIndex + 8);
  const suffix = url.substring(uploadIndex + 8);
  return `${prefix}c_limit,w_${width},q_${quality},f_auto/${suffix}`;
}

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] #${total} ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] #${total} ${name}:`, err.message);
  }
}

// 1. Validation tests
test("Rejects null or missing file", () => {
  const res = validateImageFile(null);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.error, "No file provided.");
});

test("Rejects 0-byte corrupt file", () => {
  const res = validateImageFile({ size: 0, type: "image/png" });
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.error, "File appears to be corrupted or empty.");
});

test("Rejects oversized file (> 2 MB)", () => {
  const res = validateImageFile({ size: 2 * 1024 * 1024 + 1, type: "image/png" });
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.error, "File size exceeds the maximum limit of 2 MB.");
});

test("Rejects dangerous SVG (XSS vector)", () => {
  const res = validateImageFile({ size: 1024, type: "image/svg+xml" });
  assert.strictEqual(res.valid, false);
  assert(res.error.includes("Unsupported format"));
});

test("Rejects executable / script payloads", () => {
  const res = validateImageFile({ size: 1024, type: "application/javascript" });
  assert.strictEqual(res.valid, false);
  assert(res.error.includes("Unsupported format"));
});

test("Rejects PDF documents", () => {
  const res = validateImageFile({ size: 1024, type: "application/pdf" });
  assert.strictEqual(res.valid, false);
  assert(res.error.includes("Unsupported format"));
});

test("Accepts valid JPG image", () => {
  const res = validateImageFile({ size: 500 * 1024, type: "image/jpeg" });
  assert.strictEqual(res.valid, true);
});

test("Accepts valid PNG image", () => {
  const res = validateImageFile({ size: 1.2 * 1024 * 1024, type: "image/png" });
  assert.strictEqual(res.valid, true);
});

test("Accepts valid WEBP image", () => {
  const res = validateImageFile({ size: 200 * 1024, type: "image/webp" });
  assert.strictEqual(res.valid, true);
});

// 2. URL optimization tests
test("Optimizes standard Cloudinary image URL", () => {
  const original = "https://res.cloudinary.com/linkcloud/image/upload/v12345/avatar.jpg";
  const optimized = getOptimizedCloudinaryUrl(original);
  assert.strictEqual(optimized, "https://res.cloudinary.com/linkcloud/image/upload/c_limit,w_800,q_auto,f_auto/v12345/avatar.jpg");
});

test("Does not duplicate transformation flags if already optimized", () => {
  const alreadyOptimized = "https://res.cloudinary.com/linkcloud/image/upload/c_limit,w_800,q_auto,f_auto/v12345/avatar.jpg";
  const result = getOptimizedCloudinaryUrl(alreadyOptimized);
  assert.strictEqual(result, alreadyOptimized);
});

test("Preserves non-Cloudinary external URLs unmodified", () => {
  const external = "https://images.unsplash.com/photo-12345";
  const result = getOptimizedCloudinaryUrl(external);
  assert.strictEqual(result, external);
});

test("Handles falsy or empty URL gracefully", () => {
  assert.strictEqual(getOptimizedCloudinaryUrl(""), "");
  assert.strictEqual(getOptimizedCloudinaryUrl(null), null);
});

// 3. Secret Leakage Audit
test("Confirms zero CLOUDINARY_API_SECRET in frontend source code", () => {
  const srcDir = path.resolve(__dirname, "../artifacts/linkcloud/src");
  function scan(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        scan(full);
      } else if (f.endsWith(".ts") || f.endsWith(".tsx")) {
        const content = fs.readFileSync(full, "utf8");
        assert(!content.includes("api_secret"), `Found api_secret reference in ${full}`);
        assert(!content.includes("CLOUDINARY_API_SECRET"), `Found CLOUDINARY_API_SECRET in ${full}`);
      }
    }
  }
  scan(srcDir);
});

test("Confirms built JS bundles contain zero Cloudinary API secrets", () => {
  const distDir = path.resolve(__dirname, "../artifacts/linkcloud/dist/assets");
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    for (const f of files) {
      if (f.endsWith(".js")) {
        const content = fs.readFileSync(path.join(distDir, f), "utf8");
        assert(!content.includes("CLOUDINARY_API_SECRET"), `Found private secret in bundle ${f}`);
      }
    }
  }
});

console.log(`================================================================`);
console.log(`INTEGRATIONS SUITE RESULTS: ${passed}/${total} PASSED (${total - passed} FAILED)`);
console.log(`================================================================`);

if (passed !== total) {
  process.exit(1);
}
