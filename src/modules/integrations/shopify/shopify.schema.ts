import { z } from "zod";

export const ShopifyInitOAuthQuerySchema = z.object({
  shop: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/, "Invalid Shopify shop domain format. Must be example.myshopify.com")
});

export const ShopifyCallbackQuerySchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  hmac: z.string().min(1, "HMAC signature is required"),
  shop: z.string().min(1, "Shop parameter is required"),
  state: z.string().min(1, "State parameter is required"),
  timestamp: z.string().optional()
});

export type ShopifyInitOAuthQuery = z.infer<typeof ShopifyInitOAuthQuerySchema>;
export type ShopifyCallbackQuery = z.infer<typeof ShopifyCallbackQuerySchema>;
