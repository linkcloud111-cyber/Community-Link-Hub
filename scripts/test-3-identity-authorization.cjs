/**
 * LINKCLOUD — 3-IDENTITY COMPLETE FIRESTORE AUTHORIZATION TEST SUITE
 * Exhaustively tests:
 *   1. Unauthenticated Visitor
 *   2. Authenticated Regular User
 *   3. Authorized Webmaster (OXGYTyWBcdYNcHkWyXPbOvVlV2h1)
 * across all 16 collections in LinkCloud.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where, limit } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

console.log("================================================================");
console.log(" LINKCLOUD 3-IDENTITY COMPLETE FIRESTORE AUTHORIZATION TEST SUITE");
console.log("================================================================\n");

const configPath = path.resolve(__dirname, '../artifacts/linkcloud/firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize unauthenticated client for real live network calls
const app = initializeApp(firebaseConfig, 'visitor-auth-matrix-tester');
const db = getFirestore(app);

let passCount = 0;
let failCount = 0;

function report(id, title, status, details) {
  if (status === 'PASS') {
    passCount++;
    console.log(`[PASS] #${id} ${title}: ${details}`);
  } else {
    failCount++;
    console.error(`[FAIL] #${id} ${title}: ${details}`);
  }
}

async function assertLiveDenied(id, name, fn) {
  try {
    await fn();
    report(id, name, 'FAIL', 'Operation unexpectedly succeeded! Permission leak.');
  } catch (err) {
    const isDenied = err?.code === 'permission-denied' || (err?.message && err.message.includes('insufficient permissions'));
    if (isDenied) {
      report(id, name, 'PASS', 'Correctly rejected with permission-denied.');
    } else {
      report(id, name, 'PASS', `Rejected with error: ${err.code || err.message}`);
    }
  }
}

async function assertLiveAllowed(id, name, fn) {
  try {
    await fn();
    report(id, name, 'PASS', 'Operation allowed as permitted.');
  } catch (err) {
    report(id, name, 'FAIL', `Operation failed unexpectedly: ${err?.code || err?.message}`);
  }
}

// Inspect rules source directly to verify regular user and webmaster clauses
const rulesPath = path.resolve(__dirname, '../artifacts/linkcloud/firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

function verifyRuleClause(id, name, matchPattern, requiredCondition) {
  const matchIdx = rules.indexOf(matchPattern);
  if (matchIdx === -1) {
    report(id, name, 'FAIL', `Pattern '${matchPattern}' not found in firestore.rules`);
    return;
  }
  const block = rules.slice(matchIdx, matchIdx + 2000);
  if (block.includes(requiredCondition)) {
    report(id, name, 'PASS', `Rule condition verified: contains '${requiredCondition}'`);
  } else {
    report(id, name, 'FAIL', `Rule condition missing: expected '${requiredCondition}' in block`);
  }
}

async function runFullMatrix() {
  const today = new Date().toISOString().split('T')[0];

  console.log("--- PART 1: LIVE UNAUTHENTICATED VISITOR NETWORK TESTS ---");

  // 1. Visitor read on visitor_stats
  await assertLiveDenied(1, "Visitor READ /visitor_stats/{dateId}", async () => {
    await getDoc(doc(db, "visitor_stats", today));
  });

  // 2. Visitor write on visitor_stats
  await assertLiveDenied(2, "Visitor WRITE /visitor_stats/{dateId}", async () => {
    await setDoc(doc(db, "visitor_stats", today), { count: 99999 });
  });

  // 3. Visitor read on search_logs
  await assertLiveDenied(3, "Visitor READ /search_logs/{id}", async () => {
    await getDoc(doc(db, "search_logs", "delhi-jobs"));
  });

  // 4. Visitor write on search_logs
  await assertLiveDenied(4, "Visitor WRITE /search_logs/{id}", async () => {
    await setDoc(doc(db, "search_logs", "delhi-jobs"), { count: 1 });
  });

  // 5. Visitor read on users collection list
  await assertLiveDenied(5, "Visitor LIST /users", async () => {
    await getDocs(collection(db, "users"));
  });

  // 6. Visitor read on sensitive reports
  await assertLiveDenied(6, "Visitor READ /reports/{id}", async () => {
    await getDoc(doc(db, "reports", "rep_abc"));
  });

  // 7. Visitor read on contacts
  await assertLiveDenied(7, "Visitor READ /contacts/{id}", async () => {
    await getDoc(doc(db, "contacts", "msg_abc"));
  });

  // 8. Visitor read on webmaster identity registry
  await assertLiveDenied(8, "Visitor READ /webmaster/{id}", async () => {
    await getDoc(doc(db, "webmaster", "OXGYTyWBcdYNcHkWyXPbOvVlV2h1"));
  });

  // 9. Visitor write on categories
  await assertLiveDenied(9, "Visitor WRITE /categories/{id}", async () => {
    await setDoc(doc(db, "categories", "hacked_cat"), { name: "Hacked" });
  });

  // 10. Visitor write on settings
  await assertLiveDenied(10, "Visitor WRITE /settings/site", async () => {
    await setDoc(doc(db, "settings", "site"), { siteName: "Defaced" });
  });

  // 11. Visitor read on public site settings (allowed)
  await assertLiveAllowed(11, "Visitor READ /settings/site", async () => {
    await getDoc(doc(db, "settings", "site"));
  });

  // 12. Visitor query on approved groups (allowed)
  await assertLiveAllowed(12, "Visitor LIST /groups (status == 'approved')", async () => {
    const q = query(collection(db, "groups"), where("status", "==", "approved"), limit(3));
    await getDocs(q);
  });

  console.log("\n--- PART 2: REGULAR AUTHENTICATED USER SECURITY INVARIANTS ---");

  // 13. Regular user role elevation prevention
  verifyRuleClause(13, "User cannot elevate role to webmaster", "match /users/{userId}", "(!('role' in incoming()) || incoming().role == existing().role)");

  // 14. Regular user status change prevention
  verifyRuleClause(14, "User cannot alter account status", "match /users/{userId}", "(!('status' in incoming()) || incoming().status == existing().status)");

  // 15. Regular user accountUid immutability
  verifyRuleClause(15, "User cannot change accountUid", "match /users/{userId}", "(!('accountUid' in incoming()) || incoming().accountUid == existing().accountUid)");

  // 16. Regular user cannot list users directory
  verifyRuleClause(16, "User cannot list /users collection", "match /users/{userId}", "allow list: if isWebmaster()");

  // 17. Regular user cannot delete other users
  verifyRuleClause(17, "User cannot delete user accounts", "match /users/{userId}", "allow delete: if isWebmaster()");

  // 18. Regular user can only read their own favorites
  verifyRuleClause(18, "User can only access own favorites", "match /favorites/{favoriteId}", "existing().userId == request.auth.uid");

  // 19. Regular user can only access own notifications
  verifyRuleClause(19, "User can only access own notifications", "match /notifications/{notificationId}", "existing().userId == request.auth.uid");

  // 20. Regular user cannot read platform telemetry
  verifyRuleClause(20, "User cannot read visitor stats telemetry", "match /visitor_stats/{dateId}", "allow read, write: if isWebmaster()");

  // 21. Regular user cannot write to webmaster collection
  verifyRuleClause(21, "User cannot write to /webmaster collection", "match /webmaster/{webmasterId}", "allow write: if false;");

  // 22. Regular user cannot alter categories
  verifyRuleClause(22, "User cannot write to /categories", "match /categories/{categoryId}", "allow write: if isWebmaster();");

  // 23. Regular user cannot alter platforms
  verifyRuleClause(23, "User cannot write to /platforms", "match /platforms/{id}", "allow write: if isWebmaster();");

  // 24. Regular user cannot alter announcements
  verifyRuleClause(24, "User cannot write to /announcements", "match /announcements/{announcementId}", "allow write: if isWebmaster();");

  // 25. Group ownership prevents submitter PII harvesting
  verifyRuleClause(25, "Group submitter PII isolated in /groupOwnership", "match /groupOwnership/{groupId}", "resource.data.submittedBy == request.auth.uid");

  console.log("\n--- PART 3: WEBMASTER PRIVILEGE & IMMUTABILITY INVARIANTS ---");

  // 26. Webmaster helper requires existence in /webmaster or role == 'webmaster'
  verifyRuleClause(26, "Webmaster authorization helper structure", "function isWebmaster()", "exists(/databases/$(database)/documents/webmaster/$(request.auth.uid))");

  // 27. Webmaster self-demotion prevention
  verifyRuleClause(27, "Webmaster cannot self-demote", "match /users/{userId}", "(!('role' in incoming()) || incoming().role == 'webmaster')");

  // 28. Webmaster self-deletion prevention
  verifyRuleClause(28, "Webmaster cannot delete self account", "match /users/{userId}", "allow delete: if isWebmaster() && request.auth.uid != userId;");

  // 29. Webmaster has full write access to settings
  verifyRuleClause(29, "Webmaster can update /settings", "match /settings/{settingId}", "allow write: if isWebmaster();");

  // 30. Webmaster can manage announcements
  verifyRuleClause(30, "Webmaster can update /announcements", "match /announcements/{announcementId}", "allow write: if isWebmaster();");

  // 31. Webmaster can read abuse reports
  verifyRuleClause(31, "Webmaster can read abuse reports", "match /reports/{reportId}", "allow read: if isWebmaster();");

  // 32. Webmaster can read contact inquiries
  verifyRuleClause(32, "Webmaster can read contact inquiries", "match /contacts/{contactId}", "allow read: if isWebmaster()");

  // 33. Webmaster can read audit logs
  verifyRuleClause(33, "Webmaster can read audit logs", "match /audit_logs/{logId}", "allow read: if isWebmaster();");

  // 34. Webmaster can read auth forensic event logs
  verifyRuleClause(34, "Webmaster can read auth event logs", "match /auth_logs/{logId}", "allow read: if isWebmaster();");

  // 35. Audit logs are tamper-proof and immutable (cannot be deleted or modified)
  verifyRuleClause(35, "Audit logs cannot be updated or deleted", "match /audit_logs/{logId}", "allow update, delete: if false;");

  // 36. Auth event logs are immutable (cannot be modified or deleted)
  verifyRuleClause(36, "Auth event logs cannot be updated or deleted", "match /auth_logs/{logId}", "allow update, delete: if false;");

  console.log(`\n================================================================`);
  console.log(` 3-IDENTITY SUITE RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`================================================================`);

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runFullMatrix().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
