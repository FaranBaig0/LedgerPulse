import { Request, Response, NextFunction } from "express";
import { DashboardQuerySchema, TriggerAggregationBodySchema } from "./analytics.schema.js";
import { AnalyticsService } from "./analytics.service.js";
import { AggregationService } from "../../services/aggregation.service.js";

export class AnalyticsController {
  /**
   * GET /api/v1/analytics/dashboard
   * Returns executive summary & daily metrics timeseries for tenant
   */
  static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { startDate, endDate } = DashboardQuerySchema.parse(req.query);
      const summary = await AnalyticsService.getDashboardMetrics(req.context.tenantId, startDate, endDate);

      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/analytics/trigger-aggregation
   * Manually triggers daily aggregation for tenant
   */
  static async triggerAggregation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.context?.tenantId) {
        res.status(401).json({ error: "UNAUTHORIZED", message: "Missing tenant context" });
        return;
      }

      const { date } = TriggerAggregationBodySchema.parse(req.body);
      const targetDate = date ? new Date(date) : new Date();

      const result = await AggregationService.aggregateTenantDailyMetrics(req.context.tenantId, targetDate);

      res.status(200).json({
        success: true,
        message: `Metrics aggregated successfully for date ${result.date}`,
        data: {
          ...result,
          grossRevenueCents: result.grossRevenueCents.toString(),
          netProfitCents: result.netProfitCents.toString(),
          totalCogsCents: result.totalCogsCents.toString(),
          totalFeesCents: result.totalFeesCents.toString(),
          totalAdSpendCents: result.totalAdSpendCents.toString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
