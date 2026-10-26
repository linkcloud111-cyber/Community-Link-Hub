import { jsonResponse, errorResponse, type Env } from "../email-change/_common";
import { firestoreGetDoc } from "../email-change/_firestore";
import { getServiceAccount } from "../email-change/_common";
import { getGoogleAccessToken } from "../email-change/_firebase-admin";

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  try {
    const body: any = await request.json().catch(() => ({}));
    const rawKeyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";

    if (rawKeyword.length < 2 || rawKeyword.length > 60) {
      return errorResponse("Invalid keyword length", 400);
    }

    if (/[<>{}[\]\\"'`;]/.test(rawKeyword)) {
      return errorResponse("Keyword contains invalid characters", 400);
    }

    const cleanKeyword = rawKeyword.toLowerCase().replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().slice(0, 60);
    if (cleanKeyword.length < 2) {
      return errorResponse("Keyword contains only invalid characters", 400);
    }

    const serviceAccount = getServiceAccount(env);
    if (!serviceAccount) {
      return jsonResponse({ success: true, mode: "unconfigured" });
    }

    const token = await getGoogleAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id || env.FIREBASE_PROJECT_ID || "linkcloud-5bb2f";
    const docPath = `projects/${projectId}/databases/(default)/documents/search_logs/${cleanKeyword}`;

    const existing = await firestoreGetDoc(`search_logs/${cleanKeyword}`, env);
    const currentCount = typeof existing?.count === "number" ? existing.count : 0;
    const newCount = currentCount + 1;

    const fields: Record<string, any> = {
      keyword: { stringValue: cleanKeyword },
      count: { integerValue: newCount.toString() },
      updatedAt: { timestampValue: new Date().toISOString() },
    };

    if (typeof body?.category === "string" && body.category.trim().length > 0) {
      fields.category = { stringValue: body.category.trim().slice(0, 50) };
    }
    if (typeof body?.platform === "string" && body.platform.trim().length > 0) {
      fields.platform = { stringValue: body.platform.trim().slice(0, 50) };
    }
    if (typeof body?.language === "string" && body.language.trim().length > 0) {
      fields.language = { stringValue: body.language.trim().slice(0, 50) };
    }
    if (typeof body?.location === "string" && body.location.trim().length > 0) {
      fields.location = { stringValue: body.location.trim().slice(0, 50) };
    }

    const maskParams = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
    const updateUrl = `https://firestore.googleapis.com/v1/${docPath}?${maskParams}`;

    await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to record search telemetry", 500);
  }
}
