import crypto from "crypto";
import { getTenantPrisma, prisma } from "../lib/prisma.js";

export interface PaddleCheckoutResult {
  clientToken: string;
  environment: string;
  checkoutUrl?: string;
  transactionId?: string;
  priceId?: string;
  planTier: string;
  amount: number;
  trialDays: number;
}

const PADDLE_PRICE_MAP: Record<string, { monthlyPriceId: string; annualPriceId: string; monthly: number; annual: number }> = {
  STARTER: {
    monthlyPriceId: "pri_01m2jbwbynrf5kfj0v6ck2qmnx",
    annualPriceId: "pri_01m2jbwc7jygtp5hcvyy2c23f6",
    monthly: 19,
    annual: 15
  },
  GROWTH: {
    monthlyPriceId: "pri_01m2jbwctqe0zjdmyg4afkn01c",
    annualPriceId: "pri_01m2jbwd4jetxt4y6c5n9xp965",
    monthly: 49,
    annual: 39
  },
  SCALE: {
    monthlyPriceId: "pri_01m2jbwdqktbfh8vjh0t91272y",
    annualPriceId: "pri_01m2jbwe0bvz0528m87d796f9e",
    monthly: 99,
    annual: 79
  },
  ENTERPRISE: {
    monthlyPriceId: "pri_01m2jbwemq25yyqykz8t17zbn1",
    annualPriceId: "pri_01m2jbwexj5x33hena6k7wd6jv",
    monthly: 199,
    annual: 159
  },
  BASIC: {
    monthlyPriceId: "pri_01m2jbwbynrf5kfj0v6ck2qmnx",
    annualPriceId: "pri_01m2jbwc7jygtp5hcvyy2c23f6",
    monthly: 19,
    annual: 15
  },
  PRO: {
    monthlyPriceId: "pri_01m2jbwctqe0zjdmyg4afkn01c",
    annualPriceId: "pri_01m2jbwd4jetxt4y6c5n9xp965",
    monthly: 49,
    annual: 39
  }
};

export class PaddleBillingService {
  /**
   * Generates real transaction on Paddle Sandbox API for STARTER, GROWTH, SCALE, or ENTERPRISE
   */
  static async createCheckoutSession(
    tenantId: string,
    planTier: string,
    isAnnual: boolean
  ): Promise<PaddleCheckoutResult> {
    const PADDLE_ENV = process.env.PADDLE_ENV || "sandbox";
    const PADDLE_CLIENT_TOKEN = process.env.PADDLE_CLIENT_TOKEN || "test_client_token";
    const PADDLE_API_KEY = process.env.PADDLE_API_KEY;

    const planConfig = PADDLE_PRICE_MAP[planTier] || PADDLE_PRICE_MAP.GROWTH;
    const priceId = isAnnual ? planConfig.annualPriceId : planConfig.monthlyPriceId;
    const amount = isAnnual ? planConfig.annual * 12 : planConfig.monthly;

    let checkoutUrl = "";
    let transactionId = "";

    // Call Paddle Sandbox API to create live draft transaction for selected plan
    if (PADDLE_API_KEY) {
      try {
        const res = await fetch("https://sandbox-api.paddle.com/transactions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${PADDLE_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            items: [
              {
                quantity: 1,
                price_id: priceId
              }
            ]
          })
        });

        if (res.ok) {
          const json = await res.json();
          transactionId = json.data?.id || "";
          checkoutUrl = json.data?.checkout?.url || "";
          console.log(`[Paddle API] Created live transaction for tier ${planTier}: ${transactionId} (Checkout URL: ${checkoutUrl})`);
        } else {
          const errJson = await res.json();
          console.error(`[Paddle API] Error creating transaction for tier ${planTier}:`, errJson);
        }
      } catch (err) {
        console.error(`[Paddle API] Fetch error for tier ${planTier}:`, err);
      }
    }

    // Persist chosen plan tier in PostgreSQL database for this tenant
    try {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { planTier: planTier.toUpperCase(), subscriptionStatus: "TRIALING" }
      });
    } catch (dbErr) {
      console.error("[Paddle DB Error] Failed to update tenant planTier:", dbErr);
    }

    return {
      clientToken: PADDLE_CLIENT_TOKEN,
      environment: PADDLE_ENV,
      checkoutUrl,
      transactionId,
      priceId,
      planTier,
      amount,
      trialDays: 14
    };
  }

  /**
   * Activates a subscription in LedgerPulse DB after successful Paddle Checkout / Webhook
   */
  static async activateSubscription(tenantId: string, planTier: string): Promise<void> {
    try {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { planTier: planTier.toUpperCase(), subscriptionStatus: "ACTIVE" }
      });
      console.log(`[Paddle DB] Subscription activated for tenant ${tenantId} on tier ${planTier}`);
    } catch (err) {
      console.error(`[Paddle DB Error] Failed activating subscription for tenant ${tenantId}:`, err);
    }
  }
}
