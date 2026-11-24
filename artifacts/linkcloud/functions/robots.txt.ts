import type { Env } from "./api/email-change/_common";
import { firestoreGetDoc, firestoreListCollection } from "./api/email-change/_firestore";
import { buildDynamicRobotsTxt } from "../src/server/seo-endpoints";

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const body = await buildDynamicRobotsTxt(
    {
      getDoc: (path) => firestoreGetDoc(path, env),
      listCollection: (col, limit) => firestoreListCollection(col, env, limit),
    },
    {
      envOrigin: env.APP_URL || env.VITE_APP_URL || null,
      requestUrl: request.url,
      hostHeader: request.headers.get("host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
    }
  );

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
