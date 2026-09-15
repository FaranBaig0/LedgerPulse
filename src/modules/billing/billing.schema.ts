import { z } from "zod";

export const CreateSubscriptionSchema = z.object({
  shop: z.string().min(1, "Shop store identifier is required (e.g. example.myshopify.com)"),
  planTier: z.enum(["STARTER", "GROWTH", "SCALE", "ENTERPRISE", "BASIC", "PRO"]).default("GROWTH"),
  annual: z.boolean().optional().default(false)
});

export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
