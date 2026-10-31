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

const visitorRateMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = visitorRateMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    visitorRateMap.set(ip, { count: 1, resetAt: now + windowMs });
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

  if (!checkRateLimit(clientIp, 20, 60000)) {
    return errorResponse("Too many telemetry requests. Please slow down.", 429);
  }

  // Request size limit guard
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 1024) {
    return errorResponse("Payload too large", 413);
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const serviceAccount = getServiceAccount(env);
    if (!serviceAccount) {
      return jsonResponse({ success: true, mode: "unconfigured" });
    }

    const token = await getGoogleAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id || env.FIREBASE_PROJECT_ID || "linkcloud-5bb2f";
    const docPath = `projects/${projectId}/databases/(default)/documents/visitor_stats/${today}`;

    // Read current doc to increment in REST API
    const existing = await firestoreGetDoc(`visitor_stats/${today}`, env);
    const currentCount = typeof existing?.count === "number" ? existing.count : 0;
    const newCount = currentCount + 1;

    const updateUrl = `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=date&updateMask.fieldPaths=count&updateMask.fieldPaths=lastHitAt`;
    await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          date: { stringValue: today },
          count: { integerValue: newCount.toString() },
          lastHitAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to record visitor hit", 500);
  }
}
