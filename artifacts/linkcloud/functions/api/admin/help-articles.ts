import { errorResponse, type Env } from "../email-change/_common";
import { handleAdminFirestoreError, requireWebmasterAuth } from "./_admin-common";
import { cfCmsOptions, cfResultResponse, createCloudflareCmsStorage } from "./_cms-cf";
import {
  handleAdminCreateHelpArticle,
  handleAdminDeleteHelpArticle,
  handleAdminListHelpArticles,
  handleAdminUpdateHelpArticle,
} from "../../../src/server/cms-core";

export async function onRequestOptions(): Promise<Response> {
  return cfCmsOptions("GET, POST, PUT, PATCH, DELETE, OPTIONS");
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const auth = await requireWebmasterAuth(context.request, context.env);
  if (!auth.valid) return auth.response!;
  try {
    return cfResultResponse(await handleAdminListHelpArticles(createCloudflareCmsStorage(context.env)));
  } catch (err: any) {
    return handleAdminFirestoreError(err, "Failed to load help articles");
  }
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
  try {
    return cfResultResponse(
      await handleAdminCreateHelpArticle(
        createCloudflareCmsStorage(context.env),
        { uid: auth.uid || "webmaster", email: auth.email || "webmaster@localhost.invalid" },
        body
      )
    );
  } catch (err: any) {
    return handleAdminFirestoreError(err, "Failed to create help article");
  }
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
  try {
    return cfResultResponse(
      await handleAdminUpdateHelpArticle(
        createCloudflareCmsStorage(context.env),
        { uid: auth.uid || "webmaster", email: auth.email || "webmaster@linkcloud.in" },
        body
      )
    );
  } catch (err: any) {
    return handleAdminFirestoreError(err, "Failed to update help article");
  }
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
  try {
    return cfResultResponse(
      await handleAdminDeleteHelpArticle(
        createCloudflareCmsStorage(context.env),
        { uid: auth.uid || "webmaster", email: auth.email || "webmaster@linkcloud.in" },
        url.searchParams.get("id") || body.id
      )
    );
  } catch (err: any) {
    return handleAdminFirestoreError(err, "Failed to delete help article");
  }
}
