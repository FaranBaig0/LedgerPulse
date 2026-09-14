import crypto from "crypto";

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

/**
 * Generates a PKCE code_verifier and code_challenge (S256)
 */
export function generatePkcePair(): PkcePair {
  // Generate 32 random bytes -> 43 base64url characters
  const verifierBytes = crypto.randomBytes(32);
  const codeVerifier = verifierBytes.toString("base64url");

  // SHA-256 hash of code_verifier
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = hash.toString("base64url");

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256"
  };
}
