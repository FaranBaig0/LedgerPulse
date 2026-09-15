import { prisma, getTenantPrisma } from "../lib/prisma.js";

/**
 * ============================================================================
 * LEDGERPULSE FINANCIAL AGGREGATION SERVICE & ANALYTICS ENGINE
 * ============================================================================
 * Architecture Rules:
 * 1. Strict Integer Cents: All currency amounts are stored and calculated as integer
 *    cents (BigInt or number Cents) to eliminate floating-point rounding drift.
 * 2. Complete Reconciliation: Net Revenue = Gross - Discounts - Refunds.
 *    True Net Profit = Net Revenue - COGS - Platform Fees - Shipping Overhead - Total Ad Spend.
 * 3. Hybrid Ad Spend Attribution Model:
 *    - Direct Ad Spend: Explicit SKU tags in Google Shopping / Meta Ads.
 *    - Blended Allocated Ad Spend: General campaign spend allocated proportionally
 *      to SKUs based on their revenue contribution share.
 * 4. Division-by-Zero Safety: All financial ratios (POAS, ROAS, Net Margin %) check
 *    denominators and return 0.0 when zero.
 * ============================================================================
 */

export interface FinancialSummaryMetrics {
  grossRevenueCents: bigint;
  discountCents: bigint;
  refundCents: bigint;
  netRevenueCents: bigint;
  cogsCents: bigint;
  platformFeesCents: bigint;
  shippingOverheadCents: bigint;
  totalAdSpendCents: bigint;
  trueNetProfitCents: bigint;
  blendedPOAS: number;
  blendedROAS: number;
  netMarginPercentage: number;
  orderCount: number;
}

export interface SKUProfitabilityItem {
  sku: string;
  title: string;
  unitsSold: number;
  grossRevenueCents: bigint;
  cogsCents: bigint;
  platformFeesCents: bigint;
  directAdSpendCents: bigint;
  allocatedAdSpendCents: bigint;
  totalAdSpendCents: bigint;
  netProfitCents: bigint;
  netMarginPercentage: number;
  poas: number;
  roas: number;
}

export class FinancialEngineService {
  /**
   * Calculates comprehensive financial metrics for a tenant over a date range.
   * Reconciles Gross Revenue, Net Revenue, COGS, Fees, Outbound Shipping, Ad Spend, POAS & ROAS.
   */
  static async calculateFinancialSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FinancialSummaryMetrics> {
    const tenantPrisma = getTenantPrisma(tenantId);

    // Normalize date bounds to UTC start and end of day
    const startOfPeriod = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
    const endOfPeriod = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
    const startDateOnly = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const endDateOnly = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    // 1. Fetch Orders within date range with Line Items and Fees
    const orders = await tenantPrisma.order.findMany({
      where: {
        tenantId,
        orderDate: {
          gte: startOfPeriod,
          lte: endOfPeriod
        }
      },
      include: {
        lineItems: true,
        fees: true
      }
    });

    let grossRevenueCents = 0n;
    let discountCents = 0n;
    let refundCents = 0n;
    let cogsCents = 0n;
    let platformFeesCents = 0n;
    let shippingOverheadCents = 0n;

    for (const order of orders) {
      grossRevenueCents += BigInt(order.grossAmountCents);
      discountCents += BigInt(order.discountAmountCents || 0);
      refundCents += BigInt(order.refundAmountCents || 0);
      shippingOverheadCents += BigInt(order.shippingOverheadCents || 0);

      // Accumulate line item COGS
      for (const item of order.lineItems) {
        cogsCents += BigInt(item.quantity * item.cogsAtOrderCents);
      }

      // Accumulate itemized transaction & platform fees
      for (const fee of order.fees) {
        platformFeesCents += BigInt(fee.amountCents);
      }
    }

    // Net Revenue = Gross Sales - Discounts - Refunds
    const netRevenueCents = grossRevenueCents - discountCents - refundCents;

    // 2. Fetch total Ad Spend across all platforms (Meta, Google, TikTok) for date range
    const adSpendRecords = await tenantPrisma.adSpendDaily.findMany({
      where: {
        tenantId,
        date: {
          gte: startDateOnly,
          lte: endDateOnly
        }
      }
    });

    let totalAdSpendCents = 0n;
    for (const record of adSpendRecords) {
      totalAdSpendCents += BigInt(record.spendCents);
    }

    // 3. True Net Profit Calculation:
    // True Net Profit = Net Revenue - COGS - Platform Fees - Shipping Overhead - Total Ad Spend
    const trueNetProfitCents = netRevenueCents - cogsCents - platformFeesCents - shippingOverheadCents - totalAdSpendCents;

    // 4. Financial Ratios with Division-by-Zero Protection
    const adSpendNum = Number(totalAdSpendCents);
    const netRevenueNum = Number(netRevenueCents);
    const grossProfitNum = Number(netRevenueCents - cogsCents - platformFeesCents);

    // Blended POAS (Profit on Ad Spend) = (Net Revenue - COGS - Platform Fees) / Total Ad Spend
    const blendedPOAS = adSpendNum > 0 ? Number((grossProfitNum / adSpendNum).toFixed(2)) : 0.0;

    // Blended ROAS = Net Revenue / Total Ad Spend
    const blendedROAS = adSpendNum > 0 ? Number((netRevenueNum / adSpendNum).toFixed(2)) : 0.0;

    // Net Margin % = (True Net Profit / Net Revenue) * 100
    const netMarginPercentage = netRevenueNum > 0 ? Number(((Number(trueNetProfitCents) / netRevenueNum) * 100).toFixed(2)) : 0.0;

    return {
      grossRevenueCents,
      discountCents,
      refundCents,
      netRevenueCents,
      cogsCents,
      platformFeesCents,
      shippingOverheadCents,
      totalAdSpendCents,
      trueNetProfitCents,
      blendedPOAS,
      blendedROAS,
      netMarginPercentage,
      orderCount: orders.length
    };
  }

