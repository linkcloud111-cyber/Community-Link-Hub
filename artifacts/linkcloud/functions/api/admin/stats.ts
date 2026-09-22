import { jsonResponse, type Env } from "../email-change/_common";
import { firestoreGetDoc } from "../email-change/_firestore";
import { requireWebmasterAuth } from "./_admin-common";

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const auth = await requireWebmasterAuth(request, env);
  if (!auth.valid) {
    return auth.response!;
  }

  const userSequence = await firestoreGetDoc("counters/userSequence", env);

  return jsonResponse({
    success: true,
    stats: {
      userSequence: userSequence || { currentNumber: 100, prefix: "linkcloud" },
    },
    timestamp: new Date().toISOString(),
  });
}
