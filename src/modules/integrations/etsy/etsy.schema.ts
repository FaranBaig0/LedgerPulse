import { z } from "zod";

export const EtsyCallbackQuerySchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().min(1, "State parameter is required")
});

export type EtsyCallbackQuery = z.infer<typeof EtsyCallbackQuerySchema>;
