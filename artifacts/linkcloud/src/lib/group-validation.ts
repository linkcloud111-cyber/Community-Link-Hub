export const MAX_GROUP_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const MAX_GROUP_DESCRIPTION_LENGTH = 500;
export const MIN_GROUP_DESCRIPTION_LENGTH = 20;
export const DEFAULT_GROUP_NAME_MAX_LENGTH = 100;
export const DEFAULT_GROUP_TAGLINE_MAX_LENGTH = 120;
export const DEFAULT_GROUP_RULES_MAX_LENGTH = 1000;

export const MAX_GROUP_NAME_UPPER = 150;
export const MAX_GROUP_TAGLINE_UPPER = 200;
export const MAX_GROUP_DESCRIPTION_UPPER = 2000;
export const MAX_GROUP_RULES_UPPER = 2000;
export const MAX_GROUP_TAGS_UPPER = 25;

export interface GroupSubmissionLimits {
  nameMaxLength: number;
  taglineMaxLength: number;
  descriptionMinLength: number;
  descriptionMaxLength: number;
  rulesMaxLength: number;
  maxTags: number;
  requireGroupLogo: boolean;
  autoApproveGroups: boolean;
}

export function getGroupLimits(settings?: Record<string, any> | null): GroupSubmissionLimits {
  const clamp = (val: unknown, fallback: number, min: number, max: number) => {
    const num = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
  };

  const autoApproveGroups =
    settings?.autoApproveGroups === true || settings?.requireApproval === false;

  return {
    nameMaxLength: clamp(settings?.groupNameMaxLength, DEFAULT_GROUP_NAME_MAX_LENGTH, 30, MAX_GROUP_NAME_UPPER),
    taglineMaxLength: clamp(settings?.groupTaglineMaxLength, DEFAULT_GROUP_TAGLINE_MAX_LENGTH, 30, MAX_GROUP_TAGLINE_UPPER),
    descriptionMinLength: MIN_GROUP_DESCRIPTION_LENGTH,
    descriptionMaxLength: clamp(
      settings?.groupDescriptionMaxLength,
      MAX_GROUP_DESCRIPTION_LENGTH,
      100,
      MAX_GROUP_DESCRIPTION_UPPER
    ),
    rulesMaxLength: clamp(settings?.groupRulesMaxLength, DEFAULT_GROUP_RULES_MAX_LENGTH, 100, MAX_GROUP_RULES_UPPER),
    maxTags: clamp(settings?.maxTagsPerGroup, MAX_GROUP_TAGS, 1, MAX_GROUP_TAGS_UPPER),
    requireGroupLogo: settings?.requireGroupLogo === true,
    autoApproveGroups,
  };
}

export const REPORT_REASONS = [
  "Invalid Link",
  "Spam",
  "Scam",
  "Fake Group",
  "Adult Content",
  "Duplicate",
  "Copyright",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const MIN_REPORT_DETAILS_LENGTH = 10;
export const MAX_REPORT_DETAILS_LENGTH = 500;
export const MIN_REPORTER_NAME_LENGTH = 2;
export const MAX_REPORTER_NAME_LENGTH = 100;

export interface TagValidationResult {
  valid: boolean;
  tags: string[];
  count: number;
  remaining: number;
  error?: string;
}

/**
 * Validates and normalizes group tags without silently discarding or truncating user input.
 * - Max tags configurable (default 10)
 * - Max 30 characters per tag
 * - Trims whitespace per tag
 * - Rejects empty tags (e.g. "jobs, , tech" or trailing empty comma)
 * - Rejects duplicate tags case-insensitively
 */
export function parseAndValidateTags(
  input: string | string[],
  options: { required?: boolean; maxTags?: number } = { required: true }
): TagValidationResult {
  const required = options.required !== false;
  const maxTags =
    typeof options.maxTags === "number" && Number.isFinite(options.maxTags)
      ? Math.min(MAX_GROUP_TAGS_UPPER, Math.max(1, Math.round(options.maxTags)))
      : MAX_GROUP_TAGS;

  if (Array.isArray(input)) {
    if (input.length === 0) {
      if (required) {
        return {
          valid: false,
          tags: [],
          count: 0,
          remaining: maxTags,
          error: `7. Tags are required. Enter 1 to ${maxTags} comma-separated tags.`,
        };
      }
      return { valid: true, tags: [], count: 0, remaining: maxTags };
    }

    const seen = new Set<string>();
    const tags: string[] = [];

    for (const rawItem of input) {
      if (typeof rawItem !== "string") {
        return {
          valid: false,
          tags,
          count: tags.length,
          remaining: Math.max(0, maxTags - tags.length),
          error: "Each tag must be valid text.",
        };
      }
      const trimmed = rawItem.trim();
      if (!trimmed) {
        return {
          valid: false,
          tags,
          count: tags.length,
          remaining: Math.max(0, maxTags - tags.length),
          error: "Empty tags are not allowed. Remove blank tags or extra commas.",
        };
      }
      if (trimmed.length > MAX_TAG_LENGTH) {
        return {
          valid: false,
          tags,
          count: tags.length,
          remaining: Math.max(0, maxTags - tags.length),
          error: `Tag "${trimmed}" exceeds ${MAX_TAG_LENGTH} characters (${trimmed.length}/${MAX_TAG_LENGTH}).`,
        };
      }
      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) {
        return {
          valid: false,
          tags,
          count: tags.length,
          remaining: Math.max(0, maxTags - tags.length),
          error: `Duplicate tag "${trimmed}" is not allowed.`,
        };
      }
      seen.add(normalized);
      tags.push(normalized);
    }

    if (tags.length > maxTags) {
      return {
        valid: false,
        tags,
        count: tags.length,
        remaining: 0,
        error: `Maximum ${maxTags} tags allowed per group (entered ${tags.length}). Remove ${tags.length - maxTags} tag(s).`,
      };
    }

    return {
      valid: true,
      tags,
      count: tags.length,
      remaining: Math.max(0, maxTags - tags.length),
    };
  }

  const rawText = typeof input === "string" ? input : "";
  if (!rawText.trim()) {
    if (required) {
      return {
        valid: false,
        tags: [],
        count: 0,
        remaining: maxTags,
        error: `7. Tags are required. Enter 1 to ${maxTags} comma-separated tags.`,
      };
    }
    return { valid: true, tags: [], count: 0, remaining: maxTags };
  }

  const parts = rawText.split(",");
  return parseAndValidateTags(parts, { required, maxTags });
}

