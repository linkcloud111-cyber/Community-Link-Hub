import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPhoneNumber,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updatePassword,
  updateEmail,
  verifyBeforeUpdateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
  type ConfirmationResult,
  type ActionCodeSettings,
} from "firebase/auth";
import { auth, db, setupRecaptcha } from "./firebase";
import { toast } from "sonner";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import {
  getUserProfile,
  upsertUserProfile,
  checkDuplicateUser,
  checkIsAccountDeleted,
  recordDeletedAccountTombstone,
  getUserProfileByEmail,
  logEmailChangeHistory,
  updateEmailHistoryStatus,
  logAuditEvent,
  createUserNotification,
  performPermanentUserDeletion,
  generateUniqueAccountUid,
  ensureUserAccountUid,
} from "./firestore";
import type { EmailChangeRequest } from "./types";
import {
  validateGmailAddress,
  validatePasswordStrength,
  validateFullName,
  validateDob,
  validateIndianMobile,
  STRICT_EMAIL_REGEX,
} from "./utils";

const googleProvider = new GoogleAuthProvider();

export function getAppBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return import.meta.env.VITE_APP_URL || "https://linkcloud.in";
}

export async function safeVerifyBeforeUpdateEmail(
  user: User,
  newEmail: string,
  continuePath: string
): Promise<void> {
  const origin = getAppBaseUrl();
  const authDomain = auth.config?.authDomain || "linkcloud-app.firebaseapp.com";
  const targetUser = auth.currentUser || user;

  // Pre-emptively refresh token if possible
  try {
    await targetUser.getIdToken(true);
  } catch (tErr) {
    console.warn("[EMAIL VERIFY] Token pre-refresh warning:", tErr);
  }

  const execVerify = async (actionSettings?: ActionCodeSettings) => {
    try {
      if (actionSettings) {
        await verifyBeforeUpdateEmail(targetUser, newEmail, actionSettings);
      } else {
        await verifyBeforeUpdateEmail(targetUser, newEmail);
      }
    } catch (err: any) {
      if (isSessionExpired(err)) {
        console.warn("[EMAIL VERIFY] Token expired during verification send. Retrying after force-refreshing token...");
        await targetUser.getIdToken(true);
        if (actionSettings) {
          await verifyBeforeUpdateEmail(targetUser, newEmail, actionSettings);
        } else {
          await verifyBeforeUpdateEmail(targetUser, newEmail);
        }
      } else {
        throw err;
      }
    }
  };

  // Attempt 1: Current app origin
  try {
    const settings: ActionCodeSettings = {
      url: `${origin}${continuePath}`,
      handleCodeInApp: true,
    };
    await execVerify(settings);
    console.log("[EMAIL VERIFY] Verification email dispatched to:", newEmail, "ContinueURL:", settings.url);
    return;
  } catch (err: any) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (code !== "auth/unauthorized-continue-uri" && !msg.includes("unauthorized-continue-uri")) {
      throw err;
    }
    console.warn("[EMAIL VERIFY] Current origin continue-url not allowlisted, trying Firebase project authDomain...");
  }

  // Attempt 2: Firebase project authDomain (allowlisted by default in Firebase project)
  try {
    const settings: ActionCodeSettings = {
      url: `https://${authDomain}${continuePath}`,
      handleCodeInApp: true,
    };
    await execVerify(settings);
    console.log("[EMAIL VERIFY] Verification email dispatched to:", newEmail, "Fallback ContinueURL:", settings.url);
    return;
  } catch (err: any) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (code !== "auth/unauthorized-continue-uri" && !msg.includes("unauthorized-continue-uri")) {
      throw err;
    }
    console.warn("[EMAIL VERIFY] Fallback continue-url rejected, sending default email verification without continue URL...");
  }

  // Attempt 3: Default Firebase template without ActionCodeSettings continue URI
  await execVerify();
  console.log("[EMAIL VERIFY] Verification email dispatched via default Firebase template to:", newEmail);
}

export async function safeSendEmailVerification(
  user: User,
  continuePath: string
): Promise<void> {
  const origin = getAppBaseUrl();
  const authDomain = auth.config?.authDomain || "linkcloud-app.firebaseapp.com";
  const targetUser = auth.currentUser || user;

  try {
    await targetUser.getIdToken(true);
  } catch (tErr) {
    console.warn("[EMAIL VERIFY] Token pre-refresh warning in safeSendEmailVerification:", tErr);
  }

  const execSend = async (actionSettings?: ActionCodeSettings) => {
    try {
      if (actionSettings) {
        await sendEmailVerification(targetUser, actionSettings);
      } else {
        await sendEmailVerification(targetUser);
      }
    } catch (err: any) {
      if (isSessionExpired(err)) {
        console.warn("[EMAIL VERIFY] Token expired during sendEmailVerification. Refreshing token and retrying...");
        await targetUser.getIdToken(true);
        if (actionSettings) {
          await sendEmailVerification(targetUser, actionSettings);
        } else {
          await sendEmailVerification(targetUser);
        }
      } else {
        throw err;
      }
    }
  };

  try {
    const settings: ActionCodeSettings = {
      url: `${origin}${continuePath}`,
      handleCodeInApp: true,
    };
    await execSend(settings);
    return;
  } catch (err: any) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (code !== "auth/unauthorized-continue-uri" && !msg.includes("unauthorized-continue-uri")) {
      throw err;
    }
  }

  try {
    const settings: ActionCodeSettings = {
      url: `https://${authDomain}${continuePath}`,
      handleCodeInApp: true,
    };
    await execSend(settings);
    return;
  } catch (err: any) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (code !== "auth/unauthorized-continue-uri" && !msg.includes("unauthorized-continue-uri")) {
      throw err;
    }
  }

  await execSend();
}

export async function safeSendPasswordResetEmail(
  authInstance: Auth,
  email: string,
  continuePath: string
): Promise<void> {
  const origin = getAppBaseUrl();
  const authDomain = authInstance.config?.authDomain || "linkcloud-app.firebaseapp.com";

  try {
    const settings: ActionCodeSettings = {
      url: `${origin}${continuePath}`,
      handleCodeInApp: true,
    };
    await sendPasswordResetEmail(authInstance, email, settings);
    return;
  } catch (err: any) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (code !== "auth/unauthorized-continue-uri" && !msg.includes("unauthorized-continue-uri")) {
      throw err;
    }
  }

  try {
    const settings: ActionCodeSettings = {
      url: `https://${authDomain}${continuePath}`,
      handleCodeInApp: true,
    };
    await sendPasswordResetEmail(authInstance, email, settings);
    return;
  } catch (err: any) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (code !== "auth/unauthorized-continue-uri" && !msg.includes("unauthorized-continue-uri")) {
      throw err;
    }
  }

  await sendPasswordResetEmail(authInstance, email);
}

export function isSessionExpired(error: any): boolean {
  if (!error) return false;
  const code = error.code || "";
  const msg = typeof error.message === "string" ? error.message : String(error);
  return (
    code === "auth/user-token-expired" ||
    code === "auth/id-token-expired" ||
    code === "auth/session-expired" ||
    msg.includes("user-token-expired") ||
    msg.includes("id-token-expired") ||
    msg.includes("token-expired") ||
    msg.includes("session-expired")
  );
}

