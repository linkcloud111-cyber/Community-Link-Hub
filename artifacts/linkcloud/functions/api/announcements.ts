import { jsonResponse, errorResponse, type Env } from "./email-change/_common";
import { firestoreListCollection } from "./email-change/_firestore";

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { env } = context;

  try {
    const all = await firestoreListCollection("announcements", env, 100);
    const now = Date.now();

    const active = all.filter((item: any) => {
      if (item.enabled === false) return false;
      if (item.startAt) {
        const start = new Date(item.startAt).getTime();
        if (!isNaN(start) && start > now) return false;
      }
      if (item.endAt) {
        const end = new Date(item.endAt).getTime();
        if (!isNaN(end) && end < now) return false;
      }
      return true;
    });

    active.sort((a: any, b: any) => {
      const pDiff = (b.priority ?? 10) - (a.priority ?? 10);
      if (pDiff !== 0) return pDiff;
      const tA = a.startAt ? new Date(a.startAt).getTime() : 0;
      const tB = b.startAt ? new Date(b.startAt).getTime() : 0;
      if (tB !== tA) return tB - tA;
      return String(a.id).localeCompare(String(b.id));
    });

    return jsonResponse({
      success: true,
      announcements: active,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to load announcements", 500);
  }
}
