import { getServiceAccount, type Env } from "./_common";

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

/**
 * Verify a Firebase ID Token using Google Identity Toolkit API.
 * Returns the decoded token payload or throws an error.
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
      body: JSON.stringify({ idToken: [idToken] }),
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

  // Fallback if service account is not yet provided: decode JWT payload without verification
  // and check expiration
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT token format");
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error("ID token has expired");
    }
    return {
      uid: payload.user_id || payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
    };
  } catch (err: any) {
    throw new Error(`Failed to verify ID token: ${err.message}`);
  }
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