export function formatAuthError(error: any): string {
  if (!error) return "An unexpected error occurred. Please try again.";
  const code = error.code || "";
  const msg = typeof error.message === "string" ? error.message : "";

  if (isSessionExpired(error)) {
    return "Your session has expired. Please login again.";
  }
  if (
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-credential" ||
    msg.includes("wrong-password") ||
    msg.includes("user-not-found") ||
    msg.includes("invalid-credential")
  ) {
    return "Invalid Webmaster credentials.";
  }
  if (code === "auth/invalid-email" || msg.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (code === "auth/email-already-in-use" || msg.includes("auth/email-already-in-use")) {
    return "This email address is already registered.";
  }
  if (code === "auth/requires-recent-login" || msg.includes("auth/requires-recent-login")) {
    return "Please sign in again to continue.";
  }
  if (code === "auth/too-many-requests" || msg.includes("auth/too-many-requests")) {
    return "Too many login attempts. Please try again later.";
  }
  if (code === "auth/invalid-verification-code" || msg.includes("auth/invalid-verification-code")) {
    return "Invalid verification code. Please try again.";
  }
  if (code === "auth/code-expired" || msg.includes("auth/code-expired")) {
    return "The verification code has expired. Please request a new one.";
  }
  if (code === "auth/popup-closed-by-user" || msg.includes("auth/popup-closed-by-user")) {
    return "Google sign-in popup was closed before completing.";
  }
  if (code === "auth/popup-blocked" || msg.includes("auth/popup-blocked")) {
    return "Sign-in popup was blocked by your browser. Please allow popups for this site.";
  }
  if (code === "auth/network-request-failed" || msg.includes("auth/network-request-failed")) {
    return "Unable to connect to the authentication service. Please try again.";
  }

  if (
    msg.includes("Firebase:") ||
    msg.includes("auth/") ||
    msg.includes("firestore") ||
    msg.includes("collection") ||
    msg.includes("permission")
  ) {
    return "Unable to connect to the authentication service. Please try again.";
  }

  return msg || "An unexpected error occurred. Please try again.";
}

export async function logout(reason = "User initiated logout"): Promise<void> {
  console.warn("[AUTH SIGNOUT]", {
    reason,
    uid: auth.currentUser?.uid ?? null,
    email: auth.currentUser?.email ?? null,
  });
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && (k.startsWith("pending_email_") || k.startsWith("linkcloud_submit_draft"))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
        window.localStorage.removeItem("linkcloud_submit_draft");
      } catch {}
    }
    await firebaseSignOut(auth);
    console.log("[AUTH STATE] Logout success");
  } catch (err) {
    console.warn("Logout error:", err);
  }
}

export async function refreshToken(userInstance?: User | null): Promise<string | null> {
  const targetUser = userInstance || auth.currentUser;
  if (!targetUser) return null;
  try {
    const token = await targetUser.getIdToken(false);
    console.log("[AUTH TOKEN] Token refreshed successfully");
    return token;
  } catch (err: any) {
    console.warn("[AUTH TOKEN] Token refresh non-fatal warning:", err?.message || err);
    return null;
  }
}

export async function refreshUser(userInstance?: User | null): Promise<User | null> {
  const targetUser = userInstance || auth.currentUser;
  if (!targetUser) return null;
  try {
    await targetUser.reload();
    console.log("[AUTH RELOAD] User reloaded successfully:", {
      uid: targetUser.uid,
      email: targetUser.email,
      emailVerified: targetUser.emailVerified,
    });
    return auth.currentUser || targetUser;
  } catch (err: any) {
    console.warn("[AUTH RELOAD] User reload non-fatal warning:", err?.message || err);
    return auth.currentUser || targetUser;
  }
}

export async function reauthenticate(user: User, pass: string): Promise<User> {
  try {
    await user.reload().catch(() => {});
    if (!user.email) throw new Error("Email address required for reauthentication.");
    const cred = EmailAuthProvider.credential(user.email, pass);
    const result = await reauthenticateWithCredential(user, cred);
    console.log("[AUTH STATE] Reauthenticated successfully");
    return result.user;
  } catch (err: any) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
      msg.includes("wrong-password") ||
      msg.includes("invalid-credential")
    ) {
      throw new Error("Incorrect current password.");
    }
    throw new Error(formatAuthError(err));
  }
}

export async function setAuthRememberMe(remember: boolean): Promise<void> {
  try {
    if (auth && typeof auth === "object" && "app" in auth) {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );
    }
  } catch (err) {
    console.warn("Failed to set auth persistence:", err);
  }
}

export async function signInUserWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const u = result.user;

    const isWebmasterDoc = await checkWebmasterCollection(u.uid);
    const existingProfile = await getUserProfile(u.uid);

    if (isWebmasterDoc || existingProfile?.role === "webmaster") {
      await firebaseSignOut(auth);
      toast.error("This is a Webmaster account. Please sign in from the Webmaster Login page.");
      if (typeof window !== "undefined") {
        window.location.href = "/webmaster/login";
      }
      throw new Error("This is a Webmaster account. Please sign in from the Webmaster Login page.");
    }

    if (existingProfile) {
      if (existingProfile.status === "suspended") {
        await firebaseSignOut(auth);
        throw new Error("Your LinkCloud account has been suspended. Please contact the Webmaster.");
      }
      if (existingProfile.status === "banned") {
        await firebaseSignOut(auth);
        throw new Error("Your LinkCloud account has been permanently banned. Please contact the Webmaster.");
      }
      if (existingProfile.status === "deleted") {
        await firebaseSignOut(auth);
        throw new Error("Account not found. Your previous LinkCloud account has been permanently deleted. Please create a new account.");
      }
    } else {
      const accountUid = await generateUniqueAccountUid(u.uid);
      await upsertUserProfile(u.uid, {
        uid: u.uid,
        accountUid,
        displayName: u.displayName || "User",
        email: u.email || "",
        phone: u.phoneNumber || "",
        photoURL: u.photoURL || "",
        emailVerified: u.emailVerified,
        phoneVerified: Boolean(u.phoneNumber),
        role: "user",
        status: "active",
        groupCount: 0,
      });
    }

    return u;
  } catch (err: any) {
    if (err.message && (err.message.startsWith("This is a Webmaster account") || err.message.startsWith("Your LinkCloud account") || err.message.startsWith("Account not found"))) {
      throw err;
    }
    throw new Error(formatAuthError(err));
  }
}

export const signInWithGoogle = signInUserWithGoogle;

export async function checkWebmasterCollection(uid: string): Promise<boolean> {
  try {
    if (!db || typeof db !== "object" || !("app" in db) || !uid) {
      return false;
    }

    // Read Firestore document: /webmaster/{auth.currentUser.uid}
    const webmasterDocRef = doc(db, "webmaster", uid);
    const webmasterDocSnap = await getDoc(webmasterDocRef);
    const exists = webmasterDocSnap.exists();

    if (!exists) {
      const currentUserEmail = auth.currentUser?.email?.toLowerCase();
      let userProfile = null;
      try {
        userProfile = await getUserProfile(uid);
      } catch (pErr) {
        // ignore profile error
      }

      const isOwnerEmail = currentUserEmail === "linkcloud111@gmail.com" || currentUserEmail === "webmaster@linkcloud.in";
      const isProfileWebmaster = userProfile?.role === "webmaster";

      if (isOwnerEmail || isProfileWebmaster) {
        try {
          await setDoc(webmasterDocRef, {
            active: true,
            role: "webmaster",
            email: currentUserEmail || userProfile?.email || "",
            createdAt: serverTimestamp(),
          });
          return true;
        } catch (setErr) {
          console.warn("Failed to auto-provision webmaster document:", setErr);
        }
      }

      // Check if document exists under another ID for same email
      if (currentUserEmail) {
        try {
          const q = query(collection(db, "webmaster"), where("email", "==", currentUserEmail));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const foundDoc = querySnap.docs[0];
            const data = foundDoc.data();
            if (data.active !== false && (data.role === "webmaster" || !data.role)) {
              await setDoc(webmasterDocRef, {
                active: true,
                role: "webmaster",
                email: currentUserEmail,
                createdAt: serverTimestamp(),
              });
              return true;
            }
          }
        } catch (searchErr) {
          console.warn("Secondary webmaster query error:", searchErr);
        }
      }

      return false;
    }

    const data = webmasterDocSnap.data();
    const isActive = data.active === true || data.active === "true" || data.active === undefined || data.status === "active";
    const isRoleWebmaster = data.role === "webmaster" || !data.role;

    if (isActive && isRoleWebmaster) {
      return true;
    } else {
      return false;
    }
  } catch (err: any) {
    console.warn("Error reading webmaster/{uid} document in Firestore:", err?.code || "N/A", err?.message || err);
    return false;
  }
}

