import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { MetaAdsService } from "../../services/metaAds.service.js";
import { GoogleAdsService } from "../../services/googleAds.service.js";
import { prisma, getTenantPrisma } from "../../lib/prisma.js";
import { AdPlatform } from "@prisma/client";
import { verifyOAuthStateAsync } from "../../lib/oauthState.js";
import { encryptToken } from "../../lib/encryption.js";
import { setCacheWithTTL, getCache, deleteCache } from "../../lib/redis.js";

export class AdSpendController {
  /**
   * GET /api/v1/adspend/accounts
   * List all connected ad accounts for the authenticated tenant
   */
  static async getAdAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const tenantPrisma = getTenantPrisma(req.context.tenantId);
      const accounts = await tenantPrisma.adAccount.findMany({
        where: { tenantId: req.context.tenantId, isActive: true },
        select: {
          id: true,
          platform: true,
          adAccountId: true,
          accountName: true,
          isActive: true,
          createdAt: true
        }
      });

      res.status(200).json({
        success: true,
        data: accounts
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/adspend/oauth/meta/url
   * Generate official Meta OAuth consent URL
   */
  static async getMetaAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/v1/adspend/oauth/meta/callback`;
      const { url } = MetaAdsService.getAuthUrl(req.context.tenantId, redirectUri);

      res.status(200).json({ success: true, url });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/adspend/oauth/meta/callback
   * OAuth callback for Meta Ads: validates state, exchanges code for long-lived token, fetches ad accounts, stashes setup session in Redis
   */
  static async handleMetaCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error: oauthError, error_description } = req.query;

      if (oauthError) {
        res.redirect(`http://localhost:3000/integrations?error=${encodeURIComponent(String(error_description || oauthError))}`);
        return;
      }

      if (!code || !state) {
        res.redirect("http://localhost:3000/integrations?error=MISSING_CODE_OR_STATE");
        return;
      }

      const payload = await verifyOAuthStateAsync(String(state));
      const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/v1/adspend/oauth/meta/callback`;

      const tokenData = await MetaAdsService.exchangeCodeForLongLivedToken(String(code), redirectUri);
      const accounts = await MetaAdsService.fetchAccessibleAccounts(tokenData.accessToken);

      const setupSessionId = crypto.randomUUID();
      const encryptedAccessToken = encryptToken(tokenData.accessToken);

      const setupPayload = {
        tenantId: payload.tenantId,
        platform: "META",
        encryptedAccessToken,
        expiresAt: tokenData.expiresAt,
        accounts
      };

      await setCacheWithTTL(`oauth:setup:${setupSessionId}`, JSON.stringify(setupPayload), 900); // 15 mins TTL

      res.redirect(`http://localhost:3000/integrations?setupSessionId=${setupSessionId}&platform=META`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.redirect(`http://localhost:3000/integrations?error=${encodeURIComponent(msg)}`);
    }
  }

  /**
   * GET /api/v1/adspend/oauth/google/url
   * Generate official Google Ads OAuth consent URL with offline access
   */
  static async getGoogleAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/v1/adspend/oauth/google/callback`;
      const { url } = GoogleAdsService.getAuthUrl(req.context.tenantId, redirectUri);

      res.status(200).json({ success: true, url });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/adspend/oauth/google/callback
   * OAuth callback for Google Ads: validates state, exchanges code for access & refresh tokens, fetches v18 accounts, stashes session in Redis
   */
  static async handleGoogleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        res.redirect(`http://localhost:3000/integrations?error=${encodeURIComponent(String(oauthError))}`);
        return;
      }

      if (!code || !state) {
        res.redirect("http://localhost:3000/integrations?error=MISSING_CODE_OR_STATE");
        return;
      }

      const payload = await verifyOAuthStateAsync(String(state));
      const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/v1/adspend/oauth/google/callback`;

      const tokenData = await GoogleAdsService.exchangeCodeForToken(String(code), redirectUri);
      const accounts = await GoogleAdsService.fetchAccessibleAccounts(tokenData.accessToken);

      const setupSessionId = crypto.randomUUID();
      const encryptedAccessToken = encryptToken(tokenData.accessToken);
      const encryptedRefreshToken = tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : undefined;

      const setupPayload = {
        tenantId: payload.tenantId,
        platform: "GOOGLE",
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt: tokenData.expiresAt,
        accounts
      };

      await setCacheWithTTL(`oauth:setup:${setupSessionId}`, JSON.stringify(setupPayload), 900); // 15 mins TTL

      res.redirect(`http://localhost:3000/integrations?setupSessionId=${setupSessionId}&platform=GOOGLE`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.redirect(`http://localhost:3000/integrations?error=${encodeURIComponent(msg)}`);
    }
  }

  /**
   * GET /api/v1/adspend/setup-session/:sessionId
   * Retrieve temporary accessible accounts list for dropdown population
   */
  static async getSetupAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const cached = await getCache(`oauth:setup:${sessionId}`);

      if (!cached) {
        res.status(404).json({ error: "SESSION_EXPIRED", message: "Setup session expired or invalid" });
        return;
      }

      const session = JSON.parse(cached);
      res.status(200).json({
        success: true,
        data: {
          platform: session.platform,
          accounts: session.accounts
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/adspend/accounts
   * Finalize linking an ad account for the tenant (supports setupSessionId or direct adAccountId for dev testing)
   */
  static async addAdAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { platform, adAccountId, accountName, setupSessionId } = req.body;
      const cleanPlatform = (platform?.toString().toUpperCase() || "META") as AdPlatform;

      let finalAccountId = adAccountId ? adAccountId.trim().replace(/^act_/, "") : "";
      let finalAccountName = accountName;
      let encryptedToken: string | null = null;
      let encryptedRefreshToken: string | null = null;

      if (setupSessionId) {
        const cached = await getCache(`oauth:setup:${setupSessionId}`);
        if (cached) {
          const session = JSON.parse(cached);
          encryptedToken = session.encryptedAccessToken || null;
          encryptedRefreshToken = session.encryptedRefreshToken || null;

          if (!finalAccountId && session.accounts && session.accounts.length > 0) {
            finalAccountId = session.accounts[0].id.replace(/^act_/, "");
            finalAccountName = session.accounts[0].name;
          }

          // Delete consumed setup session
          await deleteCache(`oauth:setup:${setupSessionId}`);
        }
      }

      if (!finalAccountId) {
        res.status(400).json({ error: "BAD_REQUEST", message: "Missing adAccountId or setupSessionId" });
        return;
      }

      const tenantPrisma = getTenantPrisma(req.context.tenantId);
      const adAccount = await tenantPrisma.adAccount.upsert({
        where: {
          tenantId_platform_adAccountId: {
            tenantId: req.context.tenantId,
            platform: cleanPlatform,
            adAccountId: finalAccountId
          }
        },
        update: {
          accountName: finalAccountName || `${cleanPlatform} Ad Account (${finalAccountId})`,
          encryptedToken: encryptedToken || undefined,
          encryptedRefreshToken: encryptedRefreshToken || undefined,
          isActive: true
        },
        create: {
          tenantId: req.context.tenantId,
          platform: cleanPlatform,
          adAccountId: finalAccountId,
          accountName: finalAccountName || `${cleanPlatform} Ad Account (${finalAccountId})`,
          encryptedToken,
          encryptedRefreshToken,
          isActive: true
        }
      });

      // Auto-trigger initial ad spend sync for this account
      if (cleanPlatform === "META") {
        try {
          await MetaAdsService.syncTenantAdSpend(req.context.tenantId, finalAccountId);
        } catch (syncErr) {
          console.warn(`[AdSpendController] Initial Meta sync warning for ${finalAccountId}:`, syncErr);
        }
      } else if (cleanPlatform === "GOOGLE") {
        try {
          await GoogleAdsService.syncTenantAdSpend(req.context.tenantId, finalAccountId);
        } catch (syncErr) {
          console.warn(`[AdSpendController] Initial Google sync warning for ${finalAccountId}:`, syncErr);
        }
      }

      res.status(200).json({
        success: true,
        message: `${cleanPlatform} Ad Account connected successfully`,
        data: adAccount
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/adspend/accounts/:id
   * Disconnect an ad account for the authenticated tenant
   */
  static async deleteAdAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { id } = req.params;
      const tenantPrisma = getTenantPrisma(req.context.tenantId);

      await tenantPrisma.adAccount.delete({
        where: { id, tenantId: req.context.tenantId }
      });

      res.status(200).json({
        success: true,
        message: "Ad Account disconnected successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/adspend/meta/sync
   * Trigger rolling 3-day Meta Ads Insights API sync for a tenant's ad account
   */
  static async syncMetaAds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { adAccountId = "act_demo123456", accessToken } = req.body;

      const result = await MetaAdsService.syncTenantAdSpend(
        req.context.tenantId,
        adAccountId,
        accessToken
      );

      res.status(200).json({
        success: true,
        message: "Meta Ads daily spend synchronized successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/adspend/google/sync
   * Trigger Google Ads Shopping & Performance Max daily spend sync
   */
  static async syncGoogleAds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { customerId = "123-456-7890" } = req.body;

      const result = await GoogleAdsService.syncTenantAdSpend(
        req.context.tenantId,
        customerId
      );

      res.status(200).json({
        success: true,
        message: "Google Ads PMax & Shopping spend synchronized successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
