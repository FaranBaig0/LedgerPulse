import { Request, Response, NextFunction } from "express";
import { CreateSubscriptionSchema } from "./billing.schema.js";
import { ShopifyBillingService, BILLING_PLANS, PlanTierKey } from "../../services/shopifyBilling.service.js";
import { PaddleBillingService } from "../../services/paddleBilling.service.js";
import { prisma } from "../../lib/prisma.js";

export class BillingController {
  /**
   * GET /api/v1/billing/plans
   * List 4-tier subscription matrix and key capabilities
   */
  static getPlans(_req: Request, res: Response): void {
    const primaryTiers: PlanTierKey[] = ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"];

    res.status(200).json({
      success: true,
      data: primaryTiers.map((key) => {
        const plan = BILLING_PLANS[key];
        return {
          tier: key,
          name: plan.name,
          targetMerchant: plan.targetMerchant,
          priceMonthly: plan.priceMonthly,
          priceAnnualMonthly: plan.priceAnnualMonthly,
          orderLimit: plan.orderLimit,
          channelsLimit: plan.channelsLimit,
          keyCapabilities: plan.keyCapabilities,
          cogsComplexity: plan.cogsComplexity,
          historicalData: plan.historicalData,
          adSpendSync: plan.adSpendSync,
          overageRate: plan.overageRate,
          currency: plan.currencyCode,
          trialDays: plan.trialDays
        };
      })
    });
  }

  /**
   * POST /api/v1/billing/subscribe
   * Creates recurring app charge via Shopify GraphQL API
   */
  static async subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { shop, planTier, annual } = CreateSubscriptionSchema.parse(req.body);
      const result = await ShopifyBillingService.createAppSubscription(req.context.tenantId, shop, planTier as PlanTierKey, annual);

      res.status(200).json({
        success: true,
        message: "Shopify recurring application charge initiated successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/billing/paddle/checkout
   * Generates Paddle Billing Sandbox checkout session payload
   */
  static async createPaddleCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { planTier = "GROWTH", annual = false } = req.body;
      const checkoutData = await PaddleBillingService.createCheckoutSession(req.context.tenantId, planTier, annual);

      res.status(200).json({
        success: true,
        message: "Paddle Sandbox checkout session initialized",
        data: checkoutData
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/billing/subscription
   * Returns current tenant's active plan tier and subscription status from database
   */
  static async getTenantSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: req.context.tenantId },
        select: {
          id: true,
          planTier: true,
          subscriptionStatus: true
        }
      });

      res.status(200).json({
        success: true,
        data: {
          planTier: tenant?.planTier || "STARTER",
          subscriptionStatus: tenant?.subscriptionStatus || "TRIALING"
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

