import { errorResponse, type Env } from "../email-change/_common";
import { requireWebmasterAuth } from "./_admin-common";
import { cfCmsOptions, cfResultResponse, createCloudflareCmsStorage } from "./_cms-cf";
import {
  handleAdminCreateFaq,
  handleAdminDeleteFaq,
  handleAdminListFaqs,
  handleAdminUpdateFaq,
} from "../../../src/server/cms-core";

export async function onRequestOptions(): Promise<Response> {
  return cfCmsOptions("GET, POST, PUT, PATCH, DELETE, OPTIONS");
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const auth = await requireWebmasterAuth(context.request, context.env);
  if (!auth.valid) return auth.response!;
  return cfResultResponse(await handleAdminListFaqs(createCloudflareCmsStorage(context.env)));
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const auth = await requireWebmasterAuth(context.request, context.env);
  if (!auth.valid) return auth.response!;
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }
  return cfResultResponse(
    await handleAdminCreateFaq(
      createCloudflareCmsStorage(context.env),
      { uid: auth.uid || "webmaster", email: auth.email || "webmaster@linkcloud.in" },
      body
    )
  );
}

async function handlePutPatch(context: { request: Request; env: Env }): Promise<Response> {
  const auth = await requireWebmasterAuth(context.request, context.env);
  if (!auth.valid) return auth.response!;
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }
  return cfResultResponse(
    await handleAdminUpdateFaq(
      createCloudflareCmsStorage(context.env),
      { uid: auth.uid || "webmaster", email: auth.email || "webmaster@linkcloud.in" },
      body
    )
  );
}

export const onRequestPut = handlePutPatch;
export const onRequestPatch = handlePutPatch;

export async function onRequestDelete(context: { request: Request; env: Env }): Promise<Response> {
  const auth = await requireWebmasterAuth(context.request, context.env);
  if (!auth.valid) return auth.response!;
  const url = new URL(context.request.url);
  let body: any = {};
  try {
    body = await context.request.json();
  } catch {}
  return cfResultResponse(
    await handleAdminDeleteFaq(
      createCloudflareCmsStorage(context.env),
      { uid: auth.uid || "webmaster", email: auth.email || "webmaster@linkcloud.in" },
      url.searchParams.get("id") || body.id
    )
  );
}
