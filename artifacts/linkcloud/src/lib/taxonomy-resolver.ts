import { slugify } from "./firestore";
import {
  getDeterministicColor,
} from "./taxonomy-visuals";

export interface ResolvedTaxonomyResult {
  name: string;
  slug: string;
  icon: string;
  color: string;
  brandName?: string;
  // Platform specific
  invitePattern?: string;
  helpText?: string;
  // Language specific
  code?: string;
  isoCode?: string;
  // Metadata & Resolution info
  statusSteps: {
    identity: boolean;
    icon: boolean;
    theme: boolean;
    slug: boolean;
    metadata: boolean;
  };
  resolvedAt: number;
  confidence: "high" | "medium" | "low";
}

// ─── IN-MEMORY ICONIFY API CACHE ──────────────────────────────────────────────
const iconifyCache = new Map<string, string>();

async function searchOnlineIcon(query: string): Promise<string | null> {
  const clean = query.trim().toLowerCase();
  if (!clean) return null;
  if (iconifyCache.has(clean)) return iconifyCache.get(clean)!;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(
      `https://api.iconify.design/search?query=${encodeURIComponent(clean)}&limit=5`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.icons) && data.icons.length > 0) {
      const found = data.icons[0];
      iconifyCache.set(clean, found);
      return found;
    }
  } catch {
    // Graceful fallback on network/timeout
  }
  return null;
}

// ─── KNOWN PLATFORMS DICTIONARY ───────────────────────────────────────────────
export interface PlatformRule {
  brandName: string;
  aliases: string[];
  icon: string;
  color: string;
  invitePattern: string;
  helpText: string;
}

export const KNOWN_PLATFORM_RULES: PlatformRule[] = [
  {
    brandName: "Signal",
    aliases: ["signal", "signal groups", "signal group", "signal app"],
    icon: "signal",
    color: "#3A76F0",
    invitePattern: "^https?:\\/\\/(signal\\.group|signal\\.me)\\/.+",
    helpText: "Enter a valid Signal group invite link.",
  },
  {
    brandName: "Snapchat",
    aliases: ["snapchat", "snapchat groups", "snapchat group", "snap", "snap chat"],
    icon: "snapchat",
    color: "#FFFC00",
    invitePattern: "^https?:\\/\\/(www\\.)?(snapchat\\.com|add\\.snapchat\\.com)\\/.+",
    helpText: "Enter a valid Snapchat group or profile invite link.",
  },
  {
    brandName: "WhatsApp",
    aliases: ["whatsapp", "whatsapp groups", "whatsapp group", "whatsapp community", "wa"],
    icon: "whatsapp",
    color: "#25D366",
    invitePattern: "^https?:\\/\\/(chat\\.whatsapp\\.com|wa\\.me|whatsapp\\.com\\/channel)\\/.+",
    helpText: "Enter a valid WhatsApp group or channel invite link.",
  },
  {
    brandName: "Telegram",
    aliases: ["telegram", "telegram groups", "telegram group", "telegram channel", "tg"],
    icon: "telegram",
    color: "#229ED9",
    invitePattern: "^https?:\\/\\/(t\\.me|telegram\\.me)\\/.+",
    helpText: "Enter a valid Telegram group or channel invite link.",
  },
  {
    brandName: "Discord",
    aliases: ["discord", "discord server", "discord channel"],
    icon: "discord",
    color: "#5865F2",
    invitePattern: "^https?:\\/\\/(discord\\.(gg|com\\/invite))\\/.+",
    helpText: "Enter a valid Discord server invite link.",
  },
  {
    brandName: "Facebook",
    aliases: ["facebook", "facebook groups", "facebook group", "fb", "fb group"],
    icon: "facebook",
    color: "#1877F2",
    invitePattern: "^https?:\\/\\/(www\\.)?(facebook\\.com|fb\\.com)\\/(groups|community)\\/.+",
    helpText: "Enter a valid Facebook group link.",
  },
  {
    brandName: "Instagram",
    aliases: ["instagram", "instagram broadcast", "instagram channels", "ig", "ig broadcast"],
    icon: "instagram",
    color: "#E4405F",
    invitePattern: "^https?:\\/\\/(www\\.)?(instagram\\.com|ig\\.me)\\/.+",
    helpText: "Enter a valid Instagram broadcast channel or profile link.",
  },
  {
    brandName: "X",
    aliases: ["x", "x communities", "x community", "twitter", "twitter community", "twitter list"],
    icon: "x",
    color: "#000000",
    invitePattern: "^https?:\\/\\/(www\\.)?(x\\.com|twitter\\.com)\\/i\\/communities\\/.+",
    helpText: "Enter a valid X (Twitter) community link.",
  },
  {
    brandName: "LinkedIn",
    aliases: ["linkedin", "linkedin groups", "linkedin group"],
    icon: "linkedin",
    color: "#0A66C2",
    invitePattern: "^https?:\\/\\/(www\\.)?linkedin\\.com\\/groups\\/.+",
    helpText: "Enter a valid LinkedIn group link.",
  },
  {
    brandName: "YouTube",
    aliases: ["youtube", "youtube channels", "youtube channel", "yt"],
    icon: "youtube",
    color: "#FF0000",
    invitePattern: "^https?:\\/\\/(www\\.)?(youtube\\.com|youtu\\.be)\\/.+",
    helpText: "Enter a valid YouTube channel or community link.",
  },
  {
    brandName: "Reddit",
    aliases: ["reddit", "subreddit", "reddit community", "r/"],
    icon: "reddit",
    color: "#FF4500",
    invitePattern: "^https?:\\/\\/(www\\.)?reddit\\.com\\/r\\/.+",
    helpText: "Enter a valid Subreddit or Reddit community link.",
  },
  {
    brandName: "Slack",
    aliases: ["slack", "slack workspace", "slack channel"],
    icon: "slack",
    color: "#4A154B",
    invitePattern: "^https?:\\/\\/(join\\.slack\\.com|app\\.slack\\.com)\\/.+",
    helpText: "Enter a valid Slack workspace invite link.",
  },
  {
    brandName: "Pinterest",
    aliases: ["pinterest", "pinterest board", "pinterest boards"],
    icon: "pinterest",
    color: "#E60023",
    invitePattern: "^https?:\\/\\/(www\\.)?pinterest\\.com\\/.+",
    helpText: "Enter a valid Pinterest board link.",
  },
];

