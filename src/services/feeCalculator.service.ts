import { ChannelPlatform, FeeType } from "@prisma/client";
import { prisma, getTenantPrisma } from "../lib/prisma.js";

export interface FeeBreakdownItem {
  feeType: FeeType;
  amountCents: number;
  currency: string;
}

export interface CalculatedFeesResult {
  orderId: string;
  totalFeesCents: number;
  fees: FeeBreakdownItem[];
}

export class FeeCalculatorService {
  /**
   * Calculates platform deduction fees using strict integer arithmetic in cents
   * and persists fee breakdown into order_fees table under tenantId.
   */
  static async calculateAndPersistOrderFees(
    orderId: string,
    tenantId: string,
    platform: ChannelPlatform
  ): Promise<CalculatedFeesResult> {
    const tenantPrisma = getTenantPrisma(tenantId);

    const order = await tenantPrisma.order.findFirst({
      where: {
        id: orderId,
        tenantId
      },
      include: {
        lineItems: true
      }
    });

    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: Order ${orderId} not found for tenant ${tenantId}`);
    }

    const calculatedFees: FeeBreakdownItem[] = [];

    if (platform === ChannelPlatform.ETSY) {
      const lineItemsGrossCents = order.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPriceCents,
        0
      );
      const shippingChargedCents = order.shippingChargedCents;
      const grossChargedCents = order.grossAmountCents;

      // 1. Transaction Fee: 6.5% of (Gross Line Items + Shipping)
      const transactionFeeCents = Math.round(((lineItemsGrossCents + shippingChargedCents) * 65) / 1000);
      calculatedFees.push({
        feeType: FeeType.TRANSACTION,
        amountCents: transactionFeeCents,
        currency: order.currency
      });

      // 2. Listing Fee: Fixed 20 cents per quantity sold
      const totalQuantity = order.lineItems.reduce((sum, item) => sum + item.quantity, 0);
      const listingFeeCents = totalQuantity * 20;
      calculatedFees.push({
        feeType: FeeType.LISTING,
        amountCents: listingFeeCents,
        currency: order.currency
      });

      // 3. Payment Processing Fee: 3% + 25 cents on gross charged amount
      const paymentProcessingFeeCents = Math.round((grossChargedCents * 3) / 100) + 25;
      calculatedFees.push({
        feeType: FeeType.PAYMENT_PROCESSING,
        amountCents: paymentProcessingFeeCents,
        currency: order.currency
      });
    } else if (platform === ChannelPlatform.SHOPIFY) {
      const grossChargedCents = order.grossAmountCents;

      // Shopify Payment Processing Fee: 2.9% + 30 cents on gross charged amount
      const paymentProcessingFeeCents = Math.round((grossChargedCents * 29) / 1000) + 30;
      calculatedFees.push({
        feeType: FeeType.PAYMENT_PROCESSING,
        amountCents: paymentProcessingFeeCents,
        currency: order.currency
      });
    }

    const totalFeesCents = calculatedFees.reduce((sum, fee) => sum + fee.amountCents, 0);

    // Replace order fees inside transaction
    await prisma.$transaction(async (tx) => {
      await tx.orderFee.deleteMany({
        where: { orderId: order.id }
      });

      for (const fee of calculatedFees) {
        await tx.orderFee.create({
          data: {
            orderId: order.id,
            feeType: fee.feeType,
            amountCents: fee.amountCents,
            currency: fee.currency
          }
        });
      }
    });

    return {
      orderId: order.id,
      totalFeesCents,
      fees: calculatedFees
    };
  }
}
