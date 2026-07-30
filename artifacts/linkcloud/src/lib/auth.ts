import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "./firebase";
import { upsertUserProfile } from "./firestore";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await upsertUserProfile(result.user.uid, {
    uid: result.user.uid,
    displayName: result.user.displayName || "",
    email: result.user.email || "",
    photoURL: result.user.photoURL || "",
    role: "user",
  });
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await upsertUserProfile(result.user.uid, {
    uid: result.user.uid,
    displayName,
    email,
    photoURL: "",
    role: "user",
  });
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged, auth };
export type { User };
