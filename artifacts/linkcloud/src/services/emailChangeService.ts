import type { User } from "firebase/auth";
import {
  updateUserEmailAddress,
  resendPendingEmailVerification,
  cancelPendingEmailChange,
  checkAndSyncEmailChangeStatus,
  getActiveEmailChangeRequest,
  getEmailChangeRequestById,
  checkIsEmailRegistered,
  commitEmailChangeInFirestore,
  EMAIL_CHANGE_TTL_MS,
  type EmailVerificationSyncResult,
} from "@/lib/auth";
import { validateGmailAddress, validateNewGmail } from "@/lib/utils";

export const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds strict cooldown

export interface EmailChangeRequestState {
  requestId: string;
  userId: string;
  oldEmail: string;
  newEmail: string;
  status: "pending" | "verified" | "expired" | "cancelled" | "superseded";
  createdAt: number;
  expiresAt: number;
  version: number;
  updatedAt?: number;
}

/**
 * Initiates an email change request with re-authentication and 60s TTL
 */
export async function requestEmailChange(
  user: User,
  newEmail: string,
  currentPass: string,
  displayName?: string
): Promise<{ requestId: string; expiresAt: number; newEmail: string }> {
  return updateUserEmailAddress(user, newEmail, currentPass, displayName);
}

/**
 * Resends verification link after 60s cooldown, invalidating prior requests as superseded
 */
export async function resendVerificationLink(
  user: User,
  pendingEmail: string
): Promise<{ requestId: string; expiresAt: number; newEmail: string }> {
  return resendPendingEmailVerification(user, pendingEmail);
}

/**
 * Cancels active email change request and clears local pending state
 */
export async function cancelEmailChange(
  user: User,
  pendingEmail?: string | null
): Promise<void> {
  return cancelPendingEmailChange(user, pendingEmail);
}

/**
 * Manually checks verification status against Firestore and Firebase Auth
 */
export async function refreshVerificationStatus(
  options?: {
    manual?: boolean;
    targetPendingEmail?: string | null;
    caller?: string;
  }
): Promise<EmailVerificationSyncResult> {
  return checkAndSyncEmailChangeStatus({
    manual: true,
    targetPendingEmail: options?.targetPendingEmail,
    caller: options?.caller || "emailChangeService.refreshVerificationStatus",
  });
}

export {
  updateUserEmailAddress,
  resendPendingEmailVerification,
  cancelPendingEmailChange,
  checkAndSyncEmailChangeStatus,
  getActiveEmailChangeRequest,
  getEmailChangeRequestById,
  checkIsEmailRegistered,
  commitEmailChangeInFirestore,
  validateGmailAddress,
  validateNewGmail,
  EMAIL_CHANGE_TTL_MS,
};
export type { EmailVerificationSyncResult };
