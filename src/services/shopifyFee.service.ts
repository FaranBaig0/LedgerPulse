import crypto from "crypto";
import { ChannelPlatform, FeeType } from "@prisma/client";
import { prisma, getTenantPrisma } from "../lib/prisma.js";
import { decryptToken } from "../lib/encryption.js";

export interface ShopifyTransactionFeeLine {
  id?: string | number;
  amount: string;
  currency: string;
  type?: string;
  title?: string;
  amount_set?: {
    shop_money?: {
      amount: string;
      currency_code: string;
    };
    presentment_money?: {
      amount: string;
      currency_code: string;
    };
  };
}

export interface ShopifyTransactionItem {
  id: number | string;
  kind: string;
  status: string;
  gateway?: string;
  amount: string;
  currency: string;
  fee_lines?: ShopifyTransactionFeeLine[];
  receipt?: Record<string, unknown>;
  admin_graphql_api_id?: string;
}

export interface ShopifyTransactionsResponse {
  transactions?: ShopifyTransactionItem[];
}

export interface FetchShopifyFeesResult {
  settled: boolean;
  feesExtractedCount: number;
}

export class ShopifyFeeService {
  /**
   * Fetches exact transaction processor fees from Shopify REST API and upserts them into order_fees table.
   * Standardizes fee amounts to shop_money base currency and handles delayed fee_lines settlements.
   */
  static async fetchAndPersistFees(orderId: string, tenantId: string): Promise<FetchShopifyFeesResult> {
    const tenantPrisma = getTenantPrisma(tenantId);

    const order = await tenantPrisma.order.findFirst({
      where: {
        id: orderId,
        tenantId
      }
    });

    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: Order ${orderId} not found for tenant ${tenantId}`);
    }

    const channel = await tenantPrisma.channel.findFirst({
      where: {
        tenantId,
        platform: ChannelPlatform.SHOPIFY
      }
    });

    if (!channel || !channel.encryptedToken || channel.encryptedToken === "dummy_encrypted_token") {
      console.warn(`[ShopifyFeeService] Missing or mock credentials for tenant ${tenantId}. Skipping live API fetch.`);
      return { settled: true, feesExtractedCount: 0 };
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(channel.encryptedToken);
    } catch {
      console.warn(`[ShopifyFeeService] Unable to decrypt token for shop ${channel.storeIdentifier}`);
      return { settled: true, feesExtractedCount: 0 };
    }

    const shopDomain = channel.storeIdentifier;
    const url = `https://${shopDomain}/admin/api/2026-04/orders/${order.platformOrderId}/transactions.json`;

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SHOPIFY_TRANSACTIONS_FETCH_FAILED [${response.status}]: ${errorText}`);
    }

    const data = (await response.json()) as ShopifyTransactionsResponse;
    const transactions = data.transactions || [];

    let hasSuccessfulSaleOrCapture = false;
    let feeLinesCount = 0;
    const extractedFees: Array<{
      externalFeeId: string;
      feeType: FeeType;
      amountCents: number;
      currency: string;
      rawFeeDetails: Record<string, unknown>;
    }> = [];

    for (const txItem of transactions) {
      if (txItem.status !== "success") continue;

      if (txItem.kind === "sale" || txItem.kind === "capture") {
        hasSuccessfulSaleOrCapture = true;
      }

      // 1. Process fee_lines if available
      if (Array.isArray(txItem.fee_lines) && txItem.fee_lines.length > 0) {
        for (const feeLine of txItem.fee_lines) {
          feeLinesCount++;
          // Standardize on shop_money (store base currency)
          const rawAmount = feeLine.amount_set?.shop_money?.amount || feeLine.amount || "0.00";
          const rawCurrency = feeLine.amount_set?.shop_money?.currency_code || feeLine.currency || order.currency;
          
          let amountCents = Math.round(parseFloat(rawAmount) * 100);
          if (txItem.kind === "refund" && amountCents > 0) {
            amountCents = -amountCents; // Balance net fee for refunds
          }

          const externalFeeId = feeLine.id
            ? String(feeLine.id)
            : crypto.createHash("sha256").update(`${order.id}_GATEWAY_PROCESSING_${rawAmount}_${txItem.id}`).digest("hex").slice(0, 32);

          extractedFees.push({
            externalFeeId,
            feeType: FeeType.GATEWAY_PROCESSING,
            amountCents,
            currency: rawCurrency,
            rawFeeDetails: {
              transactionId: txItem.id,
              kind: txItem.kind,
              gateway: txItem.gateway,
              feeLine
            }
          });
        }
      } 
      // 2. Fallback to transaction receipt fee details if available
      else if (txItem.receipt && typeof txItem.receipt === "object") {
        const receiptObj = txItem.receipt as Record<string, unknown>;
        if (receiptObj.fee || receiptObj.fees_cents || receiptObj.processing_fee) {
          feeLinesCount++;
          const feeVal = receiptObj.fee || receiptObj.processing_fee;
          let amountCents = 0;
          if (typeof receiptObj.fees_cents === "number") {
            amountCents = receiptObj.fees_cents;
          } else if (typeof feeVal === "string" || typeof feeVal === "number") {
            amountCents = Math.round(parseFloat(String(feeVal)) * 100);
          }

          if (txItem.kind === "refund" && amountCents > 0) {
            amountCents = -amountCents;
          }

          const externalFeeId = String(txItem.id);
          extractedFees.push({
            externalFeeId,
            feeType: FeeType.GATEWAY_PROCESSING,
            amountCents,
            currency: order.currency,
            rawFeeDetails: {
              transactionId: txItem.id,
              kind: txItem.kind,
              gateway: txItem.gateway,
              receipt: txItem.receipt
            }
          });
        }
      }
    }

    // Shopify Payments Settlement Delay check:
    // If a successful sale/capture occurred but zero fee_lines or receipt fee details were present yet,
    // mark transaction as unsettled to trigger delayed retry.
    if (hasSuccessfulSaleOrCapture && feeLinesCount === 0) {
      console.log(`[ShopifyFeeService] Order ${order.platformOrderId} has transaction but fee_lines not settled yet. Requesting delayed retry.`);
      return { settled: false, feesExtractedCount: 0 };
    }

    // Persist extracted fees atomically into database using deterministic compound key
    await prisma.$transaction(async (tx) => {
      for (const fee of extractedFees) {
        await tx.orderFee.upsert({
          where: {
            orderId_feeType_externalFeeId: {
              orderId: order.id,
              feeType: fee.feeType,
              externalFeeId: fee.externalFeeId
            }
          },
          update: {
            amountCents: fee.amountCents,
            currency: fee.currency,
            rawFeeDetails: fee.rawFeeDetails as any
          },
          create: {
            orderId: order.id,
            feeType: fee.feeType,
            amountCents: fee.amountCents,
            currency: fee.currency,
            externalFeeId: fee.externalFeeId,
            rawFeeDetails: fee.rawFeeDetails as any
          }
        });
      }
    });

    console.log(`[ShopifyFeeService] Successfully persisted ${extractedFees.length} gateway fees for order ${order.id}`);
    return { settled: true, feesExtractedCount: extractedFees.length };
  }
}
