import type { Env } from "../../email-change/_common";
import { requireWebmasterAuth } from "../_admin-common";
import { cfCmsOptions, cfResultResponse, createCloudflareCmsStorage } from "../_cms-cf";
import { handleAdminGetCmsPages } from "../../../../src/server/cms-core";

export async function onRequestOptions(): Promise<Response> {
  return cfCmsOptions("GET, OPTIONS");
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const auth = await requireWebmasterAuth(context.request, context.env);
  if (!auth.valid) return auth.response!;
  const url = new URL(context.request.url);
  const storage = createCloudflareCmsStorage(context.env);
  const res = await handleAdminGetCmsPages(storage, url.searchParams.get("slug"));
  return cfResultResponse(res);
}
