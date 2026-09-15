import { getTenantPrisma } from "../lib/prisma.js";
import { decryptToken } from "../lib/encryption.js";

export interface SubscriptionPlanDetails {
  name: string;
  targetMerchant: string;
  priceMonthly: number;
  priceAnnualMonthly: number;
  orderLimit: number;
  channelsLimit: string;
  keyCapabilities: string[];
  cogsComplexity: string;
  historicalData: string;
  adSpendSync: string;
  overageRate: string;
  currencyCode: "USD";
  trialDays: number;
}

export type PlanTierKey = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE" | "BASIC" | "PRO";

export const BILLING_PLANS: Record<PlanTierKey, SubscriptionPlanDetails> = {
  STARTER: {
    name: "Starter Plan",
    targetMerchant: "Side-hustle / Launching",
    priceMonthly: 19.0,
    priceAnnualMonthly: 15.0,
    orderLimit: 200,
    channelsLimit: "1 Store (Shopify or Etsy)",
    keyCapabilities: [
      "Static COGS Management",
      "Shopify & Etsy Transaction Fee Extraction",
      "30-Day Financial Reporting History",
      "14-Day Free Trial (No Card Required)"
    ],
    cogsComplexity: "Standard Static Unit Cost",
    historicalData: "30 Days History",
    adSpendSync: "Basic Fee Extraction",
    overageRate: "$10 / 500 extra orders",
    currencyCode: "USD",
    trialDays: 14
  },
  GROWTH: {
    name: "Growth Plan",
    targetMerchant: "Scaling DTC / Multi-channel",
    priceMonthly: 49.0,
    priceAnnualMonthly: 39.0,
    orderLimit: 1000,
    channelsLimit: "Up to 3 Channels (Shopify + Etsy)",
    keyCapabilities: [
      "Everything in Starter Plan",
      "FIFO Batch Inventory Depletion",
      "Meta Ad Spend Sync & Blended POAS",
      "1-Year Financial Reporting History",
      "Fair Overage Protection ($10/500 orders)"
    ],
    cogsComplexity: "Full FIFO Dynamic Batch Depletion",
    historicalData: "1 Year History",
    adSpendSync: "Automated Meta Ads Spend Sync",
    overageRate: "$10 / 500 extra orders",
    currencyCode: "USD",
    trialDays: 14
  },
  SCALE: {
    name: "Scale Plan",
    targetMerchant: "Established Brands",
    priceMonthly: 99.0,
    priceAnnualMonthly: 79.0,
    orderLimit: 3000,
    channelsLimit: "Up to 6 Channels",
    keyCapabilities: [
      "Everything in Growth Plan",
      "Google Ads (PMax/Shopping SKU spend)",
      "Multi-Currency / FX Automatic Conversion",
      "Raw Financial Data CSV Export",
      "Priority Redis Ingestion Sync"
    ],
    cogsComplexity: "Advanced FIFO & Multi-location Overhead",
    historicalData: "Multi-Year Trend Analysis",
    adSpendSync: "Meta & Google Ads SKU Spend Sync",
    overageRate: "$10 / 500 extra orders",
    currencyCode: "USD",
    trialDays: 14
  },
  ENTERPRISE: {
    name: "Enterprise Plan",
    targetMerchant: "7-Figure Operations",
    priceMonthly: 199.0,
    priceAnnualMonthly: 159.0,
    orderLimit: 5000,
    channelsLimit: "Unlimited Channels",
    keyCapabilities: [
      "Everything in Scale Plan",
      "Custom Batch FIFO Overrides",
      "Hourly Scheduled Syncs",
      "Dedicated BullMQ Worker Queues",
      "24/7 VIP Priority Support & SLA"
    ],
    cogsComplexity: "Custom Batch FIFO Overrides & ERP Sync",
    historicalData: "Unlimited Multi-Year Lifetime Access",
    adSpendSync: "Custom Ad Network & Omnichannel Sync",
    overageRate: "Custom Fair Overages",
    currencyCode: "USD",
    trialDays: 14
  },

  // Backward compatibility aliases
  BASIC: {
    name: "Starter Plan",
    targetMerchant: "Side-hustle / Launching",
    priceMonthly: 19.0,
    priceAnnualMonthly: 15.0,
    orderLimit: 200,
    channelsLimit: "1 Store (Shopify or Etsy)",
    keyCapabilities: [
      "Static COGS Management",
      "Shopify & Etsy Transaction Fee Extraction",
      "30-Day Financial Reporting History",
      "14-Day Free Trial (No Card Required)"
    ],
    cogsComplexity: "Standard Static Unit Cost",
    historicalData: "30 Days History",
    adSpendSync: "Basic Fee Extraction",
    overageRate: "$10 / 500 extra orders",
    currencyCode: "USD",
    trialDays: 14
  },
  PRO: {
    name: "Growth Plan",
    targetMerchant: "Scaling DTC / Multi-channel",
    priceMonthly: 49.0,
    priceAnnualMonthly: 39.0,
    orderLimit: 1000,
    channelsLimit: "Up to 3 Channels (Shopify + Etsy)",
    keyCapabilities: [
      "Everything in Starter Plan",
      "FIFO Batch Inventory Depletion",
      "Meta Ad Spend Sync & Blended POAS",
      "1-Year Financial Reporting History",
      "Fair Overage Protection ($10/500 orders)"
    ],
    cogsComplexity: "Full FIFO Dynamic Batch Depletion",
    historicalData: "1 Year History",
    adSpendSync: "Automated Meta Ads Spend Sync",
    overageRate: "$10 / 500 extra orders",
    currencyCode: "USD",
    trialDays: 14
  }
};

