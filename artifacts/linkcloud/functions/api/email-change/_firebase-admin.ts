import { getServiceAccount, type Env } from "./_common";
export { getServiceAccount };

// Cache Firebase Admin OAuth2 access token to avoid round-trips
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): Uint8Array {
  const cleanPem = pem
    .replace(/-----BEGIN[ A-Z_-]+-----/g, "")
    .replace(/-----END[ A-Z_-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(cleanPem);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));
  const unsignedToken = `${encodedHeader}.${encodedClaim}`;

  const keyBytes = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signature = base64UrlEncode(new Uint8Array(signatureBuffer));
  const signedJwt = `${unsignedToken}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Failed to acquire Google access token: ${tokenRes.status} ${text}`);
  }

  const tokenData: any = await tokenRes.json();
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600),
  };

  return cachedAccessToken.token;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

let cachedSecureTokenJwks: { keys: any[]; expiresAt: number } | null = null;

async function getGoogleSecureTokenJwks(): Promise<any[]> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedSecureTokenJwks && cachedSecureTokenJwks.expiresAt > now) {
    return cachedSecureTokenJwks.keys;
  }

  const res = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Google Secure Token JWKs (${res.status})`);
  }

  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 300;
  const data: any = await res.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  if (keys.length === 0) {
    throw new Error("Google Secure Token JWK response contained no keys");
  }

  cachedSecureTokenJwks = {
    keys,
    expiresAt: now + Math.max(60, maxAgeSec),
  };
  return keys;
}

/**
 * Verify a Firebase ID Token using Identity Toolkit (when SA is configured)
 * or cryptographic RS256 verification against Google Secure Token JWKs.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  env: Env
): Promise<{ uid: string; email?: string; [key: string]: any }> {
  const serviceAccount = getServiceAccount(env);
  if (serviceAccount) {
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ID token verification failed: ${errText}`);
    }

    const data: any = await res.json();
    const user = data.users?.[0];
    if (!user) {
      throw new Error("No user record found for token.");
    }
    return {
      uid: user.localId,
      email: user.email,
      emailVerified: user.emailVerified,
    };
  }

  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || "linkcloud-5bb2f";
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT token format");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(encodedHeader)));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(encodedPayload)));

  if (header.alg !== "RS256" || !header.kid || typeof header.kid !== "string") {
    throw new Error("Unsupported or missing JWT signing header");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("ID token has expired");
  }
  if (typeof payload.iat !== "number" || payload.iat > now + 300) {
    throw new Error("ID token issued-at time is invalid");
  }
  if (payload.aud !== projectId) {
    throw new Error("ID token audience mismatch");
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("ID token issuer mismatch");
  }
  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!sub || sub.length > 128) {
    throw new Error("ID token subject claim is invalid");
  }

  const jwks = await getGoogleSecureTokenJwks();
  const matchingJwk = jwks.find((k: any) => k.kid === header.kid);
  if (!matchingJwk) {
    // Bust cache once in case keys rotated
    cachedSecureTokenJwks = null;
    const freshJwks = await getGoogleSecureTokenJwks();
    const retryJwk = freshJwks.find((k: any) => k.kid === header.kid);
    if (!retryJwk) {
      throw new Error("Unable to locate matching signing key for ID token");
    }
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      retryJwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = base64UrlToUint8Array(encodedSignature);
    const signedBytes = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sigBytes.buffer as ArrayBuffer, signedBytes);
    if (!verified) {
      throw new Error("ID token cryptographic signature verification failed");
    }
  } else {
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      matchingJwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = base64UrlToUint8Array(encodedSignature);
    const signedBytes = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sigBytes.buffer as ArrayBuffer, signedBytes);
    if (!verified) {
      throw new Error("ID token cryptographic signature verification failed");
    }
  }

  return {
    uid: sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
  };
}

/**
 * Update user email in Firebase Auth via Identity Toolkit Admin API
 */
export async function adminUpdateUserEmail(
  uid: string,
  newEmail: string,
  env: Env
): Promise<void> {
  const serviceAccount = getServiceAccount(env);
  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is required for admin email update");
  }

  const accessToken = await getGoogleAccessToken(serviceAccount);
  const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      localId: uid,
      email: newEmail,
      emailVerified: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update Firebase Auth email: ${res.status} ${text}`);
  }
}

/**
 * Mint a Firebase Custom Token for a given UID using the service account private key.
 * Follows Firebase Custom Token JWT specification with RS256 algorithm.
 */
export async function adminCreateCustomToken(
  env: Env,
  uid: string,
  additionalClaims?: Record<string, any>
): Promise<string> {
  const serviceAccount = getServiceAccount(env);
  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is required to create custom token");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload: any = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid: uid,
  };
  if (additionalClaims && typeof additionalClaims === "object") {
    payload.claims = additionalClaims;
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const keyBytes = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signature = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${unsignedToken}.${signature}`;
}
