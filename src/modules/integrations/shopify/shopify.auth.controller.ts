import { Request, Response, NextFunction } from "express";
import { ShopifyInitOAuthQuerySchema, ShopifyCallbackQuerySchema } from "./shopify.schema.js";
import { ShopifyAuthService } from "./shopify.auth.service.js";

export class ShopifyAuthController {
  /**
   * Initiates Shopify OAuth redirect
   * GET /api/v1/auth/shopify?shop=my-store.myshopify.com
   */
  static async initOAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { shop } = ShopifyInitOAuthQuerySchema.parse(req.query);
      const apiKey = process.env.SHOPIFY_API_KEY;
      const isDummyKey = !apiKey || apiKey.startsWith("dummy") || apiKey.startsWith("your_");

      if (isDummyKey) {
        // Development / Sandbox direct channel connection fallback
        const result = await ShopifyAuthService.connectDirect(req.context.tenantId, shop);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        res.redirect(`${frontendUrl}/integrations?status=success&platform=shopify&store=${encodeURIComponent(result.storeIdentifier)}`);
        return;
      }

      const authUrl = ShopifyAuthService.getAuthorizationUrl(shop, req.context.tenantId);
      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Shopify OAuth callback route
   * GET /api/v1/auth/shopify/callback
   */
  static async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    try {
      const queryParams = ShopifyCallbackQuerySchema.parse(req.query);
      const result = await ShopifyAuthService.handleCallback(queryParams);

      res.redirect(`${frontendUrl}/integrations?status=success&platform=shopify&store=${encodeURIComponent(result.storeIdentifier)}`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "OAuth failed";
      res.redirect(`${frontendUrl}/integrations?status=error&platform=shopify&error=${encodeURIComponent(errorMsg)}`);
    }
  }
}
