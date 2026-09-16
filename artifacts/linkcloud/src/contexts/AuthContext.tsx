import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut, applyActionCode } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import {
  getUserProfile,
  upsertUserProfile,
  updateEmailHistoryStatus,
  logAuditEvent,
  createUserNotification,
  checkIsAccountDeleted,
} from "../lib/firestore";
import {
  checkWebmasterCollection,
  checkAndSyncEmailChangeStatus as checkAndSyncEmailAuth,
  type EmailVerificationSyncResult,
} from "../lib/auth";
import type { UserProfile } from "../lib/types";
import { toast } from "sonner";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isWebmaster: boolean;
  pendingEmail: string | null;
  refreshProfile: () => Promise<void>;
  checkAndSyncEmailChangeStatus: (options?: {
    manual?: boolean;
    targetPendingEmail?: string | null;
  }) => Promise<EmailVerificationSyncResult>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  isWebmaster: false,
  pendingEmail: null,
  refreshProfile: async () => {},
  checkAndSyncEmailChangeStatus: async () => ({
    status: "pending",
    message: "Your email verification is still pending.",
  }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initialAuthResolvedRef = React.useRef(false);

  // Stable fetchAndCheckProfile
  const fetchAndCheckProfile = useCallback(async (uid: string, authUserEmail?: string | null, isEmailVerified?: boolean) => {
    try {
      let p = await getUserProfile(uid);
      if (p?.status === "suspended" || p?.status === "banned" || p?.status === "deleted") {
        console.warn(`[AUTH PROFILE] User ${uid} account status is ${p?.status}`);
        setProfile(p);
        return p;
      }

      const pendingKey = `pending_email_${uid}`;
      const savedPending = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(pendingKey) : null;

      // Case 1: Initial profile creation if document missing in Firestore
      if (!p && authUserEmail) {
        const cleanEmail = authUserEmail.toLowerCase();
        await upsertUserProfile(uid, {
          email: cleanEmail,
          emailVerified: Boolean(isEmailVerified),
          pendingEmail: null,
          status: "active",
        });
        p = {
          uid,
          displayName: "User",
          email: cleanEmail,
          phone: "",
          photoURL: "",
          role: "user",
          groupCount: 0,
          createdAt: null as any,
          emailVerified: Boolean(isEmailVerified),
        };
      }
      // Email verified boolean updated for existing matching email
      else if (p && isEmailVerified && !p.emailVerified) {
        await upsertUserProfile(uid, {
          emailVerified: true,
        });
        p = {
          ...p,
          emailVerified: true,
        };
        await logAuditEvent("Email Verified", `Email verified for ${p.email}`, p.email || "", uid);
      }

      // Check and preserve active pending email state
      const currentActivePending =
        (p?.pendingEmail && p.pendingEmail.toLowerCase() !== authUserEmail?.toLowerCase())
          ? p.pendingEmail
          : (savedPending && savedPending.toLowerCase() !== authUserEmail?.toLowerCase())
          ? savedPending
          : null;

      if (currentActivePending) {
        setPendingEmail(currentActivePending);
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(pendingKey, currentActivePending);
        }
      } else {
        setPendingEmail(null);
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(pendingKey);
        }
      }

      // Explicitly check webmaster Firestore collection for current user's UID
      const isWebmasterDoc = await checkWebmasterCollection(uid);

      if (isWebmasterDoc) {
        if (p) {
          p = { ...p, role: "webmaster", status: "active" };
        } else {
          p = {
            uid,
            displayName: "Webmaster",
            email: authUserEmail || "",
            phone: "",
            photoURL: "",
            role: "webmaster",
            status: "active",
            groupCount: 0,
            createdAt: null as any,
          };
        }
      }

      setProfile((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(p)) {
          return prev;
        }
        return p;
      });
      return p;
    } catch (err) {
      console.warn("[FIRESTORE SYNC] Notice: fetchAndCheckProfile non-fatal error:", err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      try {
        await auth.currentUser.reload().catch(() => {});
        await auth.currentUser.getIdToken(true).catch(() => {});
      } catch (err) {
        console.warn("[AUTH CONTEXT] refreshProfile non-fatal reload warning:", err);
      }
      const updatedUser = auth.currentUser;
      if (updatedUser) {
        // Clone user to ensure React reference update triggers routing guards immediately
        const clonedUser = Object.assign(Object.create(Object.getPrototypeOf(updatedUser)), updatedUser);
        setUser(clonedUser);
        await fetchAndCheckProfile(updatedUser.uid, updatedUser.email, updatedUser.emailVerified);
      }
    } else if (user?.uid) {
      await fetchAndCheckProfile(user.uid, user.email, user.emailVerified);
    }
  }, [user?.uid, user?.email, user?.emailVerified, fetchAndCheckProfile]);

  // If user opens an oobCode action link on another route, redirect to /verify-handler
  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentPath = window.location.pathname;
    if (currentPath === "/verify-handler" || currentPath === "/email-action") return;
    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get("oobCode");
    const mode = urlParams.get("mode");

    if (oobCode && (mode === "verifyAndChangeEmail" || mode === "verifyEmail" || mode === "resetPassword" || mode === "recoverEmail")) {
      window.location.href = `/verify-handler${window.location.search}`;
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    console.log("[AUTH STATE] Auth initialized");
    try {
      if (auth && typeof auth === "object" && "app" in auth) {
        unsubscribe = onAuthStateChanged(
          auth,
          async (firebaseUser) => {
            console.log("[AUTH STATE] onAuthStateChanged fired:", {
              uid: firebaseUser?.uid ?? null,
              email: firebaseUser?.email ?? null,
              emailVerified: firebaseUser?.emailVerified ?? false,
            });
            if (!initialAuthResolvedRef.current) {
              setLoading(true);
            }
            if (firebaseUser) {
              try {
                await firebaseUser.getIdToken(false);
              } catch (tokenErr: any) {
                console.warn("[AUTH TOKEN] Auth token reload notice:", tokenErr);
              }

              // Fetch Firestore profile and check webmaster collection
              await checkWebmasterCollection(firebaseUser.uid);
              await fetchAndCheckProfile(firebaseUser.uid, firebaseUser.email, firebaseUser.emailVerified);

              setUser((prev) => {
                if (
                  prev &&
                  prev.uid === firebaseUser.uid &&
                  prev.email === firebaseUser.email &&
                  prev.emailVerified === firebaseUser.emailVerified
                ) {
                  return prev;
                }
                return firebaseUser;
              });
            } else if (auth.currentUser) {
              console.log("[AUTH STATE] Retaining existing in-memory auth user session:", auth.currentUser.uid);
              setUser(auth.currentUser);
            } else {
              console.log("[AUTH STATE] No authenticated user detected");
              setUser(null);
              setProfile(null);
              setPendingEmail(null);
            }
            initialAuthResolvedRef.current = true;
            setLoading(false);
          },
          (err) => {
            console.warn("[AUTH STATE] Auth state change error:", err);
            initialAuthResolvedRef.current = true;
            setLoading(false);
          }
        );
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.warn("[AUTH STATE] Firebase auth state listener setup failed:", err);
      setLoading(false);
    }
    return () => {
      try {
        unsubscribe();
      } catch {}
    };
  }, [fetchAndCheckProfile]);

  // Centralized checkAndSyncEmailChangeStatus method provided by AuthContext.
  // ONLY invoked manually when the user explicitly clicks the "Refresh Verification Status" button.
  const checkAndSyncEmailChangeStatus = useCallback(
    async (options?: { manual?: boolean; targetPendingEmail?: string | null; caller?: string }): Promise<EmailVerificationSyncResult> => {
      const result = await checkAndSyncEmailAuth({ ...options, caller: options?.caller || "AuthContext" });
      if (result.status === "success" && auth.currentUser) {
        try {
          await auth.currentUser.reload().catch(() => {});
          await auth.currentUser.getIdToken(true).catch(() => {});
        } catch (e) {
          console.warn("[AUTH CONTEXT] token reload notice:", e);
        }
        const refreshed = auth.currentUser;
        if (refreshed) {
          const clonedUser = Object.assign(Object.create(Object.getPrototypeOf(refreshed)), refreshed);
          setUser(clonedUser);
          setPendingEmail(null);
          if (typeof window !== "undefined" && window.localStorage && refreshed.uid) {
            window.localStorage.removeItem(`pending_email_${refreshed.uid}`);
            window.localStorage.removeItem(`pending_email_req_${refreshed.uid}`);
            window.localStorage.removeItem(`pending_email_expires_${refreshed.uid}`);
          }
          if (refreshed.uid) {
            await fetchAndCheckProfile(refreshed.uid, result.verifiedEmail || refreshed.email, refreshed.emailVerified);
          }
        }
      }
      return result;
    },
    [fetchAndCheckProfile]
  );

  const checkIsWebmaster = profile?.role === "webmaster";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isWebmaster: Boolean(checkIsWebmaster),
        pendingEmail,
        refreshProfile,
        checkAndSyncEmailChangeStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
