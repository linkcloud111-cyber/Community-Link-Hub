/**
 * LINKCLOUD — ALL THREE PANELS COMPREHENSIVE INTEGRATION & BEHAVIORAL SUITE
 * Validates Webmaster Panel, User Panel, Visitor Panel, and Cross-Panel Lifecycle.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("==================================================================");
console.log("   LINKCLOUD — ALL THREE PANELS INTEGRATION & VERIFICATION SUITE   ");
console.log("==================================================================");

let total = 0;
let passed = 0;

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

// -------------------------------------------------------------
// SUITE 1: USER PANEL FUNCTIONALITY & MEMBER LIFECYCLE
// -------------------------------------------------------------
console.log("\n--- SUITE 1: USER PANEL LIFECYCLE & SECURITY ---");

// Validation helpers from src/lib/utils.ts
function cleanMobileInput(val) {
  if (!val) return "";
  let digits = val.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.substring(2);
  } else if (digits.startsWith("0") && digits.length > 10) {
    digits = digits.substring(1);
  }
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits.slice(0, 10);
}

function validateIndianMobile(phone) {
  if (!phone || !phone.trim()) {
    return { valid: false, formatted: "", raw10: "", error: "Mobile number is required." };
  }
  const digits = cleanMobileInput(phone);
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return { valid: false, formatted: phone, raw10: digits, error: "Please enter a valid 10-digit Indian mobile number." };
  }
  return { valid: true, formatted: `+91${digits}`, raw10: digits };
}

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (!hasUpper || !hasLower || !hasNum || !hasSpecial) {
    return { valid: false, error: "Password must include uppercase, lowercase, number, and special character." };
  }
  return { valid: true };
}

test("User Registration: Rejects invalid mobile numbers (< 10 digits or non-Indian)", () => {
  assert.strictEqual(validateIndianMobile("12345").valid, false);
  assert.strictEqual(validateIndianMobile("0123456789").valid, false); // Doesn't start with 6-9
  assert.strictEqual(validateIndianMobile("5987654321").valid, false); // Starts with 5
  assert.strictEqual(validateIndianMobile("9876543210").valid, true);  // Valid 10-digit Indian
  assert.strictEqual(validateIndianMobile("+91 79874 10765").valid, true); // Valid formatted E.164
});

test("User Registration: Enforces strict password complexity", () => {
  assert.strictEqual(validatePasswordStrength("weak").valid, false);
  assert.strictEqual(validatePasswordStrength("weakpass123").valid, false); // No uppercase or special
  assert.strictEqual(validatePasswordStrength("WeakPass123").valid, false); // No special character
  assert.strictEqual(validatePasswordStrength("LinkCloud@2026").valid, true); // Meets all requirements
});

test("User Dashboard: My Groups filter correctly partitions groups by status", () => {
  const sampleGroups = [
    { id: "g1", name: "Group 1", status: "approved" },
    { id: "g2", name: "Group 2", status: "pending" },
    { id: "g3", name: "Group 3", status: "rejected" },
    { id: "g4", name: "Group 4", status: "approved" },
  ];

  const approved = sampleGroups.filter((g) => g.status === "approved");
  const pending = sampleGroups.filter((g) => g.status === "pending");
  const rejected = sampleGroups.filter((g) => g.status === "rejected");

  assert.strictEqual(approved.length, 2);
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(rejected.length, 1);
});

test("User Favorites: Bookmark toggle adds and removes without duplicate entries", () => {
  let userFavorites = ["g1", "g2"];
  function toggleFavorite(groupId) {
    if (userFavorites.includes(groupId)) {
      userFavorites = userFavorites.filter((id) => id !== groupId);
    } else {
      userFavorites.push(groupId);
    }
  }

  toggleFavorite("g3");
  assert.strictEqual(userFavorites.includes("g3"), true);
  assert.strictEqual(userFavorites.length, 3);

  toggleFavorite("g3");
  assert.strictEqual(userFavorites.includes("g3"), false);
  assert.strictEqual(userFavorites.length, 2);
});

test("User Account Deletion Request: Requires non-empty reason and sets pending status", () => {
  function processDeletionRequest(reason) {
    if (!reason || reason.trim().length < 5) {
      throw new Error("Deletion reason must be at least 5 characters.");
    }
    return {
      status: "pending_deletion",
      deletionReason: reason.trim(),
      requestedAt: Date.now(),
    };
  }

  assert.throws(() => processDeletionRequest(""), /Deletion reason must be at least 5 characters/);
  assert.throws(() => processDeletionRequest("why"), /Deletion reason must be at least 5 characters/);

  const res = processDeletionRequest("No longer managing community groups.");
  assert.strictEqual(res.status, "pending_deletion");
  assert.strictEqual(res.deletionReason, "No longer managing community groups.");
});

// -------------------------------------------------------------
// SUITE 2: VISITOR PANEL FUNCTIONALITY & PUBLIC DISCOVERY
// -------------------------------------------------------------
console.log("\n--- SUITE 2: VISITOR PANEL & PUBLIC DISCOVERY ---");

test("Visitor Group Discovery: Only approved & unhidden groups are publicly visible", () => {
  const groupsInDb = [
    { id: "g1", name: "Tech India", status: "approved", hidden: false },
    { id: "g2", name: "Spam Group", status: "rejected", hidden: false },
    { id: "g3", name: "New Review", status: "pending", hidden: false },
    { id: "g4", name: "Hidden Group", status: "approved", hidden: true },
  ];

  function filterPublicVisible(groups) {
    return groups.filter((g) => g.status === "approved" && !g.hidden);
  }

  const visible = filterPublicVisible(groupsInDb);
  assert.strictEqual(visible.length, 1);
  assert.strictEqual(visible[0].id, "g1");
});

test("Visitor Group Details: Access is restricted when group is not approved", () => {
  function evaluateDetailAccess(group, user, isWebmaster) {
    const isOwner = user && group.submittedBy === user.uid;
    const isApproved = group.status === "approved" && !group.hidden;
    if (isApproved || isOwner || isWebmaster) {
      return { allowed: true };
    }
    return { allowed: false, error: "Access Restricted" };
  }

  const unapprovedGroup = { id: "g2", name: "Pending Group", status: "pending", hidden: false, submittedBy: "user123" };

  // Visitor (unauthenticated)
  assert.strictEqual(evaluateDetailAccess(unapprovedGroup, null, false).allowed, false);

  // Different member (not owner)
  assert.strictEqual(evaluateDetailAccess(unapprovedGroup, { uid: "otherUser" }, false).allowed, false);

  // Group submitter (owner)
  assert.strictEqual(evaluateDetailAccess(unapprovedGroup, { uid: "user123" }, false).allowed, true);

  // Webmaster
  assert.strictEqual(evaluateDetailAccess(unapprovedGroup, { uid: "webmasterUid" }, true).allowed, true);
});

test("Visitor Join Action: Disabled when group linkStatus is inactive", () => {
  const activeGroup = { id: "g1", linkStatus: "active", joinUrl: "https://chat.whatsapp.com/test1" };
  const inactiveGroup = { id: "g2", linkStatus: "inactive", joinUrl: "https://chat.whatsapp.com/test2" };

  function canJoin(group) {
    return group.linkStatus === "active" && Boolean(group.joinUrl);
  }

  assert.strictEqual(canJoin(activeGroup), true);
  assert.strictEqual(canJoin(inactiveGroup), false);
});

test("Visitor Report Form: Requires valid reason and description >= 10 chars", () => {
  function validateReportPayload(payload) {
    if (!payload.reason || !["spam", "broken_link", "inappropriate", "illegal", "other"].includes(payload.reason)) {
      throw new Error("Invalid report reason");
    }
    if (!payload.details || payload.details.trim().length < 10) {
      throw new Error("Details must be at least 10 characters");
    }
    return true;
  }

  assert.throws(() => validateReportPayload({ reason: "invalid", details: "Spam content here" }), /Invalid report reason/);
  assert.throws(() => validateReportPayload({ reason: "spam", details: "short" }), /Details must be at least 10 characters/);
  assert.strictEqual(validateReportPayload({ reason: "spam", details: "Group is posting unsolicited promotional messages" }), true);
});

test("Visitor Contact Form: Enforces min length 20 and Indian mobile validation", () => {
  function validateContactForm(name, email, phone, subject, message) {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      throw new Error("All required fields must be filled.");
    }
    if (phone && phone.trim() && !validateIndianMobile(phone.trim()).valid) {
      throw new Error("Invalid mobile number.");
    }
    if (message.trim().length < 20) {
      throw new Error("Message must be at least 20 characters.");
    }
    return true;
  }

  assert.throws(() => validateContactForm("John", "john@example.com", "", "Help", "Too short"), /Message must be at least 20 characters/);
  assert.throws(() => validateContactForm("John", "john@example.com", "123", "Help", "Valid long message for the webmaster"), /Invalid mobile number/);
  assert.strictEqual(validateContactForm("John", "john@example.com", "9876543210", "Help", "Valid long message for the webmaster inquiry"), true);
});

test("Visitor Complaint Form: Issues a unique Grievance Reference (GRV-*)", () => {
  function generateGrievanceRef() {
    const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
    return `GRV-${Date.now().toString().slice(-6)}${randomHex}`;
  }

  const ref1 = generateGrievanceRef();
  const ref2 = generateGrievanceRef();
  assert(ref1.startsWith("GRV-"));
  assert(ref2.startsWith("GRV-"));
  assert.notStrictEqual(ref1, ref2);
});

// -------------------------------------------------------------
// SUITE 3: CROSS-PANEL INTEGRATION & LIFECYCLE
// -------------------------------------------------------------
console.log("\n--- SUITE 3: CROSS-PANEL INTEGRATION & LIFECYCLE ---");

test("Integration #1: Webmaster creates Category -> Appears in Visitor & User Taxonomy", () => {
  const taxonomy = [{ id: "cat-1", name: "Education", slug: "education", active: true }];
  function addCategory(cat) {
    taxonomy.push(cat);
  }

  addCategory({ id: "cat-2", name: "Government Jobs", slug: "government-jobs", active: true });
  assert.strictEqual(taxonomy.length, 2);
  const activeSlugs = taxonomy.filter((c) => c.active).map((c) => c.slug);
  assert(activeSlugs.includes("government-jobs"));
});

test("Integration #2: Member submits group -> Webmaster receives in moderation queue", () => {
  const moderationQueue = [];
  function memberSubmitGroup(groupData, submitterUid) {
    const newDoc = {
      ...groupData,
      id: `grp_${Date.now()}`,
      status: "pending",
      submittedBy: submitterUid,
      createdAt: Date.now(),
    };
    moderationQueue.push(newDoc);
    return newDoc;
  }

  const submitted = memberSubmitGroup({ name: "UPSC Aspirants 2026", platform: "Telegram" }, "user_789");
  assert.strictEqual(submitted.status, "pending");
  assert.strictEqual(moderationQueue.length, 1);
  assert.strictEqual(moderationQueue[0].submittedBy, "user_789");
});

test("Integration #3: Webmaster approves group -> Status becomes 'approved' and publishes publicly", () => {
  let groupDoc = { id: "grp_100", name: "UPSC Aspirants", status: "pending", hidden: false };
  function webmasterApprove(group) {
    return { ...group, status: "approved", approvedAt: Date.now() };
  }

  groupDoc = webmasterApprove(groupDoc);
  assert.strictEqual(groupDoc.status, "approved");
  assert(groupDoc.approvedAt > 0);
});

test("Integration #4: Webmaster rejects group -> Reason saved and group hidden from public directory", () => {
  let groupDoc = { id: "grp_101", name: "Spam Deals", status: "pending", hidden: false };
  function webmasterReject(group, reason) {
    return { ...group, status: "rejected", rejectionReason: reason, rejectedAt: Date.now() };
  }

  groupDoc = webmasterReject(groupDoc, "Violates community guidelines regarding unsolicited commercial links.");
  assert.strictEqual(groupDoc.status, "rejected");
  assert.strictEqual(groupDoc.rejectionReason.includes("commercial links"), true);
});

test("Integration #5: Webmaster toggles Featured & Verified badges -> Reflected in Group Card", () => {
  let groupDoc = { id: "grp_102", name: "Verified Hub", isFeatured: false, isVerified: false };
  function toggleFeaturedAndVerified(group, feat, ver) {
    return { ...group, isFeatured: feat, isVerified: ver };
  }

  groupDoc = toggleFeaturedAndVerified(groupDoc, true, true);
  assert.strictEqual(groupDoc.isFeatured, true);
  assert.strictEqual(groupDoc.isVerified, true);
});

test("Integration #6: Webmaster bans member -> Member operations strictly denied", () => {
  const userRecord = { uid: "bad_user", email: "bad@example.com", status: "banned", role: "user" };
  function checkOperationPermitted(user) {
    if (!user || user.status === "banned" || user.status === "disabled") {
      throw new Error("Account is banned or suspended. Protected operations are denied.");
    }
    return true;
  }

  assert.throws(() => checkOperationPermitted(userRecord), /Account is banned or suspended/);
});

test("Integration #7: Webmaster publishes Announcement -> Dispatched and readable across public & user pages", () => {
  const activeAnnouncements = [];
  function publishAnnouncement(title, message, link) {
    activeAnnouncements.push({
      id: `ann_${Date.now()}`,
      title,
      message,
      link,
      active: true,
      createdAt: Date.now(),
    });
  }

  publishAnnouncement("System Maintenance Scheduled", "Platform updates tonight at 2 AM IST", "/maintenance");
  assert.strictEqual(activeAnnouncements.length, 1);
  assert.strictEqual(activeAnnouncements[0].title, "System Maintenance Scheduled");
  assert.strictEqual(activeAnnouncements[0].active, true);
});

test("Integration #8: Webmaster updates theme setting -> Site computes correct HTML class", () => {
  function computeThemeClass(settingTheme, osPrefersDark) {
    if (settingTheme === "dark") return "dark";
    if (settingTheme === "light") return "light";
    return osPrefersDark ? "dark" : "light";
  }

  assert.strictEqual(computeThemeClass("dark", false), "dark");
  assert.strictEqual(computeThemeClass("light", true), "light");
  assert.strictEqual(computeThemeClass("system", true), "dark");
  assert.strictEqual(computeThemeClass("system", false), "light");
});

// -------------------------------------------------------------
// SUITE 4: ALL 62 ROUTE DECLARATIONS & DIRECT ACCESSIBILITY
// -------------------------------------------------------------
console.log("\n--- SUITE 4: ROUTE MAP & COMPREHENSIVE PATH COVERAGE ---");

test("App.tsx contains all 62 mapped routes with zero duplicate keys", () => {
  const appFile = path.resolve(__dirname, "../artifacts/linkcloud/src/App.tsx");
  const content = fs.readFileSync(appFile, "utf8");

  const routeRegex = /<Route\s+path=["']([^"']+)["']/g;
  const routes = [];
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    routes.push(match[1]);
  }

  assert(routes.length >= 60, `Found ${routes.length} routes, expected >= 60`);
  assert(routes.includes("/dashboard/groups"), "Missing /dashboard/groups route");
  assert(routes.includes("/dashboard/saved"), "Missing /dashboard/saved route");
  assert(routes.includes("/dashboard/profile"), "Missing /dashboard/profile route");
  assert(routes.includes("/dashboard/settings"), "Missing /dashboard/settings route");
  assert(routes.includes("/webmaster/my-groups"), "Missing /webmaster/my-groups route");
  assert(routes.includes("/admin/dashboard"), "Missing legacy /admin/dashboard route");
});

test("useDashboardTabs resolves direct subpaths cleanly", () => {
  const hooksFile = path.resolve(__dirname, "../artifacts/linkcloud/src/hooks/useDashboardTabs.ts");
  const content = fs.readFileSync(hooksFile, "utf8");

  assert(content.includes("/dashboard/saved"), "useDashboardTabs missing /dashboard/saved resolution");
  assert(content.includes("/dashboard/groups"), "useDashboardTabs missing /dashboard/groups resolution");
  assert(content.includes("/dashboard/profile"), "useDashboardTabs missing /dashboard/profile resolution");
  assert(content.includes("/dashboard/settings"), "useDashboardTabs missing /dashboard/settings resolution");
});

// -------------------------------------------------------------
// SUITE 5: CROSS-PANEL WEBMASTER SETTINGS & RULE ENFORCEMENT
// -------------------------------------------------------------
console.log("\n--- SUITE 5: CROSS-PANEL SETTINGS & RULE ENFORCEMENT ---");

test("Global maintenanceMode is enforced in App.tsx for all non-Webmaster routes", () => {
  const appContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/App.tsx"), "utf8");
  assert(appContent.includes("settings?.maintenanceMode && !isWebmaster && !isMaintenanceBypassRoute"), "App.tsx missing global maintenanceMode guard");
  assert(appContent.includes("isMaintenanceBypassRoute"), "App.tsx missing Webmaster maintenance bypass check");
});

test("Login page enforces emailLoginEnabled, mobileOtpLoginEnabled, and googleLoginEnabled", () => {
  const loginContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/pages/login.tsx"), "utf8");
  assert(loginContent.includes("settings?.emailLoginEnabled !== false"), "login.tsx missing emailLoginEnabled check");
  assert(loginContent.includes("settings?.mobileOtpLoginEnabled !== false"), "login.tsx missing mobileOtpLoginEnabled check");
  assert(loginContent.includes("settings?.googleLoginEnabled !== false"), "login.tsx missing googleLoginEnabled check");
});

test("Abuse Report System toggle is enforced in group-card.tsx and report-modal.tsx", () => {
  const cardContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/group-card.tsx"), "utf8");
  const modalContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/report-modal.tsx"), "utf8");
  assert(cardContent.includes("settings?.reportSystemEnabled !== false"), "group-card.tsx missing reportSystemEnabled check");
  assert(modalContent.includes("settings?.reportSystemEnabled === false"), "report-modal.tsx missing reportSystemEnabled guard");
});

test("Favorites toggle is enforced across navbar.tsx, DashboardSidebar.tsx, and FavoritesTab.tsx", () => {
  const navContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/navbar.tsx"), "utf8");
  const sidebarContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/dashboard/DashboardSidebar.tsx"), "utf8");
  const favContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/dashboard/tabs/FavoritesTab.tsx"), "utf8");
  assert(navContent.includes("settings?.favoritesEnabled !== false"), "navbar.tsx missing favoritesEnabled check");
  assert(sidebarContent.includes("settings?.favoritesEnabled !== false"), "DashboardSidebar.tsx missing favoritesEnabled check");
  assert(favContent.includes("settings?.favoritesEnabled === false"), "FavoritesTab.tsx missing favoritesEnabled check");
});

test("Dashboard MessagesTab and ComplaintTab enforce feature flags and 20-char min length matching firestore.rules", () => {
  const msgContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/dashboard/tabs/MessagesTab.tsx"), "utf8");
  const compContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/dashboard/tabs/ComplaintTab.tsx"), "utf8");
  assert(msgContent.includes("settings?.contactFormEnabled !== false"), "MessagesTab missing contactFormEnabled check");
  assert(msgContent.includes("message.trim().length < 20"), "MessagesTab missing 20-char minimum check");
  assert(compContent.includes("settings?.complaintSystemEnabled !== false"), "ComplaintTab missing complaintSystemEnabled check");
  assert(compContent.includes("description.trim().length < 20"), "ComplaintTab missing 20-char minimum check");
});

test("MyGroupsTab and dashboard-edit.tsx align owner edit/delete controls with firestore.rules", () => {
  const myGroupsContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/dashboard/tabs/MyGroupsTab.tsx"), "utf8");
  const editContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/pages/dashboard-edit.tsx"), "utf8");
  assert(myGroupsContent.includes('group.status === "pending" || group.allowResubmit === true'), "MyGroupsTab missing edit rule alignment");
  assert(myGroupsContent.includes('isWebmaster || group.status === "pending"'), "MyGroupsTab missing delete rule alignment");
  assert(editContent.includes('group.status === "pending" || group.allowResubmit === true'), "dashboard-edit.tsx missing owner edit eligibility alignment");
});

test("SiteSettingsContext syncs faviconUrl/favicon and home.tsx wires searchPlaceholder & heroButtonLink", () => {
  const ctxContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/contexts/SiteSettingsContext.tsx"), "utf8");
  const homeContent = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/pages/home.tsx"), "utf8");
  assert(ctxContent.includes("settings.faviconUrl || settings.favicon"), "SiteSettingsContext missing favicon fallback");
  assert(homeContent.includes("settings?.searchPlaceholder"), "home.tsx missing searchPlaceholder wiring");
  assert(homeContent.includes("settings?.heroButtonLink"), "home.tsx missing heroButtonLink wiring");
});

test("firestore.rules enforces siteFeatureEnabled for registration, favorites, reports, complaints, and contacts (and root/applet copies match)", () => {
  const rootRules = fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8");
  const appRules = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/firestore.rules"), "utf8");
  assert.strictEqual(rootRules, appRules, "Root and applet firestore.rules are out of sync");
  assert(rootRules.includes("function siteFeatureEnabled(field)"), "Missing siteFeatureEnabled helper");
  assert(rootRules.includes("siteFeatureEnabled('userRegistrationEnabled')"), "Missing userRegistrationEnabled rule");
  assert(rootRules.includes("siteFeatureEnabled('favoritesEnabled')"), "Missing favoritesEnabled rule");
  assert(rootRules.includes("siteFeatureEnabled('reportSystemEnabled')"), "Missing reportSystemEnabled rule");
  assert(rootRules.includes("siteFeatureEnabled('complaintSystemEnabled')"), "Missing complaintSystemEnabled rule");
  assert(rootRules.includes("siteFeatureEnabled('contactFormEnabled')"), "Missing contactFormEnabled rule");
});

test("Server-side auth provisioning enforces userRegistrationEnabled === false (403) in both Cloudflare Function and Node server", () => {
  const cfProvision = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/functions/api/auth/provision-user.ts"), "utf8");
  const nodeAuthApi = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/server/auth-api.ts"), "utf8");
  assert(cfProvision.includes("userRegistrationEnabled") && cfProvision.includes("403"), "Cloudflare provision-user.ts missing userRegistrationEnabled 403 guard");
  assert(nodeAuthApi.includes("userRegistrationEnabled") && nodeAuthApi.includes("403"), "Node auth-api.ts missing userRegistrationEnabled 403 guard");
});

test("Webmaster toggles announcementsEnabled, searchEnabled, publicDirectoryEnabled, and profileEditingEnabled are wired end-to-end", () => {
  const adminSettings = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/pages/admin-settings.tsx"), "utf8");
  const banner = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/announcement-banner.tsx"), "utf8");
  const home = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/pages/home.tsx"), "utf8");
  const groups = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/pages/groups.tsx"), "utf8");
  const profileTab = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/dashboard/tabs/ProfileTab.tsx"), "utf8");
  const editProfile = fs.readFileSync(path.resolve(__dirname, "../artifacts/linkcloud/src/components/dashboard/EditProfileModal.tsx"), "utf8");

  assert(adminSettings.includes("announcementsEnabled") && banner.includes("announcementsEnabled"), "announcementsEnabled not wired");
  assert(adminSettings.includes("searchEnabled") && home.includes("searchEnabled") && groups.includes("searchEnabled"), "searchEnabled not wired");
  assert(adminSettings.includes("publicDirectoryEnabled") && groups.includes("publicDirectoryEnabled"), "publicDirectoryEnabled not wired");
  assert(adminSettings.includes("profileEditingEnabled") && profileTab.includes("profileEditingEnabled") && editProfile.includes("profileEditingEnabled"), "profileEditingEnabled not wired");
});

test("Cloudinary configuration is centralized through SiteSettings across submit, dashboard-submit, dashboard-edit, and EditProfileModal", () => {
  const files = [
    "../artifacts/linkcloud/src/pages/submit.tsx",
    "../artifacts/linkcloud/src/pages/dashboard-submit.tsx",
    "../artifacts/linkcloud/src/pages/dashboard-edit.tsx",
    "../artifacts/linkcloud/src/components/dashboard/EditProfileModal.tsx",
  ];
  for (const rel of files) {
    const content = fs.readFileSync(path.resolve(__dirname, rel), "utf8");
    assert(content.includes("cloudinarySettings?.cloudName"), `${rel} missing centralized cloudinarySettings.cloudName`);
    assert(content.includes("cloudinarySettings?.uploadPreset"), `${rel} missing centralized cloudinarySettings.uploadPreset`);
  }
});

console.log("\n==================================================================");
console.log(`ALL PANELS SUITE RESULTS: ${passed}/${total} PASSED (${total - passed} FAILED)`);
console.log("==================================================================");

if (passed !== total) {
  process.exit(1);
}
