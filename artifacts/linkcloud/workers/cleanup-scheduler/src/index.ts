/**
 * LinkCloud - Unverified Registration Cleanup Scheduler (Cloudflare Worker)
 * 
 * Executes periodically via Cloudflare Worker Cron Triggers to invoke the
 * authoritative cleanup endpoint on Cloudflare Pages.
 * 
 * Cron Expression: * /15 * * * * (Every 15 minutes, UTC)
 * Target Endpoint: https://community-link-hub.pages.dev/api/admin/cleanup-unverified
 */

export interface ScheduledController {
  readonly scheduledTime: number;
  readonly cron: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface Env {
  CLEANUP_ENDPOINT_URL?: string;
  CRON_SECRET: string;
}

export default {
  /**
   * Cloudflare Cron Trigger Handler
   * Automatically triggered by Cloudflare's edge scheduler infrastructure.
   * Runs completely headless without any user browser or session requirement.
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const scheduledTimeIso = new Date(controller.scheduledTime).toISOString();
    const endpointUrl =
      env.CLEANUP_ENDPOINT_URL ||
      "https://community-link-hub.pages.dev/api/admin/cleanup-unverified";

    console.log(`[Scheduler] Cron trigger invoked at ${scheduledTimeIso}. Target: ${endpointUrl}`);

    if (!env.CRON_SECRET) {
      console.error("[Scheduler Error] CRON_SECRET environment secret is not configured on this Worker.");
      return;
    }

    const executionPromise = (async () => {
      try {
        const response = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Cron-Secret": env.CRON_SECRET.trim(),
            "User-Agent": "LinkCloud-Cloudflare-Cron-Scheduler/1.0",
          },
        });

        const status = response.status;
        const responseText = await response.text();

        if (response.ok) {
          console.log(`[Scheduler Success] Status ${status}. Response: ${responseText}`);
        } else {
          console.error(`[Scheduler Failed] Status ${status}. Response: ${responseText}`);
        }
      } catch (err: any) {
        console.error(`[Scheduler Network Error] Failed to reach cleanup endpoint:`, err?.message || err);
      }
    })();

    ctx.waitUntil(executionPromise);
  },

  /**
   * Health-check and manual trigger handler via HTTP
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "linkcloud-cleanup-scheduler",
          schedule: "*/15 * * * * (Every 15 minutes, UTC)",
          endpoint: env.CLEANUP_ENDPOINT_URL || "https://community-link-hub.pages.dev/api/admin/cleanup-unverified",
          hasSecret: Boolean(env.CRON_SECRET),
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      "LinkCloud Cleanup Scheduler Worker.\nCron: */15 * * * * (Every 15 minutes, UTC)\nAccess /health for status.",
      { headers: { "Content-Type": "text/plain" } }
    );
  },
};
