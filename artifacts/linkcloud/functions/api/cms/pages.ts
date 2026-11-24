import type { Env } from "../email-change/_common";
import { handlePublicGetCmsPage } from "../../../src/server/cms-core";
import { cfCmsOptions, cfResultResponse, createCloudflareCmsStorage } from "../admin/_cms-cf";

export async function onRequestOptions(): Promise<Response> {
  return cfCmsOptions("GET, OPTIONS");
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get("slug");
  const includeDrafts = url.searchParams.get("includeDrafts");
  const list = url.searchParams.get("list");
  const storage = createCloudflareCmsStorage(context.env);
  const result = await handlePublicGetCmsPage(storage, slug, { includeDrafts, list });
  return cfResultResponse(result);
}