  /**
   * Generates a per-SKU unit economics & profitability breakdown.
   * Integrates Direct Ad Spend (SKU-linked) and Proportional Allocated Ad Spend (general campaign spend).
   */
  static async getSKUProfitabilityBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SKUProfitabilityItem[]> {
    const tenantPrisma = getTenantPrisma(tenantId);

    const startOfPeriod = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
    const endOfPeriod = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
    const startDateOnly = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const endDateOnly = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    // 1. Fetch Orders within date range
    const orders = await tenantPrisma.order.findMany({
      where: {
        tenantId,
        orderDate: {
          gte: startOfPeriod,
          lte: endOfPeriod
        }
      },
      include: {
        lineItems: true,
        fees: true
      }
    });

    // Aggregate Store Total Revenue and Platform Fees for proportional allocation
    let storeTotalGrossRevenueCents = 0n;
    let storeTotalFeesCents = 0n;

    for (const order of orders) {
      storeTotalGrossRevenueCents += BigInt(order.grossAmountCents);
      for (const fee of order.fees) {
        storeTotalFeesCents += BigInt(fee.amountCents);
      }
    }

    // 2. Group sales metrics by SKU
    interface SKUMapEntry {
      sku: string;
      title: string;
      unitsSold: number;
      grossRevenueCents: bigint;
      cogsCents: bigint;
    }

    const skuMap = new Map<string, SKUMapEntry>();

    for (const order of orders) {
      for (const item of order.lineItems) {
        const itemSku = item.sku || "UNKNOWN_SKU";
        const itemRevenueCents = BigInt(item.quantity * item.unitPriceCents - item.discountCents);
        const itemCogsCents = BigInt(item.quantity * item.cogsAtOrderCents);

        const existing = skuMap.get(itemSku);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.grossRevenueCents += itemRevenueCents;
          existing.cogsCents += itemCogsCents;
        } else {
          skuMap.set(itemSku, {
            sku: itemSku,
            title: item.title,
            unitsSold: item.quantity,
            grossRevenueCents: itemRevenueCents,
            cogsCents: itemCogsCents
          });
        }
      }
    }

    // 3. Fetch Ad Spend records for date range and partition into Direct vs General Unattributed
    const adSpendRecords = await tenantPrisma.adSpendDaily.findMany({
      where: {
        tenantId,
        date: {
          gte: startDateOnly,
          lte: endDateOnly
        }
      }
    });

    const directAdSpendBySKU = new Map<string, bigint>();
    let totalGeneralUnattributedAdSpendCents = 0n;

