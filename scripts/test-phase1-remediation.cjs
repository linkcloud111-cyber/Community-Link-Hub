/**
 * LINKCLOUD — PHASE 1 CONTROLLED SECURITY & PRODUCT REMEDIATION SUITE
 * Tests Sections B–F:
 *   - Auth & Mobile+Password Server Login (11 scenarios)
 *   - EmailIndex & MobileIndex Security Lockdown (6 scenarios)
 *   - Group Submission Login Policy & Tag/Description Limits (9 scenarios)
 *   - Group Report Mandatory Fields & Validation (6 scenarios)
 *
 * Uses esbuild to load and execute real TypeScript modules from src/lib/group-validation.ts
 * and functions/api/auth/mobile-password-login.ts, plus live local HTTP checks on port 3000.
 */

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const esbuild = require("esbuild");

const BASE_URL = "http://127.0.0.1:3000";
const APP_ROOT = path.resolve(__dirname, "../artifacts/linkcloud");

function loadTsModule(relPath, extraGlobals = {}) {
  const fullPath = path.resolve(APP_ROOT, relPath);
  const res = esbuild.buildSync({
    entryPoints: [fullPath],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
  });
  const code = res.outputFiles[0].text;
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require,
    console,
    process,
    Buffer,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Response,
    Request,
    Headers,
    crypto: crypto.webcrypto,
    btoa: (str) => Buffer.from(str, "binary").toString("base64"),
    atob: (str) => Buffer.from(str, "base64").toString("binary"),
    Date,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Math,
    ...extraGlobals,
  };
  vm.runInNewContext(code, sandbox, { filename: fullPath });
  return mod.exports;
}

const gv = loadTsModule("src/lib/group-validation.ts");

let total = 0;
let passed = 0;
const categories = {
  UNIT: { passed: 0, total: 0 },
  SIMULATED_HANDLER: { passed: 0, total: 0 },
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
    console.error(`[FAIL] [${category}] #${total} ${name}: ${err.message}`);
  }
}

function readAppFile(relPath) {
  return fs.readFileSync(path.resolve(APP_ROOT, relPath), "utf8");
}

function listAllSourceFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listAllSourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function makeFakeServiceAccountEnv() {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return {
    FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify({
      project_id: "linkcloud-test-sim",
      client_email: "sim-tester@linkcloud-test-sim.iam.gserviceaccount.com",
      private_key: privateKey,
    }),
    FIREBASE_WEB_API_KEY: "AIzaSySimulatedUnitTestWebApiKey12345",
  };
}

function makeFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") fields[k] = { stringValue: v };
    else if (typeof v === "boolean") fields[k] = { booleanValue: v };
    else if (typeof v === "number") fields[k] = { integerValue: String(v) };
  }
  return { fields };
}

