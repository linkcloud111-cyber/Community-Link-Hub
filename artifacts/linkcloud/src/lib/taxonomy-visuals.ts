import React from "react";
import {
  Cpu,
  GraduationCap,
  Briefcase,
  Building2,
  Newspaper,
  Film,
  Gamepad2,
  Trophy,
  ShoppingBag,
  ShoppingCart,
  Compass,
  Heart,
  Utensils,
  Wallet,
  Home,
  Key,
  Tag,
  Landmark,
  Users,
  Sparkles,
  MessageSquare,
  Sprout,
  Car,
  Clapperboard,
  Music,
  BookOpen,
  Calendar,
  Folder,
  Languages,
  MessageCircle,
  Bell,
  HelpCircle,
  Building,
  Megaphone,
  MessageSquareCode,
  Wheat,
  Send,
  Share2,
  Radio,
  Camera,
  Linkedin as LucideLinkedin,
  Youtube as LucideYoutube,
  Globe,
  Hash,
  Laptop,
  Flame,
  CircleHelp,
  KeyRound,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

import {
  SiWhatsapp,
  SiTelegram,
  SiDiscord,
  SiFacebook,
  SiInstagram,
  SiX,
  SiYoutube,
  SiReddit,
  SiSnapchat,
  SiSignal,
} from "react-icons/si";

import { FaLinkedin, FaSlack, FaPinterest } from "react-icons/fa6";

// ─── DETERMINISTIC COLOR GENERATOR ──────────────────────────────────────────

export function getDeterministicColor(str?: string | null): string {
  if (!str) return "#3B82F6";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const s = 75;
  const l = 48;
  const lNorm = l / 100;
  const a = (s * Math.min(lNorm, 1 - lNorm)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ─── COMMON ICON SELECTOR LIST FOR ADMIN FORMS ─────────────────────────────

export const COMMON_ICON_OPTIONS = [
  { label: "Folder (Default)", value: "Folder" },
  { label: "Message Circle", value: "MessageCircle" },
  { label: "Messages Square", value: "MessagesSquare" },
  { label: "Message Square", value: "MessageSquare" },
  { label: "Languages / Globe", value: "Languages" },
  { label: "Globe", value: "Globe" },
  { label: "CPU / Tech", value: "Cpu" },
  { label: "Graduation Cap / Education", value: "GraduationCap" },
  { label: "Briefcase / Jobs", value: "Briefcase" },
  { label: "Building / Business", value: "Building2" },
  { label: "Newspaper / News", value: "Newspaper" },
  { label: "Film / Movies", value: "Film" },
  { label: "Gamepad / Gaming", value: "Gamepad2" },
  { label: "Trophy / Sports", value: "Trophy" },
  { label: "Shopping Bag", value: "ShoppingBag" },
  { label: "Shopping Cart", value: "ShoppingCart" },
  { label: "Compass / Travel", value: "Compass" },
  { label: "Heart / Health", value: "Heart" },
  { label: "Utensils / Food", value: "Utensils" },
  { label: "Wallet / Finance", value: "Wallet" },
  { label: "Home / Real Estate", value: "Home" },
  { label: "Key / Room Rent", value: "KeyRound" },
  { label: "Tag / Buy & Sell", value: "Tag" },
  { label: "Landmark / Govt", value: "Landmark" },
  { label: "Users / Community", value: "Users" },
  { label: "Sparkles / Special", value: "Sparkles" },
  { label: "Sprout / Agri", value: "Sprout" },
  { label: "Wheat", value: "Wheat" },
  { label: "Car / Automobile", value: "Car" },
  { label: "Clapperboard", value: "Clapperboard" },
  { label: "Music", value: "Music" },
  { label: "Book Open / Study", value: "BookOpen" },
  { label: "Calendar / Events", value: "Calendar" },
  { label: "Bell / Updates", value: "Bell" },
  { label: "Help Circle / Q&A", value: "CircleHelp" },
  { label: "Megaphone / Alerts", value: "Megaphone" },
  { label: "Camera / Photos", value: "Camera" },
  { label: "Flame / Trending", value: "Flame" },
  { label: "Share", value: "Share2" },
];

// ─── 1. ICON REGISTRY ─────────────────────────────────────────────────────────

export const ICON_REGISTRY: Record<string, React.ComponentType<{ className?: string }>> = {
  // Official Brand Icons (ALWAYS precedence for platforms)
  whatsapp: SiWhatsapp,
  telegram: SiTelegram,
  discord: SiDiscord,
  facebook: SiFacebook,
  facebookgroups: SiFacebook,
  instagram: SiInstagram,
  instagrambroadcast: SiInstagram,
  x: SiX,
  xcommunities: SiX,
  twitter: SiX, // Twitter MUST resolve to SiX (No Twitter bird!)
  linkedin: FaLinkedin,
  linkedingroups: FaLinkedin,
  youtube: SiYoutube,
  youtubechannels: SiYoutube,
  reddit: SiReddit,
  snapchat: SiSnapchat,
  snapchatgroups: SiSnapchat,
  signal: SiSignal,
  signalgroups: SiSignal,
  slack: FaSlack,
  pinterest: FaPinterest,

  // General Lucide Icons
  cpu: Cpu,
  laptop: Laptop,
  graduationcap: GraduationCap,
  briefcase: Briefcase,
  building2: Building2,
  building: Building,
  newspaper: Newspaper,
  film: Film,
  gamepad2: Gamepad2,
  gamepad: Gamepad2,
  trophy: Trophy,
  shoppingbag: ShoppingBag,
  compass: Compass,
  heart: Heart,
  utensils: Utensils,
  wallet: Wallet,
  home: Home,
  key: Key,
  keyround: KeyRound,
  tag: Tag,
  landmark: Landmark,
  users: Users,
  sparkles: Sparkles,
  messagesquare: MessageSquare,
  messagessquare: MessagesSquare,
  sprout: Sprout,
  wheat: Wheat,
  car: Car,
  clapperboard: Clapperboard,
  music: Music,
  bookopen: BookOpen,
  calendar: Calendar,
  folder: Folder,
  languages: Languages,
  messagecircle: MessageCircle,
  bell: Bell,
  helpcircle: HelpCircle,
  circlehelp: CircleHelp,
  megaphone: Megaphone,
  messagesquarecode: MessageSquareCode,
  send: Send,
  share2: Share2,
  radio: Radio,
  camera: Camera,
  globe: Globe,
  hash: Hash,
  flame: Flame,
};

// ─── 2. DEFAULT PLATFORM VISUAL CONFIGURATION ───────────────────────────────

export const DEFAULT_PLATFORM_VISUALS: Record<
  string,
  { name: string; iconName: string; color: string; IconComponent: React.ComponentType<{ className?: string }> }
> = {
  whatsapp: { name: "WhatsApp", iconName: "whatsapp", color: "#25D366", IconComponent: SiWhatsapp },
  telegram: { name: "Telegram", iconName: "telegram", color: "#229ED9", IconComponent: SiTelegram },
  discord: { name: "Discord", iconName: "discord", color: "#5865F2", IconComponent: SiDiscord },
  "facebook groups": { name: "Facebook Groups", iconName: "facebook", color: "#1877F2", IconComponent: SiFacebook },
  facebookgroups: { name: "Facebook Groups", iconName: "facebook", color: "#1877F2", IconComponent: SiFacebook },
  facebook: { name: "Facebook Groups", iconName: "facebook", color: "#1877F2", IconComponent: SiFacebook },
  fb: { name: "Facebook Groups", iconName: "facebook", color: "#1877F2", IconComponent: SiFacebook },
  "instagram broadcast": { name: "Instagram Broadcast", iconName: "instagram", color: "#E4405F", IconComponent: SiInstagram },
  instagrambroadcast: { name: "Instagram Broadcast", iconName: "instagram", color: "#E4405F", IconComponent: SiInstagram },
  instagram: { name: "Instagram Broadcast", iconName: "instagram", color: "#E4405F", IconComponent: SiInstagram },
  ig: { name: "Instagram Broadcast", iconName: "instagram", color: "#E4405F", IconComponent: SiInstagram },
  "x communities": { name: "X Communities", iconName: "x", color: "#000000", IconComponent: SiX },
  xcommunities: { name: "X Communities", iconName: "x", color: "#000000", IconComponent: SiX },
  x: { name: "X Communities", iconName: "x", color: "#000000", IconComponent: SiX },
  twitter: { name: "X Communities", iconName: "x", color: "#000000", IconComponent: SiX },
  "linkedin groups": { name: "LinkedIn Groups", iconName: "linkedin", color: "#0A66C2", IconComponent: FaLinkedin },
  linkedingroups: { name: "LinkedIn Groups", iconName: "linkedin", color: "#0A66C2", IconComponent: FaLinkedin },
  linkedin: { name: "LinkedIn Groups", iconName: "linkedin", color: "#0A66C2", IconComponent: FaLinkedin },
  "youtube channels": { name: "YouTube Channels", iconName: "youtube", color: "#FF0000", IconComponent: SiYoutube },
  youtubechannels: { name: "YouTube Channels", iconName: "youtube", color: "#FF0000", IconComponent: SiYoutube },
  youtube: { name: "YouTube Channels", iconName: "youtube", color: "#FF0000", IconComponent: SiYoutube },
  reddit: { name: "Reddit", iconName: "reddit", color: "#FF4500", IconComponent: SiReddit },
  subreddit: { name: "Reddit", iconName: "reddit", color: "#FF4500", IconComponent: SiReddit },
  snapchat: { name: "Snapchat Groups", iconName: "snapchat", color: "#FFFC00", IconComponent: SiSnapchat },
  snapchatgroups: { name: "Snapchat Groups", iconName: "snapchat", color: "#FFFC00", IconComponent: SiSnapchat },
  signal: { name: "Signal", iconName: "signal", color: "#3A76F0", IconComponent: SiSignal },
  signalgroups: { name: "Signal", iconName: "signal", color: "#3A76F0", IconComponent: SiSignal },
  slack: { name: "Slack", iconName: "slack", color: "#4A154B", IconComponent: FaSlack },
  pinterest: { name: "Pinterest", iconName: "pinterest", color: "#E60023", IconComponent: FaPinterest },
};

// ─── 3. DEFAULT CATEGORY VISUAL CONFIGURATION ───────────────────────────────

export const DEFAULT_CATEGORY_VISUALS: Record<
  string,
  { name: string; iconName: string; color: string; IconComponent: React.ComponentType<{ className?: string }> }
> = {
  technology: { name: "Technology", iconName: "Cpu", color: "#3B82F6", IconComponent: Cpu },
  tech: { name: "Technology", iconName: "Cpu", color: "#3B82F6", IconComponent: Cpu },
  education: { name: "Education", iconName: "GraduationCap", color: "#8B5CF6", IconComponent: GraduationCap },
  jobs: { name: "Jobs", iconName: "Briefcase", color: "#F59E0B", IconComponent: Briefcase },
  business: { name: "Business", iconName: "Building2", color: "#10B981", IconComponent: Building2 },
  news: { name: "News", iconName: "Newspaper", color: "#EF4444", IconComponent: Newspaper },
  entertainment: { name: "Entertainment", iconName: "Film", color: "#EC4899", IconComponent: Film },
  gaming: { name: "Gaming", iconName: "Gamepad2", color: "#6366F1", IconComponent: Gamepad2 },
  sports: { name: "Sports", iconName: "Trophy", color: "#22C55E", IconComponent: Trophy },
  shopping: { name: "Shopping", iconName: "ShoppingBag", color: "#F43F5E", IconComponent: ShoppingBag },
  travel: { name: "Travel", iconName: "Compass", color: "#14B8A6", IconComponent: Compass },
  health: { name: "Health", iconName: "Heart", color: "#10B981", IconComponent: Heart },
  food: { name: "Food", iconName: "Utensils", color: "#F97316", IconComponent: Utensils },
  finance: { name: "Finance", iconName: "Wallet", color: "#0EA5E9", IconComponent: Wallet },
  "real estate": { name: "Real Estate", iconName: "Home", color: "#8B5CF6", IconComponent: Home },
  "room rent": { name: "Room Rent", iconName: "Key", color: "#06B6D4", IconComponent: Key },
  "buy & sell": { name: "Buy & Sell", iconName: "ShoppingCart", color: "#F59E0B", IconComponent: ShoppingCart },
  government: { name: "Government", iconName: "Landmark", color: "#2563EB", IconComponent: Landmark },
  "local community": { name: "Local Community", iconName: "Users", color: "#14B8A6", IconComponent: Users },
  religious: { name: "Religious", iconName: "Sparkles", color: "#7C3AED", IconComponent: Sparkles },
  social: { name: "Social", iconName: "MessageSquare", color: "#EC4899", IconComponent: MessageSquare },
  agriculture: { name: "Agriculture", iconName: "Wheat", color: "#65A30D", IconComponent: Wheat },
  automobile: { name: "Automobile", iconName: "Car", color: "#475569", IconComponent: Car },
  movies: { name: "Movies", iconName: "Clapperboard", color: "#DC2626", IconComponent: Clapperboard },
  music: { name: "Music", iconName: "Music", color: "#A855F7", IconComponent: Music },
  books: { name: "Books", iconName: "BookOpen", color: "#0891B2", IconComponent: BookOpen },
  events: { name: "Events", iconName: "Calendar", color: "#EA580C", IconComponent: Calendar },
  other: { name: "Other", iconName: "CircleHelp", color: "#64748B", IconComponent: CircleHelp },
};

// ─── 4. DEFAULT CONTENT TYPE VISUAL CONFIGURATION ───────────────────────────

export const DEFAULT_CONTENT_TYPE_VISUALS: Record<
  string,
  { name: string; iconName: string; color: string; IconComponent: React.ComponentType<{ className?: string }> }
> = {
  "general discussion": { name: "General Discussion", iconName: "MessageCircle", color: "#3B82F6", IconComponent: MessageCircle },
  "news & updates": { name: "News & Updates", iconName: "Newspaper", color: "#EF4444", IconComponent: Newspaper },
  "help & support": { name: "Help & Support", iconName: "CircleHelp", color: "#10B981", IconComponent: CircleHelp },
  learning: { name: "Learning", iconName: "BookOpen", color: "#8B5CF6", IconComponent: BookOpen },
  jobs: { name: "Jobs", iconName: "Briefcase", color: "#F59E0B", IconComponent: Briefcase },
  business: { name: "Business", iconName: "Building2", color: "#10B981", IconComponent: Building2 },
  "buy & sell": { name: "Buy & Sell", iconName: "Tag", color: "#F59E0B", IconComponent: Tag },
  "room rent": { name: "Room Rent", iconName: "KeyRound", color: "#06B6D4", IconComponent: KeyRound },
  events: { name: "Events", iconName: "Calendar", color: "#EA580C", IconComponent: Calendar },
  announcements: { name: "Announcements", iconName: "Megaphone", color: "#EC4899", IconComponent: Megaphone },
  "q&a": { name: "Q&A", iconName: "CircleHelp", color: "#6366F1", IconComponent: CircleHelp },
  "community chat": { name: "Community Chat", iconName: "MessagesSquare", color: "#0EA5E9", IconComponent: MessagesSquare },
};

// ─── 5. DEFAULT LANGUAGE VISUAL CONFIGURATION ──────────────────────────────

export const DEFAULT_LANGUAGE_VISUALS: Record<
  string,
  { name: string; iconName: string; color: string; IconComponent: React.ComponentType<{ className?: string }> }
> = {
  hindi: { name: "Hindi", iconName: "Languages", color: "#F97316", IconComponent: Languages },
  hi: { name: "Hindi", iconName: "Languages", color: "#F97316", IconComponent: Languages },
  english: { name: "English", iconName: "Globe", color: "#0284C7", IconComponent: Globe },
  en: { name: "English", iconName: "Globe", color: "#0284C7", IconComponent: Globe },
  bengali: { name: "Bengali", iconName: "Languages", color: "#10B981", IconComponent: Languages },
  bn: { name: "Bengali", iconName: "Languages", color: "#10B981", IconComponent: Languages },
  telugu: { name: "Telugu", iconName: "Languages", color: "#8B5CF6", IconComponent: Languages },
  te: { name: "Telugu", iconName: "Languages", color: "#8B5CF6", IconComponent: Languages },
  marathi: { name: "Marathi", iconName: "Languages", color: "#EC4899", IconComponent: Languages },
  mr: { name: "Marathi", iconName: "Languages", color: "#EC4899", IconComponent: Languages },
  tamil: { name: "Tamil", iconName: "Languages", color: "#F59E0B", IconComponent: Languages },
  ta: { name: "Tamil", iconName: "Languages", color: "#F59E0B", IconComponent: Languages },
  gujarati: { name: "Gujarati", iconName: "Languages", color: "#06B6D4", IconComponent: Languages },
  gu: { name: "Gujarati", iconName: "Languages", color: "#06B6D4", IconComponent: Languages },
  kannada: { name: "Kannada", iconName: "Languages", color: "#6366F1", IconComponent: Languages },
  kn: { name: "Kannada", iconName: "Languages", color: "#6366F1", IconComponent: Languages },
  malayalam: { name: "Malayalam", iconName: "Languages", color: "#14B8A6", IconComponent: Languages },
  ml: { name: "Malayalam", iconName: "Languages", color: "#14B8A6", IconComponent: Languages },
  punjabi: { name: "Punjabi", iconName: "Languages", color: "#EF4444", IconComponent: Languages },
  pa: { name: "Punjabi", iconName: "Languages", color: "#EF4444", IconComponent: Languages },
  french: { name: "French", iconName: "Globe", color: "#2563EB", IconComponent: Globe },
  fr: { name: "French", iconName: "Globe", color: "#2563EB", IconComponent: Globe },
  german: { name: "German", iconName: "Globe", color: "#D97706", IconComponent: Globe },
  de: { name: "German", iconName: "Globe", color: "#D97706", IconComponent: Globe },
  spanish: { name: "Spanish", iconName: "Globe", color: "#DC2626", IconComponent: Globe },
  es: { name: "Spanish", iconName: "Globe", color: "#DC2626", IconComponent: Globe },
  urdu: { name: "Urdu", iconName: "Languages", color: "#15803D", IconComponent: Languages },
  ur: { name: "Urdu", iconName: "Languages", color: "#15803D", IconComponent: Languages },
  odia: { name: "Odia", iconName: "Languages", color: "#C026D3", IconComponent: Languages },
  or: { name: "Odia", iconName: "Languages", color: "#C026D3", IconComponent: Languages },
  assamese: { name: "Assamese", iconName: "Languages", color: "#0891B2", IconComponent: Languages },
  as: { name: "Assamese", iconName: "Languages", color: "#0891B2", IconComponent: Languages },
};

export const DEFAULT_LANGUAGE_COLOR = "#0EA5E9";
export const DEFAULT_LANGUAGE_ICON = "Languages";

// ─── 6. FALLBACK CONSTANTS ──────────────────────────────────────────────────

export const DEFAULT_FALLBACK_COLOR = "#64748B";
export const DEFAULT_FALLBACK_ICON = Folder;

// ─── 7. HELPER UTILITIES ─────────────────────────────────────────────────────

/**
 * Validates whether a hex string is valid (e.g. #3B82F6 or #FFF)
 */
export function isValidHexColor(color?: string | null): boolean {
  if (!color || typeof color !== "string") return false;
  const clean = color.trim();
  return /^#([A-Fa-f0-9]{3}){1,2}$/.test(clean);
}

/**
 * Normalizes hex color string or returns fallback.
 */
export function normalizeHexColor(color?: string | null, fallback = DEFAULT_FALLBACK_COLOR): string {
  if (isValidHexColor(color)) {
    let clean = color!.trim();
    if (clean.length === 4) {
      // expand #abc to #aabbcc
      clean = `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
    }
    return clean;
  }
  return fallback;
}

/**
 * Gets icon component by icon name or returns null
 */
export function getIconComponentByName(iconName?: string | null): React.ComponentType<{ className?: string }> | null {
  if (!iconName || typeof iconName !== "string") return null;
  const cleanKey = iconName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return ICON_REGISTRY[cleanKey] || null;
}

export interface TaxonomyVisualResult {
  color: string;
  bgColor: string;
  borderColor: string;
  iconName: string;
  IconComponent: React.ComponentType<{ className?: string }>;
  badgeStyle: React.CSSProperties;
  iconStyle: React.CSSProperties;
  containerStyle: React.CSSProperties;
}

/**
 * Generates reusable CSS styles for a given color.
 * Uses 12% - 15% opacity for background and 25% opacity for border.
 */
export function createTaxonomyStyles(hexColor: string): TaxonomyVisualResult["containerStyle"] & {
  badgeStyle: React.CSSProperties;
  iconStyle: React.CSSProperties;
  bgColor: string;
  borderColor: string;
} {
  const normColor = normalizeHexColor(hexColor, DEFAULT_FALLBACK_COLOR);
  const bgColor = `${normColor}1F`; // ~12% opacity
  const borderColor = `${normColor}3D`; // ~24% opacity

  return {
    bgColor,
    borderColor,
    badgeStyle: {
      color: normColor,
      backgroundColor: bgColor,
      borderColor: borderColor,
    },
    iconStyle: {
      color: normColor,
    },
    containerStyle: {
      color: normColor,
      backgroundColor: bgColor,
      borderColor: borderColor,
    },
  };
}

/**
 * Get Centralized Platform Visual Config
 */
export function getPlatformVisual(
  nameOrSlug?: string | null,
  customColor?: string | null,
  customIcon?: string | null
): TaxonomyVisualResult {
  const rawKey = (nameOrSlug || "").trim().toLowerCase();
  const cleanKey = rawKey.replace(/[^a-z0-9]/g, "");

  // 1. Look up built-in default platform match FIRST
  let matchedDefault =
    DEFAULT_PLATFORM_VISUALS[rawKey] ||
    DEFAULT_PLATFORM_VISUALS[cleanKey];

  if (!matchedDefault) {
    if (cleanKey.startsWith("whatsapp") || cleanKey === "wa") matchedDefault = DEFAULT_PLATFORM_VISUALS["whatsapp"];
    else if (cleanKey.startsWith("telegram") || cleanKey === "tg") matchedDefault = DEFAULT_PLATFORM_VISUALS["telegram"];
    else if (cleanKey.startsWith("discord")) matchedDefault = DEFAULT_PLATFORM_VISUALS["discord"];
    else if (cleanKey.startsWith("facebook") || cleanKey === "fb") matchedDefault = DEFAULT_PLATFORM_VISUALS["facebook groups"];
    else if (cleanKey.startsWith("instagram") || cleanKey === "ig") matchedDefault = DEFAULT_PLATFORM_VISUALS["instagram broadcast"];
    else if (cleanKey === "x" || cleanKey.startsWith("twitter")) matchedDefault = DEFAULT_PLATFORM_VISUALS["x communities"];
    else if (cleanKey.startsWith("linkedin")) matchedDefault = DEFAULT_PLATFORM_VISUALS["linkedin groups"];
    else if (cleanKey.startsWith("youtube") || cleanKey === "yt") matchedDefault = DEFAULT_PLATFORM_VISUALS["youtube channels"];
    else if (cleanKey.startsWith("reddit") || cleanKey.startsWith("subreddit")) matchedDefault = DEFAULT_PLATFORM_VISUALS["reddit"];
    else if (cleanKey.startsWith("snapchat") || cleanKey === "snap") matchedDefault = DEFAULT_PLATFORM_VISUALS["snapchat"];
    else if (cleanKey.startsWith("signal")) matchedDefault = DEFAULT_PLATFORM_VISUALS["signal"];
    else if (cleanKey.startsWith("slack")) matchedDefault = DEFAULT_PLATFORM_VISUALS["slack"];
  }

  let IconComp: React.ComponentType<{ className?: string }> | null = null;
  let iconName = "Share2";

  if (matchedDefault) {
    // For ALL built-in platforms: ALWAYS use the official brand SVG logo!
    IconComp = matchedDefault.IconComponent;
    iconName = matchedDefault.iconName;
  } else {
    // For custom platforms created by Webmaster, check customIcon, then nameOrSlug, then fallback
    IconComp = getIconComponentByName(customIcon) || getIconComponentByName(nameOrSlug) || Share2;
    iconName = customIcon || "Share2";
  }

  // Determine Color: known default brand color takes precedence unless valid non-generic hex color is specified
  let baseColor = matchedDefault?.color;
  if (
    isValidHexColor(customColor) &&
    customColor !== "#22c55e" &&
    customColor !== "#3b82f6" &&
    customColor !== "#000000" &&
    customColor !== "#1877f2"
  ) {
    baseColor = customColor!;
  }
  if (!baseColor) {
    baseColor = getDeterministicColor(nameOrSlug);
  }
  const finalColor = normalizeHexColor(baseColor, matchedDefault?.color || getDeterministicColor(nameOrSlug));

  const styles = createTaxonomyStyles(finalColor);

  return {
    color: finalColor,
    bgColor: styles.bgColor,
    borderColor: styles.borderColor,
    iconName,
    IconComponent: IconComp,
    badgeStyle: styles.badgeStyle,
    iconStyle: styles.iconStyle,
    containerStyle: styles.containerStyle,
  };
}

/**
 * Get Centralized Category Visual Config
 */
export function getCategoryVisual(
  nameOrSlug?: string | null,
  customColor?: string | null,
  customIcon?: string | null
): TaxonomyVisualResult {
  const cleanKey = (nameOrSlug || "").trim().toLowerCase();
  const matchedDefault = DEFAULT_CATEGORY_VISUALS[cleanKey];

  // Determine Icon
  let IconComp = getIconComponentByName(customIcon);
  if (!IconComp && matchedDefault) {
    IconComp = matchedDefault.IconComponent;
  }
  if (!IconComp) {
    IconComp = getIconComponentByName(nameOrSlug) || Folder;
  }

  // Determine Color: Firestore custom color wins > Default matched color > Deterministic Color
  let baseColor = isValidHexColor(customColor) ? customColor! : matchedDefault?.color;
  if (!baseColor) {
    baseColor = getDeterministicColor(cleanKey);
  }
  const finalColor = normalizeHexColor(baseColor, getDeterministicColor(cleanKey));

  const styles = createTaxonomyStyles(finalColor);

  return {
    color: finalColor,
    bgColor: styles.bgColor,
    borderColor: styles.borderColor,
    iconName: customIcon || matchedDefault?.iconName || "Folder",
    IconComponent: IconComp,
    badgeStyle: styles.badgeStyle,
    iconStyle: styles.iconStyle,
    containerStyle: styles.containerStyle,
  };
}

/**
 * Get Centralized Content Type Visual Config
 */
export function getContentTypeVisual(
  nameOrSlug?: string | null,
  customColor?: string | null,
  customIcon?: string | null
): TaxonomyVisualResult {
  const cleanKey = (nameOrSlug || "").trim().toLowerCase();
  const matchedDefault = DEFAULT_CONTENT_TYPE_VISUALS[cleanKey];

  let IconComp = getIconComponentByName(customIcon);
  if (!IconComp && matchedDefault) {
    IconComp = matchedDefault.IconComponent;
  }
  if (!IconComp) {
    IconComp = getIconComponentByName(nameOrSlug) || MessageCircle;
  }

  let baseColor = isValidHexColor(customColor) ? customColor! : matchedDefault?.color;
  if (!baseColor) {
    baseColor = getDeterministicColor(cleanKey);
  }
  const finalColor = normalizeHexColor(baseColor, getDeterministicColor(cleanKey));

  const styles = createTaxonomyStyles(finalColor);

  return {
    color: finalColor,
    bgColor: styles.bgColor,
    borderColor: styles.borderColor,
    iconName: customIcon || matchedDefault?.iconName || "MessageCircle",
    IconComponent: IconComp,
    badgeStyle: styles.badgeStyle,
    iconStyle: styles.iconStyle,
    containerStyle: styles.containerStyle,
  };
}

/**
 * Get Centralized Language Visual Config
 */
export function getLanguageVisual(
  nameOrSlug?: string | null,
  customColor?: string | null,
  customIcon?: string | null
): TaxonomyVisualResult {
  const cleanKey = (nameOrSlug || "").trim().toLowerCase();
  const matchedDefault = DEFAULT_LANGUAGE_VISUALS[cleanKey];

  let IconComp = getIconComponentByName(customIcon);
  if (!IconComp && matchedDefault) {
    IconComp = matchedDefault.IconComponent;
  }
  if (!IconComp) {
    IconComp = getIconComponentByName(nameOrSlug) || Languages;
  }

  let baseColor = isValidHexColor(customColor) ? customColor! : matchedDefault?.color;
  if (!baseColor) {
    baseColor = getDeterministicColor(cleanKey);
  }
  const finalColor = normalizeHexColor(baseColor, getDeterministicColor(cleanKey));

  const styles = createTaxonomyStyles(finalColor);

  return {
    color: finalColor,
    bgColor: styles.bgColor,
    borderColor: styles.borderColor,
    iconName: customIcon || matchedDefault?.iconName || DEFAULT_LANGUAGE_ICON,
    IconComponent: IconComp,
    badgeStyle: styles.badgeStyle,
    iconStyle: styles.iconStyle,
    containerStyle: styles.containerStyle,
  };
}

/**
 * Unified Taxonomy Visual Resolver
 */
export function getTaxonomyVisual(
  type: "category" | "platform" | "contentType" | "language",
  nameOrSlug?: string | null,
  customColor?: string | null,
  customIcon?: string | null
): TaxonomyVisualResult {
  switch (type) {
    case "platform":
      return getPlatformVisual(nameOrSlug, customColor, customIcon);
    case "category":
      return getCategoryVisual(nameOrSlug, customColor, customIcon);
    case "contentType":
      return getContentTypeVisual(nameOrSlug, customColor, customIcon);
    case "language":
      return getLanguageVisual(nameOrSlug, customColor, customIcon);
    default:
      return getCategoryVisual(nameOrSlug, customColor, customIcon);
  }
}