/**
 * Strict platform finder eliminating false partial matches.
 */
export function findPlatformMatch(normalizedInput: string): PlatformRule | null {
  const normalized = normalizedInput.trim().toLowerCase();
  if (!normalized) return null;

  const words = normalized.split(/[\s\-_]+/);

  // Priority 1: Exact Brand Name match
  for (const rule of KNOWN_PLATFORM_RULES) {
    if (rule.brandName.toLowerCase() === normalized) {
      return rule;
    }
  }

  // Priority 2: Exact Alias match
  for (const rule of KNOWN_PLATFORM_RULES) {
    if (rule.aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return rule;
    }
  }

  // Priority 3: Word Token or Strict Prefix Match (NO substring inside unrelated words!)
  for (const rule of KNOWN_PLATFORM_RULES) {
    for (const alias of rule.aliases) {
      const lowerAlias = alias.toLowerCase();
      // Short 2-letter aliases (ig, wa, tg, fb, yt, x): REQUIRE exact token match
      if (lowerAlias.length <= 2) {
        if (words.includes(lowerAlias)) return rule;
      } else {
        if (words.includes(lowerAlias) || normalized.startsWith(lowerAlias)) {
          return rule;
        }
      }
    }
  }

  return null;
}

// ─── LANGUAGE DATASET ─────────────────────────────────────────────────────────
export interface LanguageEntry {
  name: string;
  code: string;
  iso: string;
  icon: string;
  color: string;
  aliases: string[];
}

