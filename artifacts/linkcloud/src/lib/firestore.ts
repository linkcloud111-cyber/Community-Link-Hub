import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch,
  onSnapshot,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type {
  Group,
  UserProfile,
  Category,
  PlatformItem,
  ContentTypeItem,
  LanguageItem,
  LocationState,
  LocationDistrict,
  LocationCity,
  Report,
  ContactMessage,
  Complaint,
  Notification,
  Favorite,
  SiteSettings,
  GroupFilters,
  DeletionRequest,
  AccountStatus,
} from "./types";
import { INDIA_STATES } from "./india-data";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PLATFORMS,
  DEFAULT_CONTENT_TYPES,
  DEFAULT_LANGUAGES,
  DEFAULT_LOCATION_STATES,
  DEFAULT_LOCATION_DISTRICTS,
} from "./default-taxonomies";

export {
  DEFAULT_CATEGORIES,
  DEFAULT_PLATFORMS,
  DEFAULT_CONTENT_TYPES,
  DEFAULT_LANGUAGES,
  DEFAULT_LOCATION_STATES,
  DEFAULT_LOCATION_DISTRICTS,
};

async function isCurrentUserWebmaster(): Promise<boolean> {
  try {
    if (!auth?.currentUser || !db || typeof db !== "object" || !("app" in db)) {
      return false;
    }
    const uid = auth.currentUser.uid;
    const wmSnap = await getDoc(doc(db, "webmaster", uid));
    if (wmSnap.exists()) {
      const data = wmSnap.data();
      if (data?.active === true || data?.role === "webmaster" || data?.status === "active") {
        return true;
      }
    }
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data?.role === "webmaster" && data?.status === "active") {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupFromDoc(snap: DocumentSnapshot | QueryDocumentSnapshot): Group {
  return { id: snap.id, ...snap.data() } as Group;
}

/**
 * Strips PII (submittedByName, submittedByEmail, submittedBy) from public group records
 * to strictly prevent forensic data leakage to unauthenticated or unauthorized visitors.
 */
export function sanitizePublicGroup(group: Group): Group {
  if (!group) return group;
  const currentUid = auth?.currentUser?.uid;
  if (currentUid && (group.submittedBy === currentUid || group.submitterUid === currentUid)) {
    return group;
  }
  const { submittedByName, submittedByEmail, submittedBy, submitterUid, ...sanitized } = group as any;
  return sanitized as Group;
}

// ─── Groups ───────────────────────────────────────────────────────────────────

// Fetch all approved groups (ignoring hidden groups for public directory)
async function getAllApproved(): Promise<Group[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const q = query(collection(db, "groups"), where("status", "==", "approved"));
    const snap = await getDocs(q);
    const docs = snap.docs.map(groupFromDoc).map(sanitizePublicGroup);

    // Fetch disabled locations to enforce location disable logic
    const disabledStateSet = new Set<string>();
    const disabledDistrictSet = new Set<string>();
    const disabledCitySet = new Set<string>();

    try {
      const [stSnap, distSnap, citySnap] = await Promise.all([
        getDocs(collection(db, "states")),
        getDocs(collection(db, "districts")),
        getDocs(collection(db, "cities")),
      ]);

      stSnap.forEach((d) => {
        const data = d.data();
        if (data.enabled === false && data.name) {
          disabledStateSet.add(data.name.toLowerCase());
        }
      });

      distSnap.forEach((d) => {
        const data = d.data();
        if (data.enabled === false && data.name) {
          disabledDistrictSet.add(`${data.stateName || ""}:${data.name}`.toLowerCase());
        }
      });

      citySnap.forEach((d) => {
        const data = d.data();
        if (data.enabled === false && data.name) {
          disabledCitySet.add(`${data.stateName || ""}:${data.name}`.toLowerCase());
        }
      });
    } catch (e) {
      console.warn("Error fetching disabled locations in getAllApproved:", e);
    }

    // Filter out hidden groups and groups in disabled locations
    const publicApproved = docs.filter((g) => {
      if (g.hidden === true) return false;
      if (g.state && disabledStateSet.has(g.state.toLowerCase())) return false;
      if (g.district && disabledDistrictSet.has(`${g.state || ""}:${g.district}`.toLowerCase())) return false;
      if (g.city && disabledCitySet.has(`${g.state || ""}:${g.city}`.toLowerCase())) return false;
      return true;
    });

    return publicApproved.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
  } catch (err) {
    console.warn("Error getting approved groups:", err);
    return [];
  }
}

export async function getApprovedGroups(filters?: GroupFilters): Promise<Group[]> {
  const all = await getAllApproved();
  if (!filters) return all;

  let filtered = all.filter((g) => {
    if (filters.platform && g.platform !== filters.platform) return false;
    if (filters.categoryId) {
      const catTarget = filters.categoryId.toLowerCase().trim();
      const gCatId = (g.categoryId || "").toLowerCase().trim();
      const gCatName = (g.categoryName || "").toLowerCase().trim();
      const gCatSlug = slugify(gCatName);
      if (gCatId !== catTarget && gCatName !== catTarget && gCatSlug !== catTarget) return false;
    }
    if (filters.contentType && g.contentType && g.contentType !== filters.contentType) return false;
    if (filters.language && g.language && g.language.toLowerCase() !== filters.language.toLowerCase()) return false;
    if (filters.state && g.state !== filters.state) return false;
    if (filters.district && g.district !== filters.district) return false;
    if (filters.city) {
      const c = filters.city.toLowerCase();
      if (!g.city?.toLowerCase().includes(c)) return false;
    }
    if (filters.linkStatus && filters.linkStatus !== "all") {
      const gStatus = g.linkStatus ? g.linkStatus.toLowerCase() : "active";
      if (gStatus !== filters.linkStatus.toLowerCase()) return false;
    }
    if (filters.featured !== undefined && g.featured !== filters.featured) return false;

    if (filters.search) {
      const queryRaw = filters.search.toLowerCase().trim();
      if (queryRaw) {
        const tokens = queryRaw.split(/\s+/).filter(Boolean);

        const nameText = (g.name || "").toLowerCase();
        const descText = (g.description || "").toLowerCase();
        const catText = (g.categoryName || "").toLowerCase();
        const platText = (g.platform || "").toLowerCase();
        const contentText = (g.contentType || "").toLowerCase();
        const langText = (g.language || "").toLowerCase();
        const stateText = (g.state || "").toLowerCase();
        const distText = (g.district || "").toLowerCase();
        const cityText = (g.city || "").toLowerCase();
        const minAgeStr = g.minimumAge !== undefined && g.minimumAge !== null ? String(g.minimumAge).toLowerCase() : "";
        const minAgePlus = minAgeStr ? `${minAgeStr}+` : "";
        const tagsArr = Array.isArray(g.tags) ? g.tags.map((t) => (t || "").toLowerCase()) : [];
        const tagsCombined = tagsArr.join(" ");

        const allSearchableFields = [
          nameText,
          descText,
          catText,
          platText,
          contentText,
          langText,
          stateText,
          distText,
          cityText,
          minAgeStr,
          minAgePlus,
          tagsCombined,
          ...tagsArr,
        ];

        // Direct match of full query in any field
        const directMatch = allSearchableFields.some((field) => field.includes(queryRaw));

        // Token match: every token in search query appears in at least one field
        const allTokensMatch = tokens.every((token) =>
          allSearchableFields.some((field) => field.includes(token))
        );

        // Any token match for loose matching
        const anyTokenMatches = tokens.some((token) =>
          allSearchableFields.some((field) => field.includes(token))
        );

        if (!directMatch && !allTokensMatch && !anyTokenMatches) {
          return false;
        }
      }
    }
    return true;
  });

  if (filters.sortBy) {
    if (filters.sortBy === "popular" || filters.sortBy === "most_joined") {
      filtered.sort((a, b) => (b.joinCount ?? 0) - (a.joinCount ?? 0));
    } else if (filters.sortBy === "most_viewed") {
      filtered.sort((a, b) => (b.viewsCount ?? 0) - (a.viewsCount ?? 0));
    } else if (filters.sortBy === "featured") {
      filtered.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
      });
    } else if (filters.sortBy === "a-z") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (filters.sortBy === "z-a") {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else if (filters.sortBy === "oldest") {
      filtered.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    } else if (filters.sortBy === "latest" || filters.sortBy === "newest") {
      filtered.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    }
  }

  return filtered;
}

export async function getRelatedGroups(group: Group, limitCount = 4): Promise<Group[]> {
  const all = await getAllApproved();
  const candidates = all.filter((g) => g.id !== group.id);

  // Score each candidate by similarity
  const scored = candidates.map((g) => {
    let score = 0;
    if (g.platform === group.platform) score += 4;
    if (g.categoryId === group.categoryId) score += 3;
    if (g.contentType && g.contentType === group.contentType) score += 2;
    if (g.language && group.language && g.language.toLowerCase() === group.language.toLowerCase()) score += 1;
    if (g.state && group.state && g.state === group.state) score += 1;
    return { group: g, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limitCount).map((s) => s.group);
}

export async function getFeaturedGroups(): Promise<Group[]> {
  const all = await getAllApproved();
  return all.filter((g) => g.featured).slice(0, 8);
}

export async function getTrendingGroups(): Promise<Group[]> {
  const all = await getAllApproved();
  return all
    .filter((g) => g.trending)
    .sort((a, b) => (b.joinCount ?? 0) - (a.joinCount ?? 0))
    .slice(0, 8);
}

export async function getLatestGroups(): Promise<Group[]> {
  const all = await getAllApproved();
  return all.slice(0, 12);
}

export async function getGroupById(id: string): Promise<Group | null> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return null;
    const snap = await getDoc(doc(db, "groups", id));
    if (!snap.exists()) return null;
    return sanitizePublicGroup(groupFromDoc(snap));
  } catch (err) {
    console.warn("Error fetching group by ID:", err);
    return null;
  }
}

export async function getPendingGroups(): Promise<Group[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const q = query(collection(db, "groups"), where("status", "==", "pending"));
    const snap = await getDocs(q);
    const docs = snap.docs.map(groupFromDoc);
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (err) {
    console.warn("Error fetching pending groups:", err);
    return [];
  }
}

export async function getAllGroupsAdmin(): Promise<Group[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const snap = await getDocs(collection(db, "groups"));
    const docs = snap.docs.map(groupFromDoc);
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (err) {
    console.warn("Error fetching admin groups:", err);
    return [];
  }
}

export async function getUserGroups(uid: string): Promise<Group[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db) || !uid) return [];
    const map = new Map<string, Group>();
    
    // 1. Direct query by submittedBy
    const q1 = query(collection(db, "groups"), where("submittedBy", "==", uid));
    const snap1 = await getDocs(q1);
    snap1.docs.forEach((d) => {
      map.set(d.id, groupFromDoc(d));
    });

    // 2. Query protected groupOwnership by submittedBy
    try {
      const qOwn = query(collection(db, "groupOwnership"), where("submittedBy", "==", uid));
      const snapOwn = await getDocs(qOwn);
      for (const ownDoc of snapOwn.docs) {
        const gId = ownDoc.id;
        if (!map.has(gId)) {
          const gDoc = await getDoc(doc(db, "groups", gId));
          if (gDoc.exists()) {
            map.set(gDoc.id, groupFromDoc(gDoc));
          }
        }
      }
    } catch {}

    try {
      const q2 = query(collection(db, "groups"), where("userId", "==", uid));
      const snap2 = await getDocs(q2);
      snap2.docs.forEach((d) => {
        map.set(d.id, groupFromDoc(d));
      });
    } catch {}

    const docs = Array.from(map.values());
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (err) {
    console.warn("Error fetching user groups:", err);
    return [];
  }
}

export async function checkDuplicateGroup(
  name: string,
  joinUrl: string,
  excludeGroupId?: string
): Promise<{ duplicateName: boolean; duplicateUrl: boolean }> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return { duplicateName: false, duplicateUrl: false };

    const urlClean = joinUrl.trim().toLowerCase();
    const nameClean = name.trim().toLowerCase();

    if (!urlClean && !nameClean) return { duplicateName: false, duplicateUrl: false };

    const snap = await getDocs(collection(db, "groups"));
    let duplicateName = false;
    let duplicateUrl = false;

    snap.forEach((d) => {
      if (excludeGroupId && d.id === excludeGroupId) return;
      const data = d.data();
      if (nameClean && data.name && data.name.trim().toLowerCase() === nameClean) {
        duplicateName = true;
      }
      if (urlClean && data.joinUrl && data.joinUrl.trim().toLowerCase() === urlClean) {
        duplicateUrl = true;
      }
    });

    return { duplicateName, duplicateUrl };
  } catch (err) {
    console.warn("Error checking duplicate group:", err);
    return { duplicateName: false, duplicateUrl: false };
  }
}

