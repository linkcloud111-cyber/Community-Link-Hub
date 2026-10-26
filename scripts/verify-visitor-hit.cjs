const fs = require('fs');
const path = require('path');

console.log("=== LINKCLOUD VERIFICATION SCRIPT (SERVER-AUTHORITATIVE ARCHITECTURE) ===");

// 1. Verify firestore.rules for visitor_stats
const rulesPath = path.resolve(__dirname, '../firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

console.log("[CHECK 1] firestore.rules contents for visitor_stats:");
const hasVisitorStats = rulesContent.includes("match /visitor_stats/{dateId}");
const hasVisitorRestricted = rulesContent.includes("match /visitor_stats/{dateId} {\n      allow read, write: if isWebmaster();\n    }");
console.log("- has visitor_stats match block:", hasVisitorStats);
console.log("- has strict Webmaster-only restriction (no client writes):", hasVisitorRestricted);

if (!hasVisitorStats || !hasVisitorRestricted) {
  console.error("FAILED: visitor_stats rule is not properly restricted to Webmaster!");
  process.exit(1);
}

// 2. Verify firestore.rules for search_logs
console.log("[CHECK 2] firestore.rules contents for search_logs:");
const hasSearchLogs = rulesContent.includes("match /search_logs/{searchId}");
const hasSearchRestricted = rulesContent.includes("match /search_logs/{searchId} {\n      allow read, write: if isWebmaster();\n    }");
console.log("- has search_logs match block:", hasSearchLogs);
console.log("- has strict Webmaster-only restriction (no client writes):", hasSearchRestricted);

if (!hasSearchLogs || !hasSearchRestricted) {
  console.error("FAILED: search_logs rule is not properly restricted to Webmaster!");
  process.exit(1);
}

// 3. Verify firestore.ts logVisitorHit implementation
const firestoreTsPath = path.resolve(__dirname, '../artifacts/linkcloud/src/lib/firestore.ts');
const firestoreTsContent = fs.readFileSync(firestoreTsPath, 'utf8');

console.log("[CHECK 3] firestore.ts logVisitorHit implementation:");
const vHitCode = firestoreTsContent.substring(
  firestoreTsContent.indexOf("export async function logVisitorHit()"),
  firestoreTsContent.indexOf("export async function logVisitorHit()") + 1500
);

const hasNoClientFirestoreWrite = !vHitCode.includes("setDoc(") && !vHitCode.includes("getDoc(");
const hasServerApiCall = vHitCode.includes('/api/telemetry/visitor-hit');
const hasSessionDedupe = vHitCode.includes("sessionStorage");

console.log("- does NOT make client-side Firestore writes:", hasNoClientFirestoreWrite);
console.log("- uses secure server-authoritative ingestion (/api/telemetry/visitor-hit):", hasServerApiCall);
console.log("- implements session throttling/deduplication:", hasSessionDedupe);

if (!hasNoClientFirestoreWrite || !hasServerApiCall || !hasSessionDedupe) {
  console.error("FAILED: logVisitorHit violates server-authoritative telemetry constraints!");
  process.exit(1);
}

// 4. Verify logSearchQuery implementation
console.log("[CHECK 4] firestore.ts logSearchQuery implementation:");
const sQueryCode = firestoreTsContent.substring(
  firestoreTsContent.indexOf("export async function logSearchQuery("),
  firestoreTsContent.indexOf("export async function logSearchQuery(") + 1500
);

const hasNoClientSearchWrite = !sQueryCode.includes("setDoc(") && !sQueryCode.includes("getDoc(");
const hasServerSearchApiCall = sQueryCode.includes('/api/telemetry/search-query');

console.log("- does NOT make client-side Firestore writes:", hasNoClientSearchWrite);
console.log("- uses secure server-authoritative ingestion (/api/telemetry/search-query):", hasServerSearchApiCall);

if (!hasNoClientSearchWrite || !hasServerSearchApiCall) {
  console.error("FAILED: logSearchQuery violates server-authoritative telemetry constraints!");
  process.exit(1);
}

// 5. Verify App.tsx public /submit route
const appTsxPath = path.resolve(__dirname, '../artifacts/linkcloud/src/App.tsx');
const appTsxContent = fs.readFileSync(appTsxPath, 'utf8');

console.log("[CHECK 5] App.tsx /submit route routing:");
const hasPublicSubmitImport = appTsxContent.includes("const PublicSubmitPage = lazyWithRetry(() => import('@/pages/submit'))");
const hasPublicSubmitRoute = appTsxContent.includes('<Route path="/submit" component={PublicSubmitPage} />');

console.log("- has PublicSubmitPage import:", hasPublicSubmitImport);
console.log("- has /submit pointing to PublicSubmitPage:", hasPublicSubmitRoute);

if (!hasPublicSubmitImport || !hasPublicSubmitRoute) {
  console.error("FAILED: App.tsx /submit is not wired to PublicSubmitPage!");
  process.exit(1);
}

console.log("\nALL 5 AUTOMATED STRUCTURAL AUDIT CHECKS PASSED SUCCESSFULLY!");
