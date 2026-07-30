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
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Group,
  UserProfile,
  Category,
  Report,
  ContactMessage,
  Notification,
  Favorite,
  SiteSettings,
  GroupFilters,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupFromDoc(snap: DocumentSnapshot | QueryDocumentSnapshot): Group {
  return { id: snap.id, ...snap.data() } as Group;
}

// ─── Groups ───────────────────────────────────────────────────────────────────

// Fetch all approved groups, sort client-side to avoid composite index requirements
async function getAllApproved(): Promise<Group[]> {
  const q = query(collection(db, "groups"), where("status", "==", "approved"));
  const snap = await getDocs(q);
  const docs = snap.docs.map(groupFromDoc);
  return docs.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}

export async function getApprovedGroups(filters?: GroupFilters): Promise<Group[]> {
  const all = await getAllApproved();
  if (!filters) return all;
  return all.filter((g) => {
    if (filters.platform && g.platform !== filters.platform) return false;
    if (filters.categoryId && g.categoryId !== filters.categoryId) return false;
    if (filters.state && g.state !== filters.state) return false;
    if (filters.district && g.district !== filters.district) return false;
    if (filters.city) {
      const c = filters.city.toLowerCase();
      if (!g.city?.toLowerCase().includes(c)) return false;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      return (
        g.name.toLowerCase().includes(s) ||
        g.description?.toLowerCase().includes(s) ||
        g.tags?.some((t) => t.toLowerCase().includes(s)) ||
        g.city?.toLowerCase().includes(s) ||
        g.district?.toLowerCase().includes(s)
      );
    }
    return true;
  });
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
  const snap = await getDoc(doc(db, "groups", id));
  if (!snap.exists()) return null;
  return groupFromDoc(snap);
}

export async function getPendingGroups(): Promise<Group[]> {
  // No orderBy to avoid composite index requirement; sort client-side
  const q = query(collection(db, "groups"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  const docs = snap.docs.map(groupFromDoc);
  return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export async function getAllGroupsAdmin(): Promise<Group[]> {
  const snap = await getDocs(collection(db, "groups"));
  const docs = snap.docs.map(groupFromDoc);
  return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export async function getUserGroups(uid: string): Promise<Group[]> {
  // No orderBy to avoid composite index requirement; sort client-side
  const q = query(collection(db, "groups"), where("submittedBy", "==", uid));
  const snap = await getDocs(q);
  const docs = snap.docs.map(groupFromDoc);
  return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export async function createGroup(
  data: Omit<Group, "id" | "createdAt" | "updatedAt" | "joinCount" | "reportCount" | "memberCount">
): Promise<string> {
  const ref = await addDoc(collection(db, "groups"), {
    ...data,
    status: "pending",
    joinCount: 0,
    reportCount: 0,
    memberCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserProfile;
}

export async function upsertUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
}

export async function updateUserRole(uid: string, role: "user" | "admin"): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role });
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
}

export async function createCategory(data: Omit<Category, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "categories"), {
    ...data,
    groupCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
  await updateDoc(doc(db, "categories", id), data);
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

// ─── Favorites ────────────────────────────────────────────────────────────────

export async function getUserFavorites(userId: string): Promise<Favorite[]> {
  const q = query(collection(db, "favorites"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Favorite));
  return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
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
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
  return docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
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

// ─── Site Settings ────────────────────────────────────────────────────────────

const SETTINGS_DOC = "global";

export async function getSiteSettings(): Promise<SiteSettings> {
  const snap = await getDoc(doc(db, "settings", SETTINGS_DOC));
  if (!snap.exists()) {
    return {
      siteName: "LinkCloud",
      siteTagline: "India's Premium Community Directory",
      contactEmail: "hello@linkcloud.in",
      allowPublicSubmissions: true,
      maintenanceMode: false,
    };
  }
  return snap.data() as SiteSettings;
}

export async function updateSiteSettings(data: Partial<SiteSettings>): Promise<void> {
  await setDoc(
    doc(db, "settings", SETTINGS_DOC),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const [groupsSnap, usersSnap, categoriesSnap, reportsSnap, contactsSnap] = await Promise.all([
    getDocs(collection(db, "groups")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "categories")),
    getDocs(query(collection(db, "reports"), where("status", "==", "pending"))),
    getDocs(query(collection(db, "contacts"), where("status", "==", "unread"))),
  ]);

  const groups = groupsSnap.docs.map((d) => d.data());
  const pending = groups.filter((g) => g.status === "pending").length;
  const approved = groups.filter((g) => g.status === "approved").length;
  const rejected = groups.filter((g) => g.status === "rejected").length;

  const platformCounts: Record<string, number> = {};
  groups.forEach((g) => {
    if (g.status === "approved") {
      platformCounts[g.platform] = (platformCounts[g.platform] || 0) + 1;
    }
  });

  const totalJoins = groups.reduce((sum, g) => sum + (g.joinCount || 0), 0);

  return {
    totalGroups: groups.length,
    pendingGroups: pending,
    approvedGroups: approved,
    rejectedGroups: rejected,
    totalUsers: usersSnap.size,
    totalCategories: categoriesSnap.size,
    pendingReports: reportsSnap.size,
    unreadContacts: contactsSnap.size,
    platformCounts,
    totalJoins,
  };
}
