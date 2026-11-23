import type { Env } from "../../email-change/_common";
import { requireWebmasterAuth } from "../_admin-common";
import { cfCmsOptions, cfResultResponse, createCloudflareCmsStorage } from "../_cms-cf";
import { handleAdminCmsRefresh } from "../../../../src/server/cms-core";

export async function onRequestOptions(): Promise<Response> {
  return cfCmsOptions("POST, GET, OPTIONS");
}

async function handleRefresh(context: { request: Request; env: Env }): Promise<Response> {
  const auth = await requireWebmasterAuth(context.request, context.env);
  if (!auth.valid) return auth.response!;
  const storage = createCloudflareCmsStorage(context.env);
  const res = await handleAdminCmsRefresh(storage, {
    uid: auth.uid || "webmaster",
    email: auth.email || "webmaster@linkcloud.in",
  });
  return cfResultResponse(res);
}

export const onRequestPost = handleRefresh;
export const onRequestGet = handleRefresh;
