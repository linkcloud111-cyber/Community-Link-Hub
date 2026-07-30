import { Timestamp } from "firebase/firestore";

export type Platform =
  | "WhatsApp"
  | "Telegram"
  | "Discord"
  | "Facebook Groups"
  | "Instagram Broadcast"
  | "X Communities"
  | "LinkedIn Groups"
  | "YouTube Channels"
  | "Reddit";

export type GroupStatus = "pending" | "approved" | "rejected";

export type UserRole = "user" | "admin";

export type AccountStatus = "active" | "suspended" | "deleted";

export interface Group {
  id: string;
  name: string;
  platform: Platform;
  categoryId: string;
  categoryName: string;
  state: string;
  district: string;
  city: string;
  language: string;
  description: string;
  rules: string;
  tags: string[];
  joinUrl: string;
  logoUrl: string;
  submittedBy: string;
  submittedByName: string;
  submittedByEmail: string;
  status: GroupStatus;
  featured: boolean;
  trending: boolean;
  memberCount: number;
  joinCount: number;
  reportCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserProfile {
  uid: string;

  // Basic Information
  displayName: string;
  email: string;
  phone: string;
  dob: string;
  photoURL: string;

  // Location
  state?: string;
  district?: string;
  city?: string;
  address?: string;

  // Verification
  emailVerified: boolean;
  phoneVerified: boolean;

  // Role
  role: UserRole;

  // Account Status
  status: AccountStatus;

  // Statistics
  groupCount: number;

  // Optional
  bio?: string;

  // Account Deletion
  deletionRequested?: boolean;
  deletionRequestedAt?: Timestamp;

  // Dates
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  groupCount: number;
  createdAt: Timestamp;
}

export interface Report {
  id: string;
  groupId: string;
  groupName: string;
  reportedBy: string;
  reportedByName: string;
  reason: string;
  details: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: Timestamp;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "replied";
  createdAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "approval" | "rejection" | "report" | "system";
  groupId?: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface Favorite {
  id: string;
  userId: string;
  groupId: string;
  createdAt: Timestamp;
}

export interface SiteSettings {
  siteName: string;
  siteTagline: string;
  contactEmail: string;
  allowPublicSubmissions: boolean;
  maintenanceMode: boolean;
  updatedAt?: Timestamp;
}

export interface GroupFilters {
  platform?: Platform | "";
  categoryId?: string;
  state?: string;
  district?: string;
  city?: string;
  search?: string;
}
