const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where, limit } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

console.log("=== FIRESTORE RULES BEHAVIORAL SECURITY TEST SUITE ===");

const configPath = path.resolve(__dirname, '../artifacts/linkcloud/firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize unauthenticated client
const app = initializeApp(firebaseConfig, 'unauthenticated-security-tester');
const db = getFirestore(app);

async function runSecurityTests() {
  let passed = 0;
  let failed = 0;

  async function assertDenied(name, fn) {
    try {
      await fn();
      console.error(`[FAIL - SECURITY LEAK] ${name}: Operation unexpectedly SUCCEEDED!`);
      failed++;
    } catch (err) {
      if (err?.code === 'permission-denied' || (err?.message && err.message.includes('insufficient permissions'))) {
        console.log(`[PASS - SECURE] ${name}: Correctly rejected with permission-denied.`);
        passed++;
      } else {
        console.warn(`[PASS - REJECTED] ${name}: Rejected with error: ${err.code || err.message}`);
        passed++;
      }
    }
  }

  async function assertAllowed(name, fn) {
    try {
      await fn();
      console.log(`[PASS - ALLOWED] ${name}: Operation succeeded as permitted.`);
      passed++;
    } catch (err) {
      console.error(`[FAIL - FALSE DENIAL] ${name}: Operation unexpectedly failed:`, err?.code || err?.message);
      failed++;
    }
  }

  const today = new Date().toISOString().split('T')[0];

  // 1. Unauthenticated read on visitor_stats
  await assertDenied("Unauthenticated read on /visitor_stats/{dateId}", async () => {
    await getDoc(doc(db, "visitor_stats", today));
  });

  // 2. Unauthenticated direct client write on visitor_stats
  await assertDenied("Unauthenticated direct client write on /visitor_stats/{dateId}", async () => {
    await setDoc(doc(db, "visitor_stats", today), { date: today, count: 999999 });
  });

  // 3. Unauthenticated read on search_logs
  await assertDenied("Unauthenticated read on /search_logs/{searchId}", async () => {
    await getDoc(doc(db, "search_logs", "testquery"));
  });

  // 4. Unauthenticated direct client write on search_logs
  await assertDenied("Unauthenticated direct client write on /search_logs/{searchId}", async () => {
    await setDoc(doc(db, "search_logs", "testquery"), { keyword: "testquery", count: 999999 });
  });

  // 5. Unauthenticated read on private abuse reports
  await assertDenied("Unauthenticated read on /reports/{reportId}", async () => {
    await getDoc(doc(db, "reports", "rep_12345"));
  });

  // 6. Unauthenticated write on states registry
  await assertDenied("Unauthenticated write on /states/{stateId}", async () => {
    await setDoc(doc(db, "states", "hacked-state"), { name: "Hacked State" });
  });

  // 7. Unauthenticated write on global settings
  await assertDenied("Unauthenticated write on /settings/{settingId}", async () => {
    await setDoc(doc(db, "settings", "site"), { siteName: "Defaced Site" });
  });

  // 8. Default-deny on non-whitelisted path
  await assertDenied("Default-deny on /internal_system_secrets/{secretId}", async () => {
    await getDoc(doc(db, "internal_system_secrets", "master_key"));
  });

  // 9. Public read on global settings (allowed for theme/branding)
  await assertAllowed("Public read on /settings/site", async () => {
    await getDoc(doc(db, "settings", "site"));
  });

  // 10. Public listing of approved groups
  await assertAllowed("Public query on /groups with status == 'approved'", async () => {
    const q = query(collection(db, "groups"), where("status", "==", "approved"), limit(5));
    await getDocs(q);
  });

  console.log(`\nSecurity Suite Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSecurityTests().catch((err) => {
  console.error("Fatal error running security suite:", err);
  process.exit(1);
});
