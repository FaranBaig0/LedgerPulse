import { Request, Response, NextFunction } from "express";
import { EtsyCallbackQuerySchema } from "./etsy.schema.js";
import { EtsyAuthService } from "./etsy.auth.service.js";

export class EtsyAuthController {
  /**
   * Initiates Etsy PKCE OAuth redirect
   * GET /api/v1/auth/etsy
   */
  static async initOAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const apiKey = process.env.ETSY_API_KEY;
      const isDummyKey = !apiKey || apiKey.startsWith("dummy") || apiKey.startsWith("your_");

      if (isDummyKey) {
        // Development / Sandbox direct channel connection fallback
        const result = await EtsyAuthService.connectDirect(req.context.tenantId, "my-etsy-shop");
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        res.redirect(`${frontendUrl}/integrations?status=success&platform=etsy&store=${encodeURIComponent(result.storeIdentifier)}`);
        return;
      }

      const authUrl = EtsyAuthService.getAuthorizationUrl(req.context.tenantId);
      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Etsy OAuth callback route
   * GET /api/v1/auth/etsy/callback
   */
  static async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    try {
      const queryParams = EtsyCallbackQuerySchema.parse(req.query);
      const result = await EtsyAuthService.handleCallback(queryParams);

      res.redirect(`${frontendUrl}/integrations?status=success&platform=etsy&store=${encodeURIComponent(result.storeIdentifier)}`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "OAuth failed";
      res.redirect(`${frontendUrl}/integrations?status=error&platform=etsy&error=${encodeURIComponent(errorMsg)}`);
    }
  }
}
