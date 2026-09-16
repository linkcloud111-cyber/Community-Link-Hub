import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';
import type { Platform, UserProfile } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Input Sanitization, Formatting & Normalization ───────────────────────

export function sanitizeString(val: string | undefined | null): string {
  if (!val) return "";
  // Trim leading/trailing whitespace and remove non-printable control characters
  return val.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

export function formatFullName(name: string): string {
  if (!name) return "";
  return name.replace(/[a-zA-Z]+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

// ─── Age Calculation & DOB Validation ──────────────────────────────────────

export function calculateAge(dobString: string): number {
  if (!dobString) return 0;
  const parts = dobString.split("-");
  if (parts.length !== 3) return 0;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return 0;

  const birthDate = new Date(year, month, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function validateDob(dob: string): { valid: boolean; age?: number; error?: string } {
  if (!dob || !dob.trim()) {
    return { valid: false, error: "Date of birth is required." };
  }

  const parts = dob.trim().split("-");
  if (parts.length !== 3) {
    return { valid: false, error: "Please enter a valid date of birth." };
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return { valid: false, error: "Please enter a valid date of birth." };
  }

  const birthDate = new Date(year, month, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month || birthDate.getDate() !== day) {
    return { valid: false, error: "Please enter a valid date of birth." };
  }

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (birthDate > todayMidnight) {
    return { valid: false, error: "Please enter a valid date of birth." };
  }

  if (year < 1900) {
    return { valid: false, error: "Please enter a valid date of birth." };
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 18) {
    return { valid: false, age, error: "You must be at least 18 years old." };
  }

  return { valid: true, age };
}

// ─── Full Name Validation ───────────────────────────────────────────────────

export function validateFullName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: "Full Name is required." };
  }
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, "");
  if (lettersOnly.length < 3 || !/^[a-zA-Z\s]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Full Name must contain at least 3 letters (only alphabets and spaces allowed)."
    };
  }
  return { valid: true };
}

// ─── Indian Mobile Number Validation ───────────────────────────────────────

export function extract10DigitMobile(phone: string | undefined | null): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.substring(2);
  } else if (digits.startsWith("0") && digits.length > 10) {
    digits = digits.substring(1);
  }
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
}

export function cleanMobileInput(val: string | undefined | null): string {
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

export function validateIndianMobile(phone: string): { valid: boolean; formatted: string; raw10: string; error?: string } {
  if (!phone || !phone.trim()) {
    return { valid: false, formatted: "", raw10: "", error: "Mobile number is required." };
  }
  const digits = cleanMobileInput(phone);
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return { valid: false, formatted: phone, raw10: digits, error: "Please enter a valid 10-digit Indian mobile number." };
  }
  return { valid: true, formatted: `+91${digits}`, raw10: digits };
}

export function validateNewMobile(
  newPhoneInput: string,
  currentPhone?: string | null
): {
  valid: boolean;
  formatted: string;
  raw10: string;
  error?: string;
  isCurrent?: boolean;
} {
  const raw10 = cleanMobileInput(newPhoneInput);
  if (!raw10) {
    return { valid: false, formatted: "", raw10: "", error: "Mobile number is required." };
  }

  const currentRaw10 = extract10DigitMobile(currentPhone);
  if (currentRaw10 && raw10 === currentRaw10) {
    return {
      valid: false,
      formatted: `+91${raw10}`,
      raw10,
      isCurrent: true,
      error: "New mobile number must be different from your current mobile number.",
    };
  }

  if (raw10.length < 10 || !/^[6-9]\d{9}$/.test(raw10)) {
    return {
      valid: false,
      formatted: `+91${raw10}`,
      raw10,
      error: "Please enter a valid 10-digit Indian mobile number.",
    };
  }

  return {
    valid: true,
    formatted: `+91${raw10}`,
    raw10,
  };
}

// ─── Profile Field Validation Helpers ──────────────────────────────────────

