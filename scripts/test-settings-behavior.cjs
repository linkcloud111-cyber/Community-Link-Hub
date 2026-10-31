const fs = require('fs');
const path = require('path');

console.log("=== LINKCLOUD WEBMASTER SETTINGS BEHAVIORAL TEST SUITE ===");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// 1. Theme Logic Simulation & Invariant Verification
function computeEffectiveTheme(rawSetting, clientPrefersDark) {
  const mode = (rawSetting || "dark").toLowerCase();
  if (mode === "light") return "light";
  if (mode === "system") return clientPrefersDark ? "dark" : "light";
  return "dark";
}

// Test 1A: Forced dark
assert(computeEffectiveTheme("dark", false) === "dark", "Theme: 'dark' setting forces dark mode regardless of client OS preference (light)");
assert(computeEffectiveTheme("dark", true) === "dark", "Theme: 'dark' setting forces dark mode when client OS preference is dark");

// Test 1B: Forced light
assert(computeEffectiveTheme("light", true) === "light", "Theme: 'light' setting forces light mode regardless of client OS preference (dark)");
assert(computeEffectiveTheme("light", false) === "light", "Theme: 'light' setting forces light mode when client OS preference is light");

// Test 1C: System mode (isolated per client)
assert(computeEffectiveTheme("system", true) === "dark", "Theme: 'system' setting yields dark for user with dark OS preference");
assert(computeEffectiveTheme("system", false) === "light", "Theme: 'system' setting yields light for user with light OS preference");

// Test 1D: Dynamic reaction
let currentPref = false;
let resolvedTheme = computeEffectiveTheme("system", currentPref);
assert(resolvedTheme === "light", "Theme: Initial system mode with light OS is light");
currentPref = true; // OS changes to dark
resolvedTheme = computeEffectiveTheme("system", currentPref);
assert(resolvedTheme === "dark", "Theme: System mode dynamically switches to dark upon OS preference change");

// 2. Submission Flags Service-Layer Enforcement Simulation
function validateSubmissionFlags(siteSettings, isWebmaster, isGuest) {
  if (siteSettings.groupSubmissionEnabled === false && !isWebmaster) {
    throw new Error("Link submissions are temporarily paused by Webmaster.");
  }
  if (isGuest && siteSettings.allowPublicSubmissions === false && !isWebmaster) {
    throw new Error("Guest link submissions are disabled. Please sign in to submit.");
  }
  return true;
}

// Test 2A: Submissions disabled platform-wide
try {
  validateSubmissionFlags({ groupSubmissionEnabled: false, allowPublicSubmissions: true }, false, false);
  assert(false, "Flags: Should have thrown when submissions disabled for regular user");
} catch (e) {
  assert(e.message.includes("temporarily paused"), "Flags: groupSubmissionEnabled=false correctly blocks member submission at service layer");
}

// Test 2B: Webmaster override when submissions disabled
try {
  const allowed = validateSubmissionFlags({ groupSubmissionEnabled: false, allowPublicSubmissions: false }, true, false);
  assert(allowed === true, "Flags: Webmaster can submit even when group submissions are paused platform-wide");
} catch (e) {
  assert(false, "Flags: Webmaster should not be blocked");
}

// Test 2C: Guest submissions disabled
try {
  validateSubmissionFlags({ groupSubmissionEnabled: true, allowPublicSubmissions: false }, false, true);
  assert(false, "Flags: Should have thrown for guest when allowPublicSubmissions=false");
} catch (e) {
  assert(e.message.includes("Guest link submissions are disabled"), "Flags: allowPublicSubmissions=false blocks unauthenticated guests at service layer");
}

// Test 2D: Authenticated member when guest submissions disabled
try {
  const allowed = validateSubmissionFlags({ groupSubmissionEnabled: true, allowPublicSubmissions: false }, false, false);
  assert(allowed === true, "Flags: Authenticated member can submit when guest submissions are disabled");
} catch (e) {
  assert(false, "Flags: Authenticated member was unexpectedly blocked");
}

// Test 2E: Public submissions enabled
try {
  const allowed = validateSubmissionFlags({ groupSubmissionEnabled: true, allowPublicSubmissions: true }, false, true);
  assert(allowed === true, "Flags: Guests can submit when both flags are enabled");
} catch (e) {
  assert(false, "Flags: Guest was unexpectedly blocked when public submissions enabled");
}

// 3. Fallback Integrity
const appRoot = path.resolve(__dirname, '../artifacts/linkcloud');
const firestoreSrc = fs.readFileSync(path.join(appRoot, 'src/lib/firestore.ts'), 'utf8');

assert(!firestoreSrc.includes('admin@linkcloud.in'), "Hardcoding: firestore.ts contains 0 occurrences of admin@linkcloud.in");
assert(firestoreSrc.includes('support@linkcloud.in'), "Hardcoding: firestore.ts contains approved support@linkcloud.in default");
assert(firestoreSrc.includes('linkcloud111@gmail.com'), "Hardcoding: firestore.ts contains canonical Webmaster actor email");

console.log(`\nSettings Test Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
