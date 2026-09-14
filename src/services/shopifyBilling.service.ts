import { getTenantPrisma } from "../lib/prisma.js";
import { decryptToken } from "../lib/encryption.js";

export interface SubscriptionPlanDetails {
  name: string;
  priceAmount: number;
  currencyCode: "USD";
  trialDays: number;
}

export const BILLING_PLANS: Record<"BASIC" | "PRO", SubscriptionPlanDetails> = {
  BASIC: {
    name: "LedgerPulse Starter Plan",
    priceAmount: 29.0,
    currencyCode: "USD",
    trialDays: 14
  },
  PRO: {
    name: "LedgerPulse Growth Plan",
    priceAmount: 59.0,
    currencyCode: "USD",
    trialDays: 14
  }
};

const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || "http://localhost:4000";

export class ShopifyBillingService {
  /**
   * Triggers Shopify GraphQL appSubscriptionCreate mutation for $29/mo or $59/mo plan
   * with a 14-day trial period and returns the approval confirmationUrl.
   */
  static async createAppSubscription(
    tenantId: string,
    storeIdentifier: string,
    planTier: "BASIC" | "PRO"
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
    const plan = BILLING_PLANS[planTier];

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
      name: plan.name,
      returnUrl,
      test: process.env.NODE_ENV !== "production",
      trialDays: plan.trialDays,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: plan.priceAmount,
                currencyCode: plan.currencyCode
              },
              interval: "EVERY_30_DAYS"
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
      throw new Error(`SHOPIFY_BILLING_USER_ERROR: ${userErrors.map(e => e.message).join(", ")}`);
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
