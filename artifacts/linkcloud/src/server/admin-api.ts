import type { IncomingMessage, ServerResponse } from "http";
import { initializeApp, getApps, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App | null = null;

export function getFirebaseAdminApp(): App | null {
  if (adminApp) return adminApp;
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    adminApp = existingApps[0];
    return adminApp;
  }

  try {
    const projectId =
      process.env.VITE_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      "linkcloud-app";

    adminApp = initializeApp({
      projectId,
    });
    return adminApp;
  } catch (err) {
    console.warn("[Firebase Admin SDK] Initialization notice:", err);
    return null;
  }
}

export async function handleAdminUserStatusRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const { uid, status, webmasterEmail, webmasterUid } = data;

      if (!uid || typeof uid !== "string") {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Missing or invalid 'uid' parameter." }));
        return;
      }

      // Self-protection check
      if (
        (uid === webmasterUid || (webmasterEmail?.toLowerCase() === "linkcloud111@gmail.com" && uid === webmasterUid)) &&
        (status === "suspended" || status === "banned" || status === "deleted")
      ) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "Self-Protection: You cannot suspend or ban your active Webmaster account.",
          })
        );
        return;
      }

      const shouldDisable = status === "suspended" || status === "banned";
      let authUpdated = false;
      let authError: string | null = null;

      try {
        const app = getFirebaseAdminApp();
        if (app) {
          const auth = getAuth(app);
          await auth.updateUser(uid, { disabled: shouldDisable });
          if (shouldDisable) {
            try {
              await auth.revokeRefreshTokens(uid);
            } catch (revokeErr) {
              console.warn(`[Firebase Admin] Revoke refresh tokens note for ${uid}:`, revokeErr);
            }
          }
          authUpdated = true;
          console.log("[WEBMASTER AUTH ADMIN]", {
            Action: shouldDisable ? "DISABLE_USER_AUTH" : "ENABLE_USER_AUTH",
            UID: uid,
            TargetStatus: status,
            Disabled: shouldDisable,
            Result: "SUCCESS",
            FirebaseAuthResult: "SUCCESS",
          });
        } else {
          console.warn("[Firebase Admin SDK] Admin app instance not active; proceeding with Firestore sync.");
        }
      } catch (authErr: any) {
        authError = authErr?.message || String(authErr);
        console.warn(`[Firebase Admin] Auth update error for UID '${uid}':`, authError);
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          uid,
          status,
          disabled: shouldDisable,
          authUpdated,
          authError,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (parseErr) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON payload." }));
    }
  });
}

export async function handleAdminUserDeleteRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const { uid, webmasterEmail, webmasterUid } = data;

      if (!uid || typeof uid !== "string") {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Missing or invalid 'uid' parameter." }));
        return;
      }

      // Self-protection check
      if (
        uid === webmasterUid ||
        (webmasterEmail?.toLowerCase() === "linkcloud111@gmail.com" && uid === webmasterUid)
      ) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "Self-Protection: You cannot delete your active Webmaster account.",
          })
        );
        return;
      }

      let authDeleted = false;
      let authError: string | null = null;

      try {
        const app = getFirebaseAdminApp();
        if (app) {
          const auth = getAuth(app);
          await auth.deleteUser(uid);
          authDeleted = true;
          console.log("[WEBMASTER AUTH ADMIN]", {
            Action: "DELETE_USER_AUTH",
            UID: uid,
            Result: "SUCCESS",
            FirebaseAuthResult: "SUCCESS",
            AuthUserVerifiedDeleted: true,
          });
        }
      } catch (authErr: any) {
        authError = authErr?.message || String(authErr);
        console.warn(`[Firebase Admin] Auth deletion notice for UID '${uid}':`, authError);
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          uid,
          authDeleted,
          authError,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (parseErr) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON payload." }));
    }
  });
}
