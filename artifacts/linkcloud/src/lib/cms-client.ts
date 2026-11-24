import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type {
  CmsAutoSeedResponse,
  CmsPageDocument,
  CmsPageSlug,
  CmsRefreshResponse,
  CmsVersionRecord,
  FAQItem,
  HelpArticle,
} from "./types";

async function parseApiJson(res: Response) {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status} request failed`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function authHeaders(user: User | null): Promise<Record<string, string>> {
  if (!user) {
    throw new Error("Webmaster authentication required.");
  }
  const token = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export interface CmsExplorePageSummary {
  slug: CmsPageSlug;
  route: string;
  title: string;
  subtitle?: string;
  description?: string;
  status: "published";
  isLegalPage: boolean;
  enabled: boolean;
  publicVisible: boolean;
  footerVisible: boolean;
  navVisible: boolean;
  displayOrder: number;
  lastUpdated?: string | null;
  lastPublishedAt?: string | null;
}

let exploreCache: { pages: CmsExplorePageSummary[]; ts: number } | null = null;
let exploreInflight: Promise<CmsExplorePageSummary[]> | null = null;
const EXPLORE_CACHE_TTL_MS = 15_000;
const exploreListeners = new Set<() => void>();

export function invalidateExplorePagesCache(): void {
  exploreCache = null;
  exploreInflight = null;
  exploreListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
}

export async function fetchPublishedCmsPage(
  slug: CmsPageSlug
): Promise<{ published: boolean; disabled: boolean; page: CmsPageDocument | null }> {
  const res = await fetch(`/api/cms/pages?slug=${encodeURIComponent(slug)}`);
  const data = await parseApiJson(res);
  return {
    published: Boolean(data?.published && data?.page),
    disabled: Boolean(data?.disabled),
    page: data?.page || null,
  };
}

export async function fetchPublishedExplorePages(
  forceRefresh = false
): Promise<CmsExplorePageSummary[]> {
  if (!forceRefresh && exploreCache && Date.now() - exploreCache.ts < EXPLORE_CACHE_TTL_MS) {
    return exploreCache.pages;
  }
  if (!forceRefresh && exploreInflight) {
    return exploreInflight;
  }

  exploreInflight = fetch("/api/cms/pages?list=explore")
    .then(parseApiJson)
    .then((data) => {
      const pages = Array.isArray(data?.pages) ? (data.pages as CmsExplorePageSummary[]) : [];
      exploreCache = { pages, ts: Date.now() };
      return pages;
    })
    .finally(() => {
      exploreInflight = null;
    });

  return exploreInflight;
}

export function usePublishedExplorePages() {
  const [pages, setPages] = useState<CmsExplorePageSummary[]>(() => exploreCache?.pages || []);
  const [loading, setLoading] = useState(!exploreCache);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const onInvalidate = () => setReloadTick((t) => t + 1);
    exploreListeners.add(onInvalidate);
    return () => {
      exploreListeners.delete(onInvalidate);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!exploreCache || reloadTick > 0) {
      setLoading(true);
    }
    setError(null);
    fetchPublishedExplorePages(reloadTick > 0)
      .then((list) => {
        if (!active) return;
        setPages(list);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || "Failed to load Explore pages");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadTick]);

  return { pages, loading, error };
}

export function usePublishedCmsPage(slug: CmsPageSlug) {
  const [page, setPage] = useState<CmsPageDocument | null>(null);
  const [published, setPublished] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchPublishedCmsPage(slug)
      .then((res) => {
        if (!active) return;
        setPublished(res.published);
        setDisabled(res.disabled);
        setPage(res.page);
      })
      .catch((err: any) => {
        if (!active) return;
        setPublished(false);
        setDisabled(false);
        setPage(null);
        setError(err?.message || "Failed to load page content");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return { page, published, disabled, loading, error };
}

export async function fetchPublicFaqs(): Promise<FAQItem[]> {
  const res = await fetch("/api/faqs");
  const data = await parseApiJson(res);
  return Array.isArray(data?.faqs) ? data.faqs : [];
}

export async function fetchPublicHelpArticles(): Promise<HelpArticle[]> {
  const res = await fetch("/api/help-articles");
  const data = await parseApiJson(res);
  return Array.isArray(data?.articles) ? data.articles : [];
}

// ─── Webmaster Authenticated CMS APIs ─────────────────────────────────────────

export async function adminFetchCmsOverview(user: User | null, slug?: CmsPageSlug) {
  const headers = await authHeaders(user);
  const q = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  const res = await fetch(`/api/admin/cms/pages${q}`, { headers });
  return parseApiJson(res);
}

export async function adminSaveCmsDraft(
  user: User | null,
  payload: Partial<CmsPageDocument> & { slug: CmsPageSlug; note?: string }
) {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/cms/draft", {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson(res);
  invalidateExplorePagesCache();
  return data;
}

export async function adminPublishCmsPage(
  user: User | null,
  payload: (Partial<CmsPageDocument> & { slug: CmsPageSlug; note?: string }) | { slug: CmsPageSlug }
) {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/cms/publish", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseApiJson(res);
  invalidateExplorePagesCache();
  return data;
}

export async function adminUnpublishCmsPage(user: User | null, slug: CmsPageSlug) {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/cms/unpublish", {
    method: "POST",
    headers,
    body: JSON.stringify({ slug }),
  });
  const data = await parseApiJson(res);
  invalidateExplorePagesCache();
  return data;
}

export async function adminDeleteCmsPage(
  user: User | null,
  slug: CmsPageSlug,
  confirmDeletePublished = false
) {
  const headers = await authHeaders(user);
  const res = await fetch(`/api/admin/cms/page?slug=${encodeURIComponent(slug)}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ slug, confirmDeletePublished }),
  });
  return parseApiJson(res);
}

