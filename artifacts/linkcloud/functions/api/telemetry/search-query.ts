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

const searchRateMap = new Map<string, { count: number; resetAt: number }>();
function checkSearchRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = searchRateMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    searchRateMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Rate limiting guard
  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (!checkSearchRateLimit(clientIp, 40, 60000)) {
    return errorResponse("Too many search requests. Please slow down.", 429);
  }

  // Request size limit guard
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 2048) {
    return errorResponse("Payload too large", 413);
  }

  try {
    const body: any = await request.json().catch(() => ({}));
    const rawKeyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";

    if (rawKeyword.length < 2 || rawKeyword.length > 60) {
      return errorResponse("Invalid keyword length", 400);
    }

    if (/[<>{}[\]\\"'`;]/.test(rawKeyword)) {
      return errorResponse("Keyword contains invalid characters", 400);
    }

    // Strip remaining unsafe characters, allow Unicode letters/marks (Hindi/Indic scripts), numbers, spaces, hyphens, underscores
    const cleanKeyword = rawKeyword.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M}\p{N}\s\-_]/gu, "").trim().slice(0, 60);
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