export function validateProfileLocation(
  state: string,
  district: string,
  city: string
): {
  valid: boolean;
  errors: { state?: string; district?: string; city?: string };
} {
  const errors: { state?: string; district?: string; city?: string } = {};
  if (!state || !state.trim() || state === "Select State") {
    errors.state = "State is required.";
  }
  if (!district || !district.trim() || district === "Select District") {
    errors.district = "District is required.";
  }
  if (!city || !city.trim()) {
    errors.city = "City/Town is required.";
  } else if (city.trim().length < 2) {
    errors.city = "City/Town must be at least 2 characters.";
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateProfileDetails(
  address: string,
  bio: string,
  photoURL: string
): {
  valid: boolean;
  errors: { address?: string; bio?: string; photoURL?: string };
} {
  const errors: { address?: string; bio?: string; photoURL?: string } = {};
  if (!address || !address.trim()) {
    errors.address = "Address/Area is required.";
  } else if (address.trim().length < 3) {
    errors.address = "Address/Area must be at least 3 characters.";
  }

  if (!bio || !bio.trim()) {
    errors.bio = "Bio/About You is required.";
  } else if (bio.trim().length < 5) {
    errors.bio = "Bio/About You must be at least 5 characters.";
  }

  if (!photoURL || !photoURL.trim()) {
    errors.photoURL = "Profile image is required.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ─── Gmail Address & Password Validation ───────────────────────────────────

export const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Strict Email Format and Domain Validation
export const validateRealEmailStructure = (email: string): { isValid: boolean; message: string } => {
  if (!email || typeof email !== "string") {
    return { isValid: false, message: "Please enter a valid email format." };
  }

  // Standard Regex for Email format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, message: "Please enter a valid email format." };
  }

  // Block temporary/fake disposable email domains (Optional security layer)
  const disposableDomains = ["tempmail.com", "throwawaymail.com", "10minutemail.com"];
  const domain = email.trim().toLowerCase().split("@")[1];
  if (disposableDomains.includes(domain)) {
    return { isValid: false, message: "Temporary or fake emails are not allowed." };
  }

  return { isValid: true, message: "Email format is valid." };
};

export interface GmailValidationResult {
  valid: boolean;
  cleanEmail: string;
  error?: string;
}

export function validateGmailAddress(email: string): GmailValidationResult {
  if (!email || !email.trim()) {
    return { valid: false, cleanEmail: "", error: "Please enter a valid, active email address." };
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!STRICT_EMAIL_REGEX.test(cleanEmail)) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  const parts = cleanEmail.split("@");
  if (parts.length !== 2) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  const [localPart, domainPart] = parts;

  if (domainPart !== "gmail.com") {
    return { valid: false, cleanEmail, error: "Only @gmail.com email addresses are allowed." };
  }

  const GMAIL_LOCAL_REGEX = /^[a-zA-Z0-9._]+$/;
  if (!GMAIL_LOCAL_REGEX.test(localPart)) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  if (localPart.length < 6 || localPart.length > 30) {
    return { valid: false, cleanEmail, error: "Please enter a valid Gmail address (6-30 characters)." };
  }

  const firstChar = localPart.charAt(0);
  const lastChar = localPart.charAt(localPart.length - 1);
  if (!/[a-z0-9]/.test(firstChar) || !/[a-z0-9]/.test(lastChar)) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  if (/[\._]{2,}/.test(localPart)) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  return { valid: true, cleanEmail };
}

export function validateNewGmail(
  newEmailInput: string,
  currentEmail?: string | null
): {
  valid: boolean;
  cleanEmail: string;
  error?: string;
  isCurrent?: boolean;
} {
  if (!newEmailInput || !newEmailInput.trim()) {
    return { valid: false, cleanEmail: "", error: "Please enter a valid, active email address." };
  }

  const cleanEmail = newEmailInput.trim().toLowerCase();

  // 1. Format check: Strict regex check
  if (!STRICT_EMAIL_REGEX.test(cleanEmail)) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  const parts = cleanEmail.split("@");
  if (parts.length !== 2) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  const [localPart, domainPart] = parts;

  // 2. Domain check
  if (domainPart !== "gmail.com") {
    return { valid: false, cleanEmail, error: "Only @gmail.com email addresses are allowed." };
  }

  // 3. Local part formatting checks
  const GMAIL_LOCAL_REGEX = /^[a-zA-Z0-9._]+$/;
  if (!GMAIL_LOCAL_REGEX.test(localPart)) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  if (localPart.length < 6 || localPart.length > 30) {
    return { valid: false, cleanEmail, error: "Please enter a valid Gmail address (6-30 characters)." };
  }

  const firstChar = localPart.charAt(0);
  const lastChar = localPart.charAt(localPart.length - 1);
  if (!/[a-z0-9]/.test(firstChar) || !/[a-z0-9]/.test(lastChar)) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  if (/[\._]{2,}/.test(localPart)) {
    return { valid: false, cleanEmail, error: "Please enter a valid, active email address." };
  }

  // 4. Same as current email check
  const currentClean = (currentEmail || "").trim().toLowerCase();
  if (currentClean && cleanEmail === currentClean) {
    return {
      valid: false,
      cleanEmail,
      isCurrent: true,
      error: "New email must be different from your current email.",
    };
  }

  return { valid: true, cleanEmail };
}

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  if (!password) {
    return { valid: false, error: "Password is required." };
  }

  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return {
      valid: false,
      error: "Password must contain uppercase, lowercase, number and special character."
    };
  }

  return { valid: true };
}

export function validateEmail(email: string): boolean {
  return validateGmailAddress(email).valid;
}

// ─── Platform Invite Link Validation ───────────────────────────────────────

export function validateInviteLink(url: string, platform: Platform): { valid: boolean; error?: string } {
  const cleanUrl = sanitizeString(url);
  if (!cleanUrl) {
    return { valid: false, error: "Invite link URL is required" };
  }

  try {
    const parsed = new URL(cleanUrl);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    switch (platform) {
      case "WhatsApp":
        if (
          (host.includes("whatsapp.com") && pathname.startsWith("/channel/")) ||
          (host === "chat.whatsapp.com" && pathname.length > 1) ||
          (host.includes("whatsapp.com") && pathname.startsWith("/chat/"))
        ) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid WhatsApp link format. Example: https://chat.whatsapp.com/Code or https://whatsapp.com/channel/Code" };

      case "Telegram":
        if ((host === "t.me" || host === "telegram.me" || host.includes("telegram.org")) && pathname.length > 1) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid Telegram link format. Example: https://t.me/yourchannel" };

      case "Discord":
        if ((host === "discord.gg" && pathname.length > 1) || (host.includes("discord.com") && pathname.startsWith("/invite/"))) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid Discord invite link format. Example: https://discord.gg/yourcode" };

      case "Facebook Groups":
        if (host.includes("facebook.com") && pathname.includes("/groups/")) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid Facebook Group link format. Example: https://facebook.com/groups/groupname" };

      case "Instagram Broadcast":
        if (host.includes("instagram.com") && (pathname.includes("/j/") || pathname.includes("/channel/"))) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid Instagram Broadcast link format. Example: https://instagram.com/j/code/" };

      case "X Communities":
        if ((host.includes("x.com") || host.includes("twitter.com")) && pathname.includes("/communities/")) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid X Community link format. Example: https://x.com/i/communities/123456" };

      case "LinkedIn Groups":
        if (host.includes("linkedin.com") && pathname.includes("/groups/")) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid LinkedIn Group link format. Example: https://linkedin.com/groups/123456" };

      case "YouTube Channels":
        if (
          host.includes("youtube.com") &&
          (pathname.startsWith("/@") || pathname.startsWith("/c/") || pathname.startsWith("/channel/") || pathname.startsWith("/user/"))
        ) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid YouTube Channel link format. Example: https://youtube.com/@channelname" };

      case "Reddit":
        if (host.includes("reddit.com") && pathname.includes("/r/")) {
          return { valid: true };
        }
        return { valid: false, error: "Invalid Reddit Community link format. Example: https://reddit.com/r/communityname" };

      default:
        return { valid: true };
    }
  } catch {
    return { valid: false, error: "Malformed URL. Make sure it starts with https://" };
  }
}

// ─── Rate Limiting & Anti-Spam Helper ────────────────────────────────────────

const RATE_LIMIT_STORAGE_KEY = "lc_rate_limit_timestamps";

export function checkRateLimit(
  actionKey: string,
  cooldownSeconds: number = 30
): { allowed: boolean; remainingSec: number } {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    const timestamps: Record<string, number> = raw ? JSON.parse(raw) : {};
    const lastTime = timestamps[actionKey] || 0;
    const now = Date.now();
    const elapsedSec = (now - lastTime) / 1000;

    if (elapsedSec < cooldownSeconds) {
      const remainingSec = Math.ceil(cooldownSeconds - elapsedSec);
      return { allowed: false, remainingSec };
    }

    timestamps[actionKey] = now;
    sessionStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(timestamps));
    return { allowed: true, remainingSec: 0 };
  } catch {
    return { allowed: true, remainingSec: 0 };
  }
}