/**
 * Computes real-time tag UI counts & inline warning while typing.
 */
export function getLiveTagStats(
  rawText: string,
  maxTags: number = MAX_GROUP_TAGS
): {
  count: number;
  remaining: number;
  warning: string | null;
} {
  const effectiveMax =
    typeof maxTags === "number" && Number.isFinite(maxTags)
      ? Math.min(MAX_GROUP_TAGS_UPPER, Math.max(1, Math.round(maxTags)))
      : MAX_GROUP_TAGS;

  if (!rawText || !rawText.trim()) {
    return { count: 0, remaining: effectiveMax, warning: null };
  }

  const parts = rawText.split(",");
  const effectiveParts =
    parts.length > 1 && parts[parts.length - 1].trim() === ""
      ? parts.slice(0, -1)
      : parts;

  const nonEmptyCount = effectiveParts.filter((p) => p.trim().length > 0).length;
  const remaining = Math.max(0, effectiveMax - nonEmptyCount);

  const check = parseAndValidateTags(effectiveParts, { required: false, maxTags: effectiveMax });
  return {
    count: nonEmptyCount,
    remaining,
    warning: check.valid ? null : check.error || null,
  };
}

export interface ReportValidationInput {
  isSignedIn: boolean;
  reporterName?: string;
  reason?: string;
  details?: string;
}

export interface ReportValidationResult {
  valid: boolean;
  errors: {
    reporterName?: string;
    reason?: string;
    details?: string;
  };
  cleanData: {
    reporterName: string;
    reason: string;
    details: string;
  };
}

/**
 * Validates all displayed Group Report fields strictly.
 * Rejects empty/whitespace-only inputs, verifies reason allowlist, and checks lengths.
 * Does NOT require attachments.
 */
export function validateReportPayload(input: ReportValidationInput): ReportValidationResult {
  const errors: ReportValidationResult["errors"] = {};
  const cleanName = typeof input.reporterName === "string" ? input.reporterName.trim() : "";
  const cleanReason = typeof input.reason === "string" ? input.reason.trim() : "";
  const cleanDetails = typeof input.details === "string" ? input.details.trim() : "";

  if (!input.isSignedIn) {
    if (!cleanName) {
      errors.reporterName = "Your name is required.";
    } else if (cleanName.length < MIN_REPORTER_NAME_LENGTH) {
      errors.reporterName = `Name must be at least ${MIN_REPORTER_NAME_LENGTH} characters.`;
    } else if (cleanName.length > MAX_REPORTER_NAME_LENGTH) {
      errors.reporterName = `Name must not exceed ${MAX_REPORTER_NAME_LENGTH} characters.`;
    }
  }

  if (!cleanReason) {
    errors.reason = "Please select a report reason.";
  } else if (!(REPORT_REASONS as readonly string[]).includes(cleanReason)) {
    errors.reason = "Please select a valid report reason.";
  }

  if (!cleanDetails) {
    errors.details = "Details are required. Please explain the issue.";
  } else if (cleanDetails.length < MIN_REPORT_DETAILS_LENGTH) {
    errors.details = `Details must be at least ${MIN_REPORT_DETAILS_LENGTH} characters (${cleanDetails.length}/${MIN_REPORT_DETAILS_LENGTH}).`;
  } else if (cleanDetails.length > MAX_REPORT_DETAILS_LENGTH) {
    errors.details = `Details must not exceed ${MAX_REPORT_DETAILS_LENGTH} characters (${cleanDetails.length}/${MAX_REPORT_DETAILS_LENGTH}).`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    cleanData: {
      reporterName: cleanName,
      reason: cleanReason,
      details: cleanDetails,
    },
  };
}

export interface NormalizedMobileResult {
  valid: boolean;
  raw10: string;
  canonical: string;
  variations: string[];
  error?: string;
}

/**
 * Normalizes Indian mobile numbers cleanly for lookup across canonical (+91XXXXXXXXXX),
 * legacy space-formatted (+91 XXXXXXXXXX), and legacy 10-digit (XXXXXXXXXX) index formats.
 */
export function normalizeIndianMobileNumber(input: string): NormalizedMobileResult {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) {
    return {
      valid: false,
      raw10: "",
      canonical: "",
      variations: [],
      error: "Mobile number is required.",
    };
  }

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(digits)) {
    return {
      valid: false,
      raw10: digits,
      canonical: "",
      variations: [],
      error: "Please enter a valid 10-digit Indian mobile number.",
    };
  }

  const canonical = `+91${digits}`;
  const spaced = `+91 ${digits}`;
  return {
    valid: true,
    raw10: digits,
    canonical,
    variations: [canonical, spaced, digits],
  };
}
