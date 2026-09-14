import crypto from "crypto";

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "dummy_shopify_api_secret";

export class ShopifyWebhookService {
  /**
   * Verifies the authenticity of a Shopify webhook by checking x-shopify-hmac-sha256 header against raw body
   */
  static verifyWebhookHmac(rawBody: Buffer | undefined, hmacHeader: string | undefined): boolean {
    if (!rawBody || !hmacHeader) {
      return false;
    }

    const calculatedHmac = crypto
      .createHmac("sha256", SHOPIFY_API_SECRET)
      .update(rawBody)
      .digest("base64");

    try {
      return crypto.timingSafeEqual(Buffer.from(hmacHeader), Buffer.from(calculatedHmac));
    } catch {
      return false;
    }
  }
}