// ─── Profile Completion Calculation ──────────────────────────────────────────

export function calculateProfileCompletion(profile: UserProfile | null): {
  percentage: number;
  missingFields: string[];
} {
  if (!profile) return { percentage: 0, missingFields: ["Full Profile Information"] };

  const fields: { name: string; weight: number; valid: boolean }[] = [
    { name: "Full Name", weight: 15, valid: Boolean(profile.displayName && profile.displayName.trim().length >= 3) },
    { name: "Date of Birth (18+)", weight: 10, valid: Boolean(profile.dob && calculateAge(profile.dob) >= 18) },
    { name: "Email Address", weight: 10, valid: Boolean(profile.email && profile.email.includes("@")) },
    { name: "Verified Email", weight: 10, valid: Boolean(profile.emailVerified) },
    { name: "Mobile Number", weight: 10, valid: Boolean(profile.phone && profile.phone.length >= 10) },
    { name: "Verified Mobile", weight: 10, valid: Boolean(profile.phoneVerified) },
    { name: "State", weight: 10, valid: Boolean(profile.state && profile.state.trim().length > 0) },
    { name: "District", weight: 10, valid: Boolean(profile.district && profile.district.trim().length > 0) },
    { name: "City", weight: 5, valid: Boolean(profile.city && profile.city.trim().length > 0) },
    { name: "Full Address", weight: 5, valid: Boolean(profile.address && profile.address.trim().length >= 10) },
    { name: "Profile Picture", weight: 5, valid: Boolean(profile.photoURL && profile.photoURL.trim().length > 0) },
  ];

  let percentage = 0;
  const missingFields: string[] = [];

  for (const item of fields) {
    if (item.valid) {
      percentage += item.weight;
    } else {
      missingFields.push(item.name);
    }
  }

  return { percentage: Math.min(100, percentage), missingFields };
}