export async function adminFetchCmsVersions(
  user: User | null,
  slug: CmsPageSlug
): Promise<CmsVersionRecord[]> {
  const headers = await authHeaders(user);
  const res = await fetch(`/api/admin/cms/versions?slug=${encodeURIComponent(slug)}`, { headers });
  const data = await parseApiJson(res);
  return Array.isArray(data?.versions) ? data.versions : [];
}

export async function adminRestoreCmsVersion(
  user: User | null,
  slug: CmsPageSlug,
  versionId: string
) {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/cms/restore", {
    method: "POST",
    headers,
    body: JSON.stringify({ slug, versionId, confirmRestore: true }),
  });
  return parseApiJson(res);
}

export async function adminRunCmsAutoSeed(
  user: User | null,
  dryRun: boolean
): Promise<CmsAutoSeedResponse> {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/cms/seed", {
    method: "POST",
    headers,
    body: JSON.stringify({ dryRun }),
  });
  return parseApiJson(res);
}

export async function adminRunCmsRefresh(user: User | null): Promise<CmsRefreshResponse> {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/cms/refresh", {
    method: "POST",
    headers,
  });
  return parseApiJson(res);
}

// ─── Webmaster FAQ & Help Center APIs ─────────────────────────────────────────

export async function adminListFaqs(user: User | null): Promise<FAQItem[]> {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/faqs", { headers });
  const data = await parseApiJson(res);
  return Array.isArray(data?.faqs) ? data.faqs : [];
}

export async function adminCreateFaq(user: User | null, payload: Omit<FAQItem, "id">) {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/faqs", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  return parseApiJson(res);
}

export async function adminUpdateFaq(
  user: User | null,
  payload: Partial<FAQItem> & { id?: string; reorder?: { id: string; sortOrder: number }[] }
) {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/faqs", {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  return parseApiJson(res);
}

export async function adminDeleteFaq(user: User | null, id: string) {
  const headers = await authHeaders(user);
  const res = await fetch(`/api/admin/faqs?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  return parseApiJson(res);
}

export async function adminListHelpArticles(user: User | null): Promise<HelpArticle[]> {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/help-articles", { headers });
  const data = await parseApiJson(res);
  return Array.isArray(data?.articles) ? data.articles : [];
}

export async function adminCreateHelpArticle(
  user: User | null,
  payload: Omit<HelpArticle, "id">
) {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/help-articles", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  return parseApiJson(res);
}

export async function adminUpdateHelpArticle(
  user: User | null,
  payload: Partial<HelpArticle> & { id?: string; reorder?: { id: string; sortOrder: number }[] }
) {
  const headers = await authHeaders(user);
  const res = await fetch("/api/admin/help-articles", {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  return parseApiJson(res);
}

export async function adminDeleteHelpArticle(user: User | null, id: string) {
  const headers = await authHeaders(user);
  const res = await fetch(`/api/admin/help-articles?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  return parseApiJson(res);
}
