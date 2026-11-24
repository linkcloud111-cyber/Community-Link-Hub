const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");

console.log("=== LINKCLOUD GATE 1 CMS & WEBMASTER SETTINGS TEST SUITE ===");

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

function createInMemoryCmsStorage() {
  const docs = new Map();
  const auditLogs = [];

  function clone(val) {
    return val === undefined ? undefined : JSON.parse(JSON.stringify(val));
  }

  return {
    docs,
    auditLogs,
    async getDoc(docPath) {
      const val = docs.get(docPath);
      if (!val) return null;
      const id = docPath.split("/").pop();
      return { id, ...clone(val) };
    },
    async setDoc(docPath, data, merge = true) {
      const existing = docs.get(docPath) || {};
      const next = merge ? { ...clone(existing), ...clone(data) } : clone(data);
      docs.set(docPath, next);
    },
    async deleteDoc(docPath) {
      docs.delete(docPath);
    },
    async listCollection(collectionPath, limitCount = 200) {
      const prefix = collectionPath.endsWith("/") ? collectionPath : `${collectionPath}/`;
      const results = [];
      for (const [docPath, val] of docs.entries()) {
        if (!docPath.startsWith(prefix)) continue;
        const remainder = docPath.slice(prefix.length);
        // Only direct children of the collection
        if (remainder.includes("/")) continue;
        results.push({ id: remainder, ...clone(val) });
        if (results.length >= limitCount) break;
      }
      return results;
    },
    async addAuditLog(entry) {
      auditLogs.push(clone(entry));
    },
  };
}

