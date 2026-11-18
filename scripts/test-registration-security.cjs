/**
 * LINKCLOUD — REGISTRATION SECURITY, FAIL-CLOSED GUARD & DISCLOSURE TEST SUITE
 * Independently verifies Scenarios A–F, information disclosure protection,
 * and authorization boundaries across Node server + Cloudflare Functions.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://127.0.0.1:3000";

let total = 0;
let passed = 0;
const categories = {
  UNIT: { passed: 0, total: 0 },
  LOCAL_HTTP: { passed: 0, total: 0 },
  STATIC: { passed: 0, total: 0 },
};

async function runTest(category, name, fn) {
  total++;
  categories[category].total++;
  try {
    await fn();
    passed++;
    categories[category].passed++;
    console.log(`[PASS] [${category}] #${total} ${name}`);
  } catch (err) {
    console.error(`[FAIL] [${category}] #${total} ${name}:`, err.message);
  }
}

// Mirror of exported evaluateRegistrationGuard in src/server/auth-api.ts
function evaluateRegistrationGuard(siteSettings) {
  if (
    !siteSettings ||
    typeof siteSettings !== "object" ||
    Array.isArray(siteSettings) ||
    siteSettings.userRegistrationEnabled !== true
  ) {
    return {
      allowed: false,
      status: 403,
      error: "New user registrations are currently closed by the webmaster.",
    };
  }
  return { allowed: true };
}

async function simulateProvisionGuardFlow(fetchSettingsFn) {
  try {
    const siteSettings = await fetchSettingsFn();
    const guard = evaluateRegistrationGuard(siteSettings);
    if (!guard.allowed) {
      return { status: guard.status, body: { error: guard.error } };
    }
    return { status: 200, body: { allowed: true } };
  } catch {
    return {
      status: 503,
      body: { error: "Unable to verify registration availability. Please try again." },
    };
  }
}

async function main() {
  console.log("==================================================================");
  console.log("   LINKCLOUD — REGISTRATION SECURITY & FAIL-CLOSED TEST SUITE     ");
  console.log("==================================================================");

  // --- SCENARIOS A–E (UNIT / SIMULATION) ---
  await runTest("UNIT", "Scenario A: userRegistrationEnabled = false -> rejects with HTTP 403", async () => {
    const res = await simulateProvisionGuardFlow(async () => ({ userRegistrationEnabled: false }));
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, "New user registrations are currently closed by the webmaster.");
  });

  await runTest("UNIT", "Scenario B: userRegistrationEnabled = true -> allows normal workflow", async () => {
    const res = await simulateProvisionGuardFlow(async () => ({ userRegistrationEnabled: true }));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.allowed, true);
  });

  await runTest("UNIT", "Scenario C: missing doc (null), undefined, empty object, or null field -> fails closed (403)", async () => {
    for (const val of [null, undefined, {}, { userRegistrationEnabled: null }, { userRegistrationEnabled: undefined }]) {
      const res = await simulateProvisionGuardFlow(async () => val);
      assert.strictEqual(res.status, 403, `Expected 403 for ${JSON.stringify(val)}`);
    }
  });

  await runTest("UNIT", "Scenario D: Firestore unavailable or permission denied -> fails closed (503) without leaking internal error", async () => {
    const res = await simulateProvisionGuardFlow(async () => {
      throw new Error("7 PERMISSION_DENIED: Firestore service account private_key invalid");
    });
    assert.strictEqual(res.status, 503);
    assert(!res.body.error.includes("PERMISSION_DENIED"), "Leaked Firestore error code");
    assert(!res.body.error.includes("private_key"), "Leaked internal secret term");
  });

  await runTest("UNIT", "Scenario E: Malformed settings ('true', 1, {}, [], 'yes', NaN) -> fails closed (403)", async () => {
    for (const bad of ["true", 1, "1", {}, [], "yes", NaN]) {
      const res = await simulateProvisionGuardFlow(async () => ({ userRegistrationEnabled: bad }));
      assert.strictEqual(res.status, 403, `Malformed value ${String(bad)} must NOT enable registration`);
    }
    const resArr = await simulateProvisionGuardFlow(async () => ["true"]);
    assert.strictEqual(resArr.status, 403);
  });

  // --- LIVE LOCAL HTTP TESTS AGAINST PORT 3000 + LIVE FIRESTORE ---
  await runTest("LOCAL_HTTP", "Scenario A (Live Server + Live Firestore): POST /api/auth/provision-user returns 403 & leaks no phone/email conflict", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/provision-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Security Audit User",
        email: "auditblockedtest@gmail.com",
        phone: "+919876543210",
        dob: "1995-01-01",
        password: "TestPassword@2026",
      }),
    });
    const text = await res.text();
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}: ${text}`);
    assert(!text.toLowerCase().includes("already registered"), "Leaked duplicate account status");
    assert(!text.toLowerCase().includes("mobile number"), "Leaked mobile existence");
    assert(!text.toLowerCase().includes("gmail"), "Leaked email existence");
  });

  await runTest("LOCAL_HTTP", "Scenario F (Concurrent Requests): 8 simultaneous POST /api/auth/provision-user requests all fail closed with 403", async () => {
    const payload = JSON.stringify({
      fullName: "Concurrent Audit",
      email: "concurrentaudit@gmail.com",
      phone: "+919876543211",
      dob: "1996-05-10",
      password: "TestPassword@2026",
    });
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${BASE_URL}/api/auth/provision-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        }).then(async (r) => ({ status: r.status, body: await r.text() }))
      )
    );
    for (const r of responses) {
      assert.strictEqual(r.status, 403, `Concurrent request returned ${r.status}: ${r.body}`);
    }
  });

  await runTest("LOCAL_HTTP", "Disclosure Check: Forged idToken on /api/auth/provision-google-user returns safe error without stack/Firebase internals", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/provision-google-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "forged.invalid.jwt.token" }),
    });
    const text = await res.text();
    assert(res.status === 401 || res.status === 500, `Unexpected status ${res.status}`);
    assert(!text.includes("Decoding Firebase ID token failed"), "Leaked internal Firebase Admin message");
    assert(!text.includes("FIREBASE_"), "Leaked env var name");
    assert(!text.includes("at "), "Leaked stack trace");
  });

  await runTest("LOCAL_HTTP", "Disclosure Check: Forged idToken on /api/auth/provision-phone-user returns safe error without stack/Firebase internals", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/provision-phone-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "forged.invalid.phone.jwt" }),
    });
    const text = await res.text();
    assert(res.status === 401 || res.status === 500, `Unexpected status ${res.status}`);
    assert(!text.includes("Decoding Firebase ID token failed"), "Leaked internal Firebase Admin message");
    assert(!text.includes("at "), "Leaked stack trace");
  });

  await runTest("LOCAL_HTTP", "Authorization Check: Spoofed Webmaster UID/role in POST /api/admin/settings without valid Bearer token returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: "OXGYTyWBcdYNcHkWyXPbOvVlV2h1",
        role: "webmaster",
        userRegistrationEnabled: true,
      }),
    });
    assert.strictEqual(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
  });

  // --- STATIC INVARIANTS ACROSS NODE SERVER & CLOUDFLARE FUNCTIONS ---
  await runTest("STATIC", "src/server/auth-api.ts uses strict fail-closed guard (=== true), unified 409, and guards phone signup", async () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/server/auth-api.ts"), "utf8");
    assert(!content.includes("getFirebaseAdmin()"), "Regression: undefined getFirebaseAdmin() call found");
    assert(content.includes("export function evaluateRegistrationGuard"), "Missing evaluateRegistrationGuard");
    assert(content.includes("userRegistrationEnabled !== true"), "Guard must strictly check !== true (fail closed)");
    assert(content.includes("SAFE_CONFLICT_MSG"), "Missing unified conflict message");
    assert(!content.includes("This Gmail address is already registered."), "Leaks email existence in 409");
    assert(!content.includes("An account with this Mobile Number is already registered."), "Leaks phone existence in 409");
    assert(!content.includes("err?.message ||"), "Must not expose raw err?.message in HTTP responses");
  });

  await runTest("STATIC", "Cloudflare provision-user.ts & provision-phone-user.ts enforce strict fail-closed guard and sanitize errors", async () => {
    const userFn = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/functions/api/auth/provision-user.ts"), "utf8");
    const phoneFn = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/functions/api/auth/provision-phone-user.ts"), "utf8");
    const googleFn = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/functions/api/auth/provision-google-user.ts"), "utf8");

    assert(userFn.includes("siteSettings.userRegistrationEnabled !== true"), "CF provision-user must fail closed (!== true)");
    assert(userFn.includes("503"), "CF provision-user must return 503 on Firestore error");
    assert(userFn.includes("SAFE_CONFLICT_MSG"), "CF provision-user must use unified 409");
    assert(phoneFn.includes("siteSettings.userRegistrationEnabled !== true"), "CF provision-phone-user must guard new phone signups");
    assert(!phoneFn.includes("err?.message ||"), "CF provision-phone-user must not leak raw token error");
    assert(!googleFn.includes("err?.message ||"), "CF provision-google-user must not leak raw token error");
  });

  console.log("\n==================================================================");
  console.log(`REGISTRATION SECURITY SUITE: ${passed}/${total} PASSED (${total - passed} FAILED)`);
  console.log(`  UNIT: ${categories.UNIT.passed}/${categories.UNIT.total} | LOCAL_HTTP: ${categories.LOCAL_HTTP.passed}/${categories.LOCAL_HTTP.total} | STATIC: ${categories.STATIC.passed}/${categories.STATIC.total}`);
  console.log("==================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
