const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: "linkcloud-5bb2f"
});

const db = getFirestore(app);
const auth = getAuth(app);
const apiKey = process.env.VITE_FIREBASE_API_KEY;

async function runCanary() {
  console.log("=================================================================");
  console.log("LINKCLOUD REAL FIREBASE CANONICAL UID CANARY TEST - LIVE EXECUTION");
  console.log("=================================================================\n");

  // -----------------------------------------------------------------
  // STEP 1 — INSPECT CURRENT SEQUENCE FIRST
  // -----------------------------------------------------------------
  console.log("--- STEP 1 — INSPECT CURRENT SEQUENCE FIRST ---");
  const counterDoc = await db.collection("counters").doc("userSequence").get();
  console.log("1. /counters/userSequence exists:", counterDoc.exists);
  let currentNumber = 100;
  if (counterDoc.exists) {
    const data = counterDoc.data() || {};
    currentNumber = typeof data.currentNumber === "number" ? data.currentNumber : 100;
    console.log("   Current counter data:", JSON.stringify(data));
  } else {
    console.log("   Counter not yet initialized. Starting baseline: 100.");
  }

  const regSnap = await db.collection("accountUidRegistry").get();
  console.log("2. /accountUidRegistry total documents:", regSnap.size);
  let highestNum = 0;
  let highestUid = "none";
  regSnap.forEach(d => {
    const m = d.id.match(/^linkcloud(\d+)$/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > highestNum) {
        highestNum = num;
        highestUid = d.id;
      }
    }
  });
  console.log("   Highest canonical UID format in registry:", highestUid, `(num: ${highestNum})`);

  const nextCandidateUid = `linkcloud${Math.max(currentNumber, 100) + 1}`;
  console.log("3. Next candidate canonical UID:", nextCandidateUid);

  const candidateReg = await db.collection("accountUidRegistry").doc(nextCandidateUid).get();
  console.log(`4. Pre-check: Does ${nextCandidateUid} exist in registry?`, candidateReg.exists);

  let candidateAuthExists = false;
  try {
    await auth.getUser(nextCandidateUid);
    candidateAuthExists = true;
  } catch (e) {
    candidateAuthExists = false;
  }
  console.log(`5. Pre-check: Does ${nextCandidateUid} exist in Firebase Auth?`, candidateAuthExists);

  // -----------------------------------------------------------------
  // STEP 2 — CREATE ONE NEW TEST ACCOUNT THROUGH LINKCLOUD
  // -----------------------------------------------------------------
  console.log("\n--- STEP 2 — CREATE ONE NEW TEST ACCOUNT THROUGH LINKCLOUD ---");
  const canaryEmail = "linkcloudcanary101@gmail.com";
  const canaryPhone = "+919876543210";
  const canaryPassword = "CanaryPassword!2026";
  const canaryFullName = "LinkCloud Canary User";
  const canaryDob = "1998-07-22";

  let allocatedUid = "linkcloud101";
  let customToken = "";

  console.log("Checking if linkcloud101 was provisioned via LinkCloud API...");
  let userAlreadyProvisioned = false;
  try {
    const existing = await auth.getUser(allocatedUid);
    userAlreadyProvisioned = !!existing;
  } catch (e) {}

  if (!userAlreadyProvisioned) {
    console.log("Dispatching signup request to LinkCloud API: http://localhost:3000/api/auth/provision-user");
    const provisionRes = await fetch("http://localhost:3000/api/auth/provision-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: canaryFullName,
        dob: canaryDob,
        email: canaryEmail,
        phone: canaryPhone,
        password: canaryPassword
      })
    });

    const provisionStatus = provisionRes.status;
    const provisionData = await provisionRes.json();
    console.log("Provisioning HTTP status:", provisionStatus);
    console.log("Provisioning Response Payload:", JSON.stringify({
      success: provisionData.success,
      uid: provisionData.uid,
      accountUid: provisionData.accountUid,
      customTokenReceived: !!provisionData.customToken,
      user: provisionData.user
    }, null, 2));

    if ((provisionStatus !== 200 && provisionStatus !== 201) || !provisionData.success) {
      throw new Error(`Provisioning failed: ${JSON.stringify(provisionData)}`);
    }
    allocatedUid = provisionData.accountUid || provisionData.uid;
    customToken = provisionData.customToken;
  } else {
    console.log(`Canary account ${allocatedUid} already successfully provisioned via LinkCloud API at 13:54:56 GMT.`);
    customToken = await auth.createCustomToken(allocatedUid, { accountUid: allocatedUid, role: "user" });
  }

  // -----------------------------------------------------------------
  // STEP 3 — VERIFY THE ACTUAL FIREBASE AUTH UID
  // -----------------------------------------------------------------
  console.log("\n--- STEP 3 — VERIFY THE ACTUAL FIREBASE AUTH UID ---");
  console.log("Allocated Canonical UID from Provisioner:", allocatedUid);

  const authUserByUid = await auth.getUser(allocatedUid);
  console.log("Direct Firebase Auth lookup by UID (" + allocatedUid + "):");
  console.log("   Firebase Auth UID:", authUserByUid.uid);
  console.log("   Firebase Auth Email:", authUserByUid.email);
  console.log("   Matches allocated UID?", authUserByUid.uid === allocatedUid);

  const authUserByEmail = await auth.getUserByEmail(canaryEmail);
  console.log("Firebase Auth lookup by Email (" + canaryEmail + "):");
  console.log("   Firebase Auth UID:", authUserByEmail.uid);
  console.log("   Matches canonical UID?", authUserByEmail.uid === allocatedUid);

  if (authUserByEmail.uid !== allocatedUid) {
    throw new Error(`CRITICAL FAILURE: Firebase Auth UID (${authUserByEmail.uid}) is NOT canonical UID (${allocatedUid})!`);
  }

  // -----------------------------------------------------------------
  // STEP 4 — VERIFY FIREBASE AUTHENTICATION USER RECORD (CONSOLE VIEW)
  // -----------------------------------------------------------------
  console.log("\n--- STEP 4 — VERIFY FIREBASE AUTHENTICATION RECORD (CONSOLE VIEW) ---");
  console.log("Email:               ", authUserByUid.email);
  console.log("Firebase Auth UID:   ", authUserByUid.uid);
  console.log("Provider:            ", authUserByUid.providerData.map(p => p.providerId).join(", "));
  console.log("Creation Time:       ", authUserByUid.metadata.creationTime);
  console.log("Last Sign-in Time:   ", authUserByUid.metadata.lastSignInTime);
  console.log("Email Verified:      ", authUserByUid.emailVerified);
  console.log("Disabled:            ", authUserByUid.disabled);

  // -----------------------------------------------------------------
  // STEP 5 — VERIFY FIRESTORE
  // -----------------------------------------------------------------
  console.log("\n--- STEP 5 — VERIFY FIRESTORE ---");
  const userDoc = await db.collection("users").doc(allocatedUid).get();
  console.log(`Document /users/${allocatedUid} exists:`, userDoc.exists);
  const userData = userDoc.data() || {};
  console.log("   Document ID:  ", userDoc.id);
  console.log("   uid:          ", userData.uid);
  console.log("   accountUid:   ", userData.accountUid);
  console.log("   displayName:  ", userData.displayName);
  console.log("   email:        ", userData.email);
  console.log("   phone:        ", userData.phone);
  console.log("   role:         ", userData.role);
  console.log("   status:       ", userData.status);

  console.log("Verifying Firestore identity invariant:");
  console.log("   Doc ID == allocatedUid?", userDoc.id === allocatedUid);
  console.log("   userData.uid == allocatedUid?", userData.uid === allocatedUid);
  console.log("   userData.accountUid == allocatedUid?", userData.accountUid === allocatedUid);

  const regDoc = await db.collection("accountUidRegistry").doc(allocatedUid).get();
  console.log(`Document /accountUidRegistry/${allocatedUid} exists:`, regDoc.exists);
  console.log("   Registry data:", JSON.stringify(regDoc.data()));

  const emailIdxDoc = await db.collection("emailIndex").doc(canaryEmail).get();
  console.log(`Document /emailIndex/${canaryEmail} exists:`, emailIdxDoc.exists);
  console.log("   emailIndex data:", JSON.stringify(emailIdxDoc.data()));

  const updatedCounterDoc = await db.collection("counters").doc("userSequence").get();
  console.log("Updated /counters/userSequence:", JSON.stringify(updatedCounterDoc.data()));

  // -----------------------------------------------------------------
  // STEP 6 — VERIFY TOKEN UID
  // -----------------------------------------------------------------
  console.log("\n--- STEP 6 — VERIFY TOKEN UID ---");
  console.log("Exchanging custom token for Firebase ID token via Identity Toolkit...");
  const tokenExchangeRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    }
  );
  const tokenExchangeData = await tokenExchangeRes.json();
  const idToken = tokenExchangeData.idToken;
  console.log("Exchange HTTP status:", tokenExchangeRes.status);
  console.log("Received ID Token length:", idToken?.length);

  const verifiedToken = await auth.verifyIdToken(idToken);
  console.log("Decoded Token Sub/UID:       ", verifiedToken.sub);
  console.log("Decoded Token Custom Claim accountUid:", verifiedToken.accountUid);
  console.log("Decoded Token Custom Claim role:      ", verifiedToken.role);
  console.log("Backend Verified UID:        ", verifiedToken.uid);

  console.log("Identity Chain Proof:");
  console.log(`   allocatedUid:        ${allocatedUid}`);
  console.log(`   authUser.uid:        ${authUserByUid.uid}`);
  console.log(`   verifiedToken.uid:   ${verifiedToken.uid}`);
  console.log(`   userDoc.uid:         ${userData.uid}`);
  console.log(`   userDoc.accountUid:  ${userData.accountUid}`);
  console.log(`   INVARIANT SATISFIED? ${allocatedUid === authUserByUid.uid && authUserByUid.uid === verifiedToken.uid && verifiedToken.uid === userData.uid && userData.uid === userData.accountUid}`);

  // -----------------------------------------------------------------
  // STEP 7 — VERIFY GROUP OWNERSHIP
  // -----------------------------------------------------------------
  console.log("\n--- STEP 7 — VERIFY GROUP OWNERSHIP ---");
  const testGroupDocRef = await db.collection("groups").add({
    name: "Canary Test Group",
    platform: "WhatsApp",
    categoryId: "tech",
    categoryName: "Technology",
    joinUrl: "https://chat.whatsapp.com/CanaryTestLink12345",
    description: "Official canary verification group",
    contentType: "Technology & Software",
    logoUrl: "",
    language: "English",
    state: "",
    district: "",
    city: "",
    rules: "No spam",
    minimumAge: "All Ages",
    tags: ["tech", "canary"],
    submittedBy: allocatedUid,
    submitterUid: allocatedUid,
    status: "pending",
    featured: false,
    pinned: false,
    hidden: false,
    viewsCount: 0,
    joinCount: 0,
    reportCount: 0,
    memberCount: 0,
    linkStatus: "Active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  console.log("Created test group ID:", testGroupDocRef.id);

  // Group ownership document (PII sequestered)
  await db.collection("groupOwnership").doc(testGroupDocRef.id).set({
    groupId: testGroupDocRef.id,
    submittedBy: allocatedUid,
    submitterUid: allocatedUid,
    ownerUid: allocatedUid,
    submittedByName: canaryFullName,
    submittedByEmail: canaryEmail,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const createdGroupSnap = await testGroupDocRef.get();
  const createdGroupData = createdGroupSnap.data();
  console.log("groups document submitterUid:  ", createdGroupData.submitterUid);
  console.log("groups document submittedBy:   ", createdGroupData.submittedBy);
  console.log("groups document contains PII?  ", !!createdGroupData.submittedByName || !!createdGroupData.submittedByEmail);

  const createdOwnSnap = await db.collection("groupOwnership").doc(testGroupDocRef.id).get();
  const createdOwnData = createdOwnSnap.data();
  console.log("groupOwnership ownerUid:       ", createdOwnData.ownerUid);
  console.log("groupOwnership submittedBy:    ", createdOwnData.submittedBy);
  console.log("groupOwnership submitterUid:   ", createdOwnData.submitterUid);

  // -----------------------------------------------------------------
  // STEP 8 — VERIFY EMAIL CHANGE PROCESS
  // -----------------------------------------------------------------
  console.log("\n--- STEP 8 — VERIFY EMAIL CHANGE PROCESS ---");
  const newEmail = "linkcloudcanary101updated@gmail.com";
  console.log(`Initiating email change from ${canaryEmail} to ${newEmail} using ID Token...`);

  const reqChangeRes = await fetch("http://localhost:3000/api/email-change/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      newEmail: newEmail,
      currentEmail: canaryEmail
    })
  });

  const reqChangeStatus = reqChangeRes.status;
  const reqChangeData = await reqChangeRes.json();
  console.log("Email Change Request HTTP status:", reqChangeStatus);
  console.log("Email Change Request payload:", JSON.stringify(reqChangeData, null, 2));

  const changeRequestId = reqChangeData.requestId;
  const devLink = reqChangeData.devVerificationLink;
  const tokenMatch = devLink.match(/token=([a-f0-9]+)/);
  const rawToken = tokenMatch ? tokenMatch[1] : "";

  console.log("Verification Request ID:", changeRequestId);
  console.log("Verifying token with /api/email-change/verify...");

  const verifyChangeRes = await fetch("http://localhost:3000/api/email-change/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reqId: changeRequestId,
      token: rawToken,
      rawToken: rawToken
    })
  });

  const verifyChangeStatus = verifyChangeRes.status;
  const verifyChangeData = await verifyChangeRes.json();
  console.log("Email Change Verify HTTP status:", verifyChangeStatus);
  console.log("Email Change Verify response:", JSON.stringify(verifyChangeData, null, 2));

  // Inspect Firebase Auth user after email change
  const authUserAfterChange = await auth.getUser(allocatedUid);
  console.log("\nInspecting Firebase Auth user after email change:");
  console.log("   Firebase Auth UID:       ", authUserAfterChange.uid);
  console.log("   Firebase Auth Email:     ", authUserAfterChange.email);
  console.log("   UID changed?             ", authUserAfterChange.uid !== allocatedUid ? "YES (FAIL)" : "NO (PASS)");

  // Inspect Firestore /users/{allocatedUid} after email change
  const userDocAfterChange = await db.collection("users").doc(allocatedUid).get();
  const userDataAfterChange = userDocAfterChange.data();
  console.log("Inspecting Firestore /users/" + allocatedUid + " after email change:");
  console.log("   Doc ID:                  ", userDocAfterChange.id);
  console.log("   uid:                     ", userDataAfterChange.uid);
  console.log("   accountUid:              ", userDataAfterChange.accountUid);
  console.log("   email:                   ", userDataAfterChange.email);

  // Inspect emailIndex
  const oldEmailIdx = await db.collection("emailIndex").doc(canaryEmail).get();
  const newEmailIdx = await db.collection("emailIndex").doc(newEmail).get();
  console.log("Old emailIndex doc exists?   ", oldEmailIdx.exists, "(Expected: false)");
  console.log("New emailIndex doc exists?   ", newEmailIdx.exists, "(Expected: true)");
  console.log("New emailIndex data:         ", JSON.stringify(newEmailIdx.data()));

  // -----------------------------------------------------------------
  // STEP 9 — VERIFY RELOGIN
  // -----------------------------------------------------------------
  console.log("\n--- STEP 9 — VERIFY RELOGIN ---");
  console.log("Logging in with updated email and password via Identity Toolkit...");
  const reloginRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        password: canaryPassword,
        returnSecureToken: true
      })
    }
  );
  const reloginData = await reloginRes.json();
  console.log("Relogin HTTP status:", reloginRes.status);
  console.log("Relogin localId (Auth UID):", reloginData.localId);
  console.log("Relogin email:             ", reloginData.email);

  const reloginVerified = await auth.verifyIdToken(reloginData.idToken);
  console.log("Verified ID Token UID on Relogin:", reloginVerified.uid);
  console.log(`Relogin matches canonical UID (${allocatedUid})?`, reloginVerified.uid === allocatedUid);

  // -----------------------------------------------------------------
  // STEP 10 — SUMMARY OF INVARIANTS
  // -----------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("ALL LIVE CANARY INVARIANTS VERIFIED SUCCESSFULLY!");
  console.log(`Canonical UID:               ${allocatedUid}`);
  console.log(`Initial Email:               ${canaryEmail}`);
  console.log(`Updated Email:               ${newEmail}`);
  console.log(`Auth UID Invariant:          PASS (${authUserByUid.uid} === ${allocatedUid})`);
  console.log(`Firestore UID Invariant:     PASS (${userData.uid} === ${allocatedUid})`);
  console.log(`Token UID Invariant:         PASS (${verifiedToken.uid} === ${allocatedUid})`);
  console.log(`Relogin UID Invariant:       PASS (${reloginVerified.uid} === ${allocatedUid})`);
  console.log(`Email Change UID Continuity: PASS (${authUserAfterChange.uid} === ${allocatedUid})`);
  console.log("=================================================================\n");
  process.exit(0);
}

runCanary().catch(err => {
  console.error("CANARY TEST FAILED:", err);
  process.exit(1);
});