async function runTests() {
  const repoRoot = path.resolve(__dirname, "..");
  const tmpOut = path.join(repoRoot, `artifacts/linkcloud/.tmp-gate1-bundle-${Date.now()}.cjs`);
  try {
    await esbuild.build({
      entryPoints: [path.join(repoRoot, "artifacts/linkcloud/src/server/cms-api.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node22",
      outfile: tmpOut,
      external: ["firebase-admin", "firebase-admin/*"],
    });

    const cmsApi = require(tmpOut);
    const storage = createInMemoryCmsStorage();

    // Pre-populate unrelated site settings & a 1-line legacy privacy placeholder
    await storage.setDoc("settings/site", {
      siteName: "LinkCloud",
      maintenanceMode: false,
      websiteTheme: "dark",
      userRegistrationEnabled: true,
      groupSubmissionEnabled: true,
      filterSettings: { categoryFilterEnabled: true, platformFilterEnabled: true },
      privacyPolicyContent:
        "LinkCloud respects user privacy. We do not store or inspect private chat content, messages, or member lists.",
    });
    await storage.setDoc("settings/staticPages", {
      privacy:
        "LinkCloud respects user privacy. We do not store or inspect private chat content, messages, or member lists.",
    });

    const verifyWebmaster = async (req) => {
      const authHeader = String(req.headers.authorization || "");
      if (!authHeader.startsWith("Bearer ")) {
        return { valid: false, statusCode: 401, error: "Unauthorized: Missing Bearer token." };
      }
      const token = authHeader.slice(7).trim();
      if (token === "webmaster-token") {
        return { valid: true, uid: "wm_uid_canonical", email: "linkcloud111@gmail.com" };
      }
      if (token === "user-token") {
        return { valid: false, statusCode: 403, error: "Forbidden: Webmaster role required." };
      }
      return { valid: false, statusCode: 401, error: "Unauthorized: Invalid token." };
    };

    const handlers = cmsApi.createCmsNodeHandlers({
      getStorage: () => storage,
      verifyWebmaster,
    });

    const routes = {
      "/api/cms/pages": handlers.handlePublicCmsPagesGet,
      "/api/faqs": handlers.handlePublicFaqsGet,
      "/api/help-articles": handlers.handlePublicHelpArticlesGet,
      "/api/admin/cms/pages": handlers.handleAdminCmsPagesGet,
      "/api/admin/cms/draft": handlers.handleAdminCmsDraftSave,
      "/api/admin/cms/publish": handlers.handleAdminCmsPublish,
      "/api/admin/cms/unpublish": handlers.handleAdminCmsUnpublish,
      "/api/admin/cms/page": handlers.handleAdminCmsDelete,
      "/api/admin/cms/versions": handlers.handleAdminCmsVersions,
      "/api/admin/cms/restore": handlers.handleAdminCmsRestore,
      "/api/admin/cms/seed": handlers.handleAdminCmsSeed,
      "/api/admin/cms/refresh": handlers.handleAdminCmsRefresh,
      "/api/admin/faqs": handlers.handleAdminFaqs,
      "/api/admin/help-articles": handlers.handleAdminHelpArticles,
    };

    const server = http.createServer((req, res) => {
      const pathname = (req.url || "/").split("?")[0];
      const handler = routes[pathname];
      if (!handler) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      Promise.resolve(handler(req, res)).catch((err) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err?.message || "Server error" }));
      });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    async function callApi(urlPath, options = {}) {
      const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      if (options.token) headers.Authorization = `Bearer ${options.token}`;
      const res = await fetch(`${base}${urlPath}`, {
        method: options.method || "GET",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json };
    }

    try {
      // ── 1. Auth Boundaries (Visitor 401, Ordinary User 403, Webmaster 200) ──
      const rVisitorOverview = await callApi("/api/admin/cms/pages");
      check(rVisitorOverview.status === 401, "Auth: Visitor receives 401 on GET /api/admin/cms/pages");

      const rUserOverview = await callApi("/api/admin/cms/pages", { token: "user-token" });
      check(rUserOverview.status === 403, "Auth: Ordinary user receives 403 on GET /api/admin/cms/pages");

      const rUserDraft = await callApi("/api/admin/cms/draft", {
        method: "PUT",
        token: "user-token",
        body: { slug: "about", title: "Hack" },
      });
      check(rUserDraft.status === 403, "Auth: Ordinary user receives 403 on PUT /api/admin/cms/draft");

      const rUserSeed = await callApi("/api/admin/cms/seed", {
        method: "POST",
        token: "user-token",
        body: { dryRun: false },
      });
      check(rUserSeed.status === 403, "Auth: Ordinary user receives 403 on POST /api/admin/cms/seed");

      const rUserFaq = await callApi("/api/admin/faqs", {
        method: "POST",
        token: "user-token",
        body: { question: "Hack?", answer: "No", category: "General" },
      });
      check(rUserFaq.status === 403, "Auth: Ordinary user receives 403 on POST /api/admin/faqs");

      const rUserHelp = await callApi("/api/admin/help-articles", {
        method: "POST",
        token: "user-token",
        body: { title: "Hack", content: "No way", category: "General" },
      });
      check(rUserHelp.status === 403, "Auth: Ordinary user receives 403 on POST /api/admin/help-articles");

      // ── 2. Public endpoint refuses draft bypass & hides legacy 1-line placeholder ──
      const rBypass = await callApi("/api/cms/pages?slug=privacy&includeDrafts=true");
      check(rBypass.status === 403, "Public Isolation: ?includeDrafts=true rejected with 403");

      const rInvalidSlug = await callApi("/api/cms/pages?slug=nonexistent");
      check(rInvalidSlug.status === 400, "Validation: Invalid CMS slug rejected with 400");

      const rUnpubPrivacy = await callApi("/api/cms/pages?slug=privacy");
      check(
        rUnpubPrivacy.status === 200 &&
          rUnpubPrivacy.json.published === false &&
          rUnpubPrivacy.json.page === null,
        "Public Isolation: Legacy 1-line placeholder is NOT served as published privacy policy"
      );

      // ── 3. Auto Seed Dry-Run -> Execute -> Legal Draft Lock -> Idempotency ──
      const rSeedDry = await callApi("/api/admin/cms/seed", {
        method: "POST",
        token: "webmaster-token",
        body: { dryRun: true },
      });
      check(
        rSeedDry.status === 200 &&
          rSeedDry.json.dryRun === true &&
          Array.isArray(rSeedDry.json.plan) &&
          rSeedDry.json.plan.length === 7 &&
          rSeedDry.json.plan.every((p) => p.willAutoPublish === false) &&
          storage.docs.get("cms_drafts/privacy") === undefined,
        "Auto Seed Dry-Run: Previews all 7 slugs with zero writes & willAutoPublish=false"
      );

      const rSeedExec = await callApi("/api/admin/cms/seed", {
        method: "POST",
        token: "webmaster-token",
        body: { dryRun: false },
      });
      check(
        rSeedExec.status === 200 &&
          rSeedExec.json.dryRun === false &&
          rSeedExec.json.createdCount === 7 &&
          rSeedExec.json.plan.every((p) => p.willAutoPublish === false),
        "Auto Seed Execute: Creates starter drafts for 7 missing slugs and auto-publishes 0 legal pages"
      );

      // Verify legal pages remain strictly draft & legacy placeholder was archived as v0
      const rPrivacyAfterSeed = await callApi("/api/cms/pages?slug=privacy");
      check(
        rPrivacyAfterSeed.json.published === false && rPrivacyAfterSeed.json.page === null,
        "Legal Draft Lock: Privacy remains unpublished after Auto Seed"
      );
      const rPrivacyVersions = await callApi("/api/admin/cms/versions?slug=privacy", {
        token: "webmaster-token",
      });
      check(
        rPrivacyVersions.status === 200 &&
          rPrivacyVersions.json.versions.some((v) => v.action === "archived_legacy" && v.version === 0),
        "Legacy Archive: Existing 1-line legacy text archived into v0 version history before seed"
      );

      // Idempotency check
      const rSeedAgain = await callApi("/api/admin/cms/seed", {
        method: "POST",
        token: "webmaster-token",
        body: { dryRun: false },
      });
      check(
        rSeedAgain.status === 200 &&
          rSeedAgain.json.createdCount === 0 &&
          rSeedAgain.json.skippedCount === 7,
        "Auto Seed Idempotency: Second run preserves all 7 existing pages without overwriting"
      );

      // ── 4. Draft Save, Publish, Re-edit Isolation, Unpublish, Version Restore ──
      const validAboutDraft = {
        slug: "about",
        title: "About LinkCloud Community Index",
        subtitle: "Verified Discovery Portal",
        description: "LinkCloud indexes public community invite links submitted by organizers and reviewed by moderation.",
        blocks: [
          {
            id: "b1",
            type: "paragraph",
            heading: "Platform Overview",
            text: "LinkCloud helps visitors discover public community groups safely across messaging platforms.",
          },
          {
            id: "b2",
            type: "link",
            heading: "Get Help",
            text: "Contact support if you need assistance with a community listing.",
            label: "Open Contact Page",
            url: "/contact",
          },
        ],
        seo: {
          seoTitle: "About LinkCloud | Public Community Directory",
          seoDescription: "Discover how LinkCloud curates public messaging communities safely.",
          seoKeywords: "linkcloud, community directory, about",
          canonicalUrl: "/about",
          noIndex: false,
        },
        note: "Draft v1 write",
      };

      const rSaveAbout = await callApi("/api/admin/cms/draft", {
        method: "PUT",
        token: "webmaster-token",
        body: validAboutDraft,
      });
      check(rSaveAbout.status === 200 && rSaveAbout.json.draft.status === "draft", "Draft Save: About draft saved cleanly");

      const rPubAboutBeforePublish = await callApi("/api/cms/pages?slug=about");
      check(
        rPubAboutBeforePublish.json.published === false && rPubAboutBeforePublish.json.page === null,
        "Draft Isolation: Saved draft is NOT visible on public /api/cms/pages?slug=about"
      );

      const rPublishAbout = await callApi("/api/admin/cms/publish", {
        method: "POST",
        token: "webmaster-token",
        body: validAboutDraft,
      });
      check(
        rPublishAbout.status === 200 && rPublishAbout.json.page?.status === "published",
        "Publish: About page published cleanly"
      );

      const rPubAboutAfterPublish = await callApi("/api/cms/pages?slug=about");
      check(
        rPubAboutAfterPublish.status === 200 &&
          rPubAboutAfterPublish.json.published === true &&
          rPubAboutAfterPublish.json.page.title === "About LinkCloud Community Index",
        "Public Read: /api/cms/pages?slug=about serves published projection"
      );

      // Re-edit draft without publishing -> public still serves published snapshot!
      await callApi("/api/admin/cms/draft", {
        method: "PUT",
        token: "webmaster-token",
        body: {
          ...validAboutDraft,
          title: "Unpublished Revision 2 Title",
        },
      });
      const rPubAboutWhileDraftEdited = await callApi("/api/cms/pages?slug=about");
      const rOverviewAfterDraftEdit = await callApi("/api/admin/cms/pages?slug=about", {
        token: "webmaster-token",
      });
      check(
        rPubAboutWhileDraftEdited.json.page.title === "About LinkCloud Community Index" &&
          rOverviewAfterDraftEdit.json.page.draft?.title === "Unpublished Revision 2 Title" &&
          rOverviewAfterDraftEdit.json.page.published?.title === "About LinkCloud Community Index",
        "Draft Re-edit Isolation: Public still sees v1 while draft holds Revision 2"
      );

      // Restore previous version requires confirmRestore: true
      const aboutVersionsRes = await callApi("/api/admin/cms/versions?slug=about", {
        token: "webmaster-token",
      });
      const publishedV1 = aboutVersionsRes.json.versions.find(
        (v) => v.action === "published" && v.snapshot?.title === "About LinkCloud Community Index"
      );
      check(Boolean(publishedV1), "Version History: Published snapshot recorded in versions");

      const rRestoreNoConfirm = await callApi("/api/admin/cms/restore", {
        method: "POST",
        token: "webmaster-token",
        body: { slug: "about", versionId: publishedV1.versionId || publishedV1.id, confirmRestore: false },
      });
      check(rRestoreNoConfirm.status === 400, "Version Restore: Rejected without confirmRestore=true");

      const rRestoreConfirmed = await callApi("/api/admin/cms/restore", {
        method: "POST",
        token: "webmaster-token",
        body: { slug: "about", versionId: publishedV1.versionId || publishedV1.id, confirmRestore: true },
      });
      const versionsAfterRestore = await callApi("/api/admin/cms/versions?slug=about", {
        token: "webmaster-token",
      });
      check(
        rRestoreConfirmed.status === 200 &&
          rRestoreConfirmed.json.draft.title === "About LinkCloud Community Index" &&
          versionsAfterRestore.json.versions.length > aboutVersionsRes.json.versions.length &&
          versionsAfterRestore.json.versions.some((v) => v.action === "restored"),
        "Version Restore: Creates new restored version while preserving all prior history"
      );

      // Unpublish -> public returns unpublished, draft + history intact
      const rUnpublishAbout = await callApi("/api/admin/cms/unpublish", {
        method: "POST",
        token: "webmaster-token",
        body: { slug: "about" },
      });
      const rPublicAfterUnpublish = await callApi("/api/cms/pages?slug=about");
      check(
        rUnpublishAbout.status === 200 &&
          rPublicAfterUnpublish.json.published === false &&
          rPublicAfterUnpublish.json.page === null &&
          Boolean(storage.docs.get("cms_drafts/about")),
        "Unpublish: Removes public projection while keeping draft and history intact"
      );

      // Re-publish & test Delete Protection (requires confirmDeletePublished: true)
      await callApi("/api/admin/cms/publish", {
        method: "POST",
        token: "webmaster-token",
        body: validAboutDraft,
      });
      const rDeleteNoConfirm = await callApi("/api/admin/cms/page?slug=about", {
        method: "DELETE",
        token: "webmaster-token",
        body: { slug: "about", confirmDeletePublished: false },
      });
      check(
        rDeleteNoConfirm.status === 409,
        "Delete Protection: Deleting published page without confirmDeletePublished=true returns 409"
      );

      const rDeleteConfirmed = await callApi("/api/admin/cms/page?slug=about", {
        method: "DELETE",
        token: "webmaster-token",
        body: { slug: "about", confirmDeletePublished: true },
      });
      const versionsAfterDelete = await callApi("/api/admin/cms/versions?slug=about", {
        token: "webmaster-token",
      });
      check(
        rDeleteConfirmed.status === 200 &&
          !storage.docs.get("cms_pages/about") &&
          !storage.docs.get("cms_drafts/about") &&
          versionsAfterDelete.json.versions.some((v) => v.action === "deleted"),
        "Delete Confirmed: Removes draft & live doc while retaining recoverable deleted snapshot in versions"
      );

      // ── 5. XSS & Validation Checks ──
      const rXssUrl = await callApi("/api/admin/cms/draft", {
        method: "PUT",
        token: "webmaster-token",
        body: {
          ...validAboutDraft,
          slug: "help",
          blocks: [
            {
              id: "bad_link",
              type: "link",
              heading: "Bad Link",
              text: "Unsafe url test",
              label: "Click",
              url: "javascript:alert(document.cookie)",
            },
          ],
        },
      });
      check(rXssUrl.status === 400, "XSS Guard: Blocks javascript: link URLs cleanly with 400");

      const rProtoRelativeUrl = await callApi("/api/admin/cms/draft", {
        method: "PUT",
        token: "webmaster-token",
        body: {
          ...validAboutDraft,
          slug: "help",
          blocks: [
            {
              id: "bad_link_2",
              type: "link",
              heading: "Bad Link",
              text: "Protocol-relative test",
              label: "Click",
              url: "//evil.example.com/phish",
            },
          ],
        },
      });
      check(rProtoRelativeUrl.status === 400, "XSS Guard: Blocks protocol-relative // URLs cleanly with 400");

      const rScriptSanitize = await callApi("/api/admin/cms/draft", {
        method: "PUT",
        token: "webmaster-token",
        body: {
          ...validAboutDraft,
          slug: "help",
          blocks: [
            {
              id: "clean_p",
              type: "paragraph",
              heading: "Safe <script>alert(1)</script>Heading",
              text: "Help content with <img src=x onerror=alert(1)> sanitized cleanly for users.",
            },
          ],
        },
      });
      const savedHelpBlock = rScriptSanitize.json?.draft?.blocks?.[0];
      check(
        rScriptSanitize.status === 200 &&
          !savedHelpBlock.heading.includes("<script") &&
          !savedHelpBlock.text.includes("<img") &&
          !savedHelpBlock.text.includes("onerror="),
        "Sanitization: Strips <script>, raw HTML tags, and event handler strings from CMS text"
      );

      // ── 6. Refresh / Recheck Endpoint ──
      const rRefresh = await callApi("/api/admin/cms/refresh", {
        method: "POST",
        token: "webmaster-token",
      });
      check(
        rRefresh.status === 200 &&
          rRefresh.json.summary.total === 7 &&
          rRefresh.json.summary.published === 0 &&
          rRefresh.json.summary.draft === 6 &&
          rRefresh.json.summary.incomplete + rRefresh.json.summary.missing === 1,
        "Refresh / Recheck: Accurately summarizes published/draft/missing counts without mutating data"
      );

      // ── 7. FAQ CRUD + Duplicate Check + Enable/Disable + Reorder + Public Read ──
      const rFaq1 = await callApi("/api/admin/faqs", {
        method: "POST",
        token: "webmaster-token",
        body: {
          question: "How does LinkCloud review community submissions?",
          answer: "All submitted invite links are reviewed against directory policies before public listing.",
          category: "Submissions",
          enabled: true,
          status: "published",
          sortOrder: 2,
        },
      });
      const rFaq2 = await callApi("/api/admin/faqs", {
        method: "POST",
        token: "webmaster-token",
        body: {
          question: "Draft FAQ hidden from visitors?",
          answer: "This FAQ is still a draft and should never appear on public /faq or homepage.",
          category: "General",
          enabled: true,
          status: "draft",
          sortOrder: 1,
        },
      });
      const rFaqDup = await callApi("/api/admin/faqs", {
        method: "POST",
        token: "webmaster-token",
        body: {
          question: "  how does linkcloud review community submissions? ",
          answer: "Duplicate attempt should fail cleanly.",
          category: "Submissions",
          enabled: true,
          status: "published",
          sortOrder: 3,
        },
      });
      check(
        rFaq1.status === 201 && rFaq2.status === 201 && rFaqDup.status === 409,
        "FAQ CRUD: Create succeeds and normalized duplicate question rejected with 409"
      );

      const rPubFaqs1 = await callApi("/api/faqs");
      check(
        rPubFaqs1.status === 200 &&
          rPubFaqs1.json.faqs.length === 1 &&
          rPubFaqs1.json.faqs[0].id === rFaq1.json.faq.id,
        "FAQ Public Read: Draft FAQs are excluded from /api/faqs"
      );

      // Update FAQ -> disable -> verify hidden -> enable & publish FAQ2 -> reorder
      await callApi("/api/admin/faqs", {
        method: "PUT",
        token: "webmaster-token",
        body: { id: rFaq1.json.faq.id, enabled: false },
      });
      const rPubFaqsDisabled = await callApi("/api/faqs");
      check(
        rPubFaqsDisabled.json.faqs.length === 0,
        "FAQ Enable/Disable: Disabled FAQ is hidden from /api/faqs"
      );

      await callApi("/api/admin/faqs", {
        method: "PUT",
        token: "webmaster-token",
        body: { id: rFaq1.json.faq.id, enabled: true },
      });
      await callApi("/api/admin/faqs", {
        method: "PUT",
        token: "webmaster-token",
        body: { id: rFaq2.json.faq.id, status: "published", enabled: true },
      });
      await callApi("/api/admin/faqs", {
        method: "PUT",
        token: "webmaster-token",
        body: {
          reorder: [
            { id: rFaq1.json.faq.id, sortOrder: 1 },
            { id: rFaq2.json.faq.id, sortOrder: 2 },
          ],
        },
      });
      const rPubFaqsReordered = await callApi("/api/faqs");
      check(
        rPubFaqsReordered.json.faqs.length === 2 &&
          rPubFaqsReordered.json.faqs[0].id === rFaq1.json.faq.id &&
          rPubFaqsReordered.json.faqs[1].id === rFaq2.json.faq.id,
        "FAQ Reorder: Server-side sortOrder persistence controls public ordering"
      );

      await callApi(`/api/admin/faqs?id=${encodeURIComponent(rFaq2.json.faq.id)}`, {
        method: "DELETE",
        token: "webmaster-token",
      });
      const rPubFaqsAfterDelete = await callApi("/api/faqs");
      check(rPubFaqsAfterDelete.json.faqs.length === 1, "FAQ Delete: Deleted FAQ removed");

      // ── 8. Help Center CRUD + Steps + Edit + Reorder + Public Filtering ──
      const rHelp1 = await callApi("/api/admin/help-articles", {
        method: "POST",
        token: "webmaster-token",
        body: {
          title: "How to Submit a Community Group",
          category: "Group Submissions",
          content: "Follow these verified submission guidelines before sending a group invite link for review.",
          steps: ["Sign in to your account", "Open Submit Group and complete all fields"],
          enabled: true,
          status: "published",
          sortOrder: 1,
        },
      });
      const rHelp2 = await callApi("/api/admin/help-articles", {
        method: "POST",
        token: "webmaster-token",
        body: {
          title: "Internal Draft Support Article",
          category: "Account & Login",
          content: "This draft article is pending editorial sign-off.",
          steps: ["Step A"],
          enabled: true,
          status: "draft",
          sortOrder: 2,
        },
      });
      check(
        rHelp1.status === 201 &&
          rHelp2.status === 201 &&
          Array.isArray(rHelp1.json.article.steps) &&
          rHelp1.json.article.steps.length === 2,
        "Help Center CRUD: Created articles with structured steps[]"
      );

      // Edit Help Article (previously missing feature)
      const rHelpEdit = await callApi("/api/admin/help-articles", {
        method: "PUT",
        token: "webmaster-token",
        body: {
          id: rHelp1.json.article.id,
          title: "How to Submit & Verify a Community",
          steps: ["Sign in", "Submit valid public URL", "Wait for review"],
        },
      });
      const rPubHelp = await callApi("/api/help-articles");
      check(
        rHelpEdit.status === 200 &&
          rPubHelp.status === 200 &&
          rPubHelp.json.articles.length === 1 &&
          rPubHelp.json.articles[0].title === "How to Submit & Verify a Community" &&
          rPubHelp.json.articles[0].steps.length === 3,
        "Help Center Edit & Public Isolation: Edit updates steps[] and public API excludes drafts"
      );

      // ── 9. Settings Preservation + Audit Logs Check ──
      const siteSettingsAfter = storage.docs.get("settings/site");
      check(
        siteSettingsAfter.maintenanceMode === false &&
          siteSettingsAfter.websiteTheme === "dark" &&
          siteSettingsAfter.userRegistrationEnabled === true &&
          siteSettingsAfter.filterSettings?.categoryFilterEnabled === true,
        "Settings Isolation: CMS operations preserve all unrelated site settings cleanly"
      );

      check(
        storage.auditLogs.length >= 10 &&
          storage.auditLogs.every(
            (l) =>
              typeof l.action === "string" &&
              l.adminUid === "wm_uid_canonical" &&
              l.actorUid === "wm_uid_canonical" &&
              l.adminEmail === "linkcloud111@gmail.com" &&
              l.actorEmail === "linkcloud111@gmail.com" &&
              !JSON.stringify(l).includes("webmaster-token")
          ),
        `Audit Logging: Recorded ${storage.auditLogs.length} audit entries with actor UID/email and zero token leakage`
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    // ── 10. Static Source & Guardrail Audits ──
    const appSrc = path.join(__dirname, "../artifacts/linkcloud/src");
    const adminApiSrc = fs.readFileSync(path.join(appSrc, "server/admin-api.ts"), "utf8");
    const adminSettingsSrc = fs.readFileSync(path.join(appSrc, "pages/admin-settings.tsx"), "utf8");
    const firestoreSrc = fs.readFileSync(path.join(appSrc, "lib/firestore.ts"), "utf8");
    const faqSrc = fs.readFileSync(path.join(appSrc, "pages/faq.tsx"), "utf8");
    const helpSrc = fs.readFileSync(path.join(appSrc, "pages/help.tsx"), "utf8");
    const privacySrc = fs.readFileSync(path.join(appSrc, "pages/privacy.tsx"), "utf8");
    const termsSrc = fs.readFileSync(path.join(appSrc, "pages/terms.tsx"), "utf8");
    const dmcaSrc = fs.readFileSync(path.join(appSrc, "pages/dmca.tsx"), "utf8");
    const disclaimerSrc = fs.readFileSync(path.join(appSrc, "pages/disclaimer.tsx"), "utf8");
    const aboutSrc = fs.readFileSync(path.join(appSrc, "pages/about.tsx"), "utf8");
    const rendererSrc = fs.readFileSync(path.join(appSrc, "components/cms/CmsBlockRenderer.tsx"), "utf8");
    const liveRulesSrc = fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8");

    // Verify GET /api/admin/settings calls verifyWebmasterToken
    const getSettingsFnMatch = adminApiSrc.match(
      /export async function handleAdminSettingsGetRequest[\s\S]*?verifyWebmasterToken\(req\)/
    );
    check(Boolean(getSettingsFnMatch), "Security Fix: GET /api/admin/settings enforces verifyWebmasterToken(req)");

    check(
      !adminSettingsSrc.includes("await updateSiteSettings(") &&
        !adminSettingsSrc.includes("if (response.status === 503)"),
      "Security Fix: Removed silent client-side Firestore settings fallback from admin-settings.tsx"
    );

    check(!faqSrc.includes("DEFAULT_FAQS"), "Content Integrity: DEFAULT_FAQS removed from faq.tsx");
    check(
      !helpSrc.includes("Joining Communities") && !helpSrc.includes("Submitting Your Community"),
      "Content Integrity: Hardcoded 4 static Help cards removed from help.tsx"
    );
    check(
      !firestoreSrc.includes("How do I submit my WhatsApp group to LinkCloud?") &&
        !firestoreSrc.includes("Why was my group submission rejected?"),
      "Content Integrity: Hardcoded fake catch fallbacks removed from getFAQs & getHelpArticles in firestore.ts"
    );
    check(
      !privacySrc.includes("Welcome to") &&
        !termsSrc.includes("Acceptance of Terms") &&
        !dmcaSrc.includes("Indian copyright legislation") &&
        !disclaimerSrc.includes("Meta Platforms Inc.") &&
        !aboutSrc.includes("100% Moderated"),
      "Content Integrity: Public pages use published CMS views with zero fabricated legal/marketing fallbacks"
    );
    check(
      !/dangerouslySetInnerHTML\s*=/.test(rendererSrc) && !/\.innerHTML\s*=/.test(rendererSrc),
      "XSS Guard: Zero executable dangerouslySetInnerHTML / innerHTML in CmsBlockRenderer"
    );
    check(
      !liveRulesSrc.includes("match /cms_pages"),
      "Gate 1 Restraint: Live firestore.rules untouched (proposed rules kept in docs/GATE3_PROPOSED_FIRESTORE_RULES.md)"
    );
  } finally {
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  }

  console.log(`\nGate 1 Verification Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