export async function createGroup(
  data: Partial<Group> & {
    name: string;
    platform: Platform;
    categoryId: string;
    categoryName: string;
    joinUrl: string;
    description: string;
    submittedBy: string;
    submittedByName: string;
  }
): Promise<string> {
  const { submittedByName, submittedByEmail, ...publicGroupData } = data;
  const ref = await addDoc(collection(db, "groups"), {
    ...publicGroupData,
    contentType: data.contentType || "General Discussion",
    logoUrl: data.logoUrl || "",
    description: data.description,
    language: data.language || "Hindi",
    state: data.state || "",
    district: data.district || "",
    city: data.city || "",
    rules: data.rules || "",
    minimumAge: data.minimumAge || "All Ages",
    tags: Array.isArray(data.tags) ? data.tags : [],
    joinUrl: data.joinUrl,
    submittedBy: data.submittedBy,
    submitterUid: data.submittedBy,
    status: data.status || "pending",
    featured: false,
    pinned: false,
    hidden: false,
    viewsCount: 0,
    joinCount: 0,
    reportCount: 0,
    memberCount: 0,
    linkStatus: "Active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Store private submitter PII in protected /groupOwnership/{groupId}
  try {
    await setDoc(doc(db, "groupOwnership", ref.id), {
      groupId: ref.id,
      submittedBy: data.submittedBy,
      submitterUid: data.submittedBy,
      ownerUid: data.submittedBy,
      submittedByName: submittedByName || "",
      submittedByEmail: submittedByEmail || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (ownErr) {
    console.warn("Error storing group ownership metadata:", ownErr);
  }

  return ref.id;
}

export async function updateGroup(id: string, data: Partial<Group>): Promise<void> {
  await updateDoc(doc(db, "groups", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteGroup(id: string): Promise<void> {
  await deleteDoc(doc(db, "groups", id));
}

export async function approveGroup(id: string): Promise<void> {
  await updateDoc(doc(db, "groups", id), {
    status: "approved",
    updatedAt: serverTimestamp(),
  });
}

export async function rejectGroup(id: string): Promise<void> {
  await updateDoc(doc(db, "groups", id), {
    status: "rejected",
    updatedAt: serverTimestamp(),
  });
}

export async function incrementJoinCount(id: string): Promise<void> {
  await updateDoc(doc(db, "groups", id), { joinCount: increment(1) });
}

export async function incrementViewCount(id: string): Promise<void> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return;
    if (typeof window !== "undefined") {
      const key = `lc_viewed_${id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    }
    await updateDoc(doc(db, "groups", id), { viewsCount: increment(1) });
  } catch {
    // ignore
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function resolveUserDocRef(
  userOrUid: string | { uid?: string; id?: string; firestoreDocumentId?: string; email?: string }
): Promise<DocumentReference> {
  let uid = "";
  let firestoreDocId = "";
  let email = "";

  if (typeof userOrUid === "string") {
    uid = userOrUid.trim();
    if (uid.includes("@")) {
      email = uid.toLowerCase();
    }
  } else if (userOrUid && typeof userOrUid === "object") {
    firestoreDocId = userOrUid.firestoreDocumentId || "";
    uid = userOrUid.uid || userOrUid.id || "";
    email = (userOrUid.email || "").trim().toLowerCase();
  }

  // 1. Try explicit firestoreDocId if present
  if (firestoreDocId) {
    try {
      const dRef = doc(db, "users", firestoreDocId);
      const dSnap = await getDoc(dRef);
      if (dSnap.exists()) return dRef;
    } catch {}
  }

  // 2. Try direct doc(db, "users", uid)
  if (uid) {
    try {
      const directRef = doc(db, "users", uid);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        return directRef;
      }
    } catch {}

    // 3. Try where("uid", "==", uid)
    try {
      const q1 = query(collection(db, "users"), where("uid", "==", uid));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        return snap1.docs[0].ref;
      }
    } catch {}

    // 4. Try where("userId", "==", uid)
    try {
      const q2 = query(collection(db, "users"), where("userId", "==", uid));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        return snap2.docs[0].ref;
      }
    } catch {}

    // 5. Try where("id", "==", uid)
    try {
      const q3 = query(collection(db, "users"), where("id", "==", uid));
      const snap3 = await getDocs(q3);
      if (!snap3.empty) {
        return snap3.docs[0].ref;
      }
    } catch {}
  }

  // 6. Try where("email", "==", email)
  if (email) {
    try {
      const q4 = query(collection(db, "users"), where("email", "==", email));
      const snap4 = await getDocs(q4);
      if (!snap4.empty) {
        return snap4.docs[0].ref;
      }
    } catch {}
  }

  return doc(db, "users", firestoreDocId || uid || "unknown");
}

export async function generateUniqueAccountUid(firebaseUid?: string): Promise<string> {
  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const candidateUid = `linkcloud${randomDigits}`;
    try {
      const regDocRef = doc(db, "accountUidRegistry", candidateUid);
      const regDocSnap = await getDoc(regDocRef);
      if (!regDocSnap.exists()) {
        await setDoc(regDocRef, {
          accountUid: candidateUid,
          firebaseUid: firebaseUid || "",
          status: "active",
          createdAt: serverTimestamp(),
        });
        return candidateUid;
      }
    } catch (e) {
      console.warn("Account UID registry check error:", e);
      return candidateUid;
    }
  }
  return `linkcloud${Date.now().toString().slice(-6)}`;
}

export async function ensureUserAccountUid(uid: string): Promise<string> {
  try {
    const userRef = await resolveUserDocRef(uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.accountUid && typeof data.accountUid === "string" && data.accountUid.startsWith("linkcloud")) {
        return data.accountUid;
      }
      const generated = await generateUniqueAccountUid(uid);
      await setDoc(userRef, { accountUid: generated, updatedAt: serverTimestamp() }, { merge: true });
      return generated;
    }
  } catch (err) {
    console.warn("Error ensuring user account UID:", err);
  }
  return `linkcloud${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = await resolveUserDocRef(uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  const rawStatus = data.status || data.accountStatus;
  let status: AccountStatus = "active";
  if (rawStatus === "suspended" || data.suspended === true || data.isSuspended === true) {
    status = "suspended";
  } else if (rawStatus === "banned" || data.banned === true || data.isBanned === true) {
    status = "banned";
  } else if (rawStatus === "deleted" || data.deleted === true || data.isDeleted === true) {
    status = "deleted";
  } else if (rawStatus === "pending_verification" || data.pendingVerification === true) {
    status = "pending_verification";
  } else if (rawStatus === "active" || data.active === true) {
    status = "active";
  } else if (data.active === false) {
    status = "suspended";
  }

  let accountUid = data.accountUid;
  if (!accountUid || typeof accountUid !== "string" || !accountUid.startsWith("linkcloud")) {
    ensureUserAccountUid(uid).catch(() => {});
    accountUid = accountUid || `linkcloud${Math.floor(100000 + Math.random() * 900000)}`;
  }

  return {
    firestoreDocumentId: snap.id,
    id: snap.id,
    ...data,
    uid: data.uid || data.userId || snap.id,
    accountUid,
    status,
    active: status === "active",
    suspended: status === "suspended",
    banned: status === "banned",
  } as UserProfile;
}

export async function upsertUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const userRef = await resolveUserDocRef(uid);
  const snap = await getDoc(userRef);
  let finalData: Partial<UserProfile> = { ...data };
  let finalAccountUid = finalData.accountUid;
  if (snap.exists()) {
    const existing = snap.data();
    // Protect immutable accountUid from being overwritten with null/empty
    if (existing.accountUid && !finalData.accountUid) {
      finalData.accountUid = existing.accountUid;
      finalAccountUid = existing.accountUid;
    }
  } else if (!finalData.accountUid) {
    const gen = await generateUniqueAccountUid(uid);
    finalData.accountUid = gen;
    finalAccountUid = gen;
  }
  await setDoc(userRef, { ...finalData, updatedAt: serverTimestamp() }, { merge: true });

  if (finalAccountUid) {
    await registerIdentityIndexes(uid, finalAccountUid, finalData.email, finalData.phone);
  }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>, adminEmail = "webmaster@linkcloud.in", adminUid = "webmaster"): Promise<void> {
  const userRef = await resolveUserDocRef(uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    const errorMsg = `User document for UID '${uid}' not found in Firestore.`;
    console.error("[WEBMASTER USERS]", {
      Action: "EDIT_USER_PROFILE",
      UID: uid,
      TargetDocument: userRef.id,
      CurrentWebmaster: adminEmail,
      Authorized: true,
      Result: "FAILED",
      ErrorCode: "DOCUMENT_NOT_FOUND",
      ErrorMessage: errorMsg,
    });
    throw new Error(errorMsg);
  }

  const existing = snap.data();
  let sanitized = { ...data };
  // accountUid is immutable
  if (existing.accountUid) {
    sanitized.accountUid = existing.accountUid;
  }

  await setDoc(userRef, { ...sanitized, updatedAt: serverTimestamp() }, { merge: true });

  const finalAccountUid = sanitized.accountUid || existing.accountUid;
  if (finalAccountUid) {
    await registerIdentityIndexes(uid, finalAccountUid, sanitized.email || existing.email, sanitized.phone || existing.phone);
  }

  console.log("[WEBMASTER USERS]", {
    Action: "EDIT_USER_PROFILE",
    UID: uid,
    FirestoreDocumentId: userRef.id,
    CurrentWebmaster: adminEmail,
    Authorized: true,
    UpdatedFields: sanitized,
    Result: "SUCCESS",
  });
  await logAuditEvent("User Profile Updated", `Webmaster edited profile details for user ${uid}`, adminEmail, adminUid);
}

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const snap = await getDocs(collection(db, "users"));
    const docs = snap.docs.map((d) => {
      const data = d.data();
      const rawStatus = data.status || data.accountStatus;
      let status: AccountStatus = "active";
      if (rawStatus === "suspended" || data.suspended === true || data.isSuspended === true) {
        status = "suspended";
      } else if (rawStatus === "banned" || data.banned === true || data.isBanned === true) {
        status = "banned";
      } else if (rawStatus === "deleted" || data.deleted === true || data.isDeleted === true) {
        status = "deleted";
      } else if (rawStatus === "pending_verification" || data.pendingVerification === true) {
        status = "pending_verification";
      } else if (rawStatus === "active" || data.active === true) {
        status = "active";
      } else if (data.active === false) {
        status = "suspended";
      }

      return {
        firestoreDocumentId: d.id,
        id: d.id,
        ...data,
        uid: data.uid || data.userId || d.id,
        accountUid: data.accountUid || `linkcloud${d.id.slice(0, 6)}`,
        status,
        active: status === "active",
        suspended: status === "suspended",
        banned: status === "banned",
      } as UserProfile;
    });
    return docs.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? (typeof a.createdAt === "number" ? a.createdAt : 0);
      const bTime = b.createdAt?.toMillis?.() ?? (typeof b.createdAt === "number" ? b.createdAt : 0);
      return bTime - aTime;
    });
  } catch (err) {
    console.warn("Error fetching all users:", err);
    return [];
  }
}

export async function updateUserRole(uid: string, role: UserRole, adminEmail = "webmaster@linkcloud.in", adminUid = "webmaster"): Promise<void> {
  if (uid === adminUid && role !== "webmaster") {
    throw new Error("Self-Protection: You cannot revoke Webmaster authorization on your active account.");
  }
  const userRef = await resolveUserDocRef(uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    const errorMsg = `User document for UID '${uid}' not found in Firestore.`;
    console.error("[WEBMASTER USERS]", {
      Action: "UPDATE_ROLE",
      UID: uid,
      TargetDocument: userRef.id,
      CurrentWebmaster: adminEmail,
      Authorized: true,
      Result: "FAILED",
      ErrorCode: "DOCUMENT_NOT_FOUND",
      ErrorMessage: errorMsg,
    });
    throw new Error(errorMsg);
  }

  await setDoc(userRef, { role, updatedAt: serverTimestamp() }, { merge: true });
  console.log("[WEBMASTER USERS]", {
    Action: "UPDATE_ROLE",
    UID: uid,
    FirestoreDocumentId: userRef.id,
    CurrentWebmaster: adminEmail,
    Authorized: true,
    Role: role,
    Result: "SUCCESS",
  });
  await logAuditEvent("User Role Changed", `Changed user ${uid} role to ${role}`, adminEmail, adminUid);
}

// ─── Backend Admin Auth API Sync Helpers ────────────────────────────────────────

async function syncAuthStatusBackend(uid: string, status: AccountStatus, webmasterEmail: string, webmasterUid: string) {
  try {
    const token = await auth?.currentUser?.getIdToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch("/api/admin/users/status", {
      method: "POST",
      headers,
      body: JSON.stringify({ uid, status, webmasterEmail, webmasterUid }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn("[Admin API] Note reaching /api/admin/users/status:", err);
  }
  return null;
}

async function syncAuthDeleteBackend(uid: string, webmasterEmail: string, webmasterUid: string) {
  try {
    const token = await auth?.currentUser?.getIdToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers,
      body: JSON.stringify({ uid, webmasterEmail, webmasterUid }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn("[Admin API] Note reaching /api/admin/users/delete:", err);
  }
  return null;
}

export async function getAdminServerStats(): Promise<any> {
  try {
    const token = await auth?.currentUser?.getIdToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch("/api/admin/stats", { headers });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("[Admin API] getAdminServerStats notice:", err);
  }
  return null;
}

export async function runAdminMigrationDryRun(): Promise<any> {
  try {
    const token = await auth?.currentUser?.getIdToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch("/api/admin/migration/dry-run", { headers });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("[Admin API] runAdminMigrationDryRun notice:", err);
  }
  return null;
}

export async function updateUserStatus(
  uid: string,
  status: AccountStatus,
  adminEmail = "webmaster@linkcloud.in",
  adminUid = "webmaster"
): Promise<void> {
  // Webmaster self-protection
  if (
    (uid === adminUid || uid === "webmaster") &&
    (status === "suspended" || status === "banned" || status === "deleted")
  ) {
    throw new Error("Self-Protection: You cannot suspend, ban, or delete your active Webmaster account.");
  }

  const actionName =
    status === "suspended" ? "SUSPEND_USER" : status === "banned" ? "BAN_USER" : status === "active" ? "ACTIVATE_USER" : "UPDATE_STATUS";

  const userRef = await resolveUserDocRef(uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    const errorMsg = `User document for UID '${uid}' was not found in Firestore.`;
    console.error("[WEBMASTER USERS]", {
      Action: actionName,
      UID: uid,
      TargetDocument: userRef.id,
      CurrentWebmaster: adminEmail,
      Authorized: true,
      Result: "FAILED",
      ErrorCode: "DOCUMENT_NOT_FOUND",
      ErrorMessage: errorMsg,
    });
    throw new Error(errorMsg);
  }

  const payload: Record<string, any> = {
    status,
    active: status === "active",
    suspended: status === "suspended",
    banned: status === "banned",
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedBy: adminUid,
    statusUpdatedByEmail: adminEmail,
    updatedAt: serverTimestamp(),
  };

  if (status === "suspended") {
    payload.suspendedAt = serverTimestamp();
    payload.suspendedBy = adminUid;
    payload.suspendedByEmail = adminEmail;
  } else if (status === "banned") {
    payload.bannedAt = serverTimestamp();
    payload.bannedBy = adminUid;
    payload.bannedByEmail = adminEmail;
  } else if (status === "active") {
    payload.activatedAt = serverTimestamp();
    payload.activatedBy = adminUid;
    payload.activatedByEmail = adminEmail;
  }

  try {
    await setDoc(userRef, payload, { merge: true });

    // Call backend API to sync Firebase Authentication disabled state
    const authResult = await syncAuthStatusBackend(uid, status, adminEmail, adminUid);

    console.log("[WEBMASTER USERS]", {
      Action: actionName,
      UID: uid,
      FirestoreDocumentId: userRef.id,
      CurrentWebmaster: adminEmail,
      Authorized: true,
      NewStatus: status,
      Active: payload.active,
      FirebaseAuthResult: authResult?.authUpdated ? "SUCCESS" : "SYNCED",
      Result: "SUCCESS",
    });

    await logAuditEvent("User Status Changed", `Changed user ${uid} status to ${status} (active: ${payload.active})`, adminEmail, adminUid);
  } catch (err: any) {
    console.error("[WEBMASTER USERS]", {
      Action: actionName,
      UID: uid,
      FirestoreDocumentId: userRef.id,
      CurrentWebmaster: adminEmail,
      Authorized: true,
      Result: "FAILED",
      ErrorCode: err?.code || "FIRESTORE_WRITE_ERROR",
      ErrorMessage: err?.message || String(err),
    });
    throw err;
  }
}

export const updateUserStatusAdmin = updateUserStatus;

export async function toggleUserEmailVerified(uid: string, verified: boolean, adminEmail = "webmaster@linkcloud.in", adminUid = "webmaster"): Promise<void> {
  const userRef = await resolveUserDocRef(uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    const errorMsg = `User document for UID '${uid}' not found in Firestore.`;
    console.error("[WEBMASTER USERS]", {
      Action: "TOGGLE_EMAIL_VERIFIED",
      UID: uid,
      TargetDocument: userRef.id,
      CurrentWebmaster: adminEmail,
      Authorized: true,
      Result: "FAILED",
      ErrorCode: "DOCUMENT_NOT_FOUND",
      ErrorMessage: errorMsg,
    });
    throw new Error(errorMsg);
  }

  await setDoc(userRef, {
    emailVerified: verified,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  console.log("[WEBMASTER USERS]", {
    Action: "TOGGLE_EMAIL_VERIFIED",
    UID: uid,
    FirestoreDocumentId: userRef.id,
    CurrentWebmaster: adminEmail,
    Authorized: true,
    EmailVerified: verified,
    Result: "SUCCESS",
  });
  await logAuditEvent("User Email Verified Toggled", `${verified ? "Marked verified" : "Marked unverified"} for user ${uid}`, adminEmail, adminUid);
}

export async function toggleUserPhoneVerified(uid: string, verified: boolean, adminEmail = "webmaster@linkcloud.in", adminUid = "webmaster"): Promise<void> {
  const userRef = await resolveUserDocRef(uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    const errorMsg = `User document for UID '${uid}' not found in Firestore.`;
    console.error("[WEBMASTER USERS]", {
      Action: "TOGGLE_PHONE_VERIFIED",
      UID: uid,
      TargetDocument: userRef.id,
      CurrentWebmaster: adminEmail,
      Authorized: true,
      Result: "FAILED",
      ErrorCode: "DOCUMENT_NOT_FOUND",
      ErrorMessage: errorMsg,
    });
    throw new Error(errorMsg);
  }

  await setDoc(userRef, {
    phoneVerified: verified,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  console.log("[WEBMASTER USERS]", {
    Action: "TOGGLE_PHONE_VERIFIED",
    UID: uid,
    FirestoreDocumentId: userRef.id,
    CurrentWebmaster: adminEmail,
    Authorized: true,
    PhoneVerified: verified,
    Result: "SUCCESS",
  });
  await logAuditEvent("User Phone Verified Toggled", `${verified ? "Marked verified" : "Marked unverified"} for user ${uid}`, adminEmail, adminUid);
}

import { hashIdentifier, normalizeEmail, normalizePhone } from "./utils";

// ─── Identity Indexes & Tombstone Records ────────────────────────────────────

export async function registerIdentityIndexes(
  firebaseUid: string,
  accountUid: string,
  email?: string,
  phone?: string
): Promise<void> {
  try {
    if (email) {
      const normEmail = normalizeEmail(email);
      if (normEmail) {
        await setDoc(
          doc(db, "emailIndex", normEmail),
          {
            email: normEmail,
            uid: firebaseUid,
            accountUid,
            status: "active",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
    if (phone) {
      const normPhone = normalizePhone(phone);
      if (normPhone) {
        await setDoc(
          doc(db, "mobileIndex", normPhone),
          {
            phone: normPhone,
            uid: firebaseUid,
            accountUid,
            status: "active",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
  } catch (err) {
    console.warn("Error registering identity indexes:", err);
  }
}

export async function removeIdentityIndexes(email?: string, phone?: string): Promise<void> {
  try {
    if (email) {
      const normEmail = normalizeEmail(email);
      if (normEmail) {
        await deleteDoc(doc(db, "emailIndex", normEmail)).catch(() => {});
      }
    }
    if (phone) {
      const normPhone = normalizePhone(phone);
      if (normPhone) {
        await deleteDoc(doc(db, "mobileIndex", normPhone)).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Error removing identity indexes:", err);
  }
}

export async function recordDeletedAccountTombstone(data: {
  uid: string;
  accountUid?: string;
  displayName?: string;
  deletedBy: string;
  deletedByEmail: string;
  reason?: string;
  deletionType?: "user_requested" | "webmaster_approved" | "direct_user_delete";
}): Promise<void> {
  try {
    const accountUid = data.accountUid || `linkcloud_del_${data.uid.slice(0, 8)}`;
    const tombstoneRef = doc(db, "deletedAccounts", accountUid);

    const tombstoneData: Record<string, any> = {
      accountUid,
      status: "permanently_deleted",
      deletedAt: serverTimestamp(),
      deletedBy: data.deletedBy,
      deletedByEmail: data.deletedByEmail,
      reason: data.reason || "Account permanently deleted",
      deletionType: data.deletionType || "webmaster_approved",
      reRegistrationAllowed: true,
    };

    await setDoc(tombstoneRef, tombstoneData, { merge: true });

    console.log("[WEBMASTER AUTH ADMIN]", {
      Action: "RECORD_DELETED_TOMBSTONE",
      UID: data.uid,
      AccountUID: accountUid,
      DeletedBy: data.deletedByEmail,
      Result: "SUCCESS",
    });
  } catch (err) {
    console.warn("Failed to record deletedAccounts tombstone:", err);
  }
}

export async function checkIsAccountDeleted(
  email?: string,
  phone?: string,
  accountUid?: string
): Promise<{ isDeletedEmail: boolean; isDeletedPhone: boolean; isDeletedAccountUid: boolean; reason?: string }> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) {
      return { isDeletedEmail: false, isDeletedPhone: false, isDeletedAccountUid: false };
    }

    let isDeletedAccountUid = false;
    let deletionReason = "";

    if (accountUid) {
      try {
        const snap = await getDoc(doc(db, "deletedAccounts", accountUid));
        if (snap.exists()) {
          isDeletedAccountUid = true;
          deletionReason = snap.data()?.reason || "Account permanently deleted";
        }
      } catch {}
    }

    return {
      isDeletedEmail: false,
      isDeletedPhone: false,
      isDeletedAccountUid,
      reason: deletionReason,
    };
  } catch (err) {
    console.warn("Error checking deletedAccounts tombstone:", err);
    return { isDeletedEmail: false, isDeletedPhone: false, isDeletedAccountUid: false };
  }
}

export async function performPermanentUserDeletion(params: {
  targetUid: string;
  adminEmail?: string;
  adminUid?: string;
  reason?: string;
  isSelfDelete?: boolean;
}): Promise<void> {
  const {
    targetUid,
    adminEmail = "webmaster@linkcloud.in",
    adminUid = "webmaster",
    reason = "Account Permanently Deleted",
    isSelfDelete = false,
  } = params;

  if (!isSelfDelete) {
    if (targetUid === adminUid || targetUid === "webmaster") {
      throw new Error("Self-Protection: You cannot delete your active Webmaster account.");
    }
  }

  const userRef = await resolveUserDocRef(targetUid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : null;

  const email = normalizeEmail(userData?.email || "");
  const phone = normalizePhone(userData?.phone || "");
  const displayName = userData?.displayName || "Former User";
  let accountUid = userData?.accountUid;

  if (!accountUid) {
    try {
      accountUid = await ensureUserAccountUid(targetUid);
    } catch {}
  }

  try {
    // 1. Group preservation: Anonymize all groups submitted by this user (public listings remain in directory)
    try {
      const groupsCol = collection(db, "groups");
      const gSnap1 = await getDocs(query(groupsCol, where("submittedBy", "==", targetUid)));
      const groupUpdates = gSnap1.docs.map((gDoc) =>
        updateDoc(gDoc.ref, {
          submittedBy: "deleted",
          submitterDeleted: true,
          submittedByName: "Deleted User",
          submittedByEmail: "",
          submittedByPhone: "",
          authorName: "Deleted User",
          authorAccountUid: null,
          authorFirebaseUid: null,
          ownerId: null,
          updatedAt: serverTimestamp(),
        })
      );
      await Promise.all(groupUpdates);

      if (email) {
        const gSnap2 = await getDocs(query(groupsCol, where("submittedByEmail", "==", email)));
        const groupUpdates2 = gSnap2.docs
          .filter((gDoc) => gDoc.data().submittedBy !== "deleted")
          .map((gDoc) =>
            updateDoc(gDoc.ref, {
              submittedBy: "deleted",
              submitterDeleted: true,
              submittedByName: "Deleted User",
              submittedByEmail: "",
              submittedByPhone: "",
              authorName: "Deleted User",
              authorAccountUid: null,
              authorFirebaseUid: null,
              ownerId: null,
              updatedAt: serverTimestamp(),
            })
          );
        await Promise.all(groupUpdates2);
      }
    } catch (gErr) {
      console.warn("Error anonymizing submitted groups during permanent deletion:", gErr);
    }

    // 2. Delete user's favorites
    try {
      const favsQ1 = query(collection(db, "favorites"), where("userId", "==", targetUid));
      const favsSnap1 = await getDocs(favsQ1);
      await Promise.all(favsSnap1.docs.map((d) => deleteDoc(d.ref)));
      const favsQ2 = query(collection(db, "favorites"), where("uid", "==", targetUid));
      const favsSnap2 = await getDocs(favsQ2);
      await Promise.all(favsSnap2.docs.map((d) => deleteDoc(d.ref)));
    } catch (e) {
      console.warn("Error deleting user favorites during permanent deletion:", e);
    }

    // 3. Delete user's notifications
    try {
      const notifQ1 = query(collection(db, "notifications"), where("userId", "==", targetUid));
      const notifSnap1 = await getDocs(notifQ1);
      await Promise.all(notifSnap1.docs.map((d) => deleteDoc(d.ref)));
      const notifQ2 = query(collection(db, "notifications"), where("uid", "==", targetUid));
      const notifSnap2 = await getDocs(notifQ2);
      await Promise.all(notifSnap2.docs.map((d) => deleteDoc(d.ref)));
    } catch (e) {
      console.warn("Error deleting user notifications during permanent deletion:", e);
    }

    // 4. Delete user's private complaints and contact messages
    try {
      if (email) {
        const compQ = query(collection(db, "complaints"), where("email", "==", email));
        const compSnap = await getDocs(compQ);
        await Promise.all(compSnap.docs.map((d) => deleteDoc(d.ref)));

        const contQ = query(collection(db, "contacts"), where("email", "==", email));
        const contSnap = await getDocs(contQ);
        await Promise.all(contSnap.docs.map((d) => deleteDoc(d.ref)));
      }
    } catch (e) {
      console.warn("Error deleting complaints/contacts on deletion:", e);
    }

    // 5. Update all deletion requests for this user to completed
    try {
      const delQ = query(collection(db, "deletionRequests"), where("uid", "==", targetUid));
      const delSnap = await getDocs(delQ);
      await Promise.all(
        delSnap.docs.map((d) =>
          updateDoc(d.ref, {
            status: "completed",
            completedAt: serverTimestamp(),
            approvedAt: serverTimestamp(),
            approvedBy: adminUid,
            approvedByEmail: adminEmail,
            reviewedAt: serverTimestamp(),
            reviewedBy: adminUid,
            reviewedByEmail: adminEmail,
            updatedAt: serverTimestamp(),
          })
        )
      );
    } catch (e) {
      console.warn("Error updating deletion requests during permanent deletion:", e);
    }

    // 6. Mark Account UID as deleted in accountUidRegistry
    if (accountUid) {
      try {
        await setDoc(
          doc(db, "accountUidRegistry", accountUid),
          {
            accountUid,
            firebaseUid: targetUid,
            status: "deleted",
            deletedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("Error updating accountUidRegistry on deletion:", e);
      }
    }

    // 7. Remove active emailIndex and mobileIndex entries so user can register anew
    await removeIdentityIndexes(email, phone);

    // 8. Record in deletedAccounts tombstone collection (minimal record, no blocking hashes)
    await recordDeletedAccountTombstone({
      uid: targetUid,
      accountUid,
      displayName,
      deletedBy: adminUid,
      deletedByEmail: adminEmail,
      reason,
      deletionType: isSelfDelete ? "direct_user_delete" : "webmaster_approved",
    });

    // 9. Delete user doc from Firestore
    if (userSnap.exists()) {
      await deleteDoc(userRef);
    } else {
      try {
        await deleteDoc(doc(db, "users", targetUid));
      } catch {}
    }

    // 10. Call backend API to permanently purge Firebase Authentication user account
    const authDelResult = await syncAuthDeleteBackend(targetUid, adminEmail, adminUid);

    console.log("[WEBMASTER USERS]", {
      Action: "PERMANENT_USER_DELETION",
      UID: targetUid,
      AccountUID: accountUid,
      CurrentWebmaster: adminEmail,
      Authorized: true,
      FirebaseAuthDeleted: authDelResult?.authDeleted ? "SUCCESS" : "SYNCED",
      TombstoneRecorded: true,
      Result: "SUCCESS",
    });

    await logAuditEvent("User Account Permanently Deleted", `Permanently deleted user ${targetUid} (${accountUid || "no-acc-uid"})`, adminEmail, adminUid);
  } catch (err: any) {
    console.error("[WEBMASTER USERS]", {
      Action: "PERMANENT_USER_DELETION",
      UID: targetUid,
      CurrentWebmaster: adminEmail,
      Result: "FAILED",
      ErrorCode: err?.code || "DELETION_ERROR",
      ErrorMessage: err?.message || String(err),
    });
    throw err;
  }
}

export async function deleteUserAccountAdmin(uid: string, adminEmail = "webmaster@linkcloud.in", adminUid = "webmaster"): Promise<void> {
  return performPermanentUserDeletion({
    targetUid: uid,
    adminEmail,
    adminUid,
    reason: "Administrative permanent deletion by Webmaster",
    isSelfDelete: false,
  });
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return null;
    const clean = email.trim().toLowerCase();
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", clean));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0];
      return { uid: docData.id, ...docData.data() } as UserProfile;
    }
    const qPending = query(usersRef, where("pendingEmail", "==", clean));
    const snapPending = await getDocs(qPending);
    if (!snapPending.empty) {
      const docData = snapPending.docs[0];
      return { uid: docData.id, ...docData.data() } as UserProfile;
    }
    return null;
  } catch (err) {
    console.warn("Error getting user profile by email:", err);
    return null;
  }
}

export async function getUserProfileByPhone(phone: string): Promise<UserProfile | null> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return null;
    const cleanPhone = phone.replace(/\s+/g, "");
    const tenDigits = cleanPhone.replace(/^\+91/, "");
    const formattedSpace = `+91 ${tenDigits}`;
    const formattedCompact = `+91${tenDigits}`;
    const phoneVariations = Array.from(new Set([phone, cleanPhone, tenDigits, formattedSpace, formattedCompact])).filter((p) => Boolean(p) && p.length >= 10);

    if (phoneVariations.length > 0) {
      const usersRef = collection(db, "users");
      const qPhone = query(usersRef, where("phone", "in", phoneVariations.slice(0, 10)));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        const docData = snapPhone.docs[0];
        return { uid: docData.id, ...docData.data() } as UserProfile;
      }
    }
    return null;
  } catch (err) {
    console.warn("Error getting user profile by phone:", err);
    return null;
  }
}

export async function checkDuplicateUser(
  email: string,
  phone: string
): Promise<{
  emailExists: boolean;
  phoneExists: boolean;
  isPermanentlyDeletedEmail: boolean;
  isPermanentlyDeletedPhone: boolean;
}> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) {
      return {
        emailExists: false,
        phoneExists: false,
        isPermanentlyDeletedEmail: false,
        isPermanentlyDeletedPhone: false,
      };
    }
    const usersRef = collection(db, "users");
    let emailExists = false;
    let phoneExists = false;

    if (email) {
      const qEmail = query(usersRef, where("email", "==", email.trim().toLowerCase()));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const activeUsers = snapEmail.docs.filter((d) => d.data().status !== "deleted");
        if (activeUsers.length > 0) {
          emailExists = true;
        }
      }
    }

    if (phone) {
      const cleanPhone = phone.replace(/\s+/g, "");
      const tenDigits = cleanPhone.replace(/^\+91/, "");
      const formattedSpace = `+91 ${tenDigits}`;
      const phoneVariations = Array.from(new Set([phone, cleanPhone, tenDigits, formattedSpace])).filter(
        (p) => Boolean(p) && p.length >= 10
      );

      if (phoneVariations.length > 0) {
        const qPhone = query(usersRef, where("phone", "in", phoneVariations.slice(0, 10)));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
          const activeUsers = snapPhone.docs.filter((d) => d.data().status !== "deleted");
          if (activeUsers.length > 0) {
            phoneExists = true;
          }
        }
      }
    }

    // Check tombstone collection for informational status
    const tombstoneCheck = await checkIsAccountDeleted(email, phone);

    return {
      emailExists,
      phoneExists,
      isPermanentlyDeletedEmail: tombstoneCheck.isDeletedEmail,
      isPermanentlyDeletedPhone: tombstoneCheck.isDeletedPhone,
    };
  } catch (err) {
    console.warn("Error checking duplicate user:", err);
    return {
      emailExists: false,
      phoneExists: false,
      isPermanentlyDeletedEmail: false,
      isPermanentlyDeletedPhone: false,
    };
  }
}

// ─── Account Deletion Requests ────────────────────────────────────────────────

export async function requestAccountDeletion(
  uid: string,
  displayName: string,
  email: string,
  phone: string | undefined,
  reason: string
): Promise<void> {
  const userProfile = await getUserProfile(uid);

  // Check if active deletion request already exists
  if (userProfile?.deletionRequested || userProfile?.deletionStatus === "pending") {
    throw new Error("You already have an active account deletion request. Please wait for Webmaster review.");
  }

  try {
    const qActive = query(collection(db, "deletionRequests"), where("uid", "==", uid), where("status", "==", "pending"));
    const snapActive = await getDocs(qActive);
    if (!snapActive.empty) {
      throw new Error("You already have an active account deletion request. Please wait for Webmaster review.");
    }
  } catch (err: any) {
    if (err.message && err.message.includes("active account deletion request")) throw err;
  }

  // Check 7-day cooldown after previous rejection
  if (userProfile?.deletionCooldownUntil || userProfile?.deletionRejectedAt) {
    let cooldownEndMs = 0;
    if (userProfile.deletionCooldownUntil) {
      const cu: any = userProfile.deletionCooldownUntil;
      cooldownEndMs = typeof cu?.toMillis === "function" ? cu.toMillis() : (typeof cu === "number" ? cu : new Date(cu?.toDate ? cu.toDate() : cu).getTime());
    } else if (userProfile.deletionRejectedAt) {
      const rj: any = userProfile.deletionRejectedAt;
      const rejectedTime = typeof rj?.toMillis === "function" ? rj.toMillis() : (typeof rj === "number" ? rj : new Date(rj?.toDate ? rj.toDate() : rj).getTime());
      cooldownEndMs = rejectedTime + 7 * 24 * 60 * 60 * 1000;
    }

    if (cooldownEndMs > Date.now()) {
      const remainingMs = cooldownEndMs - Date.now();
      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      const timeStr = remainingDays > 1 ? `${remainingDays} days` : `${remainingHours} hours`;
      throw new Error(`A new account deletion request can only be submitted after the 7-day cooldown expires (${timeStr} remaining).`);
    }
  }

  const accountUid = userProfile?.accountUid || (await ensureUserAccountUid(uid));

  const reqDocRef = await addDoc(collection(db, "deletionRequests"), {
    uid,
    accountUid,
    displayName: displayName || userProfile?.displayName || "",
    email: email || userProfile?.email || "",
    phone: phone || userProfile?.phone || "",
    reason,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await setDoc(doc(db, "users", uid), {
      deletionRequested: true,
      deletionStatus: "pending",
      deletionRequestId: reqDocRef.id,
      deletionRequestedAt: serverTimestamp(),
      deletionReason: reason,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn("Could not set deletionRequested on user document:", e);
  }

  try {
    await createUserNotification(
      uid,
      "Account Deletion Request Submitted",
      "Your account deletion request has been submitted to the Webmaster for review. Your request is currently pending.",
      "system"
    );
  } catch {}
}

export async function cancelDeletionRequest(uid: string): Promise<void> {
  try {
    const qActive = query(collection(db, "deletionRequests"), where("uid", "==", uid), where("status", "==", "pending"));
    const snapActive = await getDocs(qActive);
    for (const d of snapActive.docs) {
      await updateDoc(d.ref, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("Could not cancel deletion request document:", e);
  }

  try {
    const userRef = await resolveUserDocRef(uid);
    await updateDoc(userRef, {
      deletionRequested: false,
      deletionStatus: "none",
      deletionRequestId: null,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("Could not update user doc on cancel deletion:", e);
  }

  try {
    await createUserNotification(
      uid,
      "Account Deletion Request Cancelled",
      "Your account deletion request has been cancelled. Your account remains active.",
      "system"
    );
  } catch {}
}

export async function getDeletionRequests(): Promise<DeletionRequest[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const snap = await getDocs(collection(db, "deletionRequests"));
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeletionRequest));
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (err) {
    console.warn("Error fetching deletion requests:", err);
    return [];
  }
}

export async function approveDeletionRequest(requestId: string, uid: string, adminEmail = "webmaster@linkcloud.in", adminUid = "webmaster"): Promise<void> {
  const reqDocRef = doc(db, "deletionRequests", requestId);
  const reqSnap = await getDoc(reqDocRef);
  if (!reqSnap.exists()) {
    throw new Error(`Deletion request record '${requestId}' was not found.`);
  }

  const reqData = reqSnap.data();
  const reason = reqData?.reason || "Account Deletion Request approved by Webmaster";

  // 1. Mark request approved
  try {
    await updateDoc(reqDocRef, {
      status: "approved",
      approvedAt: serverTimestamp(),
      approvedBy: adminUid,
      approvedByEmail: adminEmail,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
      reviewedByEmail: adminEmail,
      updatedAt: serverTimestamp(),
    });
  } catch {}

  // 2. Perform permanent user deletion
  await performPermanentUserDeletion({
    targetUid: uid,
    adminEmail,
    adminUid,
    reason,
    isSelfDelete: false,
  });

  // 3. Mark request completed
  try {
    await updateDoc(reqDocRef, {
      status: "completed",
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {}
}

export async function rejectDeletionRequest(
  requestId: string,
  uid: string,
  adminEmail = "webmaster@linkcloud.in",
  adminUid = "webmaster",
  rejectionReason = "Rejected by Webmaster"
): Promise<void> {
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new Error("Please provide a rejection reason.");
  }

  const cleanReason = rejectionReason.trim();
  const reqDocRef = doc(db, "deletionRequests", requestId);
  const reqSnap = await getDoc(reqDocRef);
  if (!reqSnap.exists()) {
    const errorMsg = `Deletion request record '${requestId}' was not found in Firestore.`;
    throw new Error(errorMsg);
  }

  const userDocRef = await resolveUserDocRef(uid);
  const cooldownDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    // 1. Update deletion request doc
    await updateDoc(reqDocRef, {
      status: "rejected",
      rejectedAt: serverTimestamp(),
      rejectedBy: adminUid,
      rejectedByEmail: adminEmail,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
      reviewedByEmail: adminEmail,
      rejectionReason: cleanReason,
      cooldownUntil: cooldownDate,
      updatedAt: serverTimestamp(),
    });

    // 2. Update user document
    try {
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        await updateDoc(userDocRef, {
          deletionRequested: false,
          deletionStatus: "rejected",
          deletionRejectedAt: serverTimestamp(),
          deletionRejectionReason: cleanReason,
          deletionCooldownUntil: cooldownDate,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (userErr) {
      console.warn("Could not update user document during deletion rejection:", userErr);
    }

    // 3. Send notification to user
    try {
      await createUserNotification(
        uid,
        "Account Deletion Request Rejected",
        `Your account deletion request was reviewed and rejected. Reason: ${cleanReason}. You may submit a new request after 7 days.`,
        "rejection"
      );
    } catch {}

    console.log("[WEBMASTER USERS]", {
      Action: "REJECT_DELETION",
      RequestId: requestId,
      UID: uid,
      FirestoreDocumentId: userDocRef.id,
      CurrentWebmaster: adminEmail,
      Authorized: true,
      Reason: cleanReason,
      CooldownUntil: cooldownDate.toISOString(),
      Result: "SUCCESS",
    });

    await logAuditEvent("Account Deletion Request Rejected", `Rejected deletion request ${requestId} for user ${uid}. Reason: ${cleanReason}`, adminEmail, adminUid);
  } catch (err: any) {
    console.error("[WEBMASTER USERS]", {
      Action: "REJECT_DELETION",
      RequestId: requestId,
      UID: uid,
      Result: "FAILED",
      ErrorMessage: err?.message || String(err),
    });
    throw err;
  }
}

// ─── Slugify Helper ─────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(onlyActive = false): Promise<Category[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const snap = await getDocs(collection(db, "categories"));
    let list: Category[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || slugify(data.name || ""),
        icon: data.icon || "Folder",
        color: data.color || "#3b82f6",
        status: data.status || (data.enabled === false ? "disabled" : "active"),
        enabled: data.enabled !== false && data.status !== "disabled",
        displayOrder: data.displayOrder ?? data.order ?? 0,
        groupCount: data.groupCount ?? 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      } as Category;
    });

    if (list.length === 0) {
      list = DEFAULT_CATEGORIES;
    }

    if (onlyActive) {
      list = list.filter((c) => c.status === "active" && c.enabled !== false);
    }

    return list.sort((a, b) => {
      if ((a.displayOrder ?? 0) !== (b.displayOrder ?? 0)) {
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    console.warn("Error getting categories:", err);
    return [];
  }
}

export async function createCategory(data: Partial<Category>): Promise<string> {
  if (!data.name?.trim()) throw new Error("Category name is required");
  const slug = data.slug?.trim() || slugify(data.name);

  // Check duplicate
  const existing = await getCategories();
  if (existing.some((c) => c.name.toLowerCase().trim() === data.name!.toLowerCase().trim())) {
    throw new Error("A category with this name already exists.");
  }
  if (existing.some((c) => c.slug?.toLowerCase().trim() === slug.toLowerCase())) {
    throw new Error("A category with this slug already exists.");
  }

  const status = data.status || "active";
  const ref = await addDoc(collection(db, "categories"), {
    name: data.name.trim(),
    slug,
    icon: data.icon || "Folder",
    color: data.color || "#3b82f6",
    status,
    enabled: status === "active",
    displayOrder: data.displayOrder ?? existing.length + 1,
    order: data.displayOrder ?? existing.length + 1,
    groupCount: 0,
    createdBy: data.createdBy || "webmaster",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
  const updates: Record<string, any> = { ...data, updatedAt: serverTimestamp() };
  if (data.name) {
    updates.name = data.name.trim();
    if (!data.slug) {
      updates.slug = slugify(data.name);
    }
  }
  if (data.status) {
    updates.enabled = data.status === "active";
  }
  await updateDoc(doc(db, "categories", id), updates);
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, "categories", id));
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function createReport(
  data: Omit<Report, "id" | "createdAt" | "status">
): Promise<void> {
  await addDoc(collection(db, "reports"), {
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  try {
    await updateDoc(doc(db, "groups", data.groupId), { reportCount: increment(1) });
  } catch {
    // ignore if group doc doesn't exist
  }
}

export async function getReports(): Promise<Report[]> {
  const snap = await getDocs(collection(db, "reports"));
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report));
  return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export async function updateReport(id: string, status: Report["status"]): Promise<void> {
  await updateDoc(doc(db, "reports", id), { status, updatedAt: serverTimestamp() });
}

export async function deleteReport(id: string): Promise<void> {
  await deleteDoc(doc(db, "reports", id));
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function createContactMessage(
  data: Omit<ContactMessage, "id" | "createdAt" | "status">
): Promise<void> {
  await addDoc(collection(db, "contacts"), {
    ...data,
    status: "unread",
    createdAt: serverTimestamp(),
  });
}

export async function getContactMessages(): Promise<ContactMessage[]> {
  const snap = await getDocs(collection(db, "contacts"));
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactMessage));
  return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export async function updateContactMessage(
  id: string,
  status: ContactMessage["status"]
): Promise<void> {
  await updateDoc(doc(db, "contacts", id), { status });
}

export async function deleteContactMessage(id: string): Promise<void> {
  await deleteDoc(doc(db, "contacts", id));
}

// ─── Complaints ───────────────────────────────────────────────────────────────

export async function createComplaint(
  data: Omit<Complaint, "id" | "createdAt" | "status">
): Promise<string> {
  const docRef = await addDoc(collection(db, "complaints"), {
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getComplaints(): Promise<Complaint[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const snap = await getDocs(collection(db, "complaints"));
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Complaint));
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (err) {
    console.warn("Error fetching complaints:", err);
    return [];
  }
}

export async function updateComplaintStatus(
  id: string,
  status: Complaint["status"]
): Promise<void> {
  await updateDoc(doc(db, "complaints", id), { status });
}

export async function deleteComplaint(id: string): Promise<void> {
  await deleteDoc(doc(db, "complaints", id));
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export async function getUserFavorites(userId: string): Promise<Favorite[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db) || !userId) return [];
    const map = new Map<string, Favorite>();

    const q1 = query(collection(db, "favorites"), where("userId", "==", userId));
    const snap1 = await getDocs(q1);
    snap1.docs.forEach((d) => {
      map.set(d.id, { id: d.id, ...d.data() } as Favorite);
    });

    try {
      const q2 = query(collection(db, "favorites"), where("uid", "==", userId));
      const snap2 = await getDocs(q2);
      snap2.docs.forEach((d) => {
        map.set(d.id, { id: d.id, ...d.data() } as Favorite);
      });
    } catch {}

    const docs = Array.from(map.values());
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (err) {
    console.warn("Error getting user favorites:", err);
    return [];
  }
}

export async function getFavoriteGroups(userId: string): Promise<Group[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const favorites = await getUserFavorites(userId);
    if (favorites.length === 0) return [];
    
    const groupPromises = favorites.map((fav) => getGroupById(fav.groupId));
    const groups = await Promise.all(groupPromises);
    return groups.filter((g): g is Group => g !== null);
  } catch (err) {
    console.warn("Error getting favorite groups:", err);
    return [];
  }
}

export async function getUserContactMessages(email: string): Promise<ContactMessage[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db) || !email) return [];
    const q = query(collection(db, "contacts"), where("email", "==", email.trim().toLowerCase()));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactMessage));
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (err) {
    console.warn("Error getting user contact messages:", err);
    return [];
  }
}

export async function getUserComplaints(email: string): Promise<Complaint[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db) || !email) return [];
    const q = query(collection(db, "complaints"), where("email", "==", email.trim().toLowerCase()));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Complaint));
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (err) {
    console.warn("Error getting user complaints:", err);
    return [];
  }
}

export async function addFavorite(userId: string, groupId: string): Promise<void> {
  // Check if already favorited
  const q = query(
    collection(db, "favorites"),
    where("userId", "==", userId),
    where("groupId", "==", groupId)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return;
  await addDoc(collection(db, "favorites"), {
    userId,
    groupId,
    createdAt: serverTimestamp(),
  });
}

export async function removeFavorite(userId: string, groupId: string): Promise<void> {
  const q = query(
    collection(db, "favorites"),
    where("userId", "==", userId),
    where("groupId", "==", groupId)
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function isFavorited(userId: string, groupId: string): Promise<boolean> {
  const q = query(
    collection(db, "favorites"),
    where("userId", "==", userId),
    where("groupId", "==", groupId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db) || !userId) return [];
    const map = new Map<string, Notification>();

    const q1 = query(collection(db, "notifications"), where("userId", "==", userId));
    const snap1 = await getDocs(q1);
    snap1.docs.forEach((d) => {
      map.set(d.id, { id: d.id, ...d.data() } as Notification);
    });

    try {
      const q2 = query(collection(db, "notifications"), where("uid", "==", userId));
      const snap2 = await getDocs(q2);
      snap2.docs.forEach((d) => {
        map.set(d.id, { id: d.id, ...d.data() } as Notification);
      });
    } catch {}

    const docs = Array.from(map.values());
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch (err) {
    console.warn("Error getting user notifications:", err);
    return [];
  }
}

export async function createNotification(
  data: Omit<Notification, "id" | "createdAt" | "read">
): Promise<void> {
  await addDoc(collection(db, "notifications"), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
}

export async function deleteNotification(id: string): Promise<void> {
  await deleteDoc(doc(db, "notifications", id));
}

// ─── Bulk Group Actions ─────────────────────────────────────────────────────────

export async function bulkApproveGroups(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      updateDoc(doc(db, "groups", id), {
        status: "approved",
        updatedAt: serverTimestamp(),
      })
    )
  );
}

export async function bulkRejectGroups(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      updateDoc(doc(db, "groups", id), {
        status: "rejected",
        updatedAt: serverTimestamp(),
      })
    )
  );
}

export async function bulkDeleteGroups(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => deleteDoc(doc(db, "groups", id))));
}

export async function bulkHideGroups(ids: string[], hidden: boolean): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      updateDoc(doc(db, "groups", id), {
        hidden,
        updatedAt: serverTimestamp(),
      })
    )
  );
}

export async function bulkFeatureGroups(ids: string[], featured: boolean): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      updateDoc(doc(db, "groups", id), {
        featured,
        updatedAt: serverTimestamp(),
      })
    )
  );
}

export async function requestGroupChanges(id: string, message: string): Promise<void> {
  await updateDoc(doc(db, "groups", id), {
    status: "pending",
    changesRequested: true,
    changesRequestedMessage: message,
    allowResubmit: true,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleGroupHide(id: string, hidden: boolean): Promise<void> {
  await updateDoc(doc(db, "groups", id), { hidden, updatedAt: serverTimestamp() });
}

export async function toggleGroupPin(id: string, pinned: boolean): Promise<void> {
  await updateDoc(doc(db, "groups", id), { pinned, updatedAt: serverTimestamp() });
}

export async function toggleGroupFeature(id: string, featured: boolean): Promise<void> {
  await updateDoc(doc(db, "groups", id), { featured, updatedAt: serverTimestamp() });
}

export async function updateGroupInviteLink(id: string, joinUrl: string, linkStatus: "active" | "inactive"): Promise<void> {
  await updateDoc(doc(db, "groups", id), {
    joinUrl,
    linkStatus,
    updatedAt: serverTimestamp(),
  });
}

// ─── Admin User Actions ────────────────────────────────────────────────────────
// (User management functions toggleUserEmailVerified, toggleUserPhoneVerified, deleteUserAccountAdmin defined above)

// ─── Platforms, Content Types & Languages ──────────────────────────────────────

export async function getCustomPlatforms(onlyActive = false): Promise<PlatformItem[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const snap = await getDocs(collection(db, "platforms"));
    let list: PlatformItem[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || slugify(data.name || ""),
        icon: data.icon || "Share2",
        color: data.color || "#22c55e",
        badgeColor: data.badgeColor || "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        iconUrl: data.iconUrl || "",
        status: data.status || (data.enabled === false ? "disabled" : "active"),
        enabled: data.enabled !== false && data.status !== "disabled",
        displayOrder: data.displayOrder ?? data.order ?? 0,
        order: data.order ?? data.displayOrder ?? 0,
        invitePattern: data.invitePattern || "",
        helpText: data.helpText || "",
        errorText: data.errorText || "",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      } as PlatformItem;
    });

    if (list.length === 0) {
      list = DEFAULT_PLATFORMS;
    }

    if (onlyActive) {
      list = list.filter((p) => p.status === "active" && p.enabled !== false);
    }

    return list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  } catch {
    return [];
  }
}

export async function createCustomPlatform(data: Partial<PlatformItem>): Promise<string> {
  if (!data.name?.trim()) throw new Error("Platform name is required");
  const slug = data.slug?.trim() || slugify(data.name);

  const existing = await getCustomPlatforms();
  if (existing.some((p) => p.name.toLowerCase().trim() === data.name!.toLowerCase().trim())) {
    throw new Error("A platform with this name already exists.");
  }
  if (existing.some((p) => p.slug?.toLowerCase().trim() === slug.toLowerCase())) {
    throw new Error("A platform with this slug already exists.");
  }

  const status = data.status || "active";
  const ref = await addDoc(collection(db, "platforms"), {
    name: data.name.trim(),
    slug,
    icon: data.icon || "Share2",
    color: data.color || "#22c55e",
    badgeColor: data.badgeColor || "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    iconUrl: data.iconUrl || "",
    status,
    enabled: status === "active",
    displayOrder: data.displayOrder ?? data.order ?? existing.length + 1,
    order: data.displayOrder ?? data.order ?? existing.length + 1,
    invitePattern: data.invitePattern || "",
    helpText: data.helpText || "",
    errorText: data.errorText || "",
    createdBy: data.createdBy || "webmaster",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCustomPlatform(id: string, data: Partial<PlatformItem>): Promise<void> {
  const updates: Record<string, any> = { ...data, updatedAt: serverTimestamp() };
  if (data.name) {
    updates.name = data.name.trim();
    if (!data.slug) updates.slug = slugify(data.name);
  }
  if (data.status) {
    updates.enabled = data.status === "active";
  }
  if (data.displayOrder !== undefined) {
    updates.order = data.displayOrder;
  }
  await updateDoc(doc(db, "platforms", id), updates);
}

export async function deleteCustomPlatform(id: string): Promise<void> {
  await deleteDoc(doc(db, "platforms", id));
}

// ─── Content Types ─────────────────────────────────────────────────────────────

export async function getCustomContentTypes(onlyActive = false): Promise<ContentTypeItem[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const snap = await getDocs(collection(db, "contentTypes"));
    let list: ContentTypeItem[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || slugify(data.name || ""),
        icon: data.icon || "",
        color: data.color || data.themeColor || "",
        themeColor: data.themeColor || data.color || "",
        categoryId: data.categoryId || "",
        status: data.status || (data.enabled === false ? "disabled" : "active"),
        enabled: data.enabled !== false && data.status !== "disabled",
        displayOrder: data.displayOrder ?? data.order ?? 0,
        order: data.order ?? data.displayOrder ?? 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      } as ContentTypeItem;
    });

    if (list.length === 0) {
      list = DEFAULT_CONTENT_TYPES;
    }

    if (onlyActive) {
      list = list.filter((ct) => ct.status === "active" && ct.enabled !== false);
    }

    return list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  } catch {
    return [];
  }
}

export async function createCustomContentType(data: Partial<ContentTypeItem>): Promise<string> {
  if (!data.name?.trim()) throw new Error("Content type name is required");
  const slug = data.slug?.trim() || slugify(data.name);

  const existing = await getCustomContentTypes();
  if (existing.some((ct) => ct.name.toLowerCase().trim() === data.name!.toLowerCase().trim())) {
    throw new Error("A content type with this name already exists.");
  }

  const status = data.status || "active";
  const ref = await addDoc(collection(db, "contentTypes"), {
    name: data.name.trim(),
    slug,
    icon: data.icon || "",
    color: data.color || data.themeColor || "",
    themeColor: data.themeColor || data.color || "",
    categoryId: data.categoryId || "",
    status,
    enabled: status === "active",
    displayOrder: data.displayOrder ?? data.order ?? existing.length + 1,
    order: data.displayOrder ?? data.order ?? existing.length + 1,
    createdBy: data.createdBy || "webmaster",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCustomContentType(id: string, data: Partial<ContentTypeItem>): Promise<void> {
  const updates: Record<string, any> = { ...data, updatedAt: serverTimestamp() };
  if (data.name) {
    updates.name = data.name.trim();
    if (!data.slug) updates.slug = slugify(data.name);
  }
  if (data.status) {
    updates.enabled = data.status === "active";
  }
  if (data.displayOrder !== undefined) {
    updates.order = data.displayOrder;
  }
  await updateDoc(doc(db, "contentTypes", id), updates);
}

export async function deleteCustomContentType(id: string): Promise<void> {
  await deleteDoc(doc(db, "contentTypes", id));
}

// ─── Languages ─────────────────────────────────────────────────────────────────

export async function getCustomLanguages(onlyActive = false): Promise<LanguageItem[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const snap = await getDocs(collection(db, "languages"));
    let list: LanguageItem[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || "",
        slug: data.slug || slugify(data.name || ""),
        code: data.code || "",
        icon: data.icon || "",
        color: data.color || data.themeColor || "",
        themeColor: data.themeColor || data.color || "",
        status: data.status || (data.enabled === false ? "disabled" : "active"),
        enabled: data.enabled !== false && data.status !== "disabled",
        displayOrder: data.displayOrder ?? data.order ?? 0,
        order: data.order ?? data.displayOrder ?? 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      } as LanguageItem;
    });

    if (list.length === 0) {
      list = DEFAULT_LANGUAGES;
    }

    if (onlyActive) {
      list = list.filter((l) => l.status === "active" && l.enabled !== false);
    }

    return list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  } catch {
    return [];
  }
}

export async function createCustomLanguage(data: Partial<LanguageItem>): Promise<string> {
  if (!data.name?.trim()) throw new Error("Language name is required");
  const slug = data.slug?.trim() || slugify(data.name);

  const existing = await getCustomLanguages();
  if (existing.some((l) => l.name.toLowerCase().trim() === data.name!.toLowerCase().trim())) {
    throw new Error("A language with this name already exists.");
  }

  const status = data.status || "active";
  const ref = await addDoc(collection(db, "languages"), {
    name: data.name.trim(),
    slug,
    code: data.code || "",
    icon: data.icon || "",
    color: data.color || data.themeColor || "",
    themeColor: data.themeColor || data.color || "",
    status,
    enabled: status === "active",
    displayOrder: data.displayOrder ?? data.order ?? existing.length + 1,
    order: data.displayOrder ?? data.order ?? existing.length + 1,
    createdBy: data.createdBy || "webmaster",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCustomLanguage(id: string, data: Partial<LanguageItem>): Promise<void> {
  const updates: Record<string, any> = { ...data, updatedAt: serverTimestamp() };
  if (data.name) {
    updates.name = data.name.trim();
    if (!data.slug) updates.slug = slugify(data.name);
  }
  if (data.status) {
    updates.enabled = data.status === "active";
  }
  if (data.displayOrder !== undefined) {
    updates.order = data.displayOrder;
  }
  await updateDoc(doc(db, "languages", id), updates);
}

export async function deleteCustomLanguage(id: string): Promise<void> {
  await deleteDoc(doc(db, "languages", id));
}

// ─── Taxonomy Usage Check & Safe Reassignment Delete ──────────────────────────

export async function checkTaxonomyUsage(
  type: "category" | "platform" | "contentType" | "language",
  identifier: string,
  name?: string
): Promise<{ count: number; sampleGroups: { id: string; name: string }[] }> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return { count: 0, sampleGroups: [] };
    const snap = await getDocs(collection(db, "groups"));
    const searchTarget = (name || identifier).toLowerCase().trim();
    const idTarget = identifier.toLowerCase().trim();

    const matchedGroups = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Group))
      .filter((g) => {
        if (type === "category") {
          return (
            (g.categoryId && g.categoryId.toLowerCase().trim() === idTarget) ||
            (g.categoryName && g.categoryName.toLowerCase().trim() === searchTarget)
          );
        }
        if (type === "platform") {
          return g.platform && g.platform.toLowerCase().trim() === searchTarget;
        }
        if (type === "contentType") {
          return g.contentType && g.contentType.toLowerCase().trim() === searchTarget;
        }
        if (type === "language") {
          return g.language && g.language.toLowerCase().trim() === searchTarget;
        }
        return false;
      });

    return {
      count: matchedGroups.length,
      sampleGroups: matchedGroups.slice(0, 5).map((g) => ({ id: g.id, name: g.name })),
    };
  } catch (err) {
    console.warn("Error checking taxonomy usage:", err);
    return { count: 0, sampleGroups: [] };
  }
}

export async function reassignTaxonomyAndDelete(
  type: "category" | "platform" | "contentType" | "language",
  oldIdentifier: string,
  newItem: { id?: string; name: string },
  docIdToDelete: string,
  oldName?: string
): Promise<void> {
  if (!db) return;
  const snap = await getDocs(collection(db, "groups"));
  const oldSearch = (oldName || oldIdentifier).toLowerCase().trim();
  const oldId = oldIdentifier.toLowerCase().trim();

  const matchingDocs = snap.docs.filter((d) => {
    const g = d.data();
    if (type === "category") {
      return (
        (g.categoryId && g.categoryId.toLowerCase().trim() === oldId) ||
        (g.categoryName && g.categoryName.toLowerCase().trim() === oldSearch)
      );
    }
    if (type === "platform") {
      return g.platform && g.platform.toLowerCase().trim() === oldSearch;
    }
    if (type === "contentType") {
      return g.contentType && g.contentType.toLowerCase().trim() === oldSearch;
    }
    if (type === "language") {
      return g.language && g.language.toLowerCase().trim() === oldSearch;
    }
    return false;
  });

  // Reassign groups
  await Promise.all(
    matchingDocs.map((docSnap) => {
      const updates: Record<string, any> = { updatedAt: serverTimestamp() };
      if (type === "category") {
        updates.categoryId = newItem.id || "";
        updates.categoryName = newItem.name;
      } else if (type === "platform") {
        updates.platform = newItem.name;
      } else if (type === "contentType") {
        updates.contentType = newItem.name;
      } else if (type === "language") {
        updates.language = newItem.name;
      }
      return updateDoc(docSnap.ref, updates);
    })
  );

  // Delete taxonomy doc
  const collectionName =
    type === "category" ? "categories" : type === "platform" ? "platforms" : type === "contentType" ? "contentTypes" : "languages";
  await deleteDoc(doc(db, collectionName, docIdToDelete));
}

// ─── Taxonomy Audit & Migration Helper ─────────────────────────────────────────

export async function auditAndMigrateTaxonomies(): Promise<{ updated: number }> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return { updated: 0 };
    let updatedCount = 0;

    const platSnap = await getDocs(collection(db, "platforms"));
    for (const d of platSnap.docs) {
      const data = d.data();
      const name = (data.name || "").trim();
      const slug = (data.slug || "").trim().toLowerCase();

      // Check if Signal was misclassified
      if (name.toLowerCase() === "signal" || slug === "signal") {
        if (data.icon !== "signal" || data.themeColor !== "#3A76F0" || data.color !== "#3A76F0") {
          await updateDoc(d.ref, {
            icon: "signal",
            themeColor: "#3A76F0",
            color: "#3A76F0",
            badgeColor: "bg-[#3A76F0]/10 text-[#3A76F0] border-[#3A76F0]/20",
            invitePattern: "^https?:\\/\\/(signal\\.group|signal\\.me)\\/.+",
            helpText: "Enter Signal Group invite link (signal.group/...)",
            updatedAt: serverTimestamp(),
          });
          updatedCount++;
        }
      }
      // Check if Snapchat was misclassified
      else if (name.toLowerCase().includes("snapchat") || slug.includes("snapchat")) {
        if (data.icon !== "snapchat" || data.themeColor !== "#FFFC00") {
          await updateDoc(d.ref, {
            icon: "snapchat",
            themeColor: "#FFFC00",
            color: "#FFFC00",
            badgeColor: "bg-[#FFFC00]/10 text-[#111111] border-[#FFFC00]/30",
            invitePattern: "^https?:\\/\\/(www\\.)?(snapchat\\.com|add\\.snapchat\\.com)\\/.+",
            helpText: "Enter Snapchat Group link",
            updatedAt: serverTimestamp(),
          });
          updatedCount++;
        }
      }
      // Check if WhatsApp was misclassified
      else if (name.toLowerCase().includes("whatsapp") || slug.includes("whatsapp")) {
        if (data.icon !== "whatsapp" || data.themeColor !== "#25D366") {
          await updateDoc(d.ref, {
            icon: "whatsapp",
            themeColor: "#25D366",
            color: "#25D366",
            updatedAt: serverTimestamp(),
          });
          updatedCount++;
        }
      }
      // Check if Telegram was misclassified
      else if (name.toLowerCase().includes("telegram") || slug.includes("telegram")) {
        if (data.icon !== "telegram" || data.themeColor !== "#229ED9") {
          await updateDoc(d.ref, {
            icon: "telegram",
            themeColor: "#229ED9",
            color: "#229ED9",
            updatedAt: serverTimestamp(),
          });
          updatedCount++;
        }
      }
    }

    return { updated: updatedCount };
  } catch (err) {
    console.error("[AUDIT ERROR] Exception in auditAndMigrateTaxonomies:", err);
    return { updated: 0 };
  }
}

// ─── Default Taxonomy Seeding Helper ──────────────────────────────────────────

let seedingPromise: Promise<{ categories: number; platforms: number; contentTypes: number; languages: number }> | null = null;

export async function seedDefaultTaxonomies(): Promise<{ categories: number; platforms: number; contentTypes: number; languages: number }> {
  if (seedingPromise) {
    console.log("[SEED] Seeding already in progress, returning existing promise.");
    return seedingPromise;
  }

  seedingPromise = (async () => {
    console.log("[SEED] Starting seedDefaultTaxonomies execution...");
    try {
      if (!db || typeof db !== "object" || !("app" in db)) {
        console.warn("[SEED ERROR] Firestore db is not initialized.");
        return { categories: 0, platforms: 0, contentTypes: 0, languages: 0 };
      }

      const isWebmaster = await isCurrentUserWebmaster();
      if (!isWebmaster) {
        console.log("[SEED] Current user is not a Webmaster. Skipping client-side taxonomy seeding.");
        return { categories: 0, platforms: 0, contentTypes: 0, languages: 0 };
      }

      let catsAdded = 0;
      let platsAdded = 0;
      let ctsAdded = 0;
      let langsAdded = 0;

      // 1. Categories (27 Defaults)
      const defaultCategories = [
        { name: "Technology", icon: "Cpu", themeColor: "#3B82F6" },
        { name: "Education", icon: "GraduationCap", themeColor: "#8B5CF6" },
        { name: "Jobs", icon: "Briefcase", themeColor: "#F59E0B" },
        { name: "Business", icon: "Building2", themeColor: "#10B981" },
        { name: "News", icon: "Newspaper", themeColor: "#EF4444" },
        { name: "Entertainment", icon: "Film", themeColor: "#EC4899" },
        { name: "Gaming", icon: "Gamepad2", themeColor: "#6366F1" },
        { name: "Sports", icon: "Trophy", themeColor: "#22C55E" },
        { name: "Shopping", icon: "ShoppingBag", themeColor: "#F43F5E" },
        { name: "Travel", icon: "Compass", themeColor: "#14B8A6" },
        { name: "Health", icon: "Heart", themeColor: "#10B981" },
        { name: "Food", icon: "Utensils", themeColor: "#F97316" },
        { name: "Finance", icon: "Wallet", themeColor: "#0EA5E9" },
        { name: "Real Estate", icon: "Home", themeColor: "#8B5CF6" },
        { name: "Room Rent", icon: "Key", themeColor: "#06B6D4" },
        { name: "Buy & Sell", icon: "Tag", themeColor: "#F59E0B" },
        { name: "Government", icon: "Landmark", themeColor: "#2563EB" },
        { name: "Local Community", icon: "Users", themeColor: "#14B8A6" },
        { name: "Religious", icon: "Sparkles", themeColor: "#7C3AED" },
        { name: "Social", icon: "MessageSquare", themeColor: "#EC4899" },
        { name: "Agriculture", icon: "Sprout", themeColor: "#65A30D" },
        { name: "Automobile", icon: "Car", themeColor: "#475569" },
        { name: "Movies", icon: "Clapperboard", themeColor: "#DC2626" },
        { name: "Music", icon: "Music", themeColor: "#A855F7" },
        { name: "Books", icon: "BookOpen", themeColor: "#0891B2" },
        { name: "Events", icon: "Calendar", themeColor: "#EA580C" },
        { name: "Other", icon: "Folder", themeColor: "#64748B" },
      ];

      console.log("[SEED] Fetching existing 'categories' collection...");
      const catSnap = await getDocs(collection(db, "categories"));
      const existingCatIds = new Set(catSnap.docs.map((d) => d.id.toLowerCase()));
      const existingCatSlugs = new Set(catSnap.docs.map((d) => (d.data().slug || "").toLowerCase()));
      const existingCatNames = new Set(catSnap.docs.map((d) => (d.data().name || "").toLowerCase().trim()));

      let catIndex = 1;
      for (const item of defaultCategories) {
        const docId = slugify(item.name);
        const lowerDocId = docId.toLowerCase();
        const lowerName = item.name.toLowerCase().trim();

        if (!existingCatIds.has(lowerDocId) && !existingCatSlugs.has(lowerDocId) && !existingCatNames.has(lowerName)) {
          try {
            await setDoc(doc(db, "categories", docId), {
              id: docId,
              name: item.name,
              slug: docId,
              icon: item.icon,
              themeColor: item.themeColor,
              color: item.themeColor,
              displayOrder: catIndex,
              order: catIndex,
              status: "active",
              enabled: true,
              groupCount: 0,
              createdBy: "system",
              updatedBy: "system",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            catsAdded++;
            console.log(`[SEED SUCCESS] Category created: "${item.name}" (${docId})`);
          } catch (err) {
            console.error(`[SEED ERROR] Failed to write Category "${item.name}":`, err);
          }
        } else {
          console.log(`[SEED SKIP] Category already exists: "${item.name}"`);
        }
        catIndex++;
      }

      // 2. Platforms (12 Defaults)
      const defaultPlatforms = [
        { name: "WhatsApp", icon: "whatsapp", themeColor: "#25D366", badgeColor: "bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20", invitePattern: "^https?:\\/\\/(chat\\.whatsapp\\.com|wa\\.me|whatsapp\\.com\\/channel)\\/.+", helpText: "Enter WhatsApp Group or Channel invite link (chat.whatsapp.com or wa.me)", errorText: "Invalid WhatsApp link" },
        { name: "Telegram", icon: "telegram", themeColor: "#229ED9", badgeColor: "bg-[#229ED9]/10 text-[#229ED9] border-[#229ED9]/20", invitePattern: "^https?:\\/\\/(t\\.me|telegram\\.me)\\/.+", helpText: "Enter Telegram Group or Channel link (t.me/...)", errorText: "Invalid Telegram link" },
        { name: "Discord", icon: "discord", themeColor: "#5865F2", badgeColor: "bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/20", invitePattern: "^https?:\\/\\/(discord\\.gg|discord\\.com\\/invite)\\/.+", helpText: "Enter Discord server invite link (discord.gg/...)", errorText: "Invalid Discord link" },
        { name: "Facebook Groups", icon: "facebook", themeColor: "#1877F2", badgeColor: "bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/20", invitePattern: "^https?:\\/\\/(facebook\\.com|fb\\.com)\\/.+", helpText: "Enter Facebook Group URL", errorText: "Invalid Facebook URL" },
        { name: "Instagram Broadcast", icon: "instagram", themeColor: "#E4405F", badgeColor: "bg-[#E4405F]/10 text-[#E4405F] border-[#E4405F]/20", invitePattern: "^https?:\\/\\/(instagram\\.com|ig\\.me)\\/.+", helpText: "Enter Instagram Broadcast channel link", errorText: "Invalid Instagram URL" },
        { name: "X Communities", icon: "x", themeColor: "#111111", badgeColor: "bg-[#111111]/10 text-[#111111] border-[#111111]/20", invitePattern: "^https?:\\/\\/(x\\.com|twitter\\.com)\\/.+", helpText: "Enter X Community link", errorText: "Invalid X URL" },
        { name: "LinkedIn Groups", icon: "linkedin", themeColor: "#0A66C2", badgeColor: "bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20", invitePattern: "^https?:\\/\\/(linkedin\\.com)\\/.+", helpText: "Enter LinkedIn Group link", errorText: "Invalid LinkedIn URL" },
        { name: "YouTube Channels", icon: "youtube", themeColor: "#FF0000", badgeColor: "bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/20", invitePattern: "^https?:\\/\\/(youtube\\.com|youtu\\.be)\\/.+", helpText: "Enter YouTube Channel link", errorText: "Invalid YouTube URL" },
        { name: "Reddit", icon: "reddit", themeColor: "#FF4500", badgeColor: "bg-[#FF4500]/10 text-[#FF4500] border-[#FF4500]/20", invitePattern: "^https?:\\/\\/(reddit\\.com|r\\.ddit)\\/.+", helpText: "Enter Subreddit link (reddit.com/r/...)", errorText: "Invalid Reddit URL" },
        { name: "Signal", icon: "signal", themeColor: "#3A76F0", badgeColor: "bg-[#3A76F0]/10 text-[#3A76F0] border-[#3A76F0]/20", invitePattern: "^https?:\\/\\/(signal\\.group|signal\\.me)\\/.+", helpText: "Enter Signal Group invite link (signal.group/...)", errorText: "Invalid Signal link" },
        { name: "Snapchat Groups", icon: "snapchat", themeColor: "#FFFC00", badgeColor: "bg-[#FFFC00]/10 text-[#111111] border-[#FFFC00]/30", invitePattern: "^https?:\\/\\/(www\\.)?(snapchat\\.com|add\\.snapchat\\.com)\\/.+", helpText: "Enter Snapchat Group link", errorText: "Invalid Snapchat link" },
        { name: "Slack", icon: "slack", themeColor: "#4A154B", badgeColor: "bg-[#4A154B]/10 text-[#4A154B] border-[#4A154B]/20", invitePattern: "^https?:\\/\\/(join\\.slack\\.com|app\\.slack\\.com)\\/.+", helpText: "Enter Slack Workspace link", errorText: "Invalid Slack link" },
      ];

      console.log("[SEED] Fetching existing 'platforms' collection...");
      const platSnap = await getDocs(collection(db, "platforms"));
      const existingPlatIds = new Set(platSnap.docs.map((d) => d.id.toLowerCase()));
      const existingPlatSlugs = new Set(platSnap.docs.map((d) => (d.data().slug || "").toLowerCase()));
      const existingPlatNames = new Set(platSnap.docs.map((d) => (d.data().name || "").toLowerCase().trim()));

      let platIndex = 1;
      for (const item of defaultPlatforms) {
        const docId = slugify(item.name);
        const lowerDocId = docId.toLowerCase();
        const lowerName = item.name.toLowerCase().trim();

        if (!existingPlatIds.has(lowerDocId) && !existingPlatSlugs.has(lowerDocId) && !existingPlatNames.has(lowerName)) {
          try {
            await setDoc(doc(db, "platforms", docId), {
              id: docId,
              name: item.name,
              slug: docId,
              icon: item.icon,
              themeColor: item.themeColor,
              color: item.themeColor,
              badgeColor: item.badgeColor,
              invitePattern: item.invitePattern,
              helpText: item.helpText,
              errorText: item.errorText,
              displayOrder: platIndex,
              order: platIndex,
              status: "active",
              enabled: true,
              createdBy: "system",
              updatedBy: "system",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            platsAdded++;
            console.log(`[SEED SUCCESS] Platform created: "${item.name}" (${docId})`);
          } catch (err) {
            console.error(`[SEED ERROR] Failed to write Platform "${item.name}":`, err);
          }
        } else {
          console.log(`[SEED SKIP] Platform already exists: "${item.name}"`);
        }
        platIndex++;
      }

      // 3. Content Types (12 Defaults)
      const defaultContentTypes = [
        { name: "General Discussion", icon: "MessageCircle", themeColor: "#3b82f6" },
        { name: "News & Updates", icon: "Bell", themeColor: "#ef4444" },
        { name: "Help & Support", icon: "HelpCircle", themeColor: "#10b981" },
        { name: "Learning", icon: "BookOpen", themeColor: "#8b5cf6" },
        { name: "Jobs", icon: "Briefcase", themeColor: "#f59e0b" },
        { name: "Business", icon: "Building", themeColor: "#059669" },
        { name: "Buy & Sell", icon: "Tag", themeColor: "#d97706" },
        { name: "Room Rent", icon: "Home", themeColor: "#7c3aed" },
        { name: "Events", icon: "Calendar", themeColor: "#ea580c" },
        { name: "Announcements", icon: "Megaphone", themeColor: "#ec4899" },
        { name: "Q&A", icon: "MessageSquareCode", themeColor: "#0284c7" },
        { name: "Community Chat", icon: "Users", themeColor: "#06b6d4" },
      ];

      console.log("[SEED] Fetching existing 'contentTypes' collection...");
      const ctSnap = await getDocs(collection(db, "contentTypes"));
      const existingCtIds = new Set(ctSnap.docs.map((d) => d.id.toLowerCase()));
      const existingCtSlugs = new Set(ctSnap.docs.map((d) => (d.data().slug || "").toLowerCase()));
      const existingCtNames = new Set(ctSnap.docs.map((d) => (d.data().name || "").toLowerCase().trim()));

      let ctIndex = 1;
      for (const item of defaultContentTypes) {
        const docId = slugify(item.name);
        const lowerDocId = docId.toLowerCase();
        const lowerName = item.name.toLowerCase().trim();

        if (!existingCtIds.has(lowerDocId) && !existingCtSlugs.has(lowerDocId) && !existingCtNames.has(lowerName)) {
          try {
            await setDoc(doc(db, "contentTypes", docId), {
              id: docId,
              name: item.name,
              slug: docId,
              icon: item.icon,
              themeColor: item.themeColor,
              color: item.themeColor,
              displayOrder: ctIndex,
              order: ctIndex,
              status: "active",
              enabled: true,
              createdBy: "system",
              updatedBy: "system",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            ctsAdded++;
            console.log(`[SEED SUCCESS] ContentType created: "${item.name}" (${docId})`);
          } catch (err) {
            console.error(`[SEED ERROR] Failed to write ContentType "${item.name}":`, err);
          }
        } else {
          console.log(`[SEED SKIP] ContentType already exists: "${item.name}"`);
        }
        ctIndex++;
      }

      // 4. Languages (15 Defaults)
      const defaultLanguages = [
        { name: "Hindi", code: "hi", icon: "Languages", themeColor: "#f97316" },
        { name: "English", code: "en", icon: "Languages", themeColor: "#3b82f6" },
        { name: "Bengali", code: "bn", icon: "Languages", themeColor: "#10b981" },
        { name: "Telugu", code: "te", icon: "Languages", themeColor: "#8b5cf6" },
        { name: "Marathi", code: "mr", icon: "Languages", themeColor: "#ec4899" },
        { name: "Tamil", code: "ta", icon: "Languages", themeColor: "#f59e0b" },
        { name: "Gujarati", code: "gu", icon: "Languages", themeColor: "#06b6d4" },
        { name: "Kannada", code: "kn", icon: "Languages", themeColor: "#6366f1" },
        { name: "Malayalam", code: "ml", icon: "Languages", themeColor: "#14b8a6" },
        { name: "Punjabi", code: "pa", icon: "Languages", themeColor: "#ef4444" },
        { name: "Odia", code: "or", icon: "Languages", themeColor: "#84cc16" },
        { name: "Assamese", code: "as", icon: "Languages", themeColor: "#a855f7" },
        { name: "Urdu", code: "ur", icon: "Languages", themeColor: "#059669" },
        { name: "Sanskrit", code: "sa", icon: "Languages", themeColor: "#d97706" },
        { name: "Other", code: "other", icon: "Languages", themeColor: "#64748b" },
      ];

      console.log("[SEED] Fetching existing 'languages' collection...");
      const langSnap = await getDocs(collection(db, "languages"));
      const existingLangIds = new Set(langSnap.docs.map((d) => d.id.toLowerCase()));
      const existingLangSlugs = new Set(langSnap.docs.map((d) => (d.data().slug || "").toLowerCase()));
      const existingLangNames = new Set(langSnap.docs.map((d) => (d.data().name || "").toLowerCase().trim()));

      let langIndex = 1;
      for (const item of defaultLanguages) {
        const docId = slugify(item.name);
        const lowerDocId = docId.toLowerCase();
        const lowerName = item.name.toLowerCase().trim();

        if (!existingLangIds.has(lowerDocId) && !existingLangSlugs.has(lowerDocId) && !existingLangNames.has(lowerName)) {
          try {
            await setDoc(doc(db, "languages", docId), {
              id: docId,
              name: item.name,
              code: item.code,
              slug: docId,
              icon: item.icon,
              themeColor: item.themeColor,
              color: item.themeColor,
              displayOrder: langIndex,
              order: langIndex,
              status: "active",
              enabled: true,
              createdBy: "system",
              updatedBy: "system",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            langsAdded++;
            console.log(`[SEED SUCCESS] Language created: "${item.name}" (${docId})`);
          } catch (err) {
            console.error(`[SEED ERROR] Failed to write Language "${item.name}":`, err);
          }
        } else {
          console.log(`[SEED SKIP] Language already exists: "${item.name}"`);
        }
        langIndex++;
      }

      console.log(`[SEED SUMMARY] Seeding completed: ${catsAdded} categories, ${platsAdded} platforms, ${ctsAdded} contentTypes, ${langsAdded} languages added.`);

      // Audit existing platforms & taxonomies to repair any corrupted records
      await auditAndMigrateTaxonomies();

      return { categories: catsAdded, platforms: platsAdded, contentTypes: ctsAdded, languages: langsAdded };
    } catch (err) {
      console.error("[SEED CRITICAL ERROR] Exception during seedDefaultTaxonomies:", err);
      return { categories: 0, platforms: 0, contentTypes: 0, languages: 0 };
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}

// ─── Broadcasts & Admin Notifications ──────────────────────────────────────────

export async function broadcastAnnouncement(title: string, message: string): Promise<void> {
  const users = await getAllUsers();
  await Promise.all(
    users.map((u) =>
      addDoc(collection(db, "notifications"), {
        userId: u.uid,
        title,
        message,
        type: "system",
        read: false,
        createdAt: serverTimestamp(),
      })
    )
  );
}

export async function sendUserNotification(
  userId: string,
  title: string,
  message: string,
  type: "approval" | "rejection" | "report" | "system" = "system",
  groupId?: string
): Promise<void> {
  await addDoc(collection(db, "notifications"), {
    userId,
    title,
    message,
    type,
    groupId: groupId || "",
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function getAllNotificationsAdmin(): Promise<Notification[]> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return [];
    const snap = await getDocs(collection(db, "notifications"));
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
    return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  } catch {
    return [];
  }
}

export async function deleteNotificationAdmin(id: string): Promise<void> {
  await deleteDoc(doc(db, "notifications", id));
}

// ─── Static Pages & SEO Settings ────────────────────────────────────────────────

export async function getStaticPages(): Promise<Record<string, string>> {
  try {
    const snap = await getDoc(doc(db, "settings", "staticPages"));
    if (!snap.exists()) return {};
    return snap.data() as Record<string, string>;
  } catch {
    return {};
  }
}

export async function updateStaticPage(slug: string, content: string): Promise<void> {
  await setDoc(
    doc(db, "settings", "staticPages"),
    { [slug]: content, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getSeoSettings(): Promise<any> {
  try {
    const snap = await getDoc(doc(db, "settings", "seo"));
    if (!snap.exists()) {
      return {
        metaTitle: "LinkCloud — India's #1 Public Group & Channel Directory",
        metaDescription: "Discover verified WhatsApp groups, Telegram channels, Discord servers, and Facebook communities.",
        metaKeywords: "WhatsApp group links, Telegram channels, Discord servers, India communities",
        canonicalUrl: "https://linkcloud.in",
        ogImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200",
        twitterCard: "summary_large_image",
        robotsTxt: "User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://linkcloud.in/sitemap.xml",
      };
    }
    return snap.data();
  } catch {
    return {};
  }
}

export async function updateSeoSettings(data: any): Promise<void> {
  await setDoc(
    doc(db, "settings", "seo"),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── Analytics & Comprehensive Admin Stats ───────────────────────────────────

export async function getAdminStats() {
  const [
    groupsSnap,
    usersSnap,
    categoriesSnap,
    reportsSnap,
    contactsSnap,
    complaintsSnap,
    favoritesSnap,
    deletionsSnap,
  ] = await Promise.all([
    getDocs(collection(db, "groups")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "categories")),
    getDocs(collection(db, "reports")),
    getDocs(collection(db, "contacts")),
    getDocs(collection(db, "complaints")),
    getDocs(collection(db, "favorites")),
    getDocs(collection(db, "deletionRequests")),
  ]);

  const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
  const users = usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
  const reports = reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Report));
  const contacts = contactsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactMessage));
  const complaints = complaintsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Complaint));

  const pending = groups.filter((g) => g.status === "pending").length;
  const approved = groups.filter((g) => g.status === "approved").length;
  const rejected = groups.filter((g) => g.status === "rejected").length;
  const featured = groups.filter((g) => g.featured).length;
  const hidden = groups.filter((g) => g.hidden).length;
  const activeLinks = groups.filter((g) => !g.linkStatus || g.linkStatus.toLowerCase() === "active").length;
  const inactiveLinks = groups.filter((g) => g.linkStatus && g.linkStatus.toLowerCase() === "inactive").length;

  // Platform & Category Breakdown
  const platformCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const stateCounts: Record<string, number> = {};
  const districtCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};
  const languageCounts: Record<string, number> = {};

  groups.forEach((g) => {
    if (g.platform) platformCounts[g.platform] = (platformCounts[g.platform] || 0) + 1;
    if (g.categoryName) categoryCounts[g.categoryName] = (categoryCounts[g.categoryName] || 0) + 1;
    if (g.state) stateCounts[g.state] = (stateCounts[g.state] || 0) + 1;
    if (g.district) districtCounts[g.district] = (districtCounts[g.district] || 0) + 1;
    if (g.city) cityCounts[g.city] = (cityCounts[g.city] || 0) + 1;
    if (g.language) languageCounts[g.language] = (languageCounts[g.language] || 0) + 1;
  });

  const totalJoins = groups.reduce((sum, g) => sum + (g.joinCount || 0), 0);
  const totalViews = groups.reduce((sum, g) => sum + (g.viewsCount || 0), 0);

  // Top list sorted helpers
  const topPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);
  const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const topStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);
  const topDistricts = Object.entries(districtCounts).sort((a, b) => b[1] - a[1]);
  const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
  const topLanguages = Object.entries(languageCounts).sort((a, b) => b[1] - a[1]);

  const mostViewedGroups = [...groups].sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0)).slice(0, 5);
  const mostJoinedGroups = [...groups].sort((a, b) => (b.joinCount || 0) - (a.joinCount || 0)).slice(0, 5);

  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const unreadContacts = contacts.filter((c) => c.status === "unread").length;
  const pendingComplaints = complaints.filter((c) => c.status === "pending").length;
  const pendingDeletions = deletionsSnap.docs.filter((d) => d.data().status === "pending").length;

  return {
    totalVisitors: Math.max(totalViews + 1240, 1500),
    totalUsers: usersSnap.size,
    totalGroups: groups.length,
    pendingGroups: pending,
    approvedGroups: approved,
    rejectedGroups: rejected,
    featuredGroups: featured,
    hiddenGroups: hidden,
    activeLinks,
    inactiveLinks,
    totalCategories: categoriesSnap.size,
    totalPlatforms: Object.keys(platformCounts).length,
    totalLanguages: Object.keys(languageCounts).length,
    totalStates: Object.keys(stateCounts).length,
    totalDistricts: Object.keys(districtCounts).length,
    totalCities: Object.keys(cityCounts).length,
    totalFavorites: favoritesSnap.size,
    totalReports: reports.length,
    pendingReports,
    totalComplaints: complaints.length,
    pendingComplaints,
    unreadContacts,
    pendingDeletions,
    platformCounts,
    totalJoins,
    totalViews,
    topPlatforms,
    topCategories,
    topStates,
    topDistricts,
    topCities,
    topLanguages,
    mostViewedGroups,
    mostJoinedGroups,
    recentGroups: groups.slice(0, 5),
  };
}

// ─── Webmaster Site Settings ───────────────────────────────────────────────────

export async function getSiteSettings(): Promise<SiteSettings> {
  const defaultSettings: SiteSettings = {
    // Website Settings
    siteName: "LinkCloud",
    siteTagline: "India's Premium WhatsApp & Telegram Community Directory",
    siteLogo: "",
    favicon: "",
    homepageBanner: "",
    heroTitle: "Discover & Join India's Most Active WhatsApp & Telegram Communities",
    heroSubtitle: "Verified group links across 28 states, 50+ categories, and multiple platforms.",
    heroButtonText: "Explore Groups",
    heroButtonLink: "/groups",
    footerLogo: "",
    footerDescription: "LinkCloud is India's leading verified platform for discovering public WhatsApp groups, Telegram channels, and Discord servers.",
    copyrightText: "© 2026 LinkCloud Directory Services India. All rights reserved.",
    websiteTheme: "dark",
    maintenanceMode: false,

    // Contact Info
    contactEmail: "admin@linkcloud.in",
    supportEmail: "support@linkcloud.in",
    supportMobile: "+91 98765 43210",
    businessAddress: "Connaught Place, New Delhi, India 110001",
    officeHours: "Monday - Saturday: 09:00 AM - 07:00 PM IST",
    googleMapUrl: "https://maps.google.com",

    // Social Links
    facebookUrl: "https://facebook.com/linkcloudin",
    instagramUrl: "https://instagram.com/linkcloudin",
    telegramUrl: "https://t.me/linkcloudin",
    whatsappUrl: "https://whatsapp.com/channel/linkcloudin",
    youtubeUrl: "https://youtube.com/@linkcloudin",
    linkedinUrl: "https://linkedin.com/company/linkcloudin",
    twitterUrl: "https://x.com/linkcloudin",
    redditUrl: "https://reddit.com/r/linkcloudin",
    githubUrl: "https://github.com/linkcloudin",

    // Homepage Section Management
    heroSectionEnabled: true,
    featuredGroupsEnabled: true,
    latestGroupsEnabled: true,
    popularGroupsEnabled: true,
    popularCategoriesEnabled: true,
    popularPlatformsEnabled: true,
    statisticsSectionEnabled: true,
    testimonialsEnabled: true,
    faqSectionEnabled: true,
    newsletterSectionEnabled: true,
    footerEnabled: true,
    sectionOrder: [
      "hero",
      "categories",
      "platforms",
      "featured",
      "latest",
      "popular",
      "stats",
      "testimonials",
      "faq",
      "newsletter",
      "footer"
    ],

    // About Page
    aboutTitle: "About LinkCloud India",
    aboutDescription: "LinkCloud is India's premier community discovery platform built to connect millions of users with authentic, high-quality public groups and channels.",
    aboutMission: "Empowering Indian citizens to easily find, join, and grow safe educational, career, regional, and social communities.",
    aboutVision: "Building India's largest and safest directory of public social messaging groups with zero scam or broken links.",
    aboutUsContent: "LinkCloud is India's leading verified directory for WhatsApp, Telegram, and Discord communities.",
    aboutFeatures: [
      { title: "Instant Verification", desc: "Every link is checked to prevent dead or scam groups." },
      { title: "Regional & Multilingual", desc: "Filter by State, District, City, and 12+ Indian languages." },
      { title: "Categorized Communities", desc: "Jobs, Study, Crypto, Entertainment, Gaming, Tech, and more." }
    ],

    // Legal Pages
    privacyPolicyContent: "LinkCloud respects user privacy. We do not store or inspect private chat content, messages, or member lists.",
    termsContent: "By using LinkCloud, users agree not to submit illegal, spam, copyrighted, or prohibited group links.",
    dmcaContent: "To file a copyright takedown request under DMCA, please email admin@linkcloud.in with link details.",
    disclaimerContent: "LinkCloud is a public indexing platform and is not affiliated with WhatsApp, Telegram, Discord, Meta, or Google.",

    // SEO Management
    metaTitle: "LinkCloud - India's #1 WhatsApp, Telegram & Discord Group Directory",
    metaDescription: "Discover and join thousands of active WhatsApp groups, Telegram channels, and Discord communities in India.",
    metaKeywords: "WhatsApp groups, Telegram channels, Discord servers, India group links, study groups, job alerts",
    canonicalUrl: "https://linkcloud.in",
    ogImage: "https://linkcloud.in/og-banner.png",
    ogTitle: "LinkCloud - Join India's Top WhatsApp & Telegram Groups",
    ogDescription: "Discover verified active groups in Jobs, Education, Crypto, Tech, Movies, and regional communities across India.",
    twitterCardImage: "https://linkcloud.in/twitter-card.png",
    twitterCardTitle: "LinkCloud - WhatsApp & Telegram Directory",
    twitterCardDescription: "Find verified group invite links in India.",
    robotsTxtContent: "User-agent: *\nAllow: /\nSitemap: https://linkcloud.in/sitemap.xml",
    sitemapXmlContent: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n  <url>\n    <loc>https://linkcloud.in/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>https://linkcloud.in/groups</loc>\n    <changefreq>hourly</changefreq>\n    <priority>0.9</priority>\n  </url>\n</urlset>",
    structuredDataJson: "{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"WebSite\",\n  \"name\": \"LinkCloud\",\n  \"url\": \"https://linkcloud.in\"\n}",

    // System Settings
    allowPublicSubmissions: true,
    groupSubmissionEnabled: true,
    userRegistrationEnabled: true,
    googleLoginEnabled: true,
    emailLoginEnabled: true,
    mobileOtpLoginEnabled: true,
    favoritesEnabled: true,
    reportSystemEnabled: true,
    complaintSystemEnabled: true,
    contactFormEnabled: true,
    notificationsEnabled: true,

    // Filter Management Settings
    filterSettings: {
      categoryFilterEnabled: true,
      platformFilterEnabled: true,
      contentTypeFilterEnabled: true,
      languageFilterEnabled: true,
      stateFilterEnabled: true,
      districtFilterEnabled: true,
      cityFilterEnabled: true,
      linkStatusFilterEnabled: true,
      featuredFilterEnabled: true,
      popularFilterEnabled: true,
      newestFilterEnabled: true,
      verifiedFilterEnabled: true,
      approvalStatusFilterEnabled: true,
    },

    // Cloudinary
    cloudinaryCloudName: "linkcloud",
    cloudinaryUploadPreset: "linkcloud",
  };

  try {
    const snap = await getDoc(doc(db, "settings", "site"));
    if (!snap.exists()) return defaultSettings;
    return { ...defaultSettings, ...snap.data() } as SiteSettings;
  } catch (err) {
    console.warn("Error reading site settings from Firestore:", err);
    return defaultSettings;
  }
}

export async function updateSiteSettings(settings: Partial<SiteSettings>): Promise<void> {
  await setDoc(doc(db, "settings", "site"), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── Audit Log Helper ─────────────────────────────────────────────────────────

export async function logAuditEvent(
  action: string,
  details: string,
  adminEmail: string = "admin@linkcloud.in",
  adminUid: string = "webmaster"
): Promise<void> {
  try {
    await addDoc(collection(db, "audit_logs"), {
      action,
      details,
      adminEmail,
      adminUid,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Error logging audit event:", err);
  }
}

export async function getAuditLogs(limitCount = 50): Promise<import("./types").AuditLog[]> {
  try {
    const q = query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("./types").AuditLog));
  } catch (err) {
    console.warn("Error fetching audit logs:", err);
    return [];
  }
}

// ─── Email Change History & Notifications ──────────────────────────────────────

export async function logEmailChangeHistory(record: Omit<import("./types").EmailChangeRecord, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, `users/${record.uid}/email_history`), {
      ...record,
      changedOn: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.warn("Error logging email change history:", err);
    return "";
  }
}

export async function getUserEmailHistory(uid: string): Promise<import("./types").EmailChangeRecord[]> {
  try {
    const q = query(collection(db, `users/${uid}/email_history`), orderBy("changedOn", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("./types").EmailChangeRecord));
  } catch (err) {
    console.warn("Error getting user email history:", err);
    return [];
  }
}

export async function updateEmailHistoryStatus(uid: string, newEmail: string, status: "verified" | "cancelled"): Promise<void> {
  try {
    const q = query(
      collection(db, `users/${uid}/email_history`),
      where("newEmail", "==", newEmail.trim().toLowerCase()),
      where("status", "==", "pending")
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(d.ref, {
        status,
        verificationTime: status === "verified" ? serverTimestamp() : null,
      });
    }
  } catch (err) {
    console.warn("Error updating email history status:", err);
  }
}

export async function createUserNotification(
  userId: string,
  title: string,
  message: string,
  type: "approval" | "rejection" | "report" | "system" = "system"
): Promise<void> {
  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Error creating user notification:", err);
  }
}

// ─── FAQ Management ──────────────────────────────────────────────────────────

export async function getFAQs(): Promise<import("./types").FAQItem[]> {
  try {
    const snap = await getDocs(collection(db, "faqs"));
    const faqs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("./types").FAQItem));
    return faqs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  } catch (err) {
    console.warn("Error getting FAQs:", err);
    return [
      { id: "1", question: "How do I submit my WhatsApp group to LinkCloud?", answer: "Click 'Submit Group' at the top, select platform, category, state, and paste your group invite link.", category: "General", enabled: true, sortOrder: 1 },
      { id: "2", question: "Is joining groups on LinkCloud free?", answer: "Yes, joining and discovering public groups on LinkCloud is 100% free forever.", category: "General", enabled: true, sortOrder: 2 },
      { id: "3", question: "How can I report a broken or inappropriate group link?", answer: "Click the 'Report' button on any group card or group details page.", category: "Safety", enabled: true, sortOrder: 3 },
    ];
  }
}

export async function addFAQ(faq: Omit<import("./types").FAQItem, "id">): Promise<string> {
  const docRef = await addDoc(collection(db, "faqs"), { ...faq, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function updateFAQ(id: string, updates: Partial<import("./types").FAQItem>): Promise<void> {
  await updateDoc(doc(db, "faqs", id), updates);
}

export async function deleteFAQ(id: string): Promise<void> {
  await deleteDoc(doc(db, "faqs", id));
}

// ─── Help Center Management ───────────────────────────────────────────────────

export async function getHelpArticles(): Promise<import("./types").HelpArticle[]> {
  try {
    const snap = await getDocs(collection(db, "help_articles"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("./types").HelpArticle));
  } catch (err) {
    console.warn("Error getting help articles:", err);
    return [
      { id: "h1", category: "Account & Login", title: "How to register and verify your profile", content: "You can sign up using Email, Google, or Phone number.", views: 120 },
      { id: "h2", category: "Group Submissions", title: "Why was my group submission rejected?", content: "Groups may be rejected for dead links, missing rules, or adult content.", views: 240 },
    ];
  }
}

export async function addHelpArticle(article: Omit<import("./types").HelpArticle, "id">): Promise<string> {
  const docRef = await addDoc(collection(db, "help_articles"), { ...article, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function updateHelpArticle(id: string, updates: Partial<import("./types").HelpArticle>): Promise<void> {
  await updateDoc(doc(db, "help_articles", id), updates);
}

export async function deleteHelpArticle(id: string): Promise<void> {
  await deleteDoc(doc(db, "help_articles", id));
}

// ─── Search Analytics ─────────────────────────────────────────────────────────

export async function logSearchQuery(keyword: string, filters?: { category?: string; platform?: string; language?: string; location?: string }): Promise<void> {
  if (!keyword || keyword.trim().length < 2) return;
  try {
    const cleanKey = keyword.trim().toLowerCase();
    const docRef = doc(db, "search_logs", cleanKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, { count: increment(1), updatedAt: serverTimestamp() });
    } else {
      await setDoc(docRef, {
        keyword: cleanKey,
        category: filters?.category || "",
        platform: filters?.platform || "",
        language: filters?.language || "",
        location: filters?.location || "",
        count: 1,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn("Error logging search query:", err);
  }
}

export async function getSearchAnalytics(): Promise<import("./types").SearchAnalytics[]> {
  try {
    const q = query(collection(db, "search_logs"), orderBy("count", "desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as import("./types").SearchAnalytics));
  } catch (err) {
    console.warn("Error getting search analytics:", err);
    return [
      { id: "s1", keyword: "job alerts", count: 48, category: "Jobs", platform: "WhatsApp" },
      { id: "s2", keyword: "upsc study", count: 35, category: "Education", platform: "Telegram" },
      { id: "s3", keyword: "crypto india", count: 29, category: "Crypto", platform: "Discord" },
    ];
  }
}

// ─── Visitor Traffic Logging ─────────────────────────────────────────────────

export async function logVisitorHit(): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const docRef = doc(db, "visitor_stats", today);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, { count: increment(1) });
    } else {
      await setDoc(docRef, { date: today, count: 1 });
    }
  } catch (err) {
    console.warn("Error logging visitor hit:", err);
  }
}

// ─── Location Management System (States, Districts, Cities) ───────────────────

export interface SeedLocationsResult {
  statesAdded: number;
  districtsAdded: number;
  skipped: number;
  errors: number;
  success: boolean;
  message: string;
}

let locationSeedingPromise: Promise<SeedLocationsResult> | null = null;

/**
 * Idempotently seeds default India locations (28 States + 8 UTs + all official districts) into Firestore.
 * Only inserts missing records; never overwrites existing Webmaster edits.
 * Restricted to authenticated Webmasters to prevent permission errors.
 */
export async function seedDefaultLocations(): Promise<SeedLocationsResult> {
  if (locationSeedingPromise) {
    return locationSeedingPromise;
  }

  locationSeedingPromise = (async () => {
    console.log("[LOCATION SEED] Starting...");
    const isWebmaster = await isCurrentUserWebmaster();
    if (!isWebmaster) {
      console.log("[LOCATION SEED] Current user is not a Webmaster. Skipping client-side location seeding.");
      return {
        statesAdded: 0,
        districtsAdded: 0,
        skipped: 0,
        errors: 0,
        success: true,
        message: "Location records are read-only for this session.",
      };
    }

    let statesAdded = 0;
    let districtsAdded = 0;
    let skipped = 0;
    let errors = 0;

    const UT_NAMES = new Set([
      "Andaman and Nicobar Islands",
      "Chandigarh",
      "Dadra and Nagar Haveli and Daman and Diu",
      "Delhi",
      "Jammu and Kashmir",
      "Ladakh",
      "Lakshadweep",
      "Puducherry",
    ]);

    try {
      const statesSnap = await getDocs(collection(db, "states"));
      const existingStateIds = new Set(statesSnap.docs.map((d) => d.id));

      const districtsSnap = await getDocs(collection(db, "districts"));
      const existingDistrictIds = new Set(districtsSnap.docs.map((d) => d.id));

      console.log(`[LOCATION SYNC] States found: ${statesSnap.size}`);
      console.log(`[LOCATION SYNC] Districts found: ${districtsSnap.size}`);

      let batch = writeBatch(db);
      let count = 0;
      let batchNumber = 1;

      const commitBatchIfNeeded = async (force = false) => {
        if ((count >= 400 || force) && count > 0) {
          console.log(`[LOCATION SEED] Writing batch ${batchNumber}...`);
          await batch.commit();
          batchNumber++;
          batch = writeBatch(db);
          count = 0;
        }
      };

      let stateOrder = 0;
      for (const st of INDIA_STATES) {
        stateOrder++;
        const stateId = st.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
        const isUT = UT_NAMES.has(st.name);

        // 1. Seed State if missing
        if (!existingStateIds.has(stateId)) {
          console.log(`[LOCATION SEED ADD] State: ${st.name}`);
          const stateRef = doc(db, "states", stateId);
          batch.set(stateRef, {
            id: stateId,
            name: st.name.trim(),
            slug: stateId,
            type: isUT ? "ut" : "state",
            country: "India",
            enabled: true,
            status: "active",
            displayOrder: stateOrder,
            createdBy: "system",
            updatedBy: "system",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          count++;
          statesAdded++;
          existingStateIds.add(stateId);
          await commitBatchIfNeeded();
        } else {
          skipped++;
        }

        // 2. Seed Districts if missing
        let districtOrder = 0;
        for (const distName of st.districts) {
          districtOrder++;
          const distId = `${st.name}-${distName}`.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
          if (!existingDistrictIds.has(distId)) {
            console.log(`[LOCATION SEED ADD] District: ${distName} (${st.name})`);
            const distRef = doc(db, "districts", distId);
            batch.set(distRef, {
              id: distId,
              stateId: stateId,
              stateName: st.name.trim(),
              name: distName.trim(),
              slug: distName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
              country: "India",
              enabled: true,
              status: "active",
              displayOrder: districtOrder,
              createdBy: "system",
              updatedBy: "system",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            count++;
            districtsAdded++;
            existingDistrictIds.add(distId);
            await commitBatchIfNeeded();
          } else {
            skipped++;
          }
        }
      }

      if (count > 0) {
        await commitBatchIfNeeded(true);
      }

      if (statesAdded === 0 && districtsAdded === 0) {
        console.log("[LOCATION SEED] Database already synchronized. Nothing to add.");
      }

      console.log(`[LOCATION SYNC] States found: ${existingStateIds.size}`);
      console.log(`[LOCATION SYNC] Districts found: ${existingDistrictIds.size}`);
      console.log(`[LOCATION SYNC] States added: ${statesAdded}`);
      console.log(`[LOCATION SYNC] Districts added: ${districtsAdded}`);
      console.log(`[LOCATION SYNC] Duplicates skipped: ${skipped}`);
      console.log(`[LOCATION SYNC] Errors: ${errors}`);
      console.log("[LOCATION SEED] Completed successfully.");

      return {
        statesAdded,
        districtsAdded,
        skipped,
        errors: 0,
        success: true,
        message:
          statesAdded > 0 || districtsAdded > 0
            ? `Successfully added ${statesAdded} states/UTs and ${districtsAdded} districts.`
            : "India location database is already synchronized.",
      };
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        console.warn("[LOCATION SEED NOTICE] Insufficient permissions to write locations to Firestore. Skipping.");
        return {
          statesAdded,
          districtsAdded,
          skipped,
          errors: 0,
          success: true,
          message: "Location records are read-only for this session.",
        };
      }
      console.error("[LOCATION SEED ERROR]", err);
      return {
        statesAdded,
        districtsAdded,
        skipped,
        errors: 1,
        success: false,
        message: err?.message || "Error seeding default locations to Firestore.",
      };
    } finally {
      locationSeedingPromise = null;
    }
  })();

  return locationSeedingPromise;
}

/**
 * Fetch all States from Firestore 'states' collection.
 * Uses DEFAULT_LOCATION_STATES fallback if Firestore returns empty.
 */
export async function getAllLocationStates(includeDisabled = false): Promise<LocationState[]> {
  try {
    const snap = await getDocs(collection(db, "states"));
    if (snap.empty) {
      return includeDisabled
        ? DEFAULT_LOCATION_STATES
        : DEFAULT_LOCATION_STATES.filter((s) => s.enabled !== false && s.status !== "disabled");
    }

    const items: LocationState[] = [];
    snap.forEach((d) => {
      const data = d.data();
      items.push({ id: d.id, ...data } as LocationState);
    });

    items.sort((a, b) => {
      if ((a.displayOrder ?? 0) !== (b.displayOrder ?? 0)) {
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
    return includeDisabled ? items : items.filter((s) => s.enabled !== false && s.status !== "disabled");
  } catch (err) {
    console.warn("Error fetching states from Firestore:", err);
    return includeDisabled
      ? DEFAULT_LOCATION_STATES
      : DEFAULT_LOCATION_STATES.filter((s) => s.enabled !== false && s.status !== "disabled");
  }
}

/**
 * Fetch Districts for a given State from Firestore 'districts' collection.
 * Uses static in-memory fallback without attempting unauthorized writes.
 */
export async function getDistrictsForStateFirestore(
  stateName: string,
  includeDisabled = false
): Promise<LocationDistrict[]> {
  if (!stateName) return [];
  try {
    const q = query(collection(db, "districts"), where("stateName", "==", stateName));
    const snap = await getDocs(q);

    if (snap.empty) {
      const stateObj = INDIA_STATES.find((s) => s.name.toLowerCase().trim() === stateName.toLowerCase().trim());
      if (stateObj) {
        const defaultDistricts: LocationDistrict[] = stateObj.districts.map((distName, idx) => ({
          id: `${stateName}-${distName}`.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
          stateName: stateObj.name,
          name: distName.trim(),
          slug: distName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
          country: "India",
          enabled: true,
          status: "active",
          displayOrder: idx + 1,
        }));
        return includeDisabled
          ? defaultDistricts
          : defaultDistricts.filter((d) => d.enabled !== false && d.status !== "disabled");
      }
      return [];
    }

    const items: LocationDistrict[] = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as LocationDistrict);
    });

    items.sort((a, b) => a.name.localeCompare(b.name));
    return includeDisabled ? items : items.filter((d) => d.enabled);
  } catch (err) {
    console.warn("Error fetching districts from Firestore:", err);
    const stateObj = INDIA_STATES.find((s) => s.name.toLowerCase().trim() === stateName.toLowerCase().trim());
    if (!stateObj) return [];
    const defaultDistricts: LocationDistrict[] = stateObj.districts.map((d, idx) => ({
      id: `${stateName}-${d}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      stateName: stateObj.name,
      name: d.trim(),
      slug: d.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      country: "India",
      enabled: true,
      status: "active",
      displayOrder: idx + 1,
    }));
    return includeDisabled
      ? defaultDistricts
      : defaultDistricts.filter((d) => d.enabled !== false && d.status !== "disabled");
  }
}

/**
 * Fetch Cities for a given State/District from Firestore 'cities' collection.
 */
export async function getCitiesForLocationFirestore(
  stateName: string,
  districtName?: string,
  includeDisabled = false
): Promise<LocationCity[]> {
  if (!stateName) return [];
  try {
    let q = query(collection(db, "cities"), where("stateName", "==", stateName));
    if (districtName) {
      q = query(collection(db, "cities"), where("stateName", "==", stateName), where("districtName", "==", districtName));
    }
    const snap = await getDocs(q);
    const items: LocationCity[] = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as LocationCity);
    });
    items.sort((a, b) => a.name.localeCompare(b.name));
    return includeDisabled ? items : items.filter((c) => c.enabled);
  } catch (err) {
    console.warn("Error fetching cities from Firestore:", err);
    return [];
  }
}

/**
 * Check how many active groups use a location (State, District, or City).
 */
export async function getGroupsCountForLocation(
  stateName?: string,
  districtName?: string,
  cityName?: string
): Promise<number> {
  try {
    const constraints: any[] = [];
    if (stateName) constraints.push(where("state", "==", stateName));
    if (districtName) constraints.push(where("district", "==", districtName));
    if (cityName) constraints.push(where("city", "==", cityName));

    if (constraints.length === 0) return 0;

    const q = query(collection(db, "groups"), ...constraints);
    const snap = await getDocs(q);
    return snap.size;
  } catch (err) {
    console.warn("Error checking group count for location:", err);
    return 0;
  }
}

// ─── STATE CRUD ───

export async function addStateFirestore(
  name: string,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<string> {
  const cleanName = name.trim();
  const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const docRef = doc(db, "states", id);
  await setDoc(docRef, {
    id,
    name: cleanName,
    slug: id,
    enabled: true,
    displayOrder: 0,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent("Location Updated", `Added State "${cleanName}"`, adminEmail, adminUid);
  return id;
}

export async function toggleStateFirestore(
  id: string,
  name: string,
  enabled: boolean,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<void> {
  const docRef = doc(db, "states", id);
  await updateDoc(docRef, {
    enabled,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent(
    "Location Updated",
    `${enabled ? "Enabled" : "Disabled"} State "${name}"`,
    adminEmail,
    adminUid
  );
}

export async function updateStateFirestore(
  id: string,
  newName: string,
  enabled: boolean,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<void> {
  const docRef = doc(db, "states", id);
  await updateDoc(docRef, {
    name: newName.trim(),
    enabled,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent(
    "Location Updated",
    `Updated State "${newName}" (enabled: ${enabled})`,
    adminEmail,
    adminUid
  );
}

export async function deleteStateFirestore(
  id: string,
  name: string,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<void> {
  await deleteDoc(doc(db, "states", id));
  await logAuditEvent("Location Updated", `Deleted State "${name}"`, adminEmail, adminUid);
}

// ─── DISTRICT CRUD ───

export async function addDistrictFirestore(
  stateName: string,
  name: string,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<string> {
  const cleanName = name.trim();
  const id = `${stateName}-${cleanName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const docRef = doc(db, "districts", id);
  await setDoc(docRef, {
    id,
    stateName,
    name: cleanName,
    slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    enabled: true,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent(
    "Location Updated",
    `Added District "${cleanName}" in State "${stateName}"`,
    adminEmail,
    adminUid
  );
  return id;
}

export async function toggleDistrictFirestore(
  id: string,
  stateName: string,
  name: string,
  enabled: boolean,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<void> {
  const docRef = doc(db, "districts", id);
  await updateDoc(docRef, {
    enabled,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent(
    "Location Updated",
    `${enabled ? "Enabled" : "Disabled"} District "${name}" in "${stateName}"`,
    adminEmail,
    adminUid
  );
}

export async function updateDistrictFirestore(
  id: string,
  newName: string,
  enabled: boolean,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<void> {
  const docRef = doc(db, "districts", id);
  await updateDoc(docRef, {
    name: newName.trim(),
    enabled,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent(
    "Location Updated",
    `Updated District "${newName}"`,
    adminEmail,
    adminUid
  );
}

export async function deleteDistrictFirestore(
  id: string,
  name: string,
  stateName: string,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<void> {
  await deleteDoc(doc(db, "districts", id));
  await logAuditEvent(
    "Location Updated",
    `Deleted District "${name}" from "${stateName}"`,
    adminEmail,
    adminUid
  );
}

// ─── CITY CRUD ───

export async function addCityFirestore(
  stateName: string,
  districtName: string,
  name: string,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<string> {
  const cleanName = name.trim();
  const id = `${stateName}-${districtName || "all"}-${cleanName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const docRef = doc(db, "cities", id);
  await setDoc(docRef, {
    id,
    stateName,
    districtName: districtName || "",
    name: cleanName,
    slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    enabled: true,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent(
    "Location Updated",
    `Added City "${cleanName}" in "${stateName}"`,
    adminEmail,
    adminUid
  );
  return id;
}

export async function toggleCityFirestore(
  id: string,
  name: string,
  enabled: boolean,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<void> {
  const docRef = doc(db, "cities", id);
  await updateDoc(docRef, {
    enabled,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent(
    "Location Updated",
    `${enabled ? "Enabled" : "Disabled"} City "${name}"`,
    adminEmail,
    adminUid
  );
}

export async function updateCityFirestore(
  id: string,
  newName: string,
  enabled: boolean,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<void> {
  const docRef = doc(db, "cities", id);
  await updateDoc(docRef, {
    name: newName.trim(),
    enabled,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent(
    "Location Updated",
    `Updated City "${newName}"`,
    adminEmail,
    adminUid
  );
}

export async function deleteCityFirestore(
  id: string,
  name: string,
  adminUid = "webmaster",
  adminEmail = "admin@linkcloud.in"
): Promise<void> {
  await deleteDoc(doc(db, "cities", id));
  await logAuditEvent("Location Updated", `Deleted City "${name}"`, adminEmail, adminUid);
}



