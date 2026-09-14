import jwt, { Secret } from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
}

const JWT_SECRET: Secret = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

/**
 * Sign a JWT token containing userId, tenantId, and email
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d"
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  
  if (typeof decoded === "string" || !decoded.userId || !decoded.tenantId || !decoded.email) {
    throw new Error("Invalid token payload structure");
  }

  return {
    userId: decoded.userId as string,
    tenantId: decoded.tenantId as string,
    email: decoded.email as string
  };
}