export async function loginWebmaster(email: string, password: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail) {
    throw new Error("Please enter your Webmaster email address.");
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  if (!password) {
    throw new Error("Please enter your password.");
  }

  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const u = result.user;
    const uid = u.uid;

    const isWebmasterDoc = await checkWebmasterCollection(uid);
    const existingProfile = await getUserProfile(uid);
    const isAuthorized = Boolean(isWebmasterDoc || existingProfile?.role === "webmaster");

    if (!isAuthorized) {
      console.warn("User is not authorized in webmaster document. Signing out immediately.");
      await firebaseSignOut(auth);
      throw new Error("This account is not authorized to access the Webmaster Portal.");
    }

    if (existingProfile && (existingProfile.status === "suspended" || existingProfile.status === "inactive")) {
      await firebaseSignOut(auth);
      throw new Error("Your Webmaster account is currently inactive.");
    }

    await upsertUserProfile(uid, {
      uid,
      email: u.email?.toLowerCase() || cleanEmail,
      role: "webmaster",
      status: "active",
    });

    return u;
  } catch (err: any) {
    if (err.message && (
      err.message.includes("not authorized") ||
      err.message.includes("inactive") ||
      err.message.includes("valid email") ||
      err.message.includes("enter your")
    )) {
      throw err;
    }
    const formatted = formatAuthError(err);
    throw new Error(formatted);
  }
}

export const signInAsWebmaster = loginWebmaster;

export async function signInWebmasterGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const u = result.user;
    const uid = u.uid;

    const isWebmasterDoc = await checkWebmasterCollection(uid);
    const existingProfile = await getUserProfile(uid);
    const isAuthorized = Boolean(isWebmasterDoc || existingProfile?.role === "webmaster");

    if (!isAuthorized) {
      console.warn("User is not authorized in webmaster document. Signing out immediately.");
      await firebaseSignOut(auth);
      throw new Error("This account is not authorized to access the Webmaster Portal.");
    }

    if (existingProfile && (existingProfile.status === "suspended" || existingProfile.status === "inactive")) {
      await firebaseSignOut(auth);
      throw new Error("Your Webmaster account is currently inactive.");
    }

    await upsertUserProfile(uid, {
      uid,
      email: u.email?.toLowerCase() || "",
      role: "webmaster",
      status: "active",
    });

    return u;
  } catch (err: any) {
    if (err.message && (
      err.message.includes("not authorized") ||
      err.message.includes("inactive")
    )) {
      throw err;
    }
    const formatted = formatAuthError(err);
    throw new Error(formatted);
  }
}

export async function loginUser(email: string, password: string): Promise<User> {
  const gmailCheck = validateGmailAddress(email);
  if (!gmailCheck.valid) {
    throw new Error(gmailCheck.error || "Please enter a valid Gmail address (@gmail.com).");
  }

  try {
    const result = await signInWithEmailAndPassword(auth, gmailCheck.cleanEmail, password);
    const u = result.user;

    await u.reload().catch(() => {});

    // Check if user is a Webmaster
    const isWebmasterDoc = await checkWebmasterCollection(u.uid);
    const profile = await getUserProfile(u.uid);

    if (isWebmasterDoc || profile?.role === "webmaster") {
      await firebaseSignOut(auth);
      toast.error("This is a Webmaster account. Please sign in from the Webmaster Login page.");
      if (typeof window !== "undefined") {
        window.location.href = "/webmaster/login";
      }
      throw new Error("This is a Webmaster account. Please sign in from the Webmaster Login page.");
    }

    if (profile) {
      if (profile.status === "suspended") {
        await firebaseSignOut(auth);
        throw new Error("Your LinkCloud account has been suspended. Please contact the Webmaster.");
      }
      if (profile.status === "banned") {
        await firebaseSignOut(auth);
        throw new Error("Your LinkCloud account has been permanently banned. Please contact the Webmaster.");
      }
      if (profile.status === "deleted") {
        await firebaseSignOut(auth);
        throw new Error("Account not found. Your previous LinkCloud account has been permanently deleted. Please create a new account.");
      }
    }

    if (u.email) {
      const cleanEmail = u.email.toLowerCase();
      await upsertUserProfile(u.uid, {
        email: cleanEmail,
        emailVerified: u.emailVerified,
        pendingEmail: null,
        status: u.emailVerified ? "active" : "pending_verification",
      });
      syncEmailToLocalStorage(u.uid, cleanEmail);
    }

    if (!u.emailVerified) {
      await upsertUserProfile(u.uid, { emailVerified: false, status: "pending_verification" });
      await firebaseSignOut(auth);
      throw new Error("Your email address is pending verification. Please verify your email before logging in.");
    }

    return u;
  } catch (err: any) {
    if (
      err.message &&
      (err.message.startsWith("This is a Webmaster account") ||
        err.message.startsWith("Your LinkCloud account") ||
        err.message.startsWith("Account not found") ||
        err.message.startsWith("Your email address is pending verification") ||
        err.message.includes("Gmail"))
    ) {
      throw err;
    }
    throw err;
  }
}

export const signInWithEmail = loginUser;