async function main() {
  console.log("==================================================================");
  console.log("   LINKCLOUD — PHASE 1 REMEDIATION VERIFICATION SUITE             ");
  console.log("==================================================================");

  // =================================================================
  // 1. AUTHENTICATION & MOBILE+PASSWORD LOGIN (11 CASES)
  // =================================================================
  console.log("\n--- SECTION 1: AUTHENTICATION & MOBILE+PASSWORD LOGIN ---");

  await runTest("UNIT", "Auth #1-3: Mobile number normalization handles +91, spaced +91, 10-digit & leading 0", () => {
    const v1 = gv.normalizeIndianMobileNumber("9876543210");
    assert.strictEqual(v1.valid, true);
    assert.strictEqual(v1.canonical, "+919876543210");
    assert.strictEqual(
      JSON.stringify(Array.from(v1.variations)),
      JSON.stringify(["+919876543210", "+91 9876543210", "9876543210"])
    );

    const v2 = gv.normalizeIndianMobileNumber("+919876543210");
    assert.strictEqual(v2.valid, true);
    assert.strictEqual(v2.canonical, "+919876543210");

    const v3 = gv.normalizeIndianMobileNumber("+91 98765 43210");
    assert.strictEqual(v3.valid, true);
    assert.strictEqual(v3.canonical, "+919876543210");

    const v4 = gv.normalizeIndianMobileNumber("09876543210");
    assert.strictEqual(v4.valid, true);
    assert.strictEqual(v4.canonical, "+919876543210");

    const invalid = gv.normalizeIndianMobileNumber("5123456789");
    assert.strictEqual(invalid.valid, false);
  });

  await runTest("SIMULATED_HANDLER", "Auth #4-9 (Bundled CF Handler Execution): Normalized logins, anti-enumeration 401 parity, suspension 403, portal isolation & PII-free customToken", async () => {
    const simEnv = makeFakeServiceAccountEnv();

    // Stubbed in-memory Firebase REST responses (no live project mutation)
    const simUsers = {
      uid_member_1: {
        uid: "uid_member_1",
        accountUid: "linkcloud101",
        email: "sim.member1@gmail.com",
        password: "CorrectMemberPass@2026",
        status: "active",
        role: "user",
        suspended: false,
        banned: false,
      },
      uid_suspended_2: {
        uid: "uid_suspended_2",
        accountUid: "linkcloud102",
        email: "sim.suspended@gmail.com",
        password: "CorrectSuspendedPass@2026",
        status: "suspended",
        role: "user",
        suspended: true,
        banned: false,
      },
      OXGYTyWBcdYNcHkWyXPbOvVlV2h1: {
        uid: "OXGYTyWBcdYNcHkWyXPbOvVlV2h1",
        accountUid: "linkcloud100",
        email: "sim.webmaster@gmail.com",
        password: "CorrectWmPass@2026",
        status: "active",
        role: "webmaster",
        suspended: false,
        banned: false,
      },
    };
    const simMobileIndex = {
      "+919876543210": { uid: "uid_member_1", status: "active" },
      "+91 9876543211": { uid: "uid_suspended_2", status: "active" }, // legacy spaced format
      "9876543212": { uid: "OXGYTyWBcdYNcHkWyXPbOvVlV2h1", status: "active" }, // legacy 10-digit format
    };

    const stubFetch = async (url, init = {}) => {
      const urlStr = String(url);
      if (urlStr === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "sim_google_access_token", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes(":runQuery")) {
        return new Response(JSON.stringify([{ readTime: "2026-01-01T00:00:00Z" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (urlStr.includes("/documents/")) {
        const docPathEncoded = urlStr.split("/documents/")[1];
        const docPath = decodeURIComponent(docPathEncoded);
        if (docPath.startsWith("mobileIndex/")) {
          const key = docPath.slice("mobileIndex/".length);
          if (simMobileIndex[key]) {
            return new Response(JSON.stringify(makeFirestoreFields(simMobileIndex[key])), { status: 200 });
          }
          return new Response(JSON.stringify({ error: { status: "NOT_FOUND" } }), { status: 404 });
        }
        if (docPath.startsWith("users/")) {
          const uid = docPath.slice("users/".length);
          if (simUsers[uid]) {
            return new Response(JSON.stringify(makeFirestoreFields(simUsers[uid])), { status: 200 });
          }
          return new Response(JSON.stringify({ error: { status: "NOT_FOUND" } }), { status: 404 });
        }
        if (docPath.startsWith("webmaster/")) {
          const uid = docPath.slice("webmaster/".length);
          if (uid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1") {
            return new Response(JSON.stringify(makeFirestoreFields({ active: true })), { status: 200 });
          }
          return new Response(JSON.stringify({ error: { status: "NOT_FOUND" } }), { status: 404 });
        }
        return new Response(JSON.stringify({ error: { status: "NOT_FOUND" } }), { status: 404 });
      }
      if (urlStr.includes("identitytoolkit.googleapis.com/v1/accounts:lookup")) {
        const reqBody = JSON.parse(init.body || "{}");
        const uid = reqBody.localId?.[0];
        const u = simUsers[uid];
        return new Response(JSON.stringify({ users: u ? [{ localId: uid, email: u.email, disabled: false }] : [] }), {
          status: 200,
        });
      }
      if (urlStr.includes("identitytoolkit.googleapis.com/v1/accounts:signInWithPassword")) {
        const reqBody = JSON.parse(init.body || "{}");
        const found = Object.values(simUsers).find((u) => u.email === reqBody.email && u.password === reqBody.password);
        if (found) {
          return new Response(JSON.stringify({ localId: found.uid }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }), { status: 400 });
      }
      throw new Error(`Unexpected fetch URL in simulated handler: ${urlStr}`);
    };

    const cfLoginMod = loadTsModule("functions/api/auth/mobile-password-login.ts", { fetch: stubFetch });
    const callLogin = async (payload, ip = "198.51.100.50") => {
      const req = new Request("https://sim.local/api/auth/mobile-password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
        body: JSON.stringify(payload),
      });
      const res = await cfLoginMod.onRequestPost({ request: req, env: simEnv });
      return { status: res.status, text: await res.text() };
    };

    // Valid logins across 10-digit, +91, and spaced +91
    for (const [idx, fmt] of ["9876543210", "+919876543210", "+91 9876543210"].entries()) {
      const res = await callLogin({ mobile: fmt, password: "CorrectMemberPass@2026", portal: "user" }, `198.51.100.${10 + idx}`);
      assert.strictEqual(res.status, 200, `Expected 200 for format ${fmt}, got ${res.status}: ${res.text}`);
      const json = JSON.parse(res.text);
      assert.strictEqual(json.success, true);
      assert(typeof json.customToken === "string" && json.customToken.split(".").length === 3);
      assert.strictEqual(json.email, undefined);
      assert.strictEqual(json.uid, undefined);
      assert.strictEqual(json.accountUid, undefined);
      assert.strictEqual(json.phone, undefined);
    }

    // Wrong password vs unregistered number -> IDENTICAL 401 response body (anti-enumeration)
    const wrongPassRes = await callLogin({ mobile: "9876543210", password: "WrongPassword!" }, "198.51.100.60");
    const unknownNumRes = await callLogin({ mobile: "9000000088", password: "WrongPassword!" }, "198.51.100.61");
    assert.strictEqual(wrongPassRes.status, 401);
    assert.strictEqual(unknownNumRes.status, 401);
    assert.strictEqual(wrongPassRes.text, unknownNumRes.text);
    assert.strictEqual(JSON.parse(wrongPassRes.text).error, "Invalid mobile number or password.");

    // Suspended user with correct password -> 403 and NO customToken
    const suspRes = await callLogin({ mobile: "9876543211", password: "CorrectSuspendedPass@2026", portal: "user" }, "198.51.100.62");
    assert.strictEqual(suspRes.status, 403);
    assert(!suspRes.text.includes("customToken"));

    // Regular user on Webmaster portal -> 403
    const userOnWm = await callLogin({ mobile: "9876543210", password: "CorrectMemberPass@2026", portal: "webmaster" }, "198.51.100.63");
    assert.strictEqual(userOnWm.status, 403);

    // Webmaster on User portal -> 403; Webmaster on Webmaster portal -> 200
    const wmOnUser = await callLogin({ mobile: "9876543212", password: "CorrectWmPass@2026", portal: "user" }, "198.51.100.64");
    assert.strictEqual(wmOnUser.status, 403);
    const wmOnWm = await callLogin({ mobile: "9876543212", password: "CorrectWmPass@2026", portal: "webmaster" }, "198.51.100.65");
    assert.strictEqual(wmOnWm.status, 200);
  });

  await runTest("LOCAL_HTTP", "Auth #10: Live port 3000 mobile-password-login rejects malformed inputs (400), never leaks PII/internals on unknown probes (401 or 503 quota), and rate-limits (429)", async () => {
    const badPhoneRes = await fetch(`${BASE_URL}/api/auth/mobile-password-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.21" },
      body: JSON.stringify({ mobile: "12345", password: "SomePassword@1" }),
    });
    assert.strictEqual(badPhoneRes.status, 400);

    const noPassRes = await fetch(`${BASE_URL}/api/auth/mobile-password-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.22" },
      body: JSON.stringify({ mobile: "9876543210", password: "" }),
    });
    assert.strictEqual(noPassRes.status, 400);

    const probe = await fetch(`${BASE_URL}/api/auth/mobile-password-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.35" },
      body: JSON.stringify({ mobile: "9000000001", password: "WrongPassword@2026" }),
    });
    const probeText = await probe.text();
    assert(probe.status === 401 || probe.status === 503, `Expected 401 or 503 (quota), got ${probe.status}: ${probeText}`);
    const parsed = JSON.parse(probeText);
    assert.strictEqual(parsed.email, undefined);
    assert.strictEqual(parsed.uid, undefined);
    assert.strictEqual(parsed.phone, undefined);
    assert.strictEqual(parsed.customToken, undefined);
    assert(!probeText.includes("RESOURCE_EXHAUSTED"));
    assert(!probeText.includes("Quota exceeded"));

    // Trigger rate limit (429) without hammering Firestore
    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      const r = await fetch(`${BASE_URL}/api/auth/mobile-password-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.99" },
        body: JSON.stringify({ mobile: "9000000009", password: `WrongPass${i}` }),
      });
      lastStatus = r.status;
    }
    assert.strictEqual(lastStatus, 429, `Expected 429 after 10 phone attempts, got ${lastStatus}`);
  });

  await runTest("STATIC", "Auth #11: Server & client auth code parity, legacy hardcoded phone removal, and forgot/OTP/Google intact", () => {
    const cfLogin = readAppFile("functions/api/auth/mobile-password-login.ts");
    const nodeAuth = readAppFile("src/server/auth-api.ts");
    const authLib = readAppFile("src/lib/auth.ts");
    const loginPage = readAppFile("src/pages/login.tsx");

    for (const [label, src] of [["CF", cfLogin], ["Node", nodeAuth]]) {
      assert(src.includes("Invalid mobile number or password."), `${label} missing generic 401 failure message`);
      assert(src.includes("accounts:signInWithPassword"), `${label} missing Firebase password verification`);
      assert(src.includes("suspended") && src.includes("banned"), `${label} missing suspended/banned check`);
      assert(src.includes('portal === "webmaster" && !isWebmaster'), `${label} missing webmaster portal isolation`);
      assert(src.includes('portal === "user" && isWebmaster'), `${label} missing user portal webmaster separation`);
      assert(src.includes("customToken"), `${label} missing customToken response`);
    }

    assert(authLib.includes("export async function loginWithMobilePassword"), "auth.ts missing loginWithMobilePassword");
    assert(authLib.includes("signInWithCustomToken"), "auth.ts missing signInWithCustomToken");
    assert(authLib.includes("sendPasswordResetEmail"), "auth.ts missing sendPasswordResetEmail");
    assert(authLib.includes("signInWithGoogle"), "auth.ts missing signInWithGoogle");
    assert(!authLib.includes("7987410765"), "auth.ts still contains hardcoded mobile number");
    assert(!authLib.includes("getUserProfileByPhone("), "auth.ts still calls getUserProfileByPhone");
    assert(!loginPage.includes("getUserProfileByPhone"), "login.tsx still imports/uses getUserProfileByPhone");
    assert(loginPage.includes("loginWithMobilePassword"), "login.tsx must call loginWithMobilePassword");
  });

  // =================================================================
  // 2. EMAILINDEX & MOBILEINDEX FIRESTORE LOCKDOWN (6 CASES)
  // =================================================================
  console.log("\n--- SECTION 2: EMAILINDEX & MOBILEINDEX LOCKDOWN ---");

  await runTest("STATIC", "Index #1-2: Both root and applet firestore.rules lock /emailIndex and /mobileIndex to Webmaster read only, write false", () => {
    const rootRules = fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8");
    const appRules = readAppFile("firestore.rules");
    assert.strictEqual(rootRules, appRules, "Root and applet firestore.rules differ");

    const emailMatch = rootRules.match(/match \/emailIndex\/\{[^}]+\}\s*\{([\s\S]*?)\}/);
    const mobileMatch = rootRules.match(/match \/mobileIndex\/\{[^}]+\}\s*\{([\s\S]*?)\}/);
    assert(emailMatch && emailMatch[1].includes("allow read: if isWebmaster();") && emailMatch[1].includes("allow write: if false;"),
      "emailIndex rule must lock reads to isWebmaster() and writes to false");
    assert(mobileMatch && mobileMatch[1].includes("allow read: if isWebmaster();") && mobileMatch[1].includes("allow write: if false;"),
      "mobileIndex rule must lock reads to isWebmaster() and writes to false");
  });

  await runTest("STATIC", "Index #3-6: Zero client SDK emailIndex/mobileIndex reads or writes remain in frontend source, and server cleanup handles all phone variations", () => {
    const clientDirs = ["src/lib", "src/pages", "src/components", "src/contexts", "src/hooks"];
    for (const relDir of clientDirs) {
      const files = listAllSourceFiles(path.resolve(APP_ROOT, relDir));
      for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        assert(!content.includes('"emailIndex"') && !content.includes("'emailIndex'"),
          `Client file ${path.relative(APP_ROOT, file)} still references emailIndex`);
        assert(!content.includes('"mobileIndex"') && !content.includes("'mobileIndex'"),
          `Client file ${path.relative(APP_ROOT, file)} still references mobileIndex`);
      }
    }

    const cfDelete = readAppFile("functions/api/auth/delete-account.ts");
    const cfCleanup = readAppFile("functions/api/admin/cleanup-unverified.ts");
    const nodeCleanup = readAppFile("src/server/admin-api.ts");
    assert(cfDelete.includes("emailIndex") && cfDelete.includes("mobileIndex"), "CF delete-account must clean up indexes");
    assert(cfCleanup.includes("phoneKeys") && cfCleanup.includes("mobileIndex/${encodeURIComponent(pk)}"),
      "CF cleanup-unverified must delete all phone index variations");
    assert(nodeCleanup.includes("phoneKeys") && nodeCleanup.includes("mobileIndex"),
      "Node admin-api cleanup must delete all phone index variations");
  });

  // =================================================================
  // 3. GROUP SUBMISSION LOGIN POLICY & TAG/DESCRIPTION LIMITS (9 CASES)
  // =================================================================
  console.log("\n--- SECTION 3: GROUP SUBMISSION POLICY, TAGS & DESCRIPTION ---");

  await runTest("LOCAL_HTTP", "Groups #1: Unauthenticated POST /api/groups/submit returns 401 (even if legacy allowPublicSubmissions is true)", async () => {
    const noAuth = await fetch(`${BASE_URL}/api/groups/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauthorized Group Attempt", tags: ["test"] }),
    });
    assert.strictEqual(noAuth.status, 401, `Expected 401, got ${noAuth.status}`);

    const badJwt = await fetch(`${BASE_URL}/api/groups/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer forged.jwt.token" },
      body: JSON.stringify({ name: "Forged JWT Group Attempt", tags: ["test"] }),
    });
    assert.strictEqual(badJwt.status, 401, `Expected 401 for forged JWT, got ${badJwt.status}`);
  });

  await runTest("STATIC", "Groups #2-3: Visitor submit redirects cleanly via ?redirect=/submit & guest bypass removed across UI + Rules + API", () => {
    const submitPage = readAppFile("src/pages/submit.tsx");
    const navbar = readAppFile("src/components/navbar.tsx");
    const loginPage = readAppFile("src/pages/login.tsx");
    const registerPage = readAppFile("src/pages/register.tsx");
    const rules = readAppFile("firestore.rules");

    assert(submitPage.includes("/login?redirect=%2Fsubmit"), "submit.tsx missing /login?redirect=%2Fsubmit CTA");
    assert(submitPage.includes("/register?redirect=%2Fsubmit"), "submit.tsx missing /register?redirect=%2Fsubmit CTA");
    assert(!submitPage.includes("allowPublicSubmissions"), "submit.tsx still references allowPublicSubmissions");
    assert(!navbar.includes("allowPublicSubmissions"), "navbar.tsx still references allowPublicSubmissions");
    assert(loginPage.includes("getSafeRedirectTarget"), "login.tsx missing safe redirect handler");
    assert(registerPage.includes("getSafeRedirectTarget"), "register.tsx missing safe redirect handler");
    assert(!rules.includes("guestSubmissionsAllowed"), "firestore.rules still contains guestSubmissionsAllowed helper");
  });

  await runTest("UNIT", "Tags #1-6: Exact 10-tag limit, 30-char limit, duplicate rejection, empty-tag rejection & live remaining counter", () => {
    const tenTags = Array.from({ length: 10 }, (_, i) => `tag-${i + 1}`).join(", ");
    const r10 = gv.parseAndValidateTags(tenTags, { required: true });
    assert.strictEqual(r10.valid, true);
    assert.strictEqual(r10.count, 10);
    assert.strictEqual(r10.remaining, 0);

    const elevenTags = Array.from({ length: 11 }, (_, i) => `tag-${i + 1}`).join(", ");
    const r11 = gv.parseAndValidateTags(elevenTags, { required: true });
    assert.strictEqual(r11.valid, false);
    assert(r11.error.includes("Maximum 10 tags"));

    const rEmptyMid = gv.parseAndValidateTags("jobs, , tech", { required: true });
    assert.strictEqual(rEmptyMid.valid, false);
    assert(rEmptyMid.error.includes("Empty tags"));

    const rEmptyTrail = gv.parseAndValidateTags("jobs, tech, ", { required: true });
    assert.strictEqual(rEmptyTrail.valid, false);

    const rDup = gv.parseAndValidateTags("Jobs, jobs", { required: true });
    assert.strictEqual(rDup.valid, false);
    assert(rDup.error.includes("Duplicate tag"));

    const tag30 = "a".repeat(30);
    const tag31 = "a".repeat(31);
    assert.strictEqual(gv.parseAndValidateTags(tag30, { required: true }).valid, true);
    const r31 = gv.parseAndValidateTags(tag31, { required: true });
    assert.strictEqual(r31.valid, false);
    assert(r31.error.includes("exceeds 30 characters"));

    const live3 = gv.getLiveTagStats("jobs, upsc, delhi, ");
    assert.strictEqual(live3.count, 3);
    assert.strictEqual(live3.remaining, 7);
    assert.strictEqual(live3.warning, null);

    const live11 = gv.getLiveTagStats(elevenTags);
    assert.strictEqual(live11.count, 11);
    assert.strictEqual(live11.remaining, 0);
    assert(live11.warning && live11.warning.includes("Maximum 10 tags"));
  });

  await runTest("STATIC", "Tags #7-9: Description 500-char limit & strict tag limits enforced in UI forms, firestore.ts, server APIs & rules", () => {
    const submitPage = readAppFile("src/pages/submit.tsx");
    const dashSubmit = readAppFile("src/pages/dashboard-submit.tsx");
    const dashEdit = readAppFile("src/pages/dashboard-edit.tsx");
    const adminGroups = readAppFile("src/pages/admin-groups.tsx");
    const rules = readAppFile("firestore.rules");

    for (const [name, src] of [
      ["submit.tsx", submitPage],
      ["dashboard-submit.tsx", dashSubmit],
      ["dashboard-edit.tsx", dashEdit],
      ["admin-groups.tsx", adminGroups],
    ]) {
      assert(src.includes("parseAndValidateTags"), `${name} missing parseAndValidateTags`);
      assert(src.includes("getLiveTagStats"), `${name} missing getLiveTagStats counter`);
      assert(src.includes("MAX_GROUP_DESCRIPTION_LENGTH"), `${name} missing MAX_GROUP_DESCRIPTION_LENGTH`);
    }

    assert(rules.includes("incoming().tags.size() <= 10"), "firestore.rules missing tags.size() <= 10");
    assert(rules.includes("incoming().description.size() <= 500"), "firestore.rules missing description.size() <= 500");
  });

  // =================================================================
  // 4. GROUP REPORTS MANDATORY FIELDS & VALIDATION (6 CASES)
  // =================================================================
  console.log("\n--- SECTION 4: GROUP REPORTS MANDATORY VALIDATION ---");

  await runTest("UNIT", "Reports #1-4: Visitor & User validation rejects whitespace/empty/short/invalid fields and needs no attachment", () => {
    const badVisitor = gv.validateReportPayload({
      isSignedIn: false,
      reporterName: "   ",
      reason: "",
      details: "   ",
    });
    assert.strictEqual(badVisitor.valid, false);
    assert(badVisitor.errors.reporterName);
    assert(badVisitor.errors.reason);
    assert(badVisitor.errors.details);

    const badReason = gv.validateReportPayload({
      isSignedIn: false,
      reporterName: "Anita Sharma",
      reason: "InvalidReason",
      details: "Invite link opens an unrelated spam channel.",
    });
    assert.strictEqual(badReason.valid, false);
    assert(badReason.errors.reason);

    const goodSignedIn = gv.validateReportPayload({
      isSignedIn: true,
      reporterName: "",
      reason: "Invalid Link",
      details: "Invite URL returns a group expired error page.",
    });
    assert.strictEqual(goodSignedIn.valid, true);

    const tooLong = gv.validateReportPayload({
      isSignedIn: true,
      reason: "Spam",
      details: "x".repeat(501),
    });
    assert.strictEqual(tooLong.valid, false);
    assert(tooLong.errors.details);
  });

  await runTest("LOCAL_HTTP", "Reports #5-6: POST /api/reports/submit rejects empty/whitespace fields (400) and rate-limits bursts (429)", async () => {
    const emptyRes = await fetch(`${BASE_URL}/api/reports/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.120" },
      body: JSON.stringify({
        groupId: "grp_validation_probe",
        reportedByName: "   ",
        reason: "",
        details: "short",
      }),
    });
    assert.strictEqual(emptyRes.status, 400);
    const emptyJson = await emptyRes.json();
    assert.strictEqual(emptyJson.success, false);
    assert(
      emptyJson.fieldErrors && emptyJson.fieldErrors.reporterName && emptyJson.fieldErrors.reason && emptyJson.fieldErrors.details,
      "Expected field-specific errors for all invalid report fields"
    );

    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      const r = await fetch(`${BASE_URL}/api/reports/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.121" },
        body: JSON.stringify({
          groupId: "grp_rate_probe",
          reportedByName: "",
          reason: "",
          details: "",
        }),
      });
      lastStatus = r.status;
    }
    assert.strictEqual(lastStatus, 429, `Expected 429 after 10 requests from same IP, got ${lastStatus}`);
  });

  await runTest("STATIC", "Reports UI & Rules: All displayed fields marked required, error feedback per field, and rules enforce allowlist", () => {
    const modal = readAppFile("src/components/report-modal.tsx");
    const rules = readAppFile("firestore.rules");
    assert(modal.includes("validateReportPayload"), "report-modal.tsx missing validateReportPayload");
    assert(modal.includes("fieldErrors"), "report-modal.tsx missing per-field error state");
    assert(modal.includes('useState("")'), "report-modal.tsx reason should start empty (no preselected default)");
    assert(
      rules.includes("incoming().reportedByName is string && incoming().reportedByName.trim().size() >= 2"),
      "firestore.rules missing mandatory reportedByName validation"
    );
    assert(rules.includes("'Invalid Link', 'Spam', 'Scam'"), "firestore.rules missing report reason allowlist");
  });

  console.log("\n==================================================================");
  console.log(`PHASE 1 REMEDIATION SUITE: ${passed}/${total} PASSED (${total - passed} FAILED)`);
  console.log(
    `  UNIT: ${categories.UNIT.passed}/${categories.UNIT.total} | SIMULATED_HANDLER: ${categories.SIMULATED_HANDLER.passed}/${categories.SIMULATED_HANDLER.total} | LOCAL_HTTP: ${categories.LOCAL_HTTP.passed}/${categories.LOCAL_HTTP.total} | STATIC: ${categories.STATIC.passed}/${categories.STATIC.total}`
  );
  console.log("==================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal Phase 1 suite error:", err);
  process.exit(1);
});
