import crypto from "crypto";

const STATE_SECRET = process.env.JWT_SECRET || "oauth-state-secret-key-change-in-production";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes expiry

export interface OAuthStatePayload {
  tenantId: string;
  platform: "SHOPIFY" | "ETSY";
  nonce: string;
  codeVerifier?: string;
  timestamp: number;
}

/**
 * Encodes and signs OAuth state object to prevent CSRF and state tampering
 */
export function generateOAuthState(payload: Omit<OAuthStatePayload, "timestamp" | "nonce">): { state: string; nonce: string; codeVerifier?: string } {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const fullPayload: OAuthStatePayload = {
    ...payload,
    nonce,
    timestamp
  };

  const payloadBase64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(payloadBase64)
    .digest("base64url");

  const state = `${payloadBase64}.${signature}`;
  return { state, nonce, codeVerifier: payload.codeVerifier };
}

/**
 * Verifies OAuth state string and returns payload if valid
 */
export function verifyOAuthState(state: string): OAuthStatePayload {
  const parts = state.split(".");
  if (parts.length !== 2) {
    throw new Error("INVALID_STATE_FORMAT");
  }

  const [payloadBase64, signature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(payloadBase64)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error("STATE_HMAC_MISMATCH");
  }

  const payloadText = Buffer.from(payloadBase64, "base64url").toString("utf8");
  const payload = JSON.parse(payloadText) as OAuthStatePayload;

  if (Date.now() - payload.timestamp > STATE_TTL_MS) {
    throw new Error("STATE_EXPIRED");
  }

  return payload;
}