    for (const adRecord of adSpendRecords) {
      const spend = BigInt(adRecord.spendCents);
      if (adRecord.sku && adRecord.sku.trim() !== "") {
        const skuKey = adRecord.sku.trim();
        directAdSpendBySKU.set(skuKey, (directAdSpendBySKU.get(skuKey) || 0n) + spend);
      } else {
        totalGeneralUnattributedAdSpendCents += spend;
      }
    }

    // 4. Calculate SKU-level Economics with Proportional Ad Spend & Fees
    const storeRevenueNum = Number(storeTotalGrossRevenueCents);
    const storeFeesNum = Number(storeTotalFeesCents);
    const generalAdSpendNum = Number(totalGeneralUnattributedAdSpendCents);

    const report: SKUProfitabilityItem[] = [];

    for (const [sku, entry] of skuMap.entries()) {
      const skuRevenueNum = Number(entry.grossRevenueCents);
      const revenueShare = storeRevenueNum > 0 ? skuRevenueNum / storeRevenueNum : 0;

      // Proportional Fee Allocation
      const platformFeesCents = BigInt(Math.round(storeFeesNum * revenueShare));

      // Direct SKU Ad Spend
      const directAdSpendCents = directAdSpendBySKU.get(sku) || 0n;

      // Allocated General Campaign Spend based on revenue share
      const allocatedAdSpendCents = BigInt(Math.round(generalAdSpendNum * revenueShare));
      const totalAdSpendCents = directAdSpendCents + allocatedAdSpendCents;

      // SKU Net Profit
      const netProfitCents = entry.grossRevenueCents - entry.cogsCents - platformFeesCents - totalAdSpendCents;

      // Ratios
      const adSpendNum = Number(totalAdSpendCents);
      const grossProfitNum = Number(entry.grossRevenueCents - entry.cogsCents - platformFeesCents);

      const poas = adSpendNum > 0 ? Number((grossProfitNum / adSpendNum).toFixed(2)) : 0.0;
      const roas = adSpendNum > 0 ? Number((skuRevenueNum / adSpendNum).toFixed(2)) : 0.0;
      const netMarginPercentage = skuRevenueNum > 0 ? Number(((Number(netProfitCents) / skuRevenueNum) * 100).toFixed(2)) : 0.0;

      report.push({
        sku,
        title: entry.title,
        unitsSold: entry.unitsSold,
        grossRevenueCents: entry.grossRevenueCents,
        cogsCents: entry.cogsCents,
        platformFeesCents,
        directAdSpendCents,
        allocatedAdSpendCents,
        totalAdSpendCents,
        netProfitCents,
        netMarginPercentage,
        poas,
        roas
      });
    }

    // Sort report by Gross Revenue descending
    return report.sort((a, b) => Number(b.grossRevenueCents - a.grossRevenueCents));
  }

  /**
   * Materializes daily metrics into daily_metrics rollup table for fast O(1) dashboard loading.
   */
  static async rebuildDailyRollup(tenantId: string, dateInput: Date | string): Promise<void> {
    const targetDate = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth();
    const day = targetDate.getUTCDate();

    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    const dbDateOnly = new Date(Date.UTC(year, month, day));

    const summary = await this.calculateFinancialSummary(tenantId, startOfDay, endOfDay);

    await prisma.dailyMetric.upsert({
      where: {
        tenantId_date: {
          tenantId,
          date: dbDateOnly
        }
      },
      update: {
        grossRevenueCents: summary.grossRevenueCents,
        netRevenueCents: summary.netRevenueCents,
        netProfitCents: summary.trueNetProfitCents,
        totalCogsCents: summary.cogsCents,
        totalFeesCents: summary.platformFeesCents,
        shippingOverheadCents: summary.shippingOverheadCents,
        totalAdSpendCents: summary.totalAdSpendCents,
        orderCount: summary.orderCount
      },
      create: {
        tenantId,
        date: dbDateOnly,
        grossRevenueCents: summary.grossRevenueCents,
        netRevenueCents: summary.netRevenueCents,
        netProfitCents: summary.trueNetProfitCents,
        totalCogsCents: summary.cogsCents,
        totalFeesCents: summary.platformFeesCents,
        shippingOverheadCents: summary.shippingOverheadCents,
        totalAdSpendCents: summary.totalAdSpendCents,
        orderCount: summary.orderCount
      }
    });
  }
}
