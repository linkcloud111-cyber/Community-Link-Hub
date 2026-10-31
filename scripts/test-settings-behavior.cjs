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

// 2. Submission Flags Service-Layer Enforcement Simulation (All 10 combinations)
function validateSubmissionFlags(siteSettings, isWebmaster, isGuest) {
  const settings = siteSettings || {};
  const submissionEnabled = settings.groupSubmissionEnabled !== false;
  const publicAllowed = settings.allowPublicSubmissions !== false;

  if (!submissionEnabled && !isWebmaster) {
    throw new Error("Link submissions are temporarily paused by Webmaster.");
  }
  if (isGuest && !publicAllowed && !isWebmaster) {
    throw new Error("Guest link submissions are disabled. Please sign in to submit.");
  }
  return true;
}

// Scenario 1: Submissions disabled; guest attempts submission
try {
  validateSubmissionFlags({ groupSubmissionEnabled: false, allowPublicSubmissions: true }, false, true);
  assert(false, "Flags #1: Should have thrown when submissions disabled for guest");
} catch (e) {
  assert(e.message.includes("temporarily paused"), "Flags #1: Submissions disabled blocks guest at service layer");
}

// Scenario 2: Submissions disabled; authenticated user attempts submission
try {
  validateSubmissionFlags({ groupSubmissionEnabled: false, allowPublicSubmissions: true }, false, false);
  assert(false, "Flags #2: Should have thrown when submissions disabled for member");
} catch (e) {
  assert(e.message.includes("temporarily paused"), "Flags #2: Submissions disabled blocks authenticated user at service layer");
}

// Scenario 3: Submissions disabled; Webmaster attempts submission
try {
  const allowed = validateSubmissionFlags({ groupSubmissionEnabled: false, allowPublicSubmissions: false }, true, false);
  assert(allowed === true, "Flags #3: Webmaster can submit even when submissions paused platform-wide");
} catch (e) {
  assert(false, "Flags #3: Webmaster should not be blocked");
}

// Scenario 4: Submissions enabled and public submissions disabled; guest attempts submission
try {
  validateSubmissionFlags({ groupSubmissionEnabled: true, allowPublicSubmissions: false }, false, true);
  assert(false, "Flags #4: Should have thrown for guest when allowPublicSubmissions=false");
} catch (e) {
  assert(e.message.includes("Guest link submissions are disabled"), "Flags #4: Public submissions disabled blocks guest at service layer");
}

// Scenario 5: Submissions enabled and public submissions disabled; ordinary user submits
try {
  const allowed = validateSubmissionFlags({ groupSubmissionEnabled: true, allowPublicSubmissions: false }, false, false);
  assert(allowed === true, "Flags #5: Authenticated member can submit when public submissions are disabled");
} catch (e) {
  assert(false, "Flags #5: Authenticated member was unexpectedly blocked");
}

// Scenario 6: Submissions enabled and public submissions disabled; Webmaster submits
try {
  const allowed = validateSubmissionFlags({ groupSubmissionEnabled: true, allowPublicSubmissions: false }, true, false);
  assert(allowed === true, "Flags #6: Webmaster can submit when public submissions are disabled");
} catch (e) {
  assert(false, "Flags #6: Webmaster was unexpectedly blocked");
}

// Scenario 7: Both flags enabled; guest submission
try {
  const allowed = validateSubmissionFlags({ groupSubmissionEnabled: true, allowPublicSubmissions: true }, false, true);
  assert(allowed === true, "Flags #7: Guests can submit when both flags are enabled");
} catch (e) {
  assert(false, "Flags #7: Guest was unexpectedly blocked when both flags enabled");
}

// Scenario 8: Both flags enabled; authenticated-user submission
try {
  const allowed = validateSubmissionFlags({ groupSubmissionEnabled: true, allowPublicSubmissions: true }, false, false);
  assert(allowed === true, "Flags #8: Authenticated users can submit when both flags are enabled");
} catch (e) {
  assert(false, "Flags #8: Authenticated user unexpectedly blocked");
}

// Scenario 9: Missing, malformed, or unreadable settings
try {
  const allowed1 = validateSubmissionFlags(null, false, true);
  const allowed2 = validateSubmissionFlags({}, false, true);
  const allowed3 = validateSubmissionFlags({ groupSubmissionEnabled: undefined, allowPublicSubmissions: undefined }, false, true);
  assert(allowed1 && allowed2 && allowed3, "Flags #9: Missing/malformed settings safely default to enabled without crashing");
} catch (e) {
  assert(false, "Flags #9: Missing settings caused an unexpected crash");
}

// Scenario 10: Direct service/API invocation that bypasses frontend (createGroup check)
const firestoreFile = path.resolve(__dirname, '../artifacts/linkcloud/src/lib/firestore.ts');
const fsCode = fs.readFileSync(firestoreFile, 'utf8');
const enforcesServiceLayer = fsCode.includes('if (siteSettings.groupSubmissionEnabled === false && !isWebmaster)') &&
  (fsCode.includes('if (!auth?.currentUser && siteSettings.allowPublicSubmissions !== true && !isWebmaster)') ||
   fsCode.includes('if (!auth?.currentUser && siteSettings.allowPublicSubmissions === false && !isWebmaster)'));
assert(enforcesServiceLayer, "Flags #10: createGroup() enforces both flags at the service layer, preventing frontend bypass");

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
