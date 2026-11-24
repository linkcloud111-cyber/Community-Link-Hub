import type { Env } from "../../email-change/_common";
import { handleAdminFirestoreError, requireWebmasterAuth } from "../_admin-common";
import { cfCmsOptions, cfResultResponse, createCloudflareCmsStorage } from "../_cms-cf";
import { handleAdminDeleteCmsPage } from "../../../../src/server/cms-core";

export async function onRequestOptions(): Promise<Response> {
  return cfCmsOptions("DELETE, POST, OPTIONS");
}

async function handleDelete(context: { request: Request; env: Env }): Promise<Response> {
  const auth = await requireWebmasterAuth(context.request, context.env);
  if (!auth.valid) return auth.response!;
  const url = new URL(context.request.url);
  let body: any = {};
  try {
    body = await context.request.json();
  } catch {}
  try {
    const storage = createCloudflareCmsStorage(context.env);
    const res = await handleAdminDeleteCmsPage(
      storage,
      { uid: auth.uid || "webmaster", email: auth.email || "webmaster@localhost.invalid" },
      {
        slug: body.slug || url.searchParams.get("slug"),
        confirmDeletePublished:
          body.confirmDeletePublished === true ||
          url.searchParams.get("confirmDeletePublished") === "true",
      }
    );
    return cfResultResponse(res);
  } catch (err: any) {
    return handleAdminFirestoreError(err, "Failed to delete CMS page");
  }
}

export const onRequestDelete = handleDelete;
export const onRequestPost = handleDelete;
