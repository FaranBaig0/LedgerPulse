import { z } from "zod";

export const DashboardQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export const TriggerAggregationBodySchema = z.object({
  date: z.string().optional()
});

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
export type TriggerAggregationBody = z.infer<typeof TriggerAggregationBodySchema>;