export const LANGUAGE_DATASET: LanguageEntry[] = [
  { name: "Hindi", code: "hi", iso: "hi", icon: "Languages", color: "#F97316", aliases: ["hindi", "hi"] },
  { name: "English", code: "en", iso: "en", icon: "Globe", color: "#0284C7", aliases: ["english", "en"] },
  { name: "French", code: "fr", iso: "fr", icon: "Globe", color: "#2563EB", aliases: ["french", "francais", "fr"] },
  { name: "Spanish", code: "es", iso: "es", icon: "Globe", color: "#DC2626", aliases: ["spanish", "espanol", "es"] },
  { name: "German", code: "de", iso: "de", icon: "Globe", color: "#D97706", aliases: ["german", "deutsch", "de"] },
  { name: "Bengali", code: "bn", iso: "bn", icon: "Languages", color: "#10B981", aliases: ["bengali", "bangla", "bn"] },
  { name: "Telugu", code: "te", iso: "te", icon: "Languages", color: "#8B5CF6", aliases: ["telugu", "te"] },
  { name: "Marathi", code: "mr", iso: "mr", icon: "Languages", color: "#EC4899", aliases: ["marathi", "mr"] },
  { name: "Tamil", code: "ta", iso: "ta", icon: "Languages", color: "#F59E0B", aliases: ["tamil", "ta"] },
  { name: "Gujarati", code: "gu", iso: "gu", icon: "Languages", color: "#06B6D4", aliases: ["gujarati", "gu"] },
  { name: "Kannada", code: "kn", iso: "kn", icon: "Languages", color: "#6366F1", aliases: ["kannada", "kn"] },
  { name: "Malayalam", code: "ml", iso: "ml", icon: "Languages", color: "#14B8A6", aliases: ["malayalam", "ml"] },
  { name: "Punjabi", code: "pa", iso: "pa", icon: "Languages", color: "#EF4444", aliases: ["punjabi", "pa"] },
  { name: "Urdu", code: "ur", iso: "ur", icon: "Languages", color: "#15803D", aliases: ["urdu", "ur"] },
  { name: "Odia", code: "or", iso: "or", icon: "Languages", color: "#C026D3", aliases: ["odia", "oriyya", "or"] },
  { name: "Assamese", code: "as", iso: "as", icon: "Languages", color: "#0891B2", aliases: ["assamese", "as"] },
  { name: "Italian", code: "it", iso: "it", icon: "Globe", color: "#059669", aliases: ["italian", "italiano", "it"] },
  { name: "Portuguese", code: "pt", iso: "pt", icon: "Globe", color: "#16A34A", aliases: ["portuguese", "portugues", "pt"] },
  { name: "Russian", code: "ru", iso: "ru", icon: "Globe", color: "#E11D48", aliases: ["russian", "ru"] },
  { name: "Japanese", code: "ja", iso: "ja", icon: "Globe", color: "#BE123C", aliases: ["japanese", "ja", "jp"] },
  { name: "Chinese", code: "zh", iso: "zh", icon: "Globe", color: "#E11D48", aliases: ["chinese", "mandarin", "zh", "cn"] },
  { name: "Korean", code: "ko", iso: "ko", icon: "Globe", color: "#4F46E5", aliases: ["korean", "ko", "kr"] },
  { name: "Arabic", code: "ar", iso: "ar", icon: "Globe", color: "#047857", aliases: ["arabic", "ar"] },
  { name: "Dutch", code: "nl", iso: "nl", icon: "Globe", color: "#EA580C", aliases: ["dutch", "nl"] },
  { name: "Polish", code: "pl", iso: "pl", icon: "Globe", color: "#E11D48", aliases: ["polish", "pl"] },
  { name: "Turkish", code: "tr", iso: "tr", icon: "Globe", color: "#DC2626", aliases: ["turkish", "tr"] },
  { name: "Swedish", code: "sv", iso: "sv", icon: "Globe", color: "#0284C7", aliases: ["swedish", "sv"] },
  { name: "Vietnamese", code: "vi", iso: "vi", icon: "Globe", color: "#E11D48", aliases: ["vietnamese", "vi"] },
  { name: "Indonesian", code: "id", iso: "id", icon: "Globe", color: "#DC2626", aliases: ["indonesian", "id"] },
  { name: "Thai", code: "th", iso: "th", icon: "Globe", color: "#9333EA", aliases: ["thai", "th"] },
];

