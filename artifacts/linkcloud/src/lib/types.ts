import { Timestamp } from "firebase/firestore";

export type Platform = string;

export interface Category {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  color?: string;
  themeColor?: string;
  status?: "active" | "disabled";
  enabled?: boolean;
  displayOrder?: number;
  groupCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export interface PlatformItem {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  color?: string;
  themeColor?: string;
  badgeColor?: string;
  iconUrl?: string;
  status: "active" | "disabled";
  enabled?: boolean;
  displayOrder?: number;
  order?: number;
  invitePattern?: string;
  helpText?: string;
  errorText?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export interface ContentTypeItem {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  color?: string;
  themeColor?: string;
  categoryId?: string;
  status: "active" | "disabled";
  enabled?: boolean;
  displayOrder?: number;
  order?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export interface LanguageItem {
  id: string;
  name: string;
  slug?: string;
  code?: string;
  icon?: string;
  color?: string;
  themeColor?: string;
  status: "active" | "disabled";
  enabled?: boolean;
  displayOrder?: number;
  order?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export type GroupStatus = "pending" | "approved" | "rejected";

export type PersistedUserRole = "user" | "webmaster";
export type UserRole = "visitor" | "user" | "webmaster";

export type AccountStatus = "active" | "suspended" | "banned" | "deleted" | "pending_verification";

export type DeletionStatus = "none" | "pending" | "rejected" | "approved" | "completed";

export interface AccountUidRecord {
  accountUid: string;
  firebaseUid: string;
  status: "active" | "deleted";
  createdAt?: Timestamp;
  deletedAt?: Timestamp;
}

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
  contentType?: string;
  linkStatus?: "active" | "inactive";
  minimumAge?: number | string;
  description: string;
  rules: string;
  tags: string[];
  joinUrl: string;
  logoUrl: string;
  submittedBy: string;
  submitterUid?: string;
  submittedByName: string;
  submittedByEmail: string;
  status: GroupStatus;
  featured: boolean;
  pinned?: boolean;
  hidden?: boolean;
  trending: boolean;
  memberCount: number;
  joinCount: number;
  viewsCount?: number;
  reportCount: number;
  rejectionReason?: string;
  changesRequested?: boolean;
  changesRequestedMessage?: string;
  allowResubmit?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserProfile {
  uid: string;
  id?: string;
  firestoreDocumentId?: string;
  accountUid?: string;

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

  // Persisted authorization roles are ONLY 'user' | 'webmaster'
  role: PersistedUserRole;

  // Account Status
  status: AccountStatus;
  active?: boolean;
  suspended?: boolean;
  banned?: boolean;
  suspendedAt?: Timestamp;
  suspendedBy?: string;
  suspendedByEmail?: string;
  bannedAt?: Timestamp;
  bannedBy?: string;
  bannedByEmail?: string;
  activatedAt?: Timestamp;
  activatedBy?: string;
  activatedByEmail?: string;

  // Statistics
  groupCount: number;

  // Optional
  bio?: string;
  pendingEmail?: string | null;
  activeEmailChangeRequestId?: string | null;

  // Account Deletion
  deletionRequested?: boolean;
  deletionRequestId?: string;
  deletionStatus?: DeletionStatus;
  deletionRequestedAt?: Timestamp;
  deletionReason?: string;
  deletionRejectedAt?: Timestamp;
  deletionRejectionReason?: string;
  deletionCooldownUntil?: Timestamp;

  // Dates
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LocationState {
  id: string;
  name: string;
  slug: string;
  country?: string;
  enabled: boolean;
  status?: "active" | "disabled";
  displayOrder?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export interface LocationDistrict {
  id: string;
  stateId?: string;
  stateName: string;
  name: string;
  slug: string;
  country?: string;
  enabled: boolean;
  status?: "active" | "disabled";
  displayOrder?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export interface LocationCity {
  id: string;
  stateId?: string;
  stateName: string;
  districtId?: string;
  districtName?: string;
  name: string;
  slug: string;
  country?: string;
  enabled: boolean;
  status?: "active" | "disabled";
  displayOrder?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export interface DeletionRequest {
  id: string;
  uid: string;
  accountUid?: string;
  displayName: string;
  email: string;
  phone?: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  createdAt: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
  approvedByEmail?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectedByEmail?: string;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  reviewedByEmail?: string;
  rejectionReason?: string;
  cooldownUntil?: Timestamp;
  completedAt?: Timestamp;
  updatedAt?: Timestamp;
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
  phone?: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "replied";
  createdAt: Timestamp;
}

export interface Complaint {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "pending" | "reviewed" | "resolved";
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

export interface FilterSettings {
  categoryFilterEnabled: boolean;
  platformFilterEnabled: boolean;
  contentTypeFilterEnabled: boolean;
  languageFilterEnabled: boolean;
  stateFilterEnabled: boolean;
  districtFilterEnabled: boolean;
  cityFilterEnabled: boolean;
  linkStatusFilterEnabled: boolean;
  featuredFilterEnabled: boolean;
  popularFilterEnabled: boolean;
  newestFilterEnabled: boolean;
  verifiedFilterEnabled: boolean;
  approvalStatusFilterEnabled: boolean;
}

export interface SiteSettings {
  // Website Settings
  siteName: string;
  siteTagline: string;
  siteLogo?: string;
  favicon?: string;
  homepageBanner?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroButtonText: string;
  heroButtonLink: string;
  footerLogo?: string;
  footerDescription: string;
  copyrightText: string;
  websiteTheme: "light" | "dark" | "system";
  maintenanceMode: boolean;

  // Filter Management Toggles
  filterSettings?: FilterSettings;

  // Contact Info
  contactEmail: string;
  supportEmail?: string;
  supportMobile?: string;
  businessAddress?: string;
  officeHours?: string;
  googleMapUrl?: string;

  // Social Links
  facebookUrl?: string;
  instagramUrl?: string;
  telegramUrl?: string;
  whatsappUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  redditUrl?: string;
  githubUrl?: string;

  // Homepage Management
  heroSectionEnabled: boolean;
  featuredGroupsEnabled: boolean;
  latestGroupsEnabled: boolean;
  popularGroupsEnabled: boolean;
  popularCategoriesEnabled: boolean;
  popularPlatformsEnabled: boolean;
  statisticsSectionEnabled: boolean;
  testimonialsEnabled: boolean;
  faqSectionEnabled: boolean;
  newsletterSectionEnabled: boolean;
  footerEnabled: boolean;
  sectionOrder?: string[];

  // About Page
  aboutTitle?: string;
  aboutDescription?: string;
  aboutMission?: string;
  aboutVision?: string;
  aboutUsContent?: string;
  aboutFeatures?: { title: string; desc: string; icon?: string }[];

  // Legal Pages
  privacyPolicyContent: string;
  termsContent: string;
  dmcaContent: string;
  disclaimerContent?: string;

  // SEO Management
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCardImage?: string;
  twitterCardTitle?: string;
  twitterCardDescription?: string;
  robotsTxtContent?: string;
  sitemapXmlContent?: string;
  structuredDataJson?: string;

  // System Settings / Toggles
  allowPublicSubmissions: boolean;
  groupSubmissionEnabled?: boolean;
  userRegistrationEnabled: boolean;
  googleLoginEnabled: boolean;
  emailLoginEnabled: boolean;
  mobileOtpLoginEnabled: boolean;
  favoritesEnabled: boolean;
  reportSystemEnabled: boolean;
  complaintSystemEnabled: boolean;
  contactFormEnabled: boolean;
  notificationsEnabled: boolean;

  // Cloudinary
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;

  updatedAt?: Timestamp;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  enabled: boolean;
  sortOrder: number;
  createdAt?: Timestamp;
}

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  content: string;
  views: number;
  icon?: string;
  createdAt?: Timestamp;
}

export interface AuditLog {
  id: string;
  action:
    | "User Deleted"
    | "Group Approved"
    | "Group Rejected"
    | "Settings Changed"
    | "Category Updated"
    | "Platform Updated"
    | "Location Updated"
    | "Broadcast Sent"
    | "Maintenance Toggled"
    | string;
  details: string;
  adminEmail: string;
  adminUid: string;
  createdAt: Timestamp;
}

export interface SearchAnalytics {
  id: string;
  keyword: string;
  category?: string;
  platform?: string;
  language?: string;
  location?: string;
  count: number;
  updatedAt?: Timestamp;
}

export interface GroupFilters {
  platform?: Platform | "";
  categoryId?: string;
  contentType?: string;
  language?: string;
  state?: string;
  district?: string;
  city?: string;
  linkStatus?: string;
  featured?: boolean;
  search?: string;
  sortBy?: "latest" | "popular" | "most_viewed" | "most_joined" | "featured" | "newest" | "oldest" | "a-z" | "z-a";
}

export interface EmailChangeRecord {
  id?: string;
  uid: string;
  oldEmail: string;
  newEmail: string;
  changedOn: any;
  verificationTime?: any;
  ip?: string;
  device?: string;
  status: "pending" | "verified" | "cancelled";
}

export interface EmailChangeRequest {
  requestId: string;
  userId: string;
  oldEmail: string;
  newEmail: string;
  status: "pending" | "verified" | "completed" | "expired" | "cancelled" | "superseded";
  createdAt: number;
  expiresAt: number;
  version: number;
  updatedAt?: number;
}
