import { jsonResponse, type Env } from "../../email-change/_common";
import { firestoreGetDoc } from "../../email-change/_firestore";
import { requireWebmasterAuth } from "../_admin-common";

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

  const sequenceData = await firestoreGetDoc("counters/userSequence", env);

  const report = {
    dryRun: true,
    timestamp: new Date().toISOString(),
    sequence: sequenceData || { currentNumber: 100, prefix: "linkcloud" },
    status: "READY_FOR_SEQUENTIAL_PROVISIONING",
  };

  return jsonResponse({
    success: true,
    report,
  });
}
