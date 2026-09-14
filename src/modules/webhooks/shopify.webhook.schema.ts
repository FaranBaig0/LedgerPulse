import { z } from "zod";

export const ShopifyWebhookLineItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  sku: z.string().nullable().optional(),
  title: z.string(),
  quantity: z.number().int().positive(),
  price: z.string() // Shopify sends prices as strings e.g. "29.99"
});

export const ShopifyOrderWebhookPayloadSchema = z.object({
  id: z.union([z.number(), z.string()]),
  order_number: z.union([z.number(), z.string()]),
  total_price: z.string(),
  total_tax: z.string().optional().default("0.00"),
  total_shipping_price_set: z.object({
    shop_money: z.object({
      amount: z.string()
    })
  }).optional().nullable(),
  currency: z.string().length(3),
  created_at: z.string(),
  line_items: z.array(ShopifyWebhookLineItemSchema)
});

export type ShopifyWebhookLineItem = z.infer<typeof ShopifyWebhookLineItemSchema>;
export type ShopifyOrderWebhookPayload = z.infer<typeof ShopifyOrderWebhookPayloadSchema>;
