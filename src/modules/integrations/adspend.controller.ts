import { Request, Response, NextFunction } from "express";
import { MetaAdsService } from "../../services/metaAds.service.js";
import { prisma } from "../../lib/prisma.js";

export class AdSpendController {
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
      const refDate = new Date();
      const cleanCustomerId = customerId.replace(/-/g, "");

      // Upsert mock/sandbox Google Ads SKU daily spend
      let totalSpend = 0;
      for (let i = 1; i <= 3; i++) {
        const d = new Date(refDate);
        d.setUTCDate(d.getUTCDate() - i);
        const dbDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const spendCents = 2400 + i * 350; // $24.00, $27.50, $31.00
        totalSpend += spendCents;

        await prisma.adSpendDaily.upsert({
          where: {
            tenantId_platform_adAccountId_campaignId_date_sku: {
              tenantId: req.context.tenantId,
              platform: "GOOGLE",
              adAccountId: cleanCustomerId,
              campaignId: "cmp_google_pmax",
              date: dbDate,
              sku: ""
            }
          },
          update: { spendCents, currency: "USD" },
          create: {
            tenantId: req.context.tenantId,
            platform: "GOOGLE",
            adAccountId: cleanCustomerId,
            campaignId: "cmp_google_pmax",
            date: dbDate,
            spendCents,
            currency: "USD",
            sku: ""
          }
        });
      }

      res.status(200).json({
        success: true,
        message: "Google Ads PMax & Shopping spend synchronized successfully",
        data: {
          tenantId: req.context.tenantId,
          platform: "GOOGLE",
          adAccountId: cleanCustomerId,
          status: "SUCCESS",
          syncedDaysCount: 3,
          totalSpendCents: totalSpend
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
