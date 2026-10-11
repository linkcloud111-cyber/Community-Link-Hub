import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut, applyActionCode, type ConfirmationResult } from "firebase/auth";
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
  loginUser,
  registerWithEmail,
  signInWithGoogle as signInWithGoogleAuth,
  signInWithMobileOTP as signInWithMobileOTPAuth,
  verifyOTP as verifyOTPAuth,
  loginWebmaster as loginWebmasterAuth,
  logout as logoutAuth,
  logAuthEvent,
  extractAuthErrorCode,
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
  isSessionHandoff: boolean;
  startSessionHandoff: () => void;
  endSessionHandoff: () => void;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string, remember?: boolean) => Promise<User>;
  register: (data: {
    fullName: string;
    dob: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<User>;
  loginWithGoogle: (mode?: "login" | "register") => Promise<User>;
  sendMobileOTP: (phone: string, containerId?: string) => Promise<ConfirmationResult>;
  verifyMobileOTP: (confirmationResult: ConfirmationResult, code: string) => Promise<User>;
  loginAsWebmaster: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
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
  isSessionHandoff: false,
  startSessionHandoff: () => {},
  endSessionHandoff: () => {},
  refreshProfile: async () => {},
  login: async () => {
    throw new Error("AuthContext not initialized");
  },
  register: async () => {
    throw new Error("AuthContext not initialized");
  },
  loginWithGoogle: async () => {
    throw new Error("AuthContext not initialized");
  },
  sendMobileOTP: async () => {
    throw new Error("AuthContext not initialized");
  },
  verifyMobileOTP: async () => {
    throw new Error("AuthContext not initialized");
  },
  loginAsWebmaster: async () => {
    throw new Error("AuthContext not initialized");
  },
  logout: async () => {},
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
  const [isSessionHandoff, setIsSessionHandoff] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem("linkcloud_session_handoff") === "true";
    }
    return false;
  });
  const isSessionHandoffRef = React.useRef(isSessionHandoff);
  useEffect(() => {
    isSessionHandoffRef.current = isSessionHandoff;
  }, [isSessionHandoff]);

  const startSessionHandoff = useCallback(() => {
    console.log("[AUTH CONTEXT] Starting session handoff (protecting routes)...");
    setIsSessionHandoff(true);
    isSessionHandoffRef.current = true;
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem("linkcloud_session_handoff", "true");
    }
  }, []);

  const endSessionHandoff = useCallback(() => {
    console.log("[AUTH CONTEXT] Ending session handoff...");
    setIsSessionHandoff(false);
    isSessionHandoffRef.current = false;
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem("linkcloud_session_handoff");
    }
  }, []);

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
      if (!isSessionHandoffRef.current) {
        try {
          await auth.currentUser.reload().catch(() => {});
        } catch (err) {
          console.warn("[AUTH CONTEXT] refreshProfile non-fatal reload warning:", err);
        }
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
            setLoading(true);
            if (firebaseUser) {
              try {
                await firebaseUser.getIdToken(false);
              } catch (tokenErr: any) {
                console.warn("[AUTH TOKEN] Auth token reload notice:", tokenErr);
                await logAuthEvent({
                  event: "AUTH_TOKEN_RELOAD_FAILURE",
                  method: "session",
                  context: "general",
                  outcome: "failure",
                  error: tokenErr,
                  errorCode: extractAuthErrorCode(tokenErr),
                  uid: firebaseUser.uid,
                  identifier: firebaseUser.email || firebaseUser.phoneNumber,
                });
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
              if (isSessionHandoffRef.current) {
                endSessionHandoff();
              }
            } else if (isSessionHandoffRef.current) {
              console.log("[AUTH STATE] Transient null user during active session handoff. Retaining current session state.");
              // Retain in-memory session while handoff completes signInWithCustomToken
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
            logAuthEvent({
              event: "AUTH_STATE_CHANGED_ERROR",
              method: "session",
              context: "general",
              outcome: "failure",
              error: err,
              errorCode: extractAuthErrorCode(err),
            }).catch(() => {});
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
  }, [fetchAndCheckProfile, endSessionHandoff]);

  // Centralized checkAndSyncEmailChangeStatus method provided by AuthContext.
  // ONLY invoked manually when the user explicitly clicks the "Refresh Verification Status" button.
  const checkAndSyncEmailChangeStatus = useCallback(
    async (options?: { manual?: boolean; targetPendingEmail?: string | null; caller?: string }): Promise<EmailVerificationSyncResult> => {
      const result = await checkAndSyncEmailAuth({ ...options, caller: options?.caller || "AuthContext" });
      if (result.status === "success" && auth.currentUser) {
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

  const login = useCallback(async (email: string, password: string, remember: boolean = true): Promise<User> => {
    try {
      const loggedInUser = await loginUser(email, password, remember);
      await logAuthEvent({
        event: "AUTH_CONTEXT_LOGIN_SUCCESS",
        method: "email_password",
        context: "email_password",
        outcome: "success",
        uid: loggedInUser.uid,
        identifier: email,
        portal: "user",
      });
      await fetchAndCheckProfile(loggedInUser.uid, loggedInUser.email, loggedInUser.emailVerified);
      return loggedInUser;
    } catch (err: any) {
      await logAuthEvent({
        event: "AUTH_CONTEXT_LOGIN_FAILURE",
        method: "email_password",
        context: "email_password",
        outcome: "failure",
        error: err,
        errorCode: extractAuthErrorCode(err),
        identifier: email,
        portal: "user",
      });
      throw err;
    }
  }, [fetchAndCheckProfile]);

  const register = useCallback(async (data: {
    fullName: string;
    dob: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<User> => {
    try {
      const registeredUser = await registerWithEmail(data);
      await logAuthEvent({
        event: "AUTH_CONTEXT_SIGNUP_SUCCESS",
        method: "registration",
        context: "email_password",
        outcome: "success",
        uid: registeredUser.uid,
        identifier: data.email,
        portal: "user",
      });
      await fetchAndCheckProfile(registeredUser.uid, registeredUser.email, registeredUser.emailVerified);
      return registeredUser;
    } catch (err: any) {
      await logAuthEvent({
        event: "AUTH_CONTEXT_SIGNUP_FAILURE",
        method: "registration",
        context: "email_password",
        outcome: "failure",
        error: err,
        errorCode: extractAuthErrorCode(err),
        identifier: data.email,
        portal: "user",
      });
      throw err;
    }
  }, [fetchAndCheckProfile]);

  const loginWithGoogle = useCallback(async (mode: "login" | "register" = "login"): Promise<User> => {
    try {
      const googleUser = await signInWithGoogleAuth(mode);
      await logAuthEvent({
        event: mode === "register" ? "AUTH_CONTEXT_GOOGLE_SIGNUP_SUCCESS" : "AUTH_CONTEXT_GOOGLE_LOGIN_SUCCESS",
        method: "google",
        context: "google",
        outcome: "success",
        uid: googleUser.uid,
        identifier: googleUser.email,
        portal: "user",
      });
      await fetchAndCheckProfile(googleUser.uid, googleUser.email, googleUser.emailVerified);
      return googleUser;
    } catch (err: any) {
      await logAuthEvent({
        event: mode === "register" ? "AUTH_CONTEXT_GOOGLE_SIGNUP_FAILURE" : "AUTH_CONTEXT_GOOGLE_LOGIN_FAILURE",
        method: "google",
        context: "google",
        outcome: "failure",
        error: err,
        errorCode: extractAuthErrorCode(err),
        portal: "user",
      });
      throw err;
    }
  }, [fetchAndCheckProfile]);

  const sendMobileOTP = useCallback(async (phone: string, containerId: string = "recaptcha-container"): Promise<ConfirmationResult> => {
    try {
      const confirmationResult = await signInWithMobileOTPAuth(phone, containerId);
      await logAuthEvent({
        event: "AUTH_CONTEXT_OTP_SEND_SUCCESS",
        method: "mobile_otp",
        context: "mobile_otp",
        outcome: "success",
        identifier: phone,
        portal: "user",
      });
      return confirmationResult;
    } catch (err: any) {
      await logAuthEvent({
        event: "AUTH_CONTEXT_OTP_SEND_FAILURE",
        method: "mobile_otp",
        context: "mobile_otp",
        outcome: "failure",
        error: err,
        errorCode: extractAuthErrorCode(err),
        identifier: phone,
        portal: "user",
      });
      throw err;
    }
  }, []);

  const verifyMobileOTP = useCallback(async (confirmationResult: ConfirmationResult, code: string): Promise<User> => {
    try {
      const verifiedUser = await verifyOTPAuth(confirmationResult, code);
      await logAuthEvent({
        event: "AUTH_CONTEXT_OTP_LOGIN_SUCCESS",
        method: "mobile_otp",
        context: "mobile_otp",
        outcome: "success",
        uid: verifiedUser.uid,
        identifier: verifiedUser.phoneNumber,
        portal: "user",
      });
      await fetchAndCheckProfile(verifiedUser.uid, verifiedUser.email, verifiedUser.emailVerified);
      return verifiedUser;
    } catch (err: any) {
      await logAuthEvent({
        event: "AUTH_CONTEXT_OTP_LOGIN_FAILURE",
        method: "mobile_otp",
        context: "mobile_otp",
        outcome: "failure",
        error: err,
        errorCode: extractAuthErrorCode(err),
        portal: "user",
      });
      throw err;
    }
  }, [fetchAndCheckProfile]);

  const loginAsWebmaster = useCallback(async (email: string, password: string): Promise<User> => {
    try {
      const wmUser = await loginWebmasterAuth(email, password);
      await logAuthEvent({
        event: "AUTH_CONTEXT_WEBMASTER_LOGIN_SUCCESS",
        method: "email_password",
        context: "email_password",
        outcome: "success",
        uid: wmUser.uid,
        identifier: email,
        portal: "webmaster",
      });
      await fetchAndCheckProfile(wmUser.uid, wmUser.email, wmUser.emailVerified);
      return wmUser;
    } catch (err: any) {
      await logAuthEvent({
        event: "AUTH_CONTEXT_WEBMASTER_LOGIN_FAILURE",
        method: "email_password",
        context: "email_password",
        outcome: "failure",
        error: err,
        errorCode: extractAuthErrorCode(err),
        identifier: email,
        portal: "webmaster",
      });
      throw err;
    }
  }, [fetchAndCheckProfile]);

  const logout = useCallback(async (): Promise<void> => {
    const activeUid = auth.currentUser?.uid || user?.uid || null;
    const activeIdentifier = auth.currentUser?.email || auth.currentUser?.phoneNumber || user?.email || null;
    try {
      await logoutAuth();
      setUser(null);
      setProfile(null);
      setPendingEmail(null);
      await logAuthEvent({
        event: "AUTH_CONTEXT_LOGOUT",
        method: "session",
        context: "general",
        outcome: "success",
        uid: activeUid,
        identifier: activeIdentifier,
      });
    } catch (err: any) {
      await logAuthEvent({
        event: "AUTH_CONTEXT_LOGOUT",
        method: "session",
        context: "general",
        outcome: "failure",
        error: err,
        errorCode: extractAuthErrorCode(err),
        uid: activeUid,
        identifier: activeIdentifier,
      });
      throw err;
    }
  }, [user?.uid, user?.email]);

  const isCanonicalWebmaster = user?.uid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1" || auth.currentUser?.uid === "OXGYTyWBcdYNcHkWyXPbOvVlV2h1";
  const checkIsWebmaster = isCanonicalWebmaster || profile?.role === "webmaster";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isWebmaster: Boolean(checkIsWebmaster),
        pendingEmail,
        isSessionHandoff,
        startSessionHandoff,
        endSessionHandoff,
        refreshProfile,
        login,
        register,
        loginWithGoogle,
        sendMobileOTP,
        verifyMobileOTP,
        loginAsWebmaster,
        logout,
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