export async function signInWithMobileOTP(
  phone: string,
  containerId: string = "recaptcha-container"
): Promise<ConfirmationResult> {
  try {
    let formattedPhone = phone.trim().replace(/\s+/g, "");
    if (!formattedPhone.startsWith("+")) {
      if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`;
      } else {
        formattedPhone = `+${formattedPhone}`;
      }
    }

    const verifier = setupRecaptcha(containerId);
    if (!verifier) {
      throw new Error("Failed to initialize reCAPTCHA verifier.");
    }

    return await signInWithPhoneNumber(auth, formattedPhone, verifier);
  } catch (err: any) {
    throw new Error(formatAuthError(err));
  }
}

export async function verifyOTP(
  confirmationResult: ConfirmationResult,
  code: string
): Promise<User> {
  try {
    const result = await confirmationResult.confirm(code);
    const u = result.user;

    const isWebmasterDoc = await checkWebmasterCollection(u.uid);
    const profile = await getUserProfile(u.uid);

    if (isWebmasterDoc || profile?.role === "webmaster") {
      await firebaseSignOut(auth);
      toast.error("This is a Webmaster account. Please sign in from the Webmaster Login page.");
      if (typeof window !== "undefined") {
        window.location.href = "/webmaster/login";
      }
      throw new Error("This is a Webmaster account. Please sign in from the Webmaster Login page.");
    }

    if (profile) {
      if (profile.status === "suspended") {
        await firebaseSignOut(auth);
        throw new Error("Your LinkCloud account has been suspended. Please contact the Webmaster.");
      }
      if (profile.status === "banned") {
        await firebaseSignOut(auth);
        throw new Error("Your LinkCloud account has been permanently banned. Please contact the Webmaster.");
      }
      if (profile.status === "deleted") {
        await firebaseSignOut(auth);
        throw new Error("Account not found. Your previous LinkCloud account has been permanently deleted. Please create a new account.");
      }
    } else {
      const accountUid = await generateUniqueAccountUid(u.uid);
      await upsertUserProfile(u.uid, {
        uid: u.uid,
        accountUid,
        displayName: u.displayName || `User ${u.phoneNumber?.slice(-4) || ""}`,
        email: u.email || "",
        phone: u.phoneNumber || "",
        photoURL: "",
        emailVerified: false,
        phoneVerified: true,
        role: "user",
        status: "active",
        groupCount: 0,
      });
    }

    return u;
  } catch (err: any) {
    if (
      err.message &&
      (err.message.startsWith("Your LinkCloud account") ||
        err.message.startsWith("Account not found") ||
        err.message.startsWith("This is a Webmaster account"))
    ) {
      throw err;
    }
    throw new Error(formatAuthError(err));
  }
}

export async function registerWithEmail(data: {
  fullName: string;
  dob: string;
  email: string;
  phone: string;
  password: string;
}): Promise<User> {
  const { fullName, dob, email, phone, password } = data;

  // 1. Validate Full Name
  const nameCheck = validateFullName(fullName);
  if (!nameCheck.valid) {
    throw new Error(nameCheck.error || "Full Name must contain at least 3 letters.");
  }

  // 2. Validate DOB (Age >= 18)
  const dobCheck = validateDob(dob);
  if (!dobCheck.valid) {
    throw new Error(dobCheck.error || "You must be at least 18 years old.");
  }

  // 3. Validate Gmail Address
  const gmailCheck = validateGmailAddress(email);
  if (!gmailCheck.valid) {
    throw new Error(gmailCheck.error || "Only Gmail addresses are allowed.");
  }

  // 4. Validate Indian Mobile
  const phoneCheck = validateIndianMobile(phone);
  if (!phoneCheck.valid) {
    throw new Error(phoneCheck.error || "Enter a valid Indian mobile number.");
  }

  // 5. Validate Password Strength
  const passCheck = validatePasswordStrength(password);
  if (!passCheck.valid) {
    throw new Error(passCheck.error || "Password must contain uppercase, lowercase, number and special character.");
  }

  // 6. Check duplicates in Firestore
  const duplicates = await checkDuplicateUser(gmailCheck.cleanEmail, phoneCheck.formatted);
  if (duplicates.emailExists) {
    throw new Error("This Gmail is already registered.");
  }
  if (duplicates.phoneExists) {
    throw new Error("An account with this Mobile Number is already registered.");
  }

  // 7. Check if email exists in Firebase Auth
  try {
    const existingMethods = await fetchSignInMethodsForEmail(auth, gmailCheck.cleanEmail);
    if (existingMethods && existingMethods.length > 0) {
      throw new Error("This Gmail is already registered.");
    }
  } catch (err: any) {
    if (err.message === "This Gmail is already registered.") {
      throw err;
    }
    // Ignore invalid-email or other fetch errors if any
  }

  // All validations passed! Create user in Firebase Auth.
  try {
    const result = await createUserWithEmailAndPassword(auth, gmailCheck.cleanEmail, password);
    const u = result.user;

    await updateProfile(u, { displayName: fullName.trim() });

    try {
      await safeSendEmailVerification(u, `/email-action?mode=verifyEmail&uid=${u.uid}`);
    } catch (err) {
      console.warn("Could not send verification email:", err);
    }

    const accountUid = await generateUniqueAccountUid(u.uid);

    await upsertUserProfile(u.uid, {
      uid: u.uid,
      accountUid,
      displayName: fullName.trim(),
      dob,
      email: gmailCheck.cleanEmail,
      phone: phoneCheck.formatted,
      photoURL: "",
      emailVerified: false,
      phoneVerified: false,
      role: "user",
      status: "pending_verification",
      groupCount: 0,
    });

    return u;
  } catch (err: any) {
    throw new Error(formatAuthError(err));
  }
}

export async function sendPasswordResetLink(email: string): Promise<void> {
  const cleanEmail = email ? email.trim() : "";
  if (!cleanEmail) {
    throw new Error("Please enter your email address.");
  }

  try {
    await safeSendPasswordResetEmail(auth, cleanEmail, `/email-action?mode=resetPassword`);
  } catch (err: any) {
    throw new Error(formatAuthError(err));
  }
}

export async function resendVerificationEmail(user: User): Promise<void> {
  const targetUser = auth.currentUser || user;
  try {
    await targetUser.getIdToken(true);
  } catch (tokenErr) {
    console.warn("[EMAIL RESEND] Token force-refresh notice in resendVerificationEmail:", tokenErr);
  }

  if (typeof window !== "undefined" && window.localStorage) {
    const storageKey = `resend_email_timestamps_${targetUser.uid}`;
    const raw = window.localStorage.getItem(storageKey);
    let timestamps: number[] = [];
    try {
      if (raw) timestamps = JSON.parse(raw);
    } catch {}

    const now = Date.now();
    const pastHourTimestamps = timestamps.filter((t) => now - t < 3600000); // 1 hour

    // 60-second cooldown check
    const lastSent = pastHourTimestamps[pastHourTimestamps.length - 1];
    if (lastSent && now - lastSent < 60000) {
      const waitSec = Math.ceil((60000 - (now - lastSent)) / 1000);
      throw new Error(`Please wait ${waitSec} seconds before requesting another verification email.`);
    }

    // Max 5 emails per hour check
    if (pastHourTimestamps.length >= 5) {
      throw new Error("Maximum 5 verification emails per hour limit reached. Please try again later.");
    }

    try {
      await safeSendEmailVerification(targetUser, `/email-action?mode=verifyEmail&uid=${targetUser.uid}`);
      console.log("Verification email sent");
      pastHourTimestamps.push(now);
      window.localStorage.setItem(storageKey, JSON.stringify(pastHourTimestamps));
      await logAuditEvent("Resent Verification Email", `Resent verification email to ${targetUser.email}`, targetUser.email || "", targetUser.uid);
    } catch (err: any) {
      const code = err?.code || "";
      const msg = String(err?.message || "");
      if (code === "auth/too-many-requests" || msg.includes("too-many-requests")) {
        throw new Error("Too many requests. Please wait a few minutes before trying again.");
      }
      throw new Error(formatAuthError(err));
    }
  } else {
    try {
      await safeSendEmailVerification(targetUser, `/email-action?mode=verifyEmail&uid=${targetUser.uid}`);
    } catch (err: any) {
      throw new Error(formatAuthError(err));
    }
  }
}

export async function updateUserPassword(
  user: User,
  currentPass: string,
  newPass: string
): Promise<void> {
  const passCheck = validatePasswordStrength(newPass);
  if (!passCheck.valid) {
    throw new Error(passCheck.error || "New password does not meet requirements.");
  }

  try {
    await user.reload().catch(() => {});
    await user.getIdToken(true);
    console.log("Token refreshed");
    if (!user.email) throw new Error("Email address required to update password.");
    const cred = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPass);
    console.log("Password changed");
  } catch (err: any) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
      msg.includes("wrong-password") ||
      msg.includes("invalid-credential")
    ) {
      throw new Error("Incorrect current password.");
    }
    throw new Error(formatAuthError(err));
  }
}

export const EMAIL_CHANGE_TTL_MS = 60 * 1000; // Strictly 60 seconds (1 minute)

export async function getActiveEmailChangeRequest(userId: string): Promise<EmailChangeRequest | null> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return null;
    const reqsRef = collection(db, "emailChangeRequests");
    const q = query(
      reqsRef,
      where("userId", "==", userId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    
    // Sort docs by createdAt desc to get the most recent request
    const docs = snap.docs.map(d => ({ requestId: d.id, ...d.data() } as EmailChangeRequest));
    docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return docs[0] || null;
  } catch (err) {
    console.warn("[EMAIL REQUEST] Error fetching active email change request:", err);
    return null;
  }
}

export async function getEmailChangeRequestById(requestId: string): Promise<EmailChangeRequest | null> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return null;
    const docRef = doc(db, "emailChangeRequests", requestId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { requestId: snap.id, ...snap.data() } as EmailChangeRequest;
    }
    return null;
  } catch (err) {
    console.warn("[EMAIL REQUEST] Error fetching email change request by id:", err);
    return null;
  }
}

export async function markActiveEmailRequestExpired(userId: string): Promise<void> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return;
    const activeReq = await getActiveEmailChangeRequest(userId);
    if (activeReq && activeReq.status === "pending") {
      await setDoc(
        doc(db, "emailChangeRequests", activeReq.requestId),
        { status: "expired", updatedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
    }
  } catch (err) {
    console.warn("[EMAIL REQUEST] Error marking request as expired:", err);
  }
}

export async function invalidateUserPendingEmailRequests(userId: string, exceptRequestId?: string): Promise<void> {
  try {
    if (!db || typeof db !== "object" || !("app" in db)) return;
    const reqsRef = collection(db, "emailChangeRequests");
    const q = query(
      reqsRef,
      where("userId", "==", userId),
      where("status", "==", "pending")
    );
    const snap = await getDocs(q);
    const updates: Promise<any>[] = [];
    for (const d of snap.docs) {
      if (d.id !== exceptRequestId) {
        updates.push(
          setDoc(
            doc(db, "emailChangeRequests", d.id),
            {
              status: "superseded",
              updatedAt: Date.now(),
            },
            { merge: true }
          ).catch(() => {})
        );
      }
    }
    await Promise.all(updates);
    if (updates.length > 0) {
      console.log(`[EMAIL REQUEST] Invalidation: marked ${updates.length} previous pending request(s) as superseded for UID: ${userId}`);
    }
  } catch (err) {
    console.warn("[EMAIL REQUEST] Error invalidating pending email change requests:", err);
  }
}

export async function updateUserEmailAddress(
  user: User,
  newEmail: string,
  currentPass: string,
  displayName?: string
): Promise<{ requestId: string; expiresAt: number; newEmail: string }> {
  console.log("[EMAIL CHANGE] Initiating email change request for UID:", user.uid);
  const targetUser = auth.currentUser || user;
  try {
    await targetUser.getIdToken(true);
  } catch (tokenErr) {
    console.warn("[EMAIL CHANGE] Token force-refresh notice:", tokenErr);
  }

  const cleanInput = newEmail ? newEmail.trim().toLowerCase() : "";
  if (!cleanInput || !STRICT_EMAIL_REGEX.test(cleanInput)) {
    throw new Error("Please enter a valid, active email address.");
  }

  const gmailCheck = validateGmailAddress(newEmail);
  if (!gmailCheck.valid) {
    throw new Error(gmailCheck.error || "Please enter a valid, active email address.");
  }

  if (displayName && displayName.trim()) {
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await upsertUserProfile(user.uid, { displayName: displayName.trim() });
    } catch (e) {
      console.warn("Failed to sync displayName before sending verification email:", e);
    }
  }

  try {
    await user.reload().catch(() => {});
  } catch (e) {
    console.warn("User reload failed before email update:", e);
  }

  if (!user.email) {
    throw new Error("Current email address is required.");
  }

  if (user.email.toLowerCase() === gmailCheck.cleanEmail.toLowerCase()) {
    throw new Error("New email must be different from your current email.");
  }

  // Check duplicate email in Firestore DB & emailIndex
  const isRegistered = await checkIsEmailRegistered(gmailCheck.cleanEmail, user.uid);
  if (isRegistered) {
    throw new Error("This Gmail is already registered.");
  }

  // 1. Re-authenticate user with current password
  try {
    const cred = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, cred);
    console.log("[EMAIL CHANGE] User re-authentication verified successfully");
  } catch (err: any) {
    console.warn("[EMAIL CHANGE] Re-authentication error:", err?.code || err?.message);
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
      code === "auth/invalid-login-credentials" ||
      msg.includes("wrong-password") ||
      msg.includes("invalid-credential") ||
      msg.includes("invalid-login-credentials")
    ) {
      throw new Error("Incorrect password. Please enter your current password and try again.");
    }
    if (code === "auth/requires-recent-login" || msg.includes("requires-recent-login")) {
      throw new Error("Please sign in again to continue.");
    }
    if (code === "auth/invalid-email" || msg.includes("invalid-email")) {
      throw new Error("Please enter a valid, active email address.");
    }
    throw new Error(formatAuthError(err));
  }

  // 2. Invalidate all previous pending requests before creating new one
  await invalidateUserPendingEmailRequests(user.uid);

  // 3. Create active request document with strictly 60-second TTL
  const now = Date.now();
  const requestId = `req_${user.uid}_${now}`;
  const expiresAt = now + EMAIL_CHANGE_TTL_MS; // strictly 60 seconds
  const requestDoc: EmailChangeRequest = {
    requestId,
    userId: user.uid,
    oldEmail: user.email.toLowerCase(),
    newEmail: gmailCheck.cleanEmail.toLowerCase(),
    status: "pending",
    createdAt: now,
    expiresAt,
    version: 1,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, "emailChangeRequests", requestId), requestDoc);
    console.log("[EMAIL REQUEST] Generated single active email change request:", { requestId, expiresAt });
  } catch (dbErr) {
    console.warn("[EMAIL REQUEST] Error saving email change request:", dbErr);
  }

  // 4. Send verification email using safeVerifyBeforeUpdateEmail with domain fallback
  try {
    await safeVerifyBeforeUpdateEmail(
      user,
      gmailCheck.cleanEmail,
      `/email-action?mode=verifyAndChangeEmail&reqId=${requestId}&uid=${user.uid}&v=${requestDoc.version}`
    );
  } catch (err: any) {
    console.error("[EMAIL VERIFY] safeVerifyBeforeUpdateEmail failed:", err);
    await setDoc(doc(db, "emailChangeRequests", requestId), { status: "cancelled", updatedAt: Date.now() }, { merge: true }).catch(() => {});
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (code === "auth/email-already-in-use" || msg.includes("email-already-in-use")) {
      throw new Error("This Gmail is already registered.");
    } else if (code === "auth/invalid-email" || msg.includes("invalid-email")) {
      throw new Error("Please enter a valid, active email address.");
    } else if (code === "auth/requires-recent-login" || msg.includes("requires-recent-login")) {
      throw new Error("Please sign in again to continue.");
    } else {
      throw new Error(formatAuthError(err));
    }
  }

  // 5. Store pending email & request reference locally and in user profile
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(`pending_email_${user.uid}`, gmailCheck.cleanEmail.toLowerCase());
      window.localStorage.setItem(`pending_email_req_${user.uid}`, requestId);
      window.localStorage.setItem(`pending_email_expires_${user.uid}`, String(expiresAt));
      window.localStorage.setItem(`resend_email_change_${user.uid}`, String(now));
    }
    await upsertUserProfile(user.uid, {
      pendingEmail: gmailCheck.cleanEmail.toLowerCase(),
      activeEmailChangeRequestId: requestId,
    });
    await logEmailChangeHistory({
      uid: user.uid,
      oldEmail: user.email.toLowerCase(),
      newEmail: gmailCheck.cleanEmail.toLowerCase(),
      changedOn: null,
      device: typeof navigator !== "undefined" ? navigator.userAgent : "Browser",
      status: "pending",
    });
    await logAuditEvent("Verification Sent", `Verification email sent to ${gmailCheck.cleanEmail}`, user.email, user.uid);
    await createUserNotification(
      user.uid,
      "Email Change Requested",
      `A verification email has been sent to ${gmailCheck.cleanEmail}. Link is valid for 1 minute.`,
      "system"
    );
  } catch (e) {
    console.warn("[EMAIL CHANGE] Failed to update pending user logs:", e);
  }

  return { requestId, expiresAt, newEmail: gmailCheck.cleanEmail.toLowerCase() };
}

export async function resendPendingEmailVerification(
  user: User,
  pendingEmail: string
): Promise<{ requestId: string; expiresAt: number; newEmail: string }> {
  console.log("[EMAIL RESEND] Resending verification link for UID:", user.uid);
  const targetUser = auth.currentUser || user;
  try {
    await targetUser.getIdToken(true);
  } catch (tokenErr) {
    console.warn("[EMAIL RESEND] Token force-refresh notice:", tokenErr);
  }

  const cleanInput = pendingEmail ? pendingEmail.trim().toLowerCase() : "";
  if (!cleanInput || !STRICT_EMAIL_REGEX.test(cleanInput)) {
    throw new Error("Please enter a valid, active email address.");
  }

  const gmailCheck = validateGmailAddress(pendingEmail);
  if (!gmailCheck.valid) {
    throw new Error(gmailCheck.error || "Please enter a valid, active email address.");
  }

  // Check if active request is already verified
  const activeReq = await getActiveEmailChangeRequest(user.uid);
  if (activeReq && activeReq.status === "verified") {
    throw new Error("Email verification has already been completed. Please click 'Refresh Verification Status' to finish the email change.");
  }

  // 60-second cooldown check in localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    const cooldownKey = `resend_email_change_${user.uid}`;
    const lastSent = Number(window.localStorage.getItem(cooldownKey) || 0);
    const now = Date.now();
    if (now - lastSent < EMAIL_CHANGE_TTL_MS) {
      const waitSec = Math.ceil((EMAIL_CHANGE_TTL_MS - (now - lastSent)) / 1000);
      throw new Error(`Please wait ${waitSec}s before resending.`);
    }
  }

  // Invalidate previous requests as superseded
  const prevVersion = activeReq?.version || 1;
  await invalidateUserPendingEmailRequests(user.uid);

  // Create new active request with strictly 60-second TTL
  const now = Date.now();
  const requestId = `req_${user.uid}_${now}`;
  const expiresAt = now + EMAIL_CHANGE_TTL_MS; // strictly 60 seconds
  const newReqDoc: EmailChangeRequest = {
    requestId,
    userId: user.uid,
    oldEmail: user.email?.toLowerCase() || "",
    newEmail: gmailCheck.cleanEmail.toLowerCase(),
    status: "pending",
    createdAt: now,
    expiresAt,
    version: prevVersion + 1,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, "emailChangeRequests", requestId), newReqDoc);
    console.log("[EMAIL RESEND] Superseded old link. Created new request:", { requestId, version: newReqDoc.version });
  } catch (e) {
    console.warn("[EMAIL RESEND] Error saving new request doc:", e);
  }

  try {
    const targetUser = auth.currentUser || user;
    try {
      await targetUser.reload();
      await targetUser.getIdToken(true);
    } catch (reloadErr) {
      console.warn("[EMAIL RESEND] User reload/token refresh warning:", reloadErr);
    }
    await safeVerifyBeforeUpdateEmail(
      targetUser,
      gmailCheck.cleanEmail,
      `/email-action?mode=verifyAndChangeEmail&reqId=${requestId}&uid=${targetUser.uid}&v=${newReqDoc.version}`
    );
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(`resend_email_change_${targetUser.uid}`, String(Date.now()));
      window.localStorage.setItem(`pending_email_${targetUser.uid}`, gmailCheck.cleanEmail.toLowerCase());
      window.localStorage.setItem(`pending_email_req_${targetUser.uid}`, requestId);
      window.localStorage.setItem(`pending_email_expires_${targetUser.uid}`, String(expiresAt));
    }
    await upsertUserProfile(targetUser.uid, {
      pendingEmail: gmailCheck.cleanEmail.toLowerCase(),
      activeEmailChangeRequestId: requestId,
    });
    await logAuditEvent("Verification Resent", `Verification email resent to ${gmailCheck.cleanEmail}`, targetUser.email || "", targetUser.uid);
  } catch (err: any) {
    console.error("[EMAIL RESEND] Resend failed:", err);
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (code === "auth/too-many-requests" || msg.includes("too-many-requests")) {
      throw new Error("Too many attempts. Please wait a while before trying again.");
    }
    if (code === "auth/requires-recent-login" || msg.includes("requires-recent-login")) {
      throw new Error("For security, please sign in again and try again.");
    }
    if (isSessionExpired(err) || code === "auth/user-token-expired" || msg.includes("user-token-expired")) {
      throw new Error("Your session has expired. Please sign in again to continue.");
    }
    throw new Error(formatAuthError(err));
  }

  return { requestId, expiresAt, newEmail: gmailCheck.cleanEmail.toLowerCase() };
}

let globalCancelCounter = 0;

export async function cancelPendingEmailChange(user: User, pendingEmail?: string | null): Promise<void> {
  const invocationId = `cancel_${++globalCancelCounter}_${Date.now()}`;
  console.log(`[EMAIL CANCEL] invocation=${invocationId} uid=${user.uid} target=${pendingEmail || "none"}`);
  try {
    // Check if active request is already verified
    const activeReq = await getActiveEmailChangeRequest(user.uid);
    if (activeReq && activeReq.status === "verified") {
      throw new Error("Email verification has already been completed. Please click 'Refresh Verification Status' to finish the email change.");
    }

    // 1. Mark active request as cancelled in Firestore
    if (activeReq && (activeReq.status === "pending" || activeReq.status === "expired")) {
      await setDoc(doc(db, "emailChangeRequests", activeReq.requestId), {
        status: "cancelled",
        updatedAt: Date.now(),
      }, { merge: true }).catch(() => {});
    }

    // Also mark any other pending requests for this user as cancelled
    await invalidateUserPendingEmailRequests(user.uid);

    // 2. Clear localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(`pending_email_${user.uid}`);
      window.localStorage.removeItem(`pending_email_req_${user.uid}`);
      window.localStorage.removeItem(`pending_email_expires_${user.uid}`);
    }

    // 3. Clear user profile
    await upsertUserProfile(user.uid, {
      pendingEmail: null,
      activeEmailChangeRequestId: null,
    });

    if (pendingEmail) {
      await updateEmailHistoryStatus(user.uid, pendingEmail, "cancelled");
    }
    await logAuditEvent("Cancelled", `Email change request cancelled for ${user.email}`, user.email || "", user.uid);
    await createUserNotification(
      user.uid,
      "Email Change Cancelled",
      "Your email change request has been cancelled.",
      "system"
    );
    console.log(`[EMAIL CANCEL] invocation=${invocationId} result=success`);
  } catch (e: any) {
    console.warn(`[EMAIL CANCEL] invocation=${invocationId} result=error:`, e);
    throw e;
  }
}

export async function checkIsEmailRegistered(email: string, currentUid?: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return false;

  // 1. Check emailIndex collection in Firestore
  try {
    if (db && typeof db === "object" && "app" in db) {
      const emailIndexRef = doc(db, "emailIndex", cleanEmail);
      const emailIndexSnap = await getDoc(emailIndexRef);
      if (emailIndexSnap.exists()) {
        const data = emailIndexSnap.data();
        if (currentUid && (data.uid === currentUid || data.userId === currentUid)) {
          // Belongs to the current active user
        } else if (data.status !== "deleted") {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn("Error checking emailIndex in Firestore:", err);
  }

  // 2. Check users collection in Firestore
  try {
    const profile = await getUserProfileByEmail(cleanEmail);
    if (profile) {
      if (currentUid && (profile.uid === currentUid || profile.id === currentUid)) {
        // Belongs to current user
      } else if (profile.status !== "deleted") {
        return true;
      }
    }
  } catch (err) {
    console.warn("Error checking profile by email:", err);
  }

  // 3. Check duplicate user helper
  try {
    const dupes = await checkDuplicateUser(cleanEmail, "");
    if (dupes.emailExists) {
      return true;
    }
  } catch (err) {
    console.warn("Error checking duplicate user in Firestore:", err);
  }

  // 4. Check Firebase Auth sign in methods
  try {
    if (auth && typeof auth === "object" && "app" in auth) {
      const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
      if (methods && methods.length > 0) return true;
    }
  } catch (err) {
    console.warn("Error fetching sign in methods for email:", err);
  }

  return false;
}

export function syncEmailToLocalStorage(uid: string, newEmail: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const cleanEmail = newEmail.trim().toLowerCase();
  try {
    window.localStorage.removeItem(`pending_email_${uid}`);
    window.localStorage.removeItem(`pending_email_req_${uid}`);
    window.localStorage.removeItem(`pending_email_expires_${uid}`);
    window.localStorage.removeItem(`resend_email_change_${uid}`);
    window.localStorage.setItem("saved_email", cleanEmail);
    window.localStorage.setItem("remember_me_email", cleanEmail);
    window.localStorage.setItem("user_email", cleanEmail);
  } catch (e) {
    console.warn("Failed to sync email to localStorage:", e);
  }
}

/**
 * Idempotently synchronize Firestore, emailIndex, emailHistory, local storage, audit logs, and notification
 * when an email change is completed in Firebase Auth.
 */
export async function commitEmailChangeInFirestore(
  uid: string,
  newEmail: string,
  oldEmail?: string | null
): Promise<{ success: boolean; newEmail: string }> {
  const cleanNewEmail = newEmail.trim().toLowerCase();
  const cleanOldEmail = oldEmail ? oldEmail.trim().toLowerCase() : null;

  console.log("[FIRESTORE SYNC] Committing email change:", { uid, cleanNewEmail, cleanOldEmail });

  // 1. Get current profile to preserve account UID
  const p = await getUserProfile(uid);

  // 2. Update user profile document in Firestore
  await upsertUserProfile(uid, {
    email: cleanNewEmail,
    emailVerified: true,
    pendingEmail: null,
    activeEmailChangeRequestId: null,
    status: "active",
  });

  // 3. Sync to localStorage & wipe all pending keys
  syncEmailToLocalStorage(uid, cleanNewEmail);

  // 4. Update email history
  try {
    await updateEmailHistoryStatus(uid, cleanNewEmail, "verified");
  } catch (e) {
    console.warn("Notice: email history status update:", e);
  }

  // 5. Atomic / safe emailIndex update
  try {
    // Safely remove old email index only if it matches current UID
    if (cleanOldEmail && cleanOldEmail !== cleanNewEmail) {
      console.log("[EMAIL INDEX] Cleaning up old email index:", cleanOldEmail);
      const oldIndexRef = doc(db, "emailIndex", cleanOldEmail);
      const oldIndexSnap = await getDoc(oldIndexRef);
      if (oldIndexSnap.exists()) {
        const oldData = oldIndexSnap.data();
        if (oldData.uid === uid || oldData.userId === uid) {
          await deleteDoc(oldIndexRef).catch(() => {});
        }
      }
    }

    // Set new email index
    console.log("[EMAIL INDEX] Setting new email index:", cleanNewEmail);
    await setDoc(
      doc(db, "emailIndex", cleanNewEmail),
      {
        uid,
        accountUid: p?.accountUid || uid,
        email: cleanNewEmail,
        status: "active",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("[EMAIL INDEX] Notice: emailIndex synchronization:", e);
  }

  // 6. Idempotent Notification & Audit Log
  try {
    if (cleanOldEmail && cleanOldEmail !== cleanNewEmail) {
      await logAuditEvent(
        "Verification Completed",
        `Email verification completed and updated to ${cleanNewEmail}`,
        cleanNewEmail,
        uid
      );
      await createUserNotification(
        uid,
        "Email Changed Successfully",
        `Your LinkCloud email address has been changed to ${cleanNewEmail}. If this wasn't you, contact support immediately.`,
        "system"
      );
    }
  } catch (e) {
    console.warn("Notice: notification / audit log on email change:", e);
  }

  return { success: true, newEmail: cleanNewEmail };
}