// ─── SEMANTIC CATEGORY & CONTENT TYPE DICTIONARY ─────────────────────────────
const SEMANTIC_KEYWORDS: { keywords: string[]; icon: string; color: string }[] = [
  { keywords: ["photo", "photography", "camera", "image", "picture", "gallery"], icon: "Camera", color: "#EC4899" },
  { keywords: ["webinar", "webinars", "masterclass", "lecture", "workshop", "presentation", "seminar"], icon: "GraduationCap", color: "#8B5CF6" },
  { keywords: ["room", "rent", "room rent", "flatmate", "apartment", "housing", "pg", "accommodation"], icon: "KeyRound", color: "#06B6D4" },
  { keywords: ["job", "jobs", "hiring", "career", "employment", "recruitment", "freelance"], icon: "Briefcase", color: "#F59E0B" },
  { keywords: ["tech", "technology", "ai", "coding", "software", "developer", "computer", "machine learning"], icon: "Cpu", color: "#3B82F6" },
  { keywords: ["edu", "education", "study", "learning", "course", "school", "college", "student"], icon: "GraduationCap", color: "#8B5CF6" },
  { keywords: ["business", "startup", "investor", "finance", "money", "company"], icon: "Building2", color: "#10B981" },
  { keywords: ["news", "update", "journalism", "media", "bulletin", "headline"], icon: "Newspaper", color: "#EF4444" },
  { keywords: ["movie", "movies", "cinema", "film", "entertainment", "actor", "hollywood", "bollywood"], icon: "Clapperboard", color: "#DC2626" },
  { keywords: ["game", "gaming", "esports", "gamer", "playstation", "xbox"], icon: "Gamepad2", color: "#6366F1" },
  { keywords: ["sport", "sports", "cricket", "football", "fitness", "gym"], icon: "Trophy", color: "#22C55E" },
  { keywords: ["shop", "shopping", "deal", "deals", "discount", "offer", "store", "buy", "sell"], icon: "ShoppingBag", color: "#F43F5E" },
  { keywords: ["travel", "tour", "tourism", "vacation", "trip", "flight"], icon: "Compass", color: "#14B8A6" },
  { keywords: ["health", "medical", "doctor", "wellness", "fitness", "hospital"], icon: "Heart", color: "#10B981" },
  { keywords: ["food", "recipe", "cooking", "restaurant", "dining"], icon: "Utensils", color: "#F97316" },
  { keywords: ["event", "events", "meetup", "conference", "party"], icon: "Calendar", color: "#EA580C" },
  { keywords: ["q&a", "qa", "question", "ask", "faq", "help"], icon: "CircleHelp", color: "#6366F1" },
  { keywords: ["chat", "community chat", "group chat", "discussion"], icon: "MessagesSquare", color: "#0EA5E9" },
  { keywords: ["music", "song", "audio", "album", "band", "artist"], icon: "Music", color: "#A855F7" },
  { keywords: ["book", "books", "reading", "author", "novel"], icon: "BookOpen", color: "#0891B2" },
  { keywords: ["car", "cars", "auto", "vehicle", "automobile", "bike"], icon: "Car", color: "#475569" },
  { keywords: ["agri", "agriculture", "farmer", "farming", "crop"], icon: "Wheat", color: "#65A30D" },
];

// ─── DEDICATED RESOLVERS ─────────────────────────────────────────────────────

export async function resolvePlatform(inputName: string): Promise<ResolvedTaxonomyResult> {
  return resolveTaxonomyInput("platform", inputName);
}

export async function resolveCategory(inputName: string): Promise<ResolvedTaxonomyResult> {
  return resolveTaxonomyInput("category", inputName);
}

export async function resolveContentType(inputName: string): Promise<ResolvedTaxonomyResult> {
  return resolveTaxonomyInput("contentType", inputName);
}

export async function resolveLanguage(inputName: string): Promise<ResolvedTaxonomyResult> {
  return resolveTaxonomyInput("language", inputName);
}

