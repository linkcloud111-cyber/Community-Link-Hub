const assert = require("assert");
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

console.log("=== LINKCLOUD SETTINGS & SEO DEDUPLICATION VERIFICATION SUITE ===");

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function run() {
  const repoRoot = path.resolve(__dirname, "..");
  const appRoot = path.join(repoRoot, "artifacts/linkcloud");

  // ── 1. Static Source Audit: Zero Duplicates & Conflicting Save Paths ──────
  const adminSettingsSrc = fs.readFileSync(path.join(appRoot, "src/pages/admin-settings.tsx"), "utf8");
  const modalSrc = fs.readFileSync(path.join(appRoot, "src/components/cms/CmsPageEditorModal.tsx"), "utf8");
  const ctxSrc = fs.readFileSync(path.join(appRoot, "src/contexts/SiteSettingsContext.tsx"), "utf8");
  const nodeAdminSrc = fs.readFileSync(path.join(appRoot, "src/server/admin-api.ts"), "utf8");
  const cfSettingsSrc = fs.readFileSync(path.join(appRoot, "functions/api/admin/settings.ts"), "utf8");

  const adminSettingsFormJsx = adminSettingsSrc.slice(
    adminSettingsSrc.indexOf("<form onSubmit={handleSaveSettings}")
  );

  check(
    !adminSettingsFormJsx.includes("privacyPolicyContent") &&
      !adminSettingsFormJsx.includes("termsContent") &&
      !adminSettingsFormJsx.includes("dmcaContent") &&
      !adminSettingsFormJsx.includes("disclaimerContent"),
    "UI Dedup: Legacy editable legal textareas removed from admin-settings.tsx JSX form"
  );

  check(
    !adminSettingsFormJsx.includes("aboutTitle") &&
      !adminSettingsFormJsx.includes("aboutDescription") &&
      !adminSettingsFormJsx.includes("aboutMission") &&
      !adminSettingsFormJsx.includes("aboutVision") &&
      !adminSettingsFormJsx.includes("aboutUsContent"),
    "UI Dedup: Legacy editable About inputs removed from admin-settings.tsx JSX form"
  );

  const cmsManagerMatches = adminSettingsSrc.match(/<CmsPagesManager/g) || [];
  check(
    cmsManagerMatches.length === 2,
    `UI Dedup: CmsPagesManager rendered strictly twice (aboutHelp + legal), removed from seo tab (found ${cmsManagerMatches.length})`
  );

  const seoTabBlock = adminSettingsSrc.slice(
    adminSettingsSrc.indexOf('{tab === "seo" && ('),
    adminSettingsSrc.indexOf('{tab === "system" && (')
  );
  check(
    seoTabBlock.length > 100 &&
      !seoTabBlock.includes("<CmsPagesManager") &&
      seoTabBlock.includes("settings.ogTitle") &&
      seoTabBlock.includes("settings.ogDescription") &&
      seoTabBlock.includes("settings.twitterCardTitle") &&
      seoTabBlock.includes("settings.twitterCardDescription"),
    "SEO Tab: Contains no CmsPagesManager and exposes Global OG/Twitter defaults"
  );

  check(
    adminSettingsSrc.includes("Save Global Settings") &&
      !adminSettingsSrc.includes("Save All Webmaster Settings") &&
      !adminSettingsSrc.includes("Save All Settings"),
    "Save Dedup: Duplicate Save All Settings buttons eliminated; single Save Global Settings button scoped to isSiteSettingsTab"
  );

  check(
    modalSrc.includes("form.seo.ogDescription"),
    "CMS Modal: Per-page SEO tab includes Open Graph Description override input"
  );

  check(
    !ctxSrc.includes("lc-webmaster-jsonld") &&
      !ctxSrc.includes("upsertHeadMeta") &&
      !ctxSrc.includes("upsertCanonicalLink"),
    "Head Dedup: SiteSettingsContext no longer writes competing SEO meta, canonical, or JSON-LD tags"
  );

  check(
    nodeAdminSrc.includes("validateAdminSettingsPayload") &&
      !nodeAdminSrc.includes('doc("staticPages")') &&
      cfSettingsSrc.includes("validateAdminSettingsPayload") &&
      !cfSettingsSrc.includes("settings/staticPages"),
    "Backend Parity: Both Node & Cloudflare settings handlers share validateAdminSettingsPayload and never overwrite settings/staticPages"
  );

  // ── 2. Verify Cloudflare Function & Shared Validation Compile Cleanly ─────
  const tmpValBundle = path.join(repoRoot, `.tmp-val-bundle-${Date.now()}.cjs`);
  const tmpCfBundle = path.join(repoRoot, `.tmp-cf-settings-${Date.now()}.cjs`);
  const tmpMetaBundle = path.join(repoRoot, `.tmp-page-meta-${Date.now()}.cjs`);

  try {
    await esbuild.build({
      entryPoints: [path.join(appRoot, "src/lib/settings-validation.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node22",
      outfile: tmpValBundle,
    });

    await esbuild.build({
      entryPoints: [path.join(appRoot, "functions/api/admin/settings.ts")],
      bundle: true,
      platform: "neutral",
      format: "esm",
      target: "es2022",
      outfile: tmpCfBundle,
    });

    // Bundle page-meta pure helpers with lightweight stubs for React/Wouter/Firestore/SiteSettingsContext
    await esbuild.build({
      entryPoints: [path.join(appRoot, "src/lib/page-meta.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node22",
      outfile: tmpMetaBundle,
      plugins: [
        {
          name: "stub-ui-deps",
          setup(build) {
            build.onResolve({ filter: /^(react|wouter|\.\/firestore|@\/contexts\/SiteSettingsContext)$/ }, (args) => ({
              path: args.path,
              namespace: "stub",
            }));
            build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
              contents: `
                export function useEffect() {}
                export function useRef(v) { return { current: v }; }
                export function useLocation() { return ["/"]; }
                export async function getSiteSettings() { return null; }
                export function useSiteSettings() { return { settings: {} }; }
              `,
              loader: "js",
            }));
          },
        },
      ],
    });

    check(fs.existsSync(tmpCfBundle), "Cloudflare Parity: functions/api/admin/settings.ts bundles cleanly");

    const validator = require(tmpValBundle);
    const pageMeta = require(tmpMetaBundle);

    // ── 3. Shared Validation Behavioral Tests ─────────────────────────────
    const stripped = validator.validateAdminSettingsPayload({
      siteName: "LinkCloud",
      role: "user",
      isWebmaster: true,
      password: "secret",
      privacyPolicyContent: "Stale overwrite attempt",
      aboutTitle: "Stale about overwrite",
      aboutDescription: "Stale desc",
      canonicalUrl: "https://linkcloud.in/",
      ogImage: "/og-banner.png",
      metaTitle: "LinkCloud Global Title",
    });

    check(
      stripped.valid === true &&
        stripped.sanitized.siteName === "LinkCloud" &&
        stripped.sanitized.canonicalUrl === "https://linkcloud.in" &&
        !("role" in stripped.sanitized) &&
        !("isWebmaster" in stripped.sanitized) &&
        !("password" in stripped.sanitized) &&
        !("privacyPolicyContent" in stripped.sanitized) &&
        !("aboutTitle" in stripped.sanitized),
      "Validation: Strips forbidden escalation keys AND legacy CMS-managed fields, normalizes canonicalUrl"
    );

    const xssJs = validator.validateAdminSettingsPayload({ ogImage: "javascript:alert(1)" });
    const xssEncoded = validator.validateAdminSettingsPayload({ favicon: "%6a%61%76%61%73%63%72%69%70%74:alert(1)" });
    const protoRel = validator.validateAdminSettingsPayload({ heroButtonLink: "//evil.com/phish" });
    const badCanonical = validator.validateAdminSettingsPayload({ canonicalUrl: "/relative-not-origin" });
    const badJsonLd = validator.validateAdminSettingsPayload({ structuredDataJson: "{broken-json" });
    const longMetaTitle = validator.validateAdminSettingsPayload({ metaTitle: "a".repeat(201) });
    const longOgTitle = validator.validateAdminSettingsPayload({ ogTitle: "a".repeat(201) });

    check(!xssJs.valid, "Validation XSS: Rejects javascript: URLs");
    check(!xssEncoded.valid, "Validation XSS: Rejects percent-encoded javascript: URLs");
    check(!protoRel.valid, "Validation XSS: Rejects protocol-relative // URLs");
    check(!badCanonical.valid, "Validation Canonical: Requires full http(s) origin for global canonicalUrl");
    check(!badJsonLd.valid, "Validation JSON-LD: Rejects malformed structuredDataJson");
    check(!longMetaTitle.valid, "Validation Bounds: Rejects metaTitle > 200 chars");
    check(!longOgTitle.valid, "Validation Bounds: Rejects ogTitle > 200 chars");

    // ── 4. Unified SEO Metadata Resolution Behavioral Tests ───────────────
    const settingsLinkcloud = {
      siteName: "LinkCloud",
      metaTitle: "LinkCloud Default Meta",
      metaDescription: "Default site description",
      metaKeywords: "default, keywords",
      canonicalUrl: "https://linkcloud.in",
      ogTitle: "Global OG Title",
      ogDescription: "Global OG Desc",
      ogImage: "/global-og.png",
      twitterCardTitle: "Global Twitter Title",
      twitterCardDescription: "Global Twitter Desc",
      twitterCardImage: "/global-twitter.png",
      maintenanceMode: false,
    };

    // 4A. Never bypass configured https://linkcloud.in even when hosted on *.pages.dev
    const resPrivacyFullCanonical = pageMeta.resolveDocumentHeadMetadata({
      location: "/privacy",
      settings: settingsLinkcloud,
      runtimeOrigin: "https://linkcloud.pages.dev",
      page: {
        title: "Privacy Policy",
        description: "Official LinkCloud Privacy Policy",
        canonicalPath: "/privacy",
        canonicalUrl: "https://custom.linkcloud.in/legal/privacy",
        ogTitle: "Page OG Privacy Title",
        ogDescription: "Page OG Privacy Desc",
        ogImage: "https://cdn.linkcloud.in/privacy-og.png",
        noIndex: false,
      },
    });

    check(
      resPrivacyFullCanonical.canonicalUrl === "https://custom.linkcloud.in/legal/privacy" &&
        resPrivacyFullCanonical.ogUrl === "https://custom.linkcloud.in/legal/privacy",
      "SEO Resolution: Supports full https:// per-page canonicalUrl without double-prefixing"
    );

    check(
      resPrivacyFullCanonical.ogTitle === "Page OG Privacy Title" &&
        resPrivacyFullCanonical.ogDescription === "Page OG Privacy Desc" &&
        resPrivacyFullCanonical.ogImage === "https://cdn.linkcloud.in/privacy-og.png",
      "SEO Resolution: Applies per-page ogTitle, ogDescription, ogImage overrides cleanly"
    );

    const resRelativeCanonical = pageMeta.resolveDocumentHeadMetadata({
      location: "/about",
      settings: settingsLinkcloud,
      runtimeOrigin: "https://linkcloud.pages.dev",
      page: {
        title: "About LinkCloud",
        description: "About description",
        canonicalPath: "/about",
        canonicalUrl: "/about",
        noIndex: false,
      },
    });

    check(
      resRelativeCanonical.canonicalUrl === "https://linkcloud.in/about" &&
        resRelativeCanonical.ogImage === "https://linkcloud.in/global-og.png" &&
        resRelativeCanonical.twitterImage === "https://linkcloud.in/global-twitter.png",
      "SEO Resolution: Preserves Webmaster canonicalUrl='https://linkcloud.in' even on *.pages.dev origin and resolves relative paths"
    );

    const resHomeGlobalFallback = pageMeta.resolveDocumentHeadMetadata({
      location: "/",
      settings: settingsLinkcloud,
      runtimeOrigin: "https://linkcloud.pages.dev",
      page: {
        title: "Discover & Join Verified Communities",
        subtitle: "India's Public Community Directory",
      },
    });

    check(
      resHomeGlobalFallback.canonicalUrl === "https://linkcloud.in" &&
        resHomeGlobalFallback.ogTitle === "Global OG Title" &&
        resHomeGlobalFallback.ogDescription === "Global OG Desc" &&
        resHomeGlobalFallback.twitterTitle === "Global Twitter Title" &&
        resHomeGlobalFallback.twitterDescription === "Global Twitter Desc",
      "SEO Resolution: Homepage uses global OG & Twitter overrides when page OG fields are absent"
    );

    const resDraftNoIndex = pageMeta.resolveDocumentHeadMetadata({
      location: "/terms",
      settings: settingsLinkcloud,
      page: {
        title: "Terms of Service",
        canonicalPath: "/terms",
        noIndex: true,
      },
    });
    check(
      resDraftNoIndex.robots === "noindex, nofollow",
      "SEO Resolution: Unpublished/draft or noIndex=true page enforces noindex, nofollow"
    );

    const resPrivateRoute = pageMeta.resolveDocumentHeadMetadata({
      location: "/webmaster/settings",
      settings: settingsLinkcloud,
      page: null,
    });
    check(
      resPrivateRoute.robots === "noindex, nofollow",
      "SEO Resolution: Private /webmaster/* route enforces noindex, nofollow"
    );

    const resUnsafePageCanonical = pageMeta.resolveDocumentHeadMetadata({
      location: "/dmca",
      settings: settingsLinkcloud,
      page: {
        title: "DMCA",
        canonicalPath: "/dmca",
        canonicalUrl: "javascript:alert(1)",
        ogImage: "javascript:alert(2)",
      },
    });
    check(
      resUnsafePageCanonical.canonicalUrl === "https://linkcloud.in/dmca" &&
        resUnsafePageCanonical.ogImage === "",
      "SEO Resolution: Rejects unsafe javascript: canonicalUrl and strips unsafe ogImage"
    );
  } finally {
    [tmpValBundle, tmpCfBundle, tmpMetaBundle].forEach((f) => {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    });
  }

  console.log(`\nDeduplication & SEO Verification Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
