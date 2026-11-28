import type { Env } from "./api/email-change/_common";
import {
  firestoreGetDoc,
  firestoreListCollection,
  firestoreRunQueryField,
} from "./api/email-change/_firestore";
import { buildDynamicSitemapResult } from "../src/lib/seo-builder";

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const mergeUnique = (a: Array<{ id: string; [k: string]: any }>, b: Array<{ id: string; [k: string]: any }>) => {
    const map = new Map<string, { id: string; [k: string]: any }>();
    for (const d of [...a, ...b]) {
      if (d?.id) map.set(d.id, d);
    }
    return Array.from(map.values());
  };

  const result = await buildDynamicSitemapResult(
    {
      getDoc: (path) => firestoreGetDoc(path, env),
      listCollection: (col, limit) => firestoreListCollection(col, env, limit),
      queryApprovedGroups: () =>
        firestoreRunQueryField("groups", "status", "EQUAL", "approved", env, 5000),
      queryDisabledLocations: async () => {
        const [s1, s2, d1, d2, c1, c2] = await Promise.all([
          firestoreRunQueryField("states", "enabled", "EQUAL", false, env, 200).catch(() => []),
          firestoreRunQueryField("states", "status", "EQUAL", "disabled", env, 200).catch(() => []),
          firestoreRunQueryField("districts", "enabled", "EQUAL", false, env, 500).catch(() => []),
          firestoreRunQueryField("districts", "status", "EQUAL", "disabled", env, 500).catch(() => []),
          firestoreRunQueryField("cities", "enabled", "EQUAL", false, env, 500).catch(() => []),
          firestoreRunQueryField("cities", "status", "EQUAL", "disabled", env, 500).catch(() => []),
        ]);
        return {
          states: mergeUnique(s1, s2),
          districts: mergeUnique(d1, d2),
          cities: mergeUnique(c1, c2),
        };
      },
    },
    {
      envOrigin: env.APP_URL || env.VITE_APP_URL || null,
      requestUrl: request.url,
      hostHeader: request.headers.get("host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
    }
  );

  if (result.groupQueryFailed) {
    return new Response("Sitemap temporarily unavailable.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": "300",
        "Cache-Control": "no-store",
      },
    });
  }

  if (result.indexingDisabled) {
    return new Response("Sitemap unavailable while indexing is disabled.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(result.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
