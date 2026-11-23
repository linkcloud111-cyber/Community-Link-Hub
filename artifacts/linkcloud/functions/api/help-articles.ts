import type { Env } from "./email-change/_common";
import { handlePublicGetHelpArticles } from "../../src/server/cms-core";
import { cfCmsOptions, cfResultResponse, createCloudflareCmsStorage } from "./admin/_cms-cf";

export async function onRequestOptions(): Promise<Response> {
  return cfCmsOptions("GET, OPTIONS");
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const storage = createCloudflareCmsStorage(context.env);
  const result = await handlePublicGetHelpArticles(storage);
  return cfResultResponse(result);
}