export interface EmailVerificationSyncResult {
  status: "success" | "pending" | "expired" | "cancelled" | "superseded" | "error";
  message: string;
  verifiedEmail?: string;
}

let activeSyncPromise: Promise<EmailVerificationSyncResult> | null = null;
let globalSyncCounter = 0;

/**
 * Centralized email change status verification & synchronization function.
 * Used ONLY by the user's manual "Refresh Status" button.
 */
export async function checkAndSyncEmailChangeStatus(
  options?: {
    manual?: boolean;
    targetPendingEmail?: string | null;
    caller?: string;
  }
): Promise<EmailVerificationSyncResult> {
  const manual = Boolean(options?.manual);
  const caller = options?.caller || "direct";
  const invocationId = `sync_${++globalSyncCounter}_${Date.now()}`;
  console.log(`[EMAIL SYNC] invocation=${invocationId} manual=${manual} caller=${caller} target=${options?.targetPendingEmail || "none"}`);

  if (!manual) {
    console.warn(`[EMAIL SYNC] invocation=${invocationId} Notice: checkAndSyncEmailChangeStatus invoked with manual: false. Non-manual automatic polling has been deprecated.`);
  }

  if (activeSyncPromise) {
    try {
      const res = await activeSyncPromise;
      if (manual && res.status === "pending") {
        toast.info(res.message || "Your email verification is still pending.");
      }
      return res;
    } catch {
      // Allow re-run if previous promise errored
    }
  }

  const syncOperation = (async (): Promise<EmailVerificationSyncResult> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        const msg = "Unable to check verification status. Please sign in again.";
        if (manual) toast.error(msg);
        return { status: "error", message: msg };
      }

      const uid = currentUser.uid;
      const pendingKey = `pending_email_${uid}`;
      const savedPending =
        options?.targetPendingEmail ||
        (typeof window !== "undefined" && window.localStorage
          ? window.localStorage.getItem(pendingKey)
          : null);

      // Check active request from Firestore
      const activeReq = await getActiveEmailChangeRequest(uid);
      const now = Date.now();

      // If user has no pending email in local state or active request, return status cleanly
      if (!activeReq && !savedPending) {
        let reloadedUser = currentUser;
        try {
          await currentUser.reload();
          await currentUser.getIdToken(true);
          reloadedUser = auth.currentUser || currentUser;
        } catch {}
        return {
          status: "success",
          message: "Email is up to date.",
          verifiedEmail: reloadedUser.email ? reloadedUser.email.trim().toLowerCase() : "",
        };
      }

      // 1. Check cancelled
      if (activeReq && activeReq.status === "cancelled") {
        console.warn("[EMAIL SYNC] Request has been cancelled");
        const msg = "Verification link cancelled.";
        if (manual) toast.error(msg);
        return { status: "cancelled", message: msg };
      }

      // 2. Check superseded
      if (activeReq && activeReq.status === "superseded") {
        console.warn("[EMAIL SYNC] Request was superseded by a newer request");
        const msg = "This is an older verification link. Please use the latest link.";
        if (manual) toast.error(msg);
        return { status: "superseded", message: msg };
      }

      // 3. Check expiration (60-second TTL)
      if (activeReq && (activeReq.status === "expired" || (activeReq.status === "pending" && now > activeReq.expiresAt))) {
        console.warn("[EMAIL SYNC] Request has expired (60-second TTL elapsed)");
        if (activeReq.status !== "expired") {
          await setDoc(doc(db, "emailChangeRequests", activeReq.requestId), {
            status: "expired",
            updatedAt: now,
          }, { merge: true }).catch(() => {});
        }
        const msg = "Verification link expired. Please send a new verification link.";
        if (manual) toast.error(msg);
        return { status: "expired", message: msg };
      }

      // 4. Force reload Firebase user & token refresh safely
      let reloadedUser = currentUser;
      try {
        await currentUser.reload();
        await currentUser.getIdToken(true);
        reloadedUser = auth.currentUser || currentUser;
      } catch (reloadErr: any) {
        console.warn("[EMAIL SYNC] Firebase Auth reload transient notice:", reloadErr?.code || reloadErr?.message);
        // Do NOT fail or log out if token is in transition. reloadedUser remains currentUser.
      }

      const targetVerifiedEmail = (activeReq?.newEmail || savedPending || "").trim().toLowerCase();

      // If active request was marked 'verified' by email-action handler in Gmail tab:
      if (activeReq && activeReq.status === "verified") {
        console.log("[EMAIL SYNC] Detected request verified in Firestore. Synchronizing...", {
          requestId: activeReq.requestId,
          newEmail: targetVerifiedEmail,
        });

        // Try one more token reload if needed
        if (reloadedUser.email?.trim().toLowerCase() !== targetVerifiedEmail) {
          try {
            await currentUser.reload();
            await currentUser.getIdToken(true);
            reloadedUser = auth.currentUser || currentUser;
          } catch {}
        }

        const effectiveNewEmail = targetVerifiedEmail || (reloadedUser.email ? reloadedUser.email.trim().toLowerCase() : "");
        const profile = await getUserProfile(uid);
        const oldEmail = profile?.email ? profile.email.trim().toLowerCase() : (activeReq.oldEmail || "");

        await commitEmailChangeInFirestore(uid, effectiveNewEmail, oldEmail);

        const successMsg = "Email updated successfully";
        if (manual) {
          toast.success(successMsg);
        }
        return {
          status: "success",
          message: successMsg,
          verifiedEmail: effectiveNewEmail,
        };
      }

      const currentAuthEmail = reloadedUser.email ? reloadedUser.email.trim().toLowerCase() : "";
      const expectedEmail = targetVerifiedEmail;

      // Get current profile in Firestore
      const profile = await getUserProfile(uid);
      const firestoreEmail = profile?.email ? profile.email.trim().toLowerCase() : "";

      // Determine if email change has completed in Firebase Auth
      const isEmailChangedInAuth =
        expectedEmail && currentAuthEmail === expectedEmail;
      const isAuthAheadOfFirestore =
        currentAuthEmail && firestoreEmail && currentAuthEmail !== firestoreEmail;

      if (isEmailChangedInAuth || isAuthAheadOfFirestore) {
        console.log("[EMAIL SYNC] Authoritative email verified in Firebase Auth! Committing to Firestore...", {
          currentAuthEmail,
          expectedEmail,
        });

        if (activeReq && activeReq.requestId) {
          await setDoc(doc(db, "emailChangeRequests", activeReq.requestId), {
            status: "verified",
            updatedAt: Date.now(),
          }, { merge: true }).catch(() => {});
        }

        const oldEmail = firestoreEmail || activeReq?.oldEmail || (expectedEmail && expectedEmail !== currentAuthEmail ? firestoreEmail : "");
        await commitEmailChangeInFirestore(uid, currentAuthEmail, oldEmail);

        const successMsg = "Email updated successfully";
        if (manual) {
          toast.success(successMsg);
        }
        return {
          status: "success",
          message: successMsg,
          verifiedEmail: currentAuthEmail,
        };
      }

      // Check if user is already verified and no pending exists
      if (!expectedEmail && !profile?.pendingEmail) {
        if (reloadedUser.emailVerified) {
          if (profile && !profile.emailVerified) {
            await upsertUserProfile(uid, { emailVerified: true, status: "active" });
          }
          if (manual) {
            toast.success("Email updated successfully");
          }
          return {
            status: "success",
            message: "Email updated successfully",
            verifiedEmail: currentAuthEmail,
          };
        }
      }

      // Still pending in Firebase Auth
      console.log("[EMAIL SYNC] Verification is still pending in Firebase Auth");
      const pendingMsg = "Verification is still pending. Please click the link in your email and try again.";
      if (manual) {
        toast.info(pendingMsg);
      }
      return {
        status: "pending",
        message: pendingMsg,
      };
    } catch (err: any) {
      console.error("[EMAIL SYNC] Error in checkAndSyncEmailChangeStatus:", err);
      const errorMsg = "Unable to check verification status. Please check your internet connection and try again.";
      if (manual) {
        toast.error(errorMsg);
      }
      return {
        status: "error",
        message: errorMsg,
      };
    }
  })();

  activeSyncPromise = syncOperation;

  try {
    return await syncOperation;
  } finally {
    activeSyncPromise = null;
  }
}

export async function deleteUserAccount(
  user: User,
  currentPass: string
): Promise<void> {
  try {
    await user.reload().catch(() => {});
  } catch (e) {
    console.warn("User reload failed before delete:", e);
  }

  if (!user.email) throw new Error("Email address required to delete account.");

  try {
    const cred = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, cred);

    await performPermanentUserDeletion({
      targetUid: user.uid,
      adminEmail: user.email,
      adminUid: user.uid,
      reason: "Self Direct Permanent Deletion",
      isSelfDelete: true,
    });
  } catch (err: any) {
    const code = err?.code || "";
    const msg = String(err?.message || "");
    if (
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
      msg.includes("wrong-password") ||
      msg.includes("invalid-credential")
    ) {
      throw new Error("Incorrect current password.");
    }
    throw new Error(formatAuthError(err));
  }
}

export async function signOut(): Promise<void> {
  await logout();
}

export { onAuthStateChanged, auth };
export type { User, ConfirmationResult };
