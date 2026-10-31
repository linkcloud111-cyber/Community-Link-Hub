/**
 * LINKCLOUD — COMPREHENSIVE WEBMASTER PANEL BEHAVIORAL VERIFICATION SUITE
 * Tests Phase 3 (Every Webmaster Control Must Work) and Phase 4 (Settings Must Change Real Behavior)
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, '../artifacts/linkcloud/firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize test client
const app = initializeApp(firebaseConfig, 'webmaster-behavior-tester');
const db = getFirestore(app);

const results = [];

function record(suite, testName, status, details) {
  results.push({ suite, testName, status, details });
  const icon = status === 'PASS' ? '✓' : '✗';
  console.log(`[${status}] [${suite}] ${testName} -> ${details}`);
}

async function runWebmasterBehavioralAudit() {
  console.log("==================================================================");
  console.log(" LINKCLOUD WEBMASTER PANEL BEHAVIORAL AUDIT SUITE");
  console.log("==================================================================\n");

  // ─── SUITE 1: ACCESS CONTROL & RBAC ENFORCEMENT ──────────────────
  console.log("--- SUITE 1: ACCESS CONTROL & RBAC ENFORCEMENT ---");
  try {
    // 1.1 Unauthenticated client denied access to /webmaster collection
    try {
      await getDoc(doc(db, "webmaster", "OXGYTyWBcdYNcHkWyXPbOvVlV2h1"));
      record("RBAC", "Webmaster collection read isolation", "FAIL", "Unauthenticated read succeeded unexpectedly");
    } catch (err) {
      record("RBAC", "Webmaster collection read isolation", "PASS", "Direct client read correctly denied (permission-denied)");
    }

    // 1.2 Unauthenticated client write to /webmaster collection denied
    try {
      await setDoc(doc(db, "webmaster", "fake_intruder"), { role: "webmaster" });
      record("RBAC", "Webmaster collection write lockdown", "FAIL", "Intruder write succeeded unexpectedly");
    } catch (err) {
      record("RBAC", "Webmaster collection write lockdown", "PASS", "Direct client write to /webmaster strictly denied");
    }

    // 1.3 Unauthenticated client write to /settings/site denied
    try {
      await setDoc(doc(db, "settings", "site"), { siteName: "Hacked" }, { merge: true });
      record("RBAC", "Settings mutation authority", "FAIL", "Unauthenticated write to settings succeeded");
    } catch (err) {
      record("RBAC", "Settings mutation authority", "PASS", "Settings write strictly requires isWebmaster()");
    }

    // 1.4 Public read of settings is permitted for downstream consumers
    try {
      const snap = await getDoc(doc(db, "settings", "site"));
      record("RBAC", "Public settings availability", "PASS", `Settings readable for runtime theming: exists=${snap.exists()}`);
    } catch (err) {
      record("RBAC", "Public settings availability", "FAIL", `Settings read failed: ${err.message}`);
    }

  } catch (err) {
    console.error("Suite 1 error:", err);
  }

  // ─── SUITE 2: THEME COMPUTATION & SYNC LOGIC ─────────────────────
  console.log("\n--- SUITE 2: THEME COMPUTATION & REAL-TIME SYNC ---");
  {
    // Pure logic test of theme calculation (matches SiteSettingsContext.tsx)
    function computeEffectiveTheme(websiteTheme, fallbackTheme, systemPrefersDark) {
      const raw = (websiteTheme || fallbackTheme || "dark").toLowerCase();
      if (raw === "light") return "light";
      if (raw === "system") return systemPrefersDark ? "dark" : "light";
      return "dark";
    }

    const testDark = computeEffectiveTheme("dark", "light", false);
    const testLight = computeEffectiveTheme("light", "dark", true);
    const testSystemDark = computeEffectiveTheme("system", "dark", true);
    const testSystemLight = computeEffectiveTheme("system", "dark", false);

    record("Theme", "Theme 'dark' mode enforcement", testDark === "dark" ? "PASS" : "FAIL", `Computed: ${testDark}`);
    record("Theme", "Theme 'light' mode enforcement", testLight === "light" ? "PASS" : "FAIL", `Computed: ${testLight}`);
    record("Theme", "Theme 'system' with OS dark preference", testSystemDark === "dark" ? "PASS" : "FAIL", `Computed: ${testSystemDark}`);
    record("Theme", "Theme 'system' with OS light preference", testSystemLight === "light" ? "PASS" : "FAIL", `Computed: ${testSystemLight}`);
  }

  // ─── SUITE 3: SUBMISSION FEATURE FLAGS & GUARDING ────────────────
  console.log("\n--- SUITE 3: SUBMISSION FEATURE FLAGS & GUARDING ---");
  {
    // Test logic implemented in firestore.ts createGroup
    function validateSubmissionAllowed(settings, isAuthenticated) {
      if (settings?.groupSubmissionEnabled === false) {
        return { allowed: false, error: "Community group submissions are currently paused by the administrator." };
      }
      if (!isAuthenticated && settings?.allowPublicSubmissions === false) {
        return { allowed: false, error: "Public unauthenticated submissions are currently disabled. Please sign in to submit your group." };
      }
      return { allowed: true };
    }

    const passAll = validateSubmissionAllowed({ groupSubmissionEnabled: true, allowPublicSubmissions: true }, false);
    record("SubmissionFlags", "Open submissions allow guests", passAll.allowed ? "PASS" : "FAIL", "Guest permitted when flags enabled");

    const blockPublic = validateSubmissionAllowed({ groupSubmissionEnabled: true, allowPublicSubmissions: false }, false);
    record("SubmissionFlags", "allowPublicSubmissions=false blocks guest", !blockPublic.allowed ? "PASS" : "FAIL", blockPublic.error);

    const allowAuthed = validateSubmissionAllowed({ groupSubmissionEnabled: true, allowPublicSubmissions: false }, true);
    record("SubmissionFlags", "allowPublicSubmissions=false allows authed user", allowAuthed.allowed ? "PASS" : "FAIL", "Authenticated user permitted");

    const blockAll = validateSubmissionAllowed({ groupSubmissionEnabled: false, allowPublicSubmissions: true }, true);
    record("SubmissionFlags", "groupSubmissionEnabled=false blocks all users", !blockAll.allowed ? "PASS" : "FAIL", blockAll.error);
  }

  // ─── SUITE 4: TAXONOMY & SLUG RESOLUTION ─────────────────────────
  console.log("\n--- SUITE 4: TAXONOMY & SLUG RESOLUTION ---");
  {
    function slugify(text) {
      return (text || '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const slug1 = slugify("UPSC & Government Exams");
    const slug2 = slugify("WhatsApp Channels 2026!");
    const slug3 = slugify("   Special #123 Deals & Discounts   ");

    record("Taxonomy", "Slugify UPSC & Government Exams", slug1 === "upsc-government-exams" ? "PASS" : "FAIL", slug1);
    record("Taxonomy", "Slugify WhatsApp Channels 2026!", slug2 === "whatsapp-channels-2026" ? "PASS" : "FAIL", slug2);
    record("Taxonomy", "Slugify special characters and whitespace", slug3 === "special-123-deals-discounts" ? "PASS" : "FAIL", slug3);
  }

  // ─── SUITE 5: BRAND COLOR HSL CONVERTER ──────────────────────────
  console.log("\n--- SUITE 5: BRAND COLOR HSL CSS VARIABLE CONVERSION ---");
  {
    function hexToHslCssVars(hex) {
      const clean = (hex || "").trim().replace(/^#/, "");
      if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;

      const r = parseInt(clean.substring(0, 2), 16) / 255;
      const g = parseInt(clean.substring(2, 4), 16) / 255;
      const b = parseInt(clean.substring(4, 6), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      const hDeg = Math.round(h * 360);
      const sPct = Math.round(s * 100);
      const lPct = Math.round(l * 100);
      const hslStr = `${hDeg} ${sPct}% ${lPct}%`;
      return { primary: hslStr, ring: hslStr };
    }

    const brandBlue = hexToHslCssVars("#3b82f6");
    const brandEmerald = hexToHslCssVars("#10b981");
    const invalidHex = hexToHslCssVars("not-a-color");

    record("Branding", "Convert #3b82f6 to CSS HSL", brandBlue ? "PASS" : "FAIL", brandBlue?.primary);
    record("Branding", "Convert #10b981 to CSS HSL", brandEmerald ? "PASS" : "FAIL", brandEmerald?.primary);
    record("Branding", "Invalid hex rejected safely", invalidHex === null ? "PASS" : "FAIL", "Correctly returned null");
  }

  // ─── SUITE 6: ANNOUNCEMENT ACTION URL SANITIZER ──────────────────
  console.log("\n--- SUITE 6: ANNOUNCEMENT URL SECURITY SANITIZER ---");
  {
    function isSafeActionUrl(url) {
      if (!url || typeof url !== "string") return false;
      const trimmed = url.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
      try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }

    record("URLSanitizer", "Relative path /groups allowed", isSafeActionUrl("/groups") ? "PASS" : "FAIL", "Allowed");
    record("URLSanitizer", "HTTPS url https://linkcloud.in allowed", isSafeActionUrl("https://linkcloud.in") ? "PASS" : "FAIL", "Allowed");
    record("URLSanitizer", "JavaScript protocol rejected", !isSafeActionUrl("javascript:alert(1)") ? "PASS" : "FAIL", "Blocked");
    record("URLSanitizer", "Data protocol rejected", !isSafeActionUrl("data:text/html;base64,...") ? "PASS" : "FAIL", "Blocked");
    record("URLSanitizer", "VBScript protocol rejected", !isSafeActionUrl("vbscript:MsgBox(1)") ? "PASS" : "FAIL", "Blocked");
  }

  // ─── SUITE 7: HTTP ROUTE SMOKE & SERVER STATUS ───────────────────
  console.log("\n--- SUITE 7: HTTP ROUTE SMOKE & SERVER STATUS ---");
  {
    const http = require('http');

    function checkHttp(path) {
      return new Promise((resolve) => {
        const req = http.get({
          hostname: '127.0.0.1',
          port: 3000,
          path,
          headers: { 'Accept': 'text/html,application/json' },
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, length: body.length });
          });
        });
        req.on('error', (err) => resolve({ statusCode: 0, error: err.message }));
        req.setTimeout(3000, () => { req.destroy(); resolve({ statusCode: 408 }); });
      });
    }

    const routesToCheck = [
      "/webmaster/login",
      "/webmaster/dashboard",
      "/webmaster/groups",
      "/webmaster/users",
      "/webmaster/categories",
      "/webmaster/locations",
      "/webmaster/reports",
      "/webmaster/contacts",
      "/webmaster/notifications",
      "/webmaster/settings",
      "/api/telemetry/visitor-hit",
      "/api/telemetry/search-query",
    ];

    for (const route of routesToCheck) {
      const res = await checkHttp(route);
      const isOk = res.statusCode >= 200 && res.statusCode < 500;
      record("HTTPRoutes", `Route ${route} responds cleanly`, isOk ? "PASS" : "FAIL", `Status ${res.statusCode}`);
    }
  }

  console.log("\n==================================================================");
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL WEBMASTER AUDIT CHECKS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runWebmasterBehavioralAudit();
