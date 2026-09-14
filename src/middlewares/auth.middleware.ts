import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";

/**
 * Authentication & Multi-Tenancy Middleware
 * Verifies JWT token from Authorization header and injects tenantId and userId into req.context.
 */
export function authenticateTenant(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.query.token && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Authorization token missing or malformed. Expected 'Bearer <token>' or '?token=<jwt>'"
    });
    return;
  }

  try {
    const decoded = verifyToken(token);

    req.context = {
      tenantId: decoded.tenantId,
      userId: decoded.userId
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Invalid or expired authorization token"
    });
    return;
  }
}
