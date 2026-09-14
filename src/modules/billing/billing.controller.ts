import { Request, Response, NextFunction } from "express";
import { CreateSubscriptionSchema } from "./billing.schema.js";
import { ShopifyBillingService, BILLING_PLANS } from "../../services/shopifyBilling.service.js";

export class BillingController {
  /**
   * GET /api/v1/billing/plans
   * List available subscription plans ($29/mo and $59/mo with 14-day trial)
   */
  static getPlans(_req: Request, res: Response): void {
    res.status(200).json({
      success: true,
      data: Object.entries(BILLING_PLANS).map(([key, plan]) => ({
        tier: key,
        name: plan.name,
        price: plan.priceAmount,
        currency: plan.currencyCode,
        trialDays: plan.trialDays,
        features:
          key === "BASIC"
            ? [
                "Shopify & Etsy Automated Integration",
                "Real-Time Webhook Order Processing",
                "Historical COGS Snapshotting",
                "Automated Fee Breakdown Engine",
                "Executive Analytics Dashboard",
                "14-Day Risk-Free Trial"
              ]
            : [
                "Everything in Starter Plan",
                "Unlimited Order Volume Processing",
                "Multi-Store Channel Aggregation",
                "Bulk CSV Product COGS Management",
                "Priority Redis Ingestion Queue",
                "Hourly Automated Financial Rollup"
              ]
      }))
    });
  }

  /**
   * POST /api/v1/billing/subscribe
   * Creates recurring app charge via Shopify GraphQL API and returns confirmationUrl
   */
  static async subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { shop, planTier } = CreateSubscriptionSchema.parse(req.body);
      const result = await ShopifyBillingService.createAppSubscription(req.context.tenantId, shop, planTier);

      res.status(200).json({
        success: true,
        message: "Shopify recurring application charge initiated successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
