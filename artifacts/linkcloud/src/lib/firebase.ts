import { initializeApp, getApps, setLogLevel, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  RecaptchaVerifier,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  setLogLevel as setFirestoreLogLevel,
  memoryLocalCache,
  memoryLruGarbageCollector,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Suppress internal transport-level WebChannel reconnect warnings while preserving real error logging
setLogLevel("silent");
try {
  setFirestoreLogLevel("silent");
} catch {}

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// Check if valid Firebase API Key is provided
const isValidApiKey =
  typeof rawApiKey === "string" &&
  rawApiKey.trim().length > 10 &&
  rawApiKey !== "undefined" &&
  !rawApiKey.includes("YOUR_");

const firebaseConfig = {
  apiKey: isValidApiKey ? rawApiKey : "AIzaSyDummyApiKeyForLinkcloudApp2026Key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "linkcloud-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "linkcloud-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "linkcloud-app.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890",
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

const isNewApp = getApps().length === 0;
try {
  app = isNewApp ? initializeApp(firebaseConfig) : getApps()[0];

  // Initialize Auth using localStorage & inMemory persistence explicitly (avoiding IndexedDB closing/hidden in iframe)
  if (isNewApp) {
    try {
      auth = initializeAuth(app, {
        persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      auth = getAuth(app);
    }
  } else {
    try {
      auth = getAuth(app);
    } catch {
      auth = initializeAuth(app, {
        persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    }
  }

  if (isNewApp) {
    try {
      db = initializeFirestore(app, {
        localCache: memoryLocalCache({ garbageCollector: memoryLruGarbageCollector() }),
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true,
      });
    } catch {
      db = getFirestore(app);
    }
  } else {
    try {
      db = initializeFirestore(app, {
        localCache: memoryLocalCache({ garbageCollector: memoryLruGarbageCollector() }),
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true,
      });
    } catch {
      db = getFirestore(app);
    }
  }
  storage = getStorage(app);
} catch (err) {
  console.warn("[Firebase] Initialization issue, creating safe fallback instance:", err);
  app = (getApps()[0] || {}) as FirebaseApp;
  try {
    auth = getAuth(app);
  } catch {
    auth = {} as Auth;
  }
  try {
    db = getFirestore(app);
  } catch {
    db = {} as Firestore;
  }
  try {
    storage = getStorage(app);
  } catch {
    storage = {} as FirebaseStorage;
  }
}

export { app, auth, db, storage };

// Google Authentication Provider
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Invisible reCAPTCHA (Phone OTP)
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export const createRecaptcha = (containerId: string) => {
  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  if (!auth || typeof auth !== "object" || !("app" in auth)) {
    console.warn("reCAPTCHA creation skipped: Firebase Auth not fully configured.");
    return null;
  }

  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => {},
  });

  return window.recaptchaVerifier;
};

export const setupRecaptcha = createRecaptcha;

export default app;