import { prisma, getTenantPrisma } from "../lib/prisma.js";

export interface DailyAggregationResult {
  tenantId: string;
  date: string;
  grossRevenueCents: bigint;
  netProfitCents: bigint;
  totalCogsCents: bigint;
  totalFeesCents: bigint;
  totalAdSpendCents: bigint;
  orderCount: number;
}

export class AggregationService {
  /**
   * Aggregates revenue, COGS, platform fees, and net profit for a single tenant on a specific date.
   * Uses strict integer math and upserts into daily_metrics for instant O(1) rendering.
   */
  static async aggregateTenantDailyMetrics(tenantId: string, dateInput: Date | string): Promise<DailyAggregationResult> {
    const targetDate = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    
    // Construct UTC start of day and end of day
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth();
    const day = targetDate.getUTCDate();

    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    const dbDateOnly = new Date(Date.UTC(year, month, day));

    const tenantPrisma = getTenantPrisma(tenantId);

    // 1. Fetch all orders for tenant on date
    const orders = await tenantPrisma.order.findMany({
      where: {
        tenantId,
        orderDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        lineItems: true,
        fees: true
      }
    });

    const orderCount = orders.length;

    // 2. Sum Gross Revenue, COGS, and Platform Fees (in cents)
    let grossRevenueCents = 0n;
    let totalCogsCents = 0n;
    let totalFeesCents = 0n;

    for (const order of orders) {
      grossRevenueCents += BigInt(order.grossAmountCents);

      // Sum line item COGS
      for (const item of order.lineItems) {
        totalCogsCents += BigInt(item.quantity * item.cogsAtOrderCents);
      }

      // Sum order fees
      for (const fee of order.fees) {
        totalFeesCents += BigInt(fee.amountCents);
      }
    }

    // 3. Query Ad Spend from ad_spend_daily for this tenant on date
    const adSpendRecords = await tenantPrisma.adSpendDaily.findMany({
      where: {
        tenantId,
        date: dbDateOnly
      }
    });

    let totalAdSpendCents = 0n;
    for (const adRecord of adSpendRecords) {
      totalAdSpendCents += BigInt(adRecord.spendCents);
    }

    // True Net Profit Formula: GrossRevenue - (TotalCOGS + TotalFees + TotalAdSpend)
    const netProfitCents = grossRevenueCents - (totalCogsCents + totalFeesCents + totalAdSpendCents);

    // 3. Upsert into daily_metrics table
    const metric = await prisma.dailyMetric.upsert({
      where: {
        tenantId_date: {
          tenantId,
          date: dbDateOnly
        }
      },
      update: {
        grossRevenueCents,
        netProfitCents,
        totalCogsCents,
        totalFeesCents,
        totalAdSpendCents,
        orderCount
      },
      create: {
        tenantId,
        date: dbDateOnly,
        grossRevenueCents,
        netProfitCents,
        totalCogsCents,
        totalFeesCents,
        totalAdSpendCents,
        orderCount
      }
    });

    return {
      tenantId: metric.tenantId,
      date: startOfDay.toISOString().split("T")[0],
      grossRevenueCents: metric.grossRevenueCents,
      netProfitCents: metric.netProfitCents,
      totalCogsCents: metric.totalCogsCents,
      totalFeesCents: metric.totalFeesCents,
      totalAdSpendCents: metric.totalAdSpendCents,
      orderCount: metric.orderCount
    };
  }

  /**
   * Triggers daily metrics aggregation for all registered tenants
   */
  static async aggregateAllTenants(dateInput?: Date | string): Promise<number> {
    const targetDate = dateInput ? (typeof dateInput === "string" ? new Date(dateInput) : dateInput) : new Date();
    const tenants = await prisma.tenant.findMany({ select: { id: true } });

    for (const tenant of tenants) {
      await this.aggregateTenantDailyMetrics(tenant.id, targetDate);
    }

    return tenants.length;
  }
}
