import crypto from "crypto";
import { ChannelPlatform } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { encryptToken } from "../../../lib/encryption.js";
import { generateOAuthState, verifyOAuthState } from "../../../lib/oauthState.js";
import { ShopifyCallbackQuery } from "./shopify.schema.js";

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || "dummy_api_key";
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "dummy_api_secret";
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || "http://localhost:4000";
const SHOPIFY_SCOPES = "read_orders,read_products";

export class ShopifyAuthService {
  /**
   * Builds the Shopify OAuth authorization redirect URL
   */
  static getAuthorizationUrl(shop: string, tenantId: string): string {
    const { state } = generateOAuthState({ tenantId, platform: "SHOPIFY" });
    const redirectUri = encodeURIComponent(`${SHOPIFY_APP_URL}/api/v1/auth/shopify/callback`);
    
    return `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SHOPIFY_SCOPES}&redirect_uri=${redirectUri}&state=${state}`;
  }

  /**
   * Verifies Shopify HMAC query signature
   */
  static verifyHmac(query: Record<string, string>): boolean {
    const { hmac, ...rest } = query;
    if (!hmac) return false;

    // Sort query keys alphabetically and construct string
    const message = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${rest[key]}`)
      .join("&");

    const calculatedHmac = crypto
      .createHmac("sha256", SHOPIFY_API_SECRET)
      .update(message)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(calculatedHmac));
    } catch {
      return false;
    }
  }

  /**
   * Handles Shopify OAuth callback, exchanges code for access token, encrypts token, and upserts channel record.
   */
  static async handleCallback(queryParams: ShopifyCallbackQuery): Promise<{ channelId: string; storeIdentifier: string }> {
    // 1. Verify HMAC
    const isValidHmac = this.verifyHmac(queryParams as Record<string, string>);
    if (!isValidHmac) {
      throw new Error("INVALID_HMAC_SIGNATURE");
    }

    // 2. Verify State
    const statePayload = verifyOAuthState(queryParams.state);
    if (statePayload.platform !== "SHOPIFY") {
      throw new Error("INVALID_PLATFORM_STATE");
    }

    const { tenantId } = statePayload;
    const { shop, code } = queryParams;

    // 3. Exchange code for access token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SHOPIFY_TOKEN_EXCHANGE_FAILED: ${errorText}`);
    }

    const tokenData = (await response.json()) as { access_token: string; scope: string };
    if (!tokenData.access_token) {
      throw new Error("SHOPIFY_TOKEN_MISSING");
    }

    // 4. Encrypt Access Token using AES-256-GCM
    const encryptedToken = encryptToken(tokenData.access_token);

    // 5. Upsert Channel record under tenantId
    const channel = await prisma.channel.upsert({
      where: {
        tenantId_platform_storeIdentifier: {
          tenantId,
          platform: ChannelPlatform.SHOPIFY,
          storeIdentifier: shop
        }
      },
      update: {
        encryptedToken,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        platform: ChannelPlatform.SHOPIFY,
        storeIdentifier: shop,
        encryptedToken,
        isActive: true
      }
    });

    return {
      channelId: channel.id,
      storeIdentifier: channel.storeIdentifier
    };
  }

  /**
   * Direct development/sandbox channel connection when live OAuth keys are not configured
   */
  static async connectDirect(tenantId: string, shop: string): Promise<{ channelId: string; storeIdentifier: string }> {
    const encryptedToken = encryptToken("dummy_shopify_access_token");

    const channel = await prisma.channel.upsert({
      where: {
        tenantId_platform_storeIdentifier: {
          tenantId,
          platform: ChannelPlatform.SHOPIFY,
          storeIdentifier: shop
        }
      },
      update: {
        encryptedToken,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        platform: ChannelPlatform.SHOPIFY,
        storeIdentifier: shop,
        encryptedToken,
        isActive: true
      }
    });

    return {
      channelId: channel.id,
      storeIdentifier: channel.storeIdentifier
    };
  }
}
