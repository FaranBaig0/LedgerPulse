import { getTenantPrisma } from "../../lib/prisma.js";

export interface UnderperformingSkuItem {
  sku: string;
  title: string;
  orders: number;
  revenue: number;
  cogs: number;
  fees: number;
  netProfit: number;
  marginPercent: number;
}

export interface DashboardSummary {
  netProfit: number;
  grossRevenue: number;
  totalCogs: number;
  totalFees: number;
  totalAdSpend: number;
  orderCount: number;
  trueMarginPercent: number;
  dailyMetrics: Array<{
    date: string;
    grossRevenue: number;
    netProfit: number;
    totalCogs: number;
    totalFees: number;
    orderCount: number;
  }>;
  underperformingSkus: UnderperformingSkuItem[];
}

export class AnalyticsService {
  /**
   * Fetches pre-aggregated O(1) daily metrics & real underperforming SKUs for tenant.
   */
  static async getDashboardMetrics(
    tenantId: string,
    startDateStr?: string,
    endDateStr?: string
  ): Promise<DashboardSummary> {
    const tenantPrisma = getTenantPrisma(tenantId);

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const startDate = startDateStr ? new Date(startDateStr) : thirtyDaysAgo;
    const endDate = endDateStr ? new Date(endDateStr) : now;

    // Fetch pre-aggregated records from daily_metrics
    const metrics = await tenantPrisma.dailyMetric.findMany({
      where: {
        tenantId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: "asc" }
    });

    let grossRevenueCents = 0n;
    let netProfitCents = 0n;
    let totalCogsCents = 0n;
    let totalFeesCents = 0n;
    let totalAdSpendCents = 0n;
    let orderCount = 0;

    const dailyBreakdown = metrics.map((m) => {
      grossRevenueCents += m.grossRevenueCents;
      netProfitCents += m.netProfitCents;
      totalCogsCents += m.totalCogsCents;
      totalFeesCents += m.totalFeesCents;
      totalAdSpendCents += m.totalAdSpendCents;
      orderCount += m.orderCount;

      return {
        date: m.date.toISOString().split("T")[0],
        grossRevenue: Number(m.grossRevenueCents) / 100,
        netProfit: Number(m.netProfitCents) / 100,
        totalCogs: Number(m.totalCogsCents) / 100,
        totalFees: Number(m.totalFeesCents) / 100,
        orderCount: m.orderCount
      };
    });

    const grossRevenueDollars = Number(grossRevenueCents) / 100;
    const netProfitDollars = Number(netProfitCents) / 100;
    const trueMarginPercent =
      grossRevenueDollars > 0 ? Number(((netProfitDollars / grossRevenueDollars) * 100).toFixed(2)) : 0;

    // Compute real underperforming SKUs for tenant from order_line_items
    const lineItems = await tenantPrisma.orderLineItem.findMany({
      where: {
        order: {
          tenantId
        }
      },
      include: {
        order: {
          include: {
            fees: true,
            lineItems: true
          }
        }
      }
    });

    // Group line items by SKU
    const skuMap = new Map<string, { sku: string; title: string; orders: number; revenueCents: number; cogsCents: number; feesCents: number }>();

    for (const item of lineItems) {
      const existing = skuMap.get(item.sku) || {
        sku: item.sku,
        title: item.title,
        orders: 0,
        revenueCents: 0,
        cogsCents: 0,
        feesCents: 0
      };

      existing.orders += item.quantity;
      existing.revenueCents += item.quantity * item.unitPriceCents;
      existing.cogsCents += item.quantity * item.cogsAtOrderCents;

      // Approximate pro-rated fee per line item
      const orderFeeTotal = item.order.fees.reduce((sum, f) => sum + f.amountCents, 0);
      existing.feesCents += Math.round(orderFeeTotal / (item.order.lineItems?.length || 1));

      skuMap.set(item.sku, existing);
    }

    const underperformingSkus: UnderperformingSkuItem[] = Array.from(skuMap.values())
      .map((item) => {
        const revenue = item.revenueCents / 100;
        const cogs = item.cogsCents / 100;
        const fees = item.feesCents / 100;
        const netProfit = revenue - (cogs + fees);
        const marginPercent = revenue > 0 ? Number(((netProfit / revenue) * 100).toFixed(2)) : 0;

        return {
          sku: item.sku,
          title: item.title,
          orders: item.orders,
          revenue,
          cogs,
          fees,
          netProfit,
          marginPercent
        };
      })
      .filter((item) => item.marginPercent < 15 || item.cogs === 0)
      .sort((a, b) => a.marginPercent - b.marginPercent)
      .slice(0, 10);

    return {
      netProfit: netProfitDollars,
      grossRevenue: grossRevenueDollars,
      totalCogs: Number(totalCogsCents) / 100,
      totalFees: Number(totalFeesCents) / 100,
      totalAdSpend: Number(totalAdSpendCents) / 100,
      orderCount,
      trueMarginPercent,
      dailyMetrics: dailyBreakdown,
      underperformingSkus
    };
  }
}
