import { z } from "zod";

export const CreateSubscriptionSchema = z.object({
  shop: z.string().min(1, "Shop store identifier is required (e.g. example.myshopify.com)"),
  planTier: z.enum(["BASIC", "PRO"]).default("BASIC")
});

export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