// ─── MAIN SMART AUTO-RESOLVER ────────────────────────────────────────────────
export async function resolveTaxonomyInput(
  type: "category" | "platform" | "contentType" | "language",
  inputName: string
): Promise<ResolvedTaxonomyResult> {
  const cleanName = inputName.trim();
  const normalized = cleanName.toLowerCase();
  const generatedSlug = slugify(cleanName);

  const result: ResolvedTaxonomyResult = {
    name: cleanName,
    slug: generatedSlug,
    icon: "Folder",
    color: getDeterministicColor(cleanName),
    statusSteps: {
      identity: false,
      icon: false,
      theme: false,
      slug: false,
      metadata: false,
    },
    resolvedAt: Date.now(),
    confidence: "medium",
  };

  if (!cleanName) {
    return result;
  }

  // Identity and Slug generated
  result.statusSteps.identity = true;
  result.statusSteps.slug = true;

  // 1. PLATFORM RESOLUTION
  if (type === "platform") {
    const matchedRule = findPlatformMatch(normalized);

    if (matchedRule) {
      result.brandName = matchedRule.brandName;
      result.icon = matchedRule.icon;
      result.color = matchedRule.color;
      result.invitePattern = matchedRule.invitePattern;
      result.helpText = matchedRule.helpText;
      result.confidence = "high";
      result.statusSteps.icon = true;
      result.statusSteps.theme = true;
      result.statusSteps.metadata = true;
      return result;
    }

    // Custom platform fallback (Strictly UNRESOLVED / Low Confidence)
    result.brandName = cleanName;
    result.icon = "Share2";
    result.color = getDeterministicColor(cleanName);
    result.invitePattern = "^https?:\\/\\/.+";
    result.helpText = `Enter the official invite or community URL for ${cleanName}.`;
    result.confidence = "low";
    result.statusSteps.icon = true;
    result.statusSteps.theme = true;
    result.statusSteps.metadata = true;
    return result;
  }

  // 2. LANGUAGE RESOLUTION
  if (type === "language") {
    const words = normalized.split(/[\s\-_]+/);
    const matchedLang = LANGUAGE_DATASET.find((lang) =>
      lang.aliases.some((alias) => normalized === alias.toLowerCase() || words.includes(alias.toLowerCase()))
    );

    if (matchedLang) {
      result.code = matchedLang.code;
      result.isoCode = matchedLang.iso;
      result.icon = matchedLang.icon;
      result.color = matchedLang.color;
      result.confidence = "high";
      result.statusSteps.icon = true;
      result.statusSteps.theme = true;
      result.statusSteps.metadata = true;
      return result;
    }

    // Custom language fallback
    const isoFallback = generatedSlug.slice(0, 2) || "en";
    result.code = isoFallback;
    result.isoCode = isoFallback;
    result.icon = "Globe";
    result.color = getDeterministicColor(cleanName);
    result.confidence = "low";
    result.statusSteps.icon = true;
    result.statusSteps.theme = true;
    result.statusSteps.metadata = true;
    return result;
  }

  // 3. CATEGORY & CONTENT TYPE RESOLUTION
  const words = normalized.split(/[\s\-_]+/);
  const semanticMatch = SEMANTIC_KEYWORDS.find((item) =>
    item.keywords.some((kw) => normalized === kw.toLowerCase() || words.includes(kw.toLowerCase()))
  );

  if (semanticMatch) {
    result.icon = semanticMatch.icon;
    result.color = semanticMatch.color;
    result.confidence = "high";
    result.statusSteps.icon = true;
    result.statusSteps.theme = true;
    result.statusSteps.metadata = true;
    return result;
  }

  // Try Online Icon search for custom terms if not matched locally
  const onlineIcon = await searchOnlineIcon(cleanName);
  if (onlineIcon) {
    result.icon = onlineIcon;
    result.color = getDeterministicColor(cleanName);
    result.confidence = "medium";
    result.statusSteps.icon = true;
    result.statusSteps.theme = true;
    result.statusSteps.metadata = true;
    return result;
  }

  // Default fallback for Category / Content Type
  result.icon = type === "category" ? "Folder" : "MessageCircle";
  result.color = getDeterministicColor(cleanName);
  result.confidence = "low";
  result.statusSteps.icon = true;
  result.statusSteps.theme = true;
  result.statusSteps.metadata = true;

  return result;
}
