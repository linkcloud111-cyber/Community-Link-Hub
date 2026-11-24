import { errorResponse, type Env } from "../../email-change/_common";
import { requireWebmasterAuth } from "../_admin-common";
import { cfCmsOptions, cfResultResponse, createCloudflareCmsStorage } from "../_cms-cf";
import { handleAdminRestoreCmsVersion } from "../../../../src/server/cms-core";

export async function onRequestOptions(): Promise<Response> {
  return cfCmsOptions("POST, OPTIONS");
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const auth = await requireWebmasterAuth(context.request, context.env);
  if (!auth.valid) return auth.response!;
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }
  const storage = createCloudflareCmsStorage(context.env);
  const res = await handleAdminRestoreCmsVersion(
    storage,
    { uid: auth.uid || "webmaster", email: auth.email || "webmaster@localhost.invalid" },
    body
  );
  return cfResultResponse(res);
}