// ─── Login Account Lockout Security (5 wrong attempts -> 15 min lock) ───────

const FAILED_LOGIN_PREFIX = "lc_failed_login_";

export function getFailedLoginAttempts(identifier: string): {
  count: number;
  lockedUntil: number;
  isLocked: boolean;
  remainingSec: number;
} {
  try {
    const key = `${FAILED_LOGIN_PREFIX}${identifier.toLowerCase().trim()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return { count: 0, lockedUntil: 0, isLocked: false, remainingSec: 0 };
    const data = JSON.parse(raw);
    const now = Date.now();
    if (data.lockedUntil && data.lockedUntil > now) {
      const remainingSec = Math.ceil((data.lockedUntil - now) / 1000);
      return { count: data.count || 5, lockedUntil: data.lockedUntil, isLocked: true, remainingSec };
    }
    if (data.lockedUntil && data.lockedUntil <= now) {
      localStorage.removeItem(key);
      return { count: 0, lockedUntil: 0, isLocked: false, remainingSec: 0 };
    }
    return { count: data.count || 0, lockedUntil: 0, isLocked: false, remainingSec: 0 };
  } catch {
    return { count: 0, lockedUntil: 0, isLocked: false, remainingSec: 0 };
  }
}

export function recordFailedLoginAttempt(identifier: string): {
  count: number;
  isLocked: boolean;
  remainingSec: number;
} {
  try {
    const key = `${FAILED_LOGIN_PREFIX}${identifier.toLowerCase().trim()}`;
    const current = getFailedLoginAttempts(identifier);
    const newCount = current.count + 1;
    const now = Date.now();

    if (newCount >= 5) {
      const lockedUntil = now + 15 * 60 * 1000; // 15 minutes
      localStorage.setItem(key, JSON.stringify({ count: newCount, lockedUntil }));
      return { count: newCount, isLocked: true, remainingSec: 15 * 60 };
    } else {
      localStorage.setItem(key, JSON.stringify({ count: newCount, lockedUntil: 0 }));
      return { count: newCount, isLocked: false, remainingSec: 0 };
    }
  } catch {
    return { count: 1, isLocked: false, remainingSec: 0 };
  }
}

export function clearFailedLoginAttempts(identifier: string): void {
  try {
    const key = `${FAILED_LOGIN_PREFIX}${identifier.toLowerCase().trim()}`;
    localStorage.removeItem(key);
  } catch {}
}

// ─── Cryptographic Identifier Hashing & Normalization ───────────────────────

export async function hashIdentifier(value: string): Promise<string> {
  const clean = (value || "").trim().toLowerCase();
  if (!clean) return "";
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(clean);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (err) {
    console.warn("SubtleCrypto digest unavailable, using fallback:", err);
  }

  // Fallback FNV-1a / polynomial 64-bit hex hash representation
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  const clean = (phone || "").replace(/[\s\-\(\)\+]/g, "");
  if (clean.startsWith("91") && clean.length === 12) {
    return clean.substring(2);
  }
  return clean;
}

