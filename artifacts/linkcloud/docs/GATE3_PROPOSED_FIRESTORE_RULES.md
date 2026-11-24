# LINKCLOUD — GATE 3 PROPOSED FIRESTORE RULES & BLUEPRINT UPDATES

**Status:** PROPOSED FOR GATE 3 OWNER REVIEW ONLY — **NOT APPLIED OR DEPLOYED IN GATE 1**

Per Gate 1 non-negotiable safety rules:
- Live `/firestore.rules` (and any artifact copy) was **NOT modified or deployed**.
- Live `/firebase-blueprint.json` was **NOT modified**.
- During Gate 1, all CMS public reads (`GET /api/cms/pages`, `/api/faqs`, `/api/help-articles`) and all Webmaster CMS/FAQ/Help/Settings mutations (`/api/admin/cms/*`, `/api/admin/faqs`, `/api/admin/help-articles`, `/api/admin/settings`) execute strictly on the server via Firebase Admin SDK (`verifyWebmasterToken` + `cms-core.ts`), keeping draft projections (`cms_drafts`) and version histories (`cms_pages/{slug}/versions`) isolated from direct client Firestore reads/writes even before Gate 3 rules deployment.

---

## 1. Proposed `firestore.rules` Additions & Tightening (Gate 3)

Once the Owner explicitly approves Gate 3 rules & blueprint deployment, add/update the following rules inside `match /databases/{database}/documents`:

```firestore
    // ─── CMS Published Page Projections ───
    // Public visitors may read ONLY published projections.
    // All mutations occur exclusively via server-side Admin SDK endpoints (/api/admin/cms/*).
    match /cms_pages/{slug} {
      allow read: if resource.data.status == 'published' || isWebmaster();
      allow write: if false;

      // Immutable CMS version history snapshots
      match /versions/{versionId} {
        allow read: if isWebmaster();
        allow write: if false;
      }
    }

    // ─── CMS Server-Side Drafts ───
    // Drafts are strictly inaccessible to public visitors and ordinary users.
    // Reads and writes occur via server-side Admin SDK endpoints (/api/admin/cms/*).
    match /cms_drafts/{slug} {
      allow read: if isWebmaster();
      allow write: if false;
    }

    // ─── Site Settings (Server-Authoritative Enforcement in Gate 3) ───
    // Public read remains permitted for public theme/feature flags;
    // client writes disabled once all Webmaster settings routes are verified exclusively via /api/admin/settings.
    match /settings/{settingId} {
      allow read: if true;
      allow write: if false;
    }

    // ─── FAQs (Published-Only Public Read + Server-Authoritative Write) ───
    match /faqs/{faqId} {
      allow read: if (resource.data.enabled != false && resource.data.status != 'draft') || isWebmaster();
      allow write: if false;
    }

    // ─── Help Articles (Published-Only Public Read + Server-Authoritative Write) ───
    match /help_articles/{articleId} {
      allow read: if (resource.data.enabled != false && resource.data.status != 'draft') || isWebmaster();
      allow write: if false;
    }
```

### Security & Consistency Notes for Gate 3 Review
1. **Both Root & Artifact Sync:** Ensure root `/firestore.rules` and any artifact rules copy remain 100% synchronized during Gate 3 if approved.
2. **Existing Rules Preservation:** Keep `isWebmaster()` claim/role/UID protections, fail-closed `settings`, `audit_logs` immutability, `users` owner isolation, and `auth_logs` intact.
3. **Draft Isolation:** Even if an attacker sends raw Firestore REST API client queries to `cms_drafts/*`, `versions/*`, disabled `faqs/*`, or draft `help_articles/*`, the proposed rules deny public and ordinary-user reads at the database layer in addition to server-side `/api/cms/*` filtering.

---

## 2. Proposed `firebase-blueprint.json` Additions (Gate 3)

Add entities and paths to `firebase-blueprint.json`:

- **Entities:**
  - `CmsPage`:
    - `slug`: `enum ["about", "faq", "help", "privacy", "terms", "dmca", "disclaimer"]`
    - `title`, `subtitle`, `description`
    - `blocks`: ordered array of validated structured `CmsSectionBlock` objects (`heading`, `paragraph`, `bullet_list`, `numbered_list`, `link`, `notice`, `faq_item`, `steps`, `contact_info`)
    - `seo`: `{ seoTitle, seoDescription, seoKeywords, canonicalUrl, ogTitle, ogImage, noIndex }`
    - `status`: `enum ["draft", "published"]`
    - `version`: number
    - `isLegal`: boolean
    - `updatedAt`, `updatedBy`, `updatedByEmail`, `lastPublishedAt`, `lastPublishedBy`
  - `CmsVersionRecord`:
    - `version`, `slug`, `action` (`"draft_saved" | "published" | "unpublished" | "restored" | "seeded" | "archived_legacy" | "deleted_snapshot"`), `snapshot`, `changedBy`, `changedByEmail`, `changedAt`, `restoredFromVersion`, `note`
  - Update `FaqItem`: add `status` (`"published" | "draft"`), `updatedAt`, `updatedBy`
  - Update `HelpArticle`: add `steps` (`string[]`), `enabled`, `sortOrder`, `status` (`"published" | "draft"`), `updatedAt`, `updatedBy`
- **Firestore Paths:**
  - `/cms_pages/{slug}` -> `$ref: #/entities/CmsPage`
  - `/cms_drafts/{slug}` -> `$ref: #/entities/CmsPage`
  - `/cms_pages/{slug}/versions/{versionId}` -> `$ref: #/entities/CmsVersionRecord`