const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || "http://localhost:4000";

export class ShopifyBillingService {
  /**
   * Triggers Shopify GraphQL appSubscriptionCreate mutation for tier plans
   * with a 14-day trial period and returns the approval confirmationUrl.
   */
  static async createAppSubscription(
    tenantId: string,
    storeIdentifier: string,
    planTier: PlanTierKey = "GROWTH",
    isAnnual: boolean = false
  ): Promise<{ confirmationUrl: string; subscriptionId: string }> {
    const tenantPrisma = getTenantPrisma(tenantId);

    // 1. Fetch channel record for store under tenantId
    const channel = await tenantPrisma.channel.findFirst({
      where: {
        tenantId,
        platform: "SHOPIFY",
        storeIdentifier
      }
    });

    if (!channel || !channel.encryptedToken) {
      throw new Error("SHOPIFY_CHANNEL_NOT_FOUND: Active Shopify channel connection required for billing.");
    }

    // 2. Decrypt access token using AES-256-GCM
    const accessToken = decryptToken(channel.encryptedToken);
    const plan = BILLING_PLANS[planTier] || BILLING_PLANS.GROWTH;
    const priceAmount = isAnnual ? plan.priceAnnualMonthly : plan.priceMonthly;

    const graphqlUrl = `https://${storeIdentifier}/admin/api/2024-04/graphql.json`;
    const returnUrl = `${SHOPIFY_APP_URL}/billing/callback?shop=${storeIdentifier}&tenantId=${tenantId}`;

    const graphqlQuery = `
      mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean, $trialDays: Int) {
        appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, test: $test, trialDays: $trialDays) {
          userErrors {
            field
            message
          }
          confirmationUrl
          appSubscription {
            id
            status
          }
        }
      }
    `;

    const variables = {
      name: `${plan.name} (${isAnnual ? "Annual Billing" : "Monthly Billing"})`,
      returnUrl,
      test: process.env.NODE_ENV !== "production",
      trialDays: plan.trialDays,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: priceAmount,
                currencyCode: plan.currencyCode
              },
              interval: isAnnual ? "ANNUAL" : "EVERY_30_DAYS"
            }
          }
        }
      ]
    };

    // 3. Post GraphQL mutation to Shopify Admin API
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query: graphqlQuery, variables })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SHOPIFY_GRAPHQL_ERROR: HTTP ${response.status} - ${errorText}`);
    }

    const json = (await response.json()) as {
      data?: {
        appSubscriptionCreate?: {
          userErrors?: Array<{ field: string[]; message: string }>;
          confirmationUrl?: string;
          appSubscription?: { id: string; status: string };
        };
      };
    };

    const userErrors = json.data?.appSubscriptionCreate?.userErrors;
    if (userErrors && userErrors.length > 0) {
      throw new Error(`SHOPIFY_BILLING_USER_ERROR: ${userErrors.map((e) => e.message).join(", ")}`);
    }

    const confirmationUrl = json.data?.appSubscriptionCreate?.confirmationUrl;
    const subscriptionId = json.data?.appSubscriptionCreate?.appSubscription?.id;

    if (!confirmationUrl || !subscriptionId) {
      throw new Error("SHOPIFY_BILLING_MISSING_CONFIRMATION_URL");
    }

    return {
      confirmationUrl,
      subscriptionId
    };
  }
}
